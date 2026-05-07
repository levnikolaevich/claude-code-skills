import { Composer, type Context } from "grammy";
import type { Logger } from "../../lib/logger.js";
import type { SessionService } from "../../services/session.service.js";
import type { ControlLane } from "../../services/controlLane.service.js";
import type { MutexMap } from "../../lib/mutex.js";
import type { GodRuntimeService } from "../../services/godRuntime.service.js";
import { TIMING } from "../../config/paths.js";
import { detailKeyboard, safeEditMenu, successKeyboard, type MenuScreen } from "./kb.js";
import { renderSessionsList } from "./sessions.js";
import { truncate } from "../../domain/events.js";

export interface SessionsCallbackDeps {
  log: Logger;
  sessionService: SessionService;
  controlLane: ControlLane;
  sessionLocks: MutexMap;
  godRuntime: GodRuntimeService;
}

const SLUG_DISPLAY_MAX = 32;

function fmtTs(epoch: number): string {
  const d = new Date(epoch * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}

function loadList(deps: SessionsCallbackDeps, ownerId: number): MenuScreen {
  const sessions = deps.sessionService.listSessions({
    ownerUserId: ownerId,
    limit: TIMING.maxMenuItems,
  });
  const total = deps.sessionService.listSessions({
    ownerUserId: ownerId,
    limit: null,
  }).length;
  return renderSessionsList({ sessions, ownerId, totalCount: total });
}

function detailScreen(args: {
  sid: string;
  ownerId: number;
  slug: string;
  ts: number;
}): MenuScreen {
  const text =
    `📂 ${truncate(args.slug, SLUG_DISPLAY_MAX)}\n` +
    `last: ${fmtTs(args.ts)}\n` +
    `id: ${args.sid}`;
  return {
    text,
    keyboard: detailKeyboard({
      actions: [
        { label: "▶ Resume", callbackData: `s_run:${args.sid}` },
        { label: "🗑 Delete", callbackData: `s_del:${args.sid}` },
      ],
      backAction: `s_back:${args.ownerId}`,
    }),
  };
}

function successScreen(args: { ownerId: number; text: string }): MenuScreen {
  return {
    text: args.text,
    keyboard: successKeyboard(`s_back:${args.ownerId}`),
  };
}

function expiredScreen(ownerId: number): MenuScreen {
  return {
    text: "✗ Session no longer available.",
    keyboard: successKeyboard(`s_back:${ownerId}`),
  };
}

export function buildSessionsCallbackHandler(deps: SessionsCallbackDeps): Composer<Context> {
  const c = new Composer<Context>();

  // List & back: owner-bound refresh of the list screen.
  c.callbackQuery(/^s_(list|back):/, async (ctx) => {
    const data = ctx.callbackQuery.data ?? "";
    const colon = data.indexOf(":");
    const ownerId = Number.parseInt(data.slice(colon + 1), 10);
    if (!Number.isFinite(ownerId)) {
      await ctx.answerCallbackQuery({ text: "malformed", show_alert: true });
      return;
    }
    if (ctx.from?.id !== ownerId) {
      // Cross-actor tap: do not edit the message; just nack.
      await ctx.answerCallbackQuery({ text: "not your menu", show_alert: false });
      return;
    }
    const screen = loadList(deps, ownerId);
    await safeEditMenu(ctx, screen, { log: deps.log });
  });

  // View: drill into detail screen for a single session.
  c.callbackQuery(/^s_view:/, async (ctx) => {
    const data = ctx.callbackQuery.data ?? "";
    const sid = data.slice("s_view:".length);
    const owner = deps.sessionService.getOwner(sid);
    const fromId = ctx.from?.id ?? null;
    if (owner === null) {
      await safeEditMenu(ctx, expiredScreen(fromId ?? deps.sessionService.primaryOperator), {
        log: deps.log,
      });
      return;
    }
    if (fromId !== owner) {
      await ctx.answerCallbackQuery({ text: "not your session", show_alert: false });
      return;
    }
    const path = deps.sessionService.validateSessionPath(sid, owner);
    if (path === null) {
      await safeEditMenu(ctx, expiredScreen(owner), { log: deps.log });
      return;
    }
    // Re-fetch metadata for the slug/timestamp from the list — cheap enough.
    const item = deps.sessionService
      .listSessions({ ownerUserId: owner, limit: null })
      .find((s) => s.sid === sid);
    if (item === undefined) {
      await safeEditMenu(ctx, expiredScreen(owner), { log: deps.log });
      return;
    }
    await safeEditMenu(ctx, detailScreen({ sid, ownerId: owner, slug: item.slug, ts: item.ts }), {
      log: deps.log,
    });
  });

  // Resume / Delete: existing actions, now followed by an edit-in-place success
  // screen with a Back button. Legacy regex `s_run:` / `s_del:` is preserved so
  // pre-redesign card buttons continue to work.
  c.callbackQuery(/^s_(run|del):/, async (ctx) => {
    const data = ctx.callbackQuery.data ?? "";
    const colon = data.indexOf(":");
    if (colon === -1) {
      await ctx.answerCallbackQuery({ text: "malformed", show_alert: true });
      return;
    }
    const action = data.slice(0, colon);
    const sid = data.slice(colon + 1);

    const owner = deps.sessionService.getOwner(sid);
    if (owner === null) {
      deps.log.warn({ sid }, "session has no owner; refusing");
      await ctx.answerCallbackQuery({
        text: "session ownership unknown",
        show_alert: true,
      });
      return;
    }
    const path = deps.sessionService.validateSessionPath(sid, owner);
    if (path === null) {
      await safeEditMenu(ctx, expiredScreen(owner), { log: deps.log });
      return;
    }
    const fromId = ctx.from?.id ?? null;
    if (fromId !== owner) {
      deps.log.warn(
        { fromId, owner, sid, action },
        "user tried to act on other's session — rejected"
      );
      await ctx.answerCallbackQuery({ text: "not your session", show_alert: true });
      return;
    }

    await deps.sessionLocks.for(sid).run(action, async () => {
      const stillThere = deps.sessionService.validateSessionPath(sid, owner);
      if (stillThere === null) {
        await safeEditMenu(ctx, expiredScreen(owner), { log: deps.log });
        return;
      }

      if (action === "s_run") {
        try {
          await deps.controlLane.run("resume_session", async () => {
            if (fromId === null) throw new Error("missing Telegram user id");
            const runtime = deps.godRuntime.runtimeFor(fromId);
            if (!runtime.ok) throw new Error(runtime.error.message);
            runtime.value.atomicCmd.write("resume", sid, fromId);
            if (await runtime.value.pane.hasSession()) {
              await runtime.value.pane.killGracefully();
            } else {
              const started = await deps.godRuntime.ensureStarted(fromId);
              if (!started.ok) throw new Error(started.error.message);
            }
          });
        } catch (error) {
          deps.log.error({ err: String(error) }, "write_command_atomic resume failed");
          await ctx.answerCallbackQuery({ text: `failed: ${String(error)}`, show_alert: true });
          return;
        }
        deps.log.info({ sid, userId: fromId }, "[Resume] queued");
        await safeEditMenu(
          ctx,
          successScreen({
            ownerId: owner,
            text: `🔄 Resuming ${sid.slice(0, 8)}… — pane will reload in ~5–10s.`,
          }),
          { log: deps.log }
        );
      } else if (action === "s_del") {
        await deps.controlLane.run("delete_session", () => {
          deps.sessionService.deleteSessionFile(sid);
          return Promise.resolve();
        });
        deps.log.info({ sid }, "[Delete] removed");
        await safeEditMenu(
          ctx,
          successScreen({ ownerId: owner, text: `✓ Deleted ${sid.slice(0, 8)}…` }),
          { log: deps.log }
        );
      } else {
        await ctx.answerCallbackQuery({ text: "unknown action", show_alert: true });
      }
    });
  });

  return c;
}

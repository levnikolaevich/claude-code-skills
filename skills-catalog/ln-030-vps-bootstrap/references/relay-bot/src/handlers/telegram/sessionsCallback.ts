import { Composer, type Context } from "grammy";
import type { Logger } from "../../lib/logger.js";
import type { SessionService } from "../../services/session.service.js";
import type { ControlLane } from "../../services/controlLane.service.js";
import type { MutexMap } from "../../lib/mutex.js";
import type { TmuxPane } from "../../infrastructure/tmux/pane.js";
import type { AtomicCommandWriter } from "../../infrastructure/filesystem/atomicCommand.js";
import type { GodStatusProbe } from "../../infrastructure/systemd/godStatus.js";

export interface SessionsCallbackDeps {
  log: Logger;
  sessionService: SessionService;
  controlLane: ControlLane;
  sessionLocks: MutexMap;
  pane: TmuxPane;
  atomicCmd: AtomicCommandWriter;
  godStatus: GodStatusProbe;
}

export function buildSessionsCallbackHandler(deps: SessionsCallbackDeps): Composer<Context> {
  const c = new Composer<Context>();
  c.callbackQuery(/^s_run:|^s_del:/, async (ctx) => {
    const data = ctx.callbackQuery.data ?? "";
    const colon = data.indexOf(":");
    if (colon === -1) {
      await ctx.answerCallbackQuery({ text: "malformed", show_alert: true });
      return;
    }
    const action = data.slice(0, colon);
    const sid = data.slice(colon + 1);

    const path = deps.sessionService.validateSessionPath(sid);
    if (path === null) {
      await ctx.answerCallbackQuery({ text: "session not found", show_alert: true });
      try {
        await ctx.editMessageReplyMarkup({});
      } catch {
        /* ignore */
      }
      return;
    }

    const owner = deps.sessionService.getOwner(sid);
    if (owner === null) {
      deps.log.warn({ sid }, "session has no owner; refusing");
      await ctx.answerCallbackQuery({
        text: "session ownership unknown",
        show_alert: true,
      });
      return;
    }
    const fromId = ctx.from?.id ?? null;
    if (fromId !== owner) {
      deps.log.warn(
        { fromId, owner, sid, action },
        "user tried to act on other's session — rejected"
      );
      await ctx.answerCallbackQuery({ text: "not your session", show_alert: true });
      try {
        await ctx.editMessageReplyMarkup({});
      } catch {
        /* ignore */
      }
      return;
    }

    await deps.sessionLocks.for(sid).run(action, async () => {
      const stillThere = deps.sessionService.validateSessionPath(sid);
      if (stillThere === null) {
        await ctx.answerCallbackQuery({ text: "session gone", show_alert: true });
        try {
          await ctx.editMessageReplyMarkup({});
        } catch {
          /* ignore */
        }
        return;
      }

      if (action === "s_run") {
        if (!(await deps.godStatus.isActive())) {
          await ctx.answerCallbackQuery({
            text: "god-session paused; /dispatcher resume first",
            show_alert: true,
          });
          return;
        }
        try {
          await deps.controlLane.run("resume_session", async () => {
            deps.atomicCmd.write("resume", sid, fromId);
            await deps.pane.killGracefully();
          });
        } catch (error) {
          deps.log.error({ err: String(error) }, "write_command_atomic resume failed");
          await ctx.answerCallbackQuery({ text: `failed: ${String(error)}`, show_alert: true });
          return;
        }
        deps.log.info({ sid }, "[Resume] queued");
        try {
          await ctx.editMessageText(
            `🔄 Resuming \`${sid.slice(0, 8)}…\` — pane will reload in ~5–10s.`,
            { parse_mode: "Markdown" }
          );
        } catch {
          /* ignore */
        }
      } else if (action === "s_del") {
        await deps.controlLane.run("delete_session", () => {
          deps.sessionService.deleteSessionFile(sid);
          return Promise.resolve();
        });
        deps.log.info({ sid }, "[Delete] removed");
        try {
          await ctx.editMessageText(`✓ Deleted \`${sid.slice(0, 8)}…\``, {
            parse_mode: "Markdown",
          });
        } catch {
          /* ignore */
        }
      } else {
        await ctx.answerCallbackQuery({ text: "unknown action", show_alert: true });
        return;
      }
    });

    await ctx.answerCallbackQuery();
  });
  return c;
}

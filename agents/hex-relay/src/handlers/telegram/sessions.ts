import { Composer, type Context } from "grammy";
import type { Logger } from "../../lib/logger.js";
import type { SessionService } from "../../services/session.service.js";
import type { ControlLane } from "../../services/controlLane.service.js";
import type { MutexMap } from "../../lib/mutex.js";
import { TIMING } from "../../config/paths.js";
import { listKeyboard, type MenuScreen } from "./kb.js";
import type { SessionListItem } from "../../domain/session.js";
import { truncate } from "../../domain/events.js";

export interface SessionsDeps {
  log: Logger;
  sessionService: SessionService;
  controlLane: ControlLane;
  sessionLocks: MutexMap;
}

const SLUG_DISPLAY_MAX = 32;

function fmtTs(epoch: number): string {
  const d = new Date(epoch * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}

/**
 * Render the v2 sessions-list screen. Plain text, no parse_mode (Option A) so
 * underscores/asterisks in slugs are safe. Numbered keyboard refers back via
 * `s_list:{ownerId}` for owner-bound Refresh.
 */
export function renderSessionsList(args: {
  sessions: SessionListItem[];
  ownerId: number;
  totalCount: number;
}): MenuScreen {
  const { sessions, ownerId, totalCount } = args;
  const cap = TIMING.maxMenuItems;
  const visible = sessions.slice(0, cap);

  if (visible.length === 0) {
    return {
      text: "📂 Sessions (0)\n\nNo sessions yet.",
      keyboard: listKeyboard({
        items: [],
        viewActionPrefix: "s_view",
        listAction: `s_list:${ownerId}`,
      }),
    };
  }

  const lines = visible.map((s, idx) => {
    const slug = truncate(s.slug, SLUG_DISPLAY_MAX);
    return `${idx + 1}. ${slug} · ${fmtTs(s.ts)} · ${s.sid.slice(0, 8)}…`;
  });
  let text = `📂 Sessions (${totalCount})\n${lines.join("\n")}`;
  if (totalCount > visible.length) {
    text += `\n\n+${totalCount - visible.length} more`;
  }
  return {
    text,
    keyboard: listKeyboard({
      items: visible.map((s, idx) => ({ index: idx + 1, id: s.sid })),
      viewActionPrefix: "s_view",
      listAction: `s_list:${ownerId}`,
    }),
  };
}

export function buildSessionsHandler(deps: SessionsDeps): Composer<Context> {
  const c = new Composer<Context>();
  c.command("sessions", async (ctx) => {
    const args = (ctx.match?.toString() ?? "").trim();

    if (args.startsWith("delete")) {
      const parts = args.split(/\s+/);
      const sid = parts[1] ?? "";
      if (!sid) {
        await ctx.reply("Usage: /sessions delete <session-id>");
        return;
      }
      const owner = deps.sessionService.getOwner(sid);
      if (owner === null) {
        await ctx.reply(`❌ Session ${sid.slice(0, 8)}… has no recorded owner.`);
        return;
      }
      if (ctx.from && ctx.from.id !== owner) {
        await ctx.reply("❌ Not your session.");
        return;
      }
      const path = deps.sessionService.validateSessionPath(sid, owner);
      if (path === null) {
        await ctx.reply(`❌ Session ${sid} not found or invalid id.`);
        return;
      }
      let deleted = false;
      await deps.sessionLocks.for(sid).run("delete", async () => {
        const stillThere = deps.sessionService.validateSessionPath(sid, owner);
        if (stillThere === null) return;
        await deps.controlLane.run("delete_session", () => {
          deps.sessionService.deleteSessionFile(sid);
          deleted = true;
          return Promise.resolve();
        });
      });
      if (!deleted) {
        await ctx.reply(`❌ Session ${sid.slice(0, 8)}… not found or already deleted.`);
        return;
      }
      await ctx.reply(`✓ Deleted ${sid.slice(0, 8)}….`);
      return;
    }

    const showAll = args === "all";
    const ownerId = ctx.from?.id ?? deps.sessionService.primaryOperator;
    const limit = showAll ? TIMING.maxMenuItems : TIMING.sessionsTopN;
    const sessions = deps.sessionService.listSessions({
      ownerUserId: ownerId,
      limit,
    });
    const total = deps.sessionService.listSessions({
      ownerUserId: ownerId,
      limit: null,
    }).length;

    const screen = renderSessionsList({ sessions, ownerId, totalCount: total });
    try {
      await ctx.reply(screen.text, { reply_markup: screen.keyboard });
    } catch (error) {
      deps.log.error({ err: String(error) }, "send sessions list failed");
    }
  });
  return c;
}

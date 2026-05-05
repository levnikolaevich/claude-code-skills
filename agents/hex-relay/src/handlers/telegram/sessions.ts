import { Composer, type Context } from "grammy";
import type { Logger } from "../../lib/logger.js";
import type { SessionService } from "../../services/session.service.js";
import type { ControlLane } from "../../services/controlLane.service.js";
import type { MutexMap } from "../../lib/mutex.js";
import { TIMING } from "../../config/paths.js";
import { sessionCardKb } from "./kb.js";

export interface SessionsDeps {
  log: Logger;
  sessionService: SessionService;
  controlLane: ControlLane;
  sessionLocks: MutexMap;
}

function fmtTs(epoch: number): string {
  const d = new Date(epoch * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}

export function buildSessionsHandler(deps: SessionsDeps): Composer<Context> {
  const c = new Composer<Context>();
  c.command("sessions", async (ctx) => {
    const args = (ctx.match?.toString() ?? "").trim();

    if (args.startsWith("delete")) {
      const parts = args.split(/\s+/);
      const sid = parts[1] ?? "";
      if (!sid) {
        await ctx.reply("Usage: `/sessions delete <session-id>`");
        return;
      }
      const owner = deps.sessionService.getOwner(sid);
      if (owner === null) {
        await ctx.reply(`❌ Session \`${sid.slice(0, 8)}…\` has no recorded owner.`, {
          parse_mode: "Markdown",
        });
        return;
      }
      if (ctx.from && ctx.from.id !== owner) {
        await ctx.reply("❌ Not your session.");
        return;
      }
      const path = deps.sessionService.validateSessionPath(sid, owner);
      if (path === null) {
        await ctx.reply(`❌ Session \`${sid}\` not found or invalid id.`);
        return;
      }
      await deps.controlLane.run("delete_session", async () => {
        await deps.sessionLocks.for(sid).run("delete", () => {
          deps.sessionService.deleteSessionFile(sid);
          return Promise.resolve();
        });
      });
      await ctx.reply(`✓ Deleted \`${sid.slice(0, 8)}…\`.`);
      return;
    }

    const showAll = args === "all";
    const ownerId = ctx.from?.id ?? deps.sessionService.primaryOperator;
    const sessions = deps.sessionService.listSessions({
      ownerUserId: ownerId,
      limit: showAll ? null : TIMING.sessionsTopN,
    });
    if (sessions.length === 0) {
      await ctx.reply("📭 No sessions found for your account yet.");
      return;
    }

    if (showAll) {
      const lines = sessions.map((s) => `• \`${s.sid.slice(0, 8)}\` *${s.slug}* — ${fmtTs(s.ts)}`);
      const footer = "\n\nDelete: `/sessions delete <id>`";
      await ctx.reply(`Your sessions (${sessions.length}):\n${lines.join("\n")}${footer}`, {
        parse_mode: "Markdown",
      });
      return;
    }

    const total = deps.sessionService.listSessions({
      ownerUserId: ownerId,
      limit: null,
    }).length;
    for (const s of sessions) {
      const text = `📂 *${s.slug}*\nlast: ${fmtTs(s.ts)}\nid: \`${s.sid.slice(0, 8)}…\``;
      try {
        await ctx.api.sendMessage(ctx.chat.id, text, {
          reply_markup: sessionCardKb(s.sid),
          parse_mode: "Markdown",
        });
      } catch (error) {
        deps.log.error({ err: String(error), sid: s.sid }, "send sessions card failed");
      }
    }
    if (total > TIMING.sessionsTopN) {
      await ctx.reply(`+${total - TIMING.sessionsTopN} more — type \`/sessions all\``, {
        parse_mode: "Markdown",
      });
    }
  });
  return c;
}

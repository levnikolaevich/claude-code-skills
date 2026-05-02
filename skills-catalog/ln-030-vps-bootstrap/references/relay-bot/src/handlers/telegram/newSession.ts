import { Composer, type Context } from "grammy";
import type { Logger } from "../../lib/logger.js";
import type { ControlLane } from "../../services/controlLane.service.js";
import type { TmuxPane } from "../../infrastructure/tmux/pane.js";
import type { AtomicCommandWriter } from "../../infrastructure/filesystem/atomicCommand.js";
import type { GodStatusProbe } from "../../infrastructure/systemd/godStatus.js";

export interface NewSessionDeps {
  log: Logger;
  controlLane: ControlLane;
  pane: TmuxPane;
  atomicCmd: AtomicCommandWriter;
  godStatus: GodStatusProbe;
}

export function buildNewSessionHandler(deps: NewSessionDeps): Composer<Context> {
  const c = new Composer<Context>();
  c.command("new_session", async (ctx) => {
    const args = ctx.match?.toString() ?? "";
    if (args.trim().length > 0) {
      await ctx.reply("`/new_session` accepts no arguments.");
      return;
    }
    if (!(await deps.godStatus.isActive())) {
      await ctx.reply(
        "⚠️ god-session is paused. Run `/dispatcher resume` first, then re-issue `/new_session`."
      );
      return;
    }
    try {
      const cmdId = await deps.controlLane.run("new_session", async () => {
        const id = deps.atomicCmd.write("new", null, ctx.chat?.id ?? null);
        await deps.pane.killGracefully();
        return id;
      });
      deps.log.info({ cmdId }, "/new_session queued; killing tmux");
      await ctx.reply("🔄 Killing god-session — fresh context will start in ~5–10s.");
    } catch (error) {
      deps.log.error({ err: String(error) }, "write_command_atomic failed");
      await ctx.reply(`❌ Failed to queue command: ${String(error)}`);
    }
  });
  return c;
}

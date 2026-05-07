import { Composer, type Context } from "grammy";
import type { Logger } from "../../lib/logger.js";
import type { ControlLane } from "../../services/controlLane.service.js";
import type { GodRuntimeService } from "../../services/godRuntime.service.js";

export interface NewSessionDeps {
  log: Logger;
  controlLane: ControlLane;
  godRuntime: GodRuntimeService;
}

export function buildNewSessionHandler(deps: NewSessionDeps): Composer<Context> {
  const c = new Composer<Context>();
  c.command("new_session", async (ctx) => {
    const args = ctx.match?.toString() ?? "";
    if (args.trim().length > 0) {
      await ctx.reply("`/new_session` accepts no arguments.");
      return;
    }
    const userId = ctx.from?.id;
    if (userId === undefined) {
      await ctx.reply("❌ Cannot start a session without Telegram user id.");
      return;
    }
    try {
      const cmdId = await deps.controlLane.run("new_session", async () => {
        const runtime = deps.godRuntime.runtimeFor(userId);
        if (!runtime.ok) throw new Error(runtime.error.message);
        const id = runtime.value.atomicCmd.write("new", null, userId);
        if (await runtime.value.pane.hasSession()) {
          await runtime.value.pane.killGracefully();
        } else {
          const started = await deps.godRuntime.ensureStarted(userId);
          if (!started.ok) throw new Error(started.error.message);
        }
        return id;
      });
      deps.log.info({ cmdId, userId }, "/new_session queued for user god-session");
      await ctx.reply("🔄 Starting a fresh personal god-session — ready in ~5–10s.");
    } catch (error) {
      deps.log.error({ err: String(error) }, "write_command_atomic failed");
      await ctx.reply(`❌ Failed to queue command: ${String(error)}`);
    }
  });
  return c;
}

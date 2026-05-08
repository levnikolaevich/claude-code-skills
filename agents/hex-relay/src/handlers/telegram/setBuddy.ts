import { Composer, type Context } from "grammy";
import type { Logger } from "../../lib/logger.js";
import type { UserBuddyService } from "../../services/userBuddy.service.js";
import { isAgentKind } from "../../domain/message.js";
import { TELEGRAM_COMMANDS } from "../../domain/telegramCommands.js";

export interface SetBuddyDeps {
  log: Logger;
  userBuddy: UserBuddyService;
}

export function buildSetBuddyHandler(deps: SetBuddyDeps): Composer<Context> {
  const c = new Composer<Context>();
  c.command(TELEGRAM_COMMANDS.set_buddy.command, async (ctx) => {
    const userId = ctx.from?.id;
    if (userId === undefined) return;
    const arg = (ctx.match ?? "").toString().trim().toLowerCase();
    if (arg.length === 0) {
      const current = deps.userBuddy.getDefault(userId);
      await ctx.reply(`Default agent: ${current}.`);
      return;
    }
    if (!isAgentKind(arg)) {
      await ctx.reply("Usage: /set_buddy claude or /set_buddy codex.");
      return;
    }
    deps.userBuddy.setDefault(userId, arg);
    deps.log.info({ userId, agent: arg }, "user_buddy default updated");
    await ctx.reply(`Default agent set to ${arg}.`);
  });
  return c;
}

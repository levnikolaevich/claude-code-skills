import { Composer, type Context } from "grammy";
import type { Logger } from "../../lib/logger.js";
import type { AllowlistService } from "../../services/allowlist.service.js";
import { userCardKb, userCardText } from "./kb.js";

export interface UsersDeps {
  log: Logger;
  allowlist: AllowlistService;
}

export function buildUsersHandler(deps: UsersDeps): Composer<Context> {
  const c = new Composer<Context>();
  c.command("users", async (ctx) => {
    if (!deps.allowlist.isPrimary(ctx.from?.id)) {
      await ctx.reply("❌ Only the primary operator can manage the allowlist.");
      return;
    }
    const rows = deps.allowlist.list();
    if (rows.length === 0) {
      await ctx.reply("📭 Allowlist is empty (impossible — primary should always be there).");
      return;
    }
    await ctx.reply(`👥 Allowlist (${rows.length} entries):`);
    for (const row of rows) {
      const kb = userCardKb(row, deps.allowlist.primaryOperator);
      try {
        await ctx.api.sendMessage(ctx.chat.id, userCardText(row, deps.allowlist.primaryOperator), {
          reply_markup: kb ?? undefined,
          parse_mode: "Markdown",
        });
      } catch (error) {
        deps.log.error({ err: String(error), userId: row.userId }, "send users card failed");
      }
    }
  });
  return c;
}

import { Composer, type Context } from "grammy";
import type { Logger } from "../../lib/logger.js";
import type { Bot } from "grammy";
import type { AllowlistService } from "../../services/allowlist.service.js";
import { userCardKb, userCardText } from "./kb.js";

export interface UsersCallbackDeps {
  log: Logger;
  bot: Bot;
  allowlist: AllowlistService;
}

export function buildUsersCallbackHandler(deps: UsersCallbackDeps): Composer<Context> {
  const c = new Composer<Context>();
  c.callbackQuery(/^usr_(allow|block|del):/, async (ctx) => {
    if (!deps.allowlist.isPrimary(ctx.from?.id)) {
      await ctx.answerCallbackQuery({ text: "forbidden", show_alert: true });
      return;
    }
    const data = ctx.callbackQuery.data ?? "";
    const colon = data.indexOf(":");
    if (colon === -1) {
      await ctx.answerCallbackQuery({ text: "malformed", show_alert: true });
      return;
    }
    const action = data.slice(0, colon);
    const rawUid = data.slice(colon + 1);
    const uid = Number.parseInt(rawUid, 10);
    if (!Number.isFinite(uid)) {
      await ctx.answerCallbackQuery({ text: "invalid id", show_alert: true });
      return;
    }
    if (uid === deps.allowlist.primaryOperator) {
      await ctx.answerCallbackQuery({
        text: "cannot modify primary operator",
        show_alert: true,
      });
      return;
    }
    const row = deps.allowlist.getRow(uid);
    if (row === null) {
      await ctx.answerCallbackQuery({ text: "user not found", show_alert: true });
      try {
        await ctx.editMessageReplyMarkup({});
      } catch {
        /* ignore */
      }
      return;
    }

    if (action === "usr_del") {
      try {
        deps.allowlist.deleteUser(uid);
      } catch (error) {
        deps.log.error({ err: String(error), uid }, "delete user failed");
        await ctx.answerCallbackQuery({ text: `db error: ${String(error)}`, show_alert: true });
        return;
      }
      deps.log.info({ uid }, "[/users delete] by primary");
      try {
        await ctx.editMessageText(`🗑 Deleted user \`${uid}\` from allowlist.`, {
          parse_mode: "Markdown",
        });
      } catch {
        /* ignore */
      }
      await ctx.answerCallbackQuery();
      return;
    }

    let newStatus: "allowed" | "blocked";
    let notify: string | null = null;
    if (action === "usr_allow") {
      newStatus = "allowed";
      notify = "✓ Access granted by operator. You can use the bot now.";
    } else if (action === "usr_block") {
      newStatus = "blocked";
    } else {
      await ctx.answerCallbackQuery({ text: "unknown action", show_alert: true });
      return;
    }

    try {
      deps.allowlist.upsertUser({
        userId: uid,
        username: row.username,
        status: newStatus,
        addedBy: deps.allowlist.primaryOperator,
      });
    } catch (error) {
      deps.log.error({ err: String(error), uid, newStatus }, "set status failed");
      await ctx.answerCallbackQuery({ text: `db error: ${String(error)}`, show_alert: true });
      return;
    }
    deps.log.info({ action, uid }, "[/users] by primary");

    if (notify) {
      try {
        await deps.bot.api.sendMessage(uid, notify);
      } catch (error) {
        deps.log.debug({ err: String(error) }, "notify allowed user failed");
      }
    }

    const fresh = deps.allowlist.getRow(uid);
    if (fresh !== null) {
      try {
        await ctx.editMessageText(userCardText(fresh, deps.allowlist.primaryOperator), {
          reply_markup: userCardKb(fresh, deps.allowlist.primaryOperator) ?? undefined,
          parse_mode: "Markdown",
        });
      } catch {
        /* ignore */
      }
    }
    await ctx.answerCallbackQuery();
  });
  return c;
}

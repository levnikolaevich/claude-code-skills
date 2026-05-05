import type { Bot, Context, NextFunction } from "grammy";
import type { Logger } from "../../lib/logger.js";
import type { AllowlistService } from "../../services/allowlist.service.js";

export interface AllowlistMiddlewareDeps {
  bot: Bot;
  log: Logger;
  allowlist: AllowlistService;
}

export function buildAllowlistMiddleware(deps: AllowlistMiddlewareDeps) {
  return async function allowlistMiddleware(ctx: Context, next: NextFunction): Promise<void> {
    const fromUser = ctx.from;
    if (!fromUser) {
      return;
    }
    const userId = fromUser.id;
    const username = fromUser.username ?? null;
    const chatId = ctx.chat?.id ?? null;
    const eventKind = ctx.update.callback_query
      ? "CallbackQuery"
      : ctx.update.message
        ? "Message"
        : "Other";
    const textPreview =
      ctx.message?.text ?? ctx.message?.caption ?? ctx.callbackQuery?.data ?? null;
    const status = deps.allowlist.status(userId);

    if (status === "allowed") {
      await next();
      return;
    }

    deps.allowlist.insertAuthReject({
      fromUserId: userId,
      username,
      chatId,
      eventKind,
      textPreview,
    });

    if (status === "blocked") {
      deps.log.warn({ userId, username }, "AUTH REJECT blocked");
      return;
    }

    if (status === "pending") {
      deps.log.info({ userId, username }, "AUTH REJECT pending");
      const row = deps.allowlist.getRow(userId);
      const alreadyNotified = row !== null && row.pendingNotifiedAt !== null;
      if (ctx.message && !alreadyNotified) {
        try {
          await ctx.reply(
            "⏳ Your access is pending approval by the operator. " +
              "You'll be notified when approved."
          );
        } catch (error) {
          deps.log.debug({ err: String(error) }, "pending notice failed");
        }
        deps.allowlist.markPendingNotified(userId);
      }
      return;
    }

    deps.log.info({ userId, username }, "AUTH NEW pending");
    try {
      deps.allowlist.upsertUser({
        userId,
        username,
        status: "pending",
        addedBy: null,
        notes: "first DM — auto-pending",
      });
    } catch (error) {
      deps.log.error({ err: String(error) }, "upsert pending failed");
    }
    if (ctx.message) {
      try {
        await ctx.reply(
          "⏳ Your access is pending approval by the operator. " +
            "You'll be notified when approved."
        );
        deps.allowlist.markPendingNotified(userId);
      } catch (error) {
        deps.log.debug({ err: String(error) }, "pending notice failed");
      }
    }
    try {
      const uname = username ? `@${username}` : "(no username)";
      await deps.bot.api.sendMessage(
        deps.allowlist.primaryOperator,
        `🆕 New user request: ${uname} (id=\`${userId}\`)\nType \`/users\` to manage.`,
        { parse_mode: "Markdown" }
      );
    } catch (error) {
      deps.log.debug({ err: String(error) }, "primary alert failed");
    }
  };
}

import { Composer, type Context } from "grammy";
import type { Logger } from "../../lib/logger.js";
import type { Bot } from "grammy";
import type { AllowlistService } from "../../services/allowlist.service.js";
import type { AllowedUserRow } from "../../domain/user.js";
import {
  detailKeyboard,
  safeEditMenu,
  successKeyboard,
  type DetailKeyboardAction,
  type MenuScreen,
} from "./kb.js";
import { renderUsersList } from "./users.js";

export interface UsersCallbackDeps {
  log: Logger;
  bot: Bot;
  allowlist: AllowlistService;
}

const BACK_ACTION = "usr_list";

function loadList(deps: UsersCallbackDeps): MenuScreen {
  return renderUsersList({
    rows: deps.allowlist.list(),
    primary: deps.allowlist.primaryOperator,
  });
}

function detailScreen(row: AllowedUserRow, primary: number): MenuScreen {
  const isPrimary = row.userId === primary;
  const uname = row.username ? `@${row.username}` : "(no username)";
  const notes = row.notes ? `\nnotes: ${row.notes}` : "";
  const text =
    `${row.status === "allowed" ? "✓" : row.status === "blocked" ? "⛔" : "⏳"} ${row.status}` +
    (isPrimary ? " 🛡 primary" : "") +
    `\n${uname}\nid: ${row.userId}${notes}`;

  const actions: DetailKeyboardAction[] = [];
  if (!isPrimary) {
    if (row.status === "pending" || row.status === "blocked") {
      actions.push({ label: "✓ Allow", callbackData: `usr_allow:${row.userId}` });
    }
    if (row.status === "pending" || row.status === "allowed") {
      actions.push({ label: "⛔ Block", callbackData: `usr_block:${row.userId}` });
    }
    actions.push({ label: "🗑 Delete", callbackData: `usr_del:${row.userId}` });
  }
  return {
    text,
    keyboard: detailKeyboard({ actions, backAction: BACK_ACTION }),
  };
}

function successScreen(text: string): MenuScreen {
  return { text, keyboard: successKeyboard(BACK_ACTION) };
}

export function buildUsersCallbackHandler(deps: UsersCallbackDeps): Composer<Context> {
  const c = new Composer<Context>();

  // List refresh — primary-only via isPrimary guard. No owner id in callback
  // because /users is primary-only by design.
  c.callbackQuery(/^usr_list$/, async (ctx) => {
    if (!deps.allowlist.isPrimary(ctx.from?.id)) {
      await ctx.answerCallbackQuery({ text: "forbidden", show_alert: true });
      return;
    }
    await safeEditMenu(ctx, loadList(deps), { log: deps.log });
  });

  // View detail.
  c.callbackQuery(/^usr_view:/, async (ctx) => {
    if (!deps.allowlist.isPrimary(ctx.from?.id)) {
      await ctx.answerCallbackQuery({ text: "forbidden", show_alert: true });
      return;
    }
    const data = ctx.callbackQuery.data ?? "";
    const uid = Number.parseInt(data.slice("usr_view:".length), 10);
    if (!Number.isFinite(uid)) {
      await ctx.answerCallbackQuery({ text: "invalid id", show_alert: true });
      return;
    }
    const row = deps.allowlist.getRow(uid);
    if (row === null) {
      await safeEditMenu(ctx, successScreen("✗ User no longer in allowlist."), {
        log: deps.log,
      });
      return;
    }
    await safeEditMenu(ctx, detailScreen(row, deps.allowlist.primaryOperator), { log: deps.log });
  });

  // Allow / Block / Delete — legacy regex preserved for backward compat with
  // pre-redesign card buttons. After action, edit-in-place to a success screen
  // with Back to list.
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
      await safeEditMenu(ctx, successScreen("✗ User no longer in allowlist."), {
        log: deps.log,
      });
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
      await safeEditMenu(ctx, successScreen(`🗑 Deleted user ${uid} from allowlist.`), {
        log: deps.log,
      });
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

    await safeEditMenu(
      ctx,
      successScreen(newStatus === "allowed" ? `✓ Allowed user ${uid}.` : `⛔ Blocked user ${uid}.`),
      { log: deps.log }
    );
  });

  return c;
}

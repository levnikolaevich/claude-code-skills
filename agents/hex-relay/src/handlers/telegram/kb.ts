import { InlineKeyboard, GrammyError, type Context } from "grammy";
import type { Logger } from "../../lib/logger.js";
import type { ProviderTask } from "../../domain/task.js";
import type { AllowedUserRow } from "../../domain/user.js";

/**
 * List/detail/success keyboard builders for the v2 menu UX.
 *
 * Design: a single message per command, edited in place between three screens
 * (list → detail → success → back). All keyboards are plain InlineKeyboard
 * instances; text is rendered without parse_mode (Option A) so callers do not
 * need to escape Markdown reserved chars in slugs/titles.
 */

export interface ListItemRef {
  /** 1-based numeric label shown on the keyboard button. */
  index: number;
  /** Stable identifier appended to `viewActionPrefix` to form callback_data. */
  id: string;
}

export interface ListKeyboardOptions {
  /** Items to render as numbered buttons. Caller is responsible for the cap. */
  items: ListItemRef[];
  /** Prefix for view-action callback_data, e.g. "s_view". A colon is added automatically. */
  viewActionPrefix: string;
  /** callback_data for the Refresh footer button (owner-bound, e.g. "s_list:123"). */
  listAction: string;
  /** Buttons per row (default 5). */
  perRow?: number;
}

/**
 * Numbered list keyboard with a Refresh footer.
 *
 * Layout:
 *   [ 1 ] [ 2 ] [ 3 ] [ 4 ] [ 5 ]
 *   [ 6 ] [ 7 ] ...
 *   [ 🔄 Refresh ]
 *
 * Empty list → keyboard with only the Refresh button (caller renders the
 * "_No items yet_" text).
 */
export function listKeyboard(opts: ListKeyboardOptions): InlineKeyboard {
  const perRow = opts.perRow ?? 5;
  const kb = new InlineKeyboard();
  for (let i = 0; i < opts.items.length; i += 1) {
    const item = opts.items[i];
    if (item === undefined) continue;
    kb.text(String(item.index), `${opts.viewActionPrefix}:${item.id}`);
    if ((i + 1) % perRow === 0 && i + 1 < opts.items.length) kb.row();
  }
  if (opts.items.length > 0) kb.row();
  kb.text("🔄 Refresh", opts.listAction);
  return kb;
}

export interface DetailKeyboardAction {
  label: string;
  callbackData: string;
}

/**
 * Detail screen keyboard: action buttons in a single row, then a back-to-list
 * row. Optional URL buttons (e.g. tasks "Open") sit alongside actions.
 */
export function detailKeyboard(args: {
  actions: DetailKeyboardAction[];
  urls?: { label: string; url: string }[];
  backAction: string;
  backLabel?: string;
}): InlineKeyboard {
  const kb = new InlineKeyboard();
  let placedAny = false;
  for (const a of args.actions) {
    kb.text(a.label, a.callbackData);
    placedAny = true;
  }
  for (const u of args.urls ?? []) {
    kb.url(u.label, u.url);
    placedAny = true;
  }
  if (placedAny) kb.row();
  kb.text(args.backLabel ?? "← Back to list", args.backAction);
  return kb;
}

/** Success screen keyboard: only a Back button. */
export function successKeyboard(backAction: string, backLabel = "← Back to list"): InlineKeyboard {
  return new InlineKeyboard().text(backLabel, backAction);
}

/* ----------------------------------------------------------------------- */
/* Legacy card keyboards — still consumed by the current handlers while    */
/* the v2 menu UX is introduced incrementally.                             */
/* ----------------------------------------------------------------------- */

export function sessionCardKb(sid: string): InlineKeyboard {
  return new InlineKeyboard().text("▶ Resume", `s_run:${sid}`).text("🗑 Delete", `s_del:${sid}`);
}

export function userCardKb(row: AllowedUserRow, primary: number): InlineKeyboard | null {
  if (row.userId === primary) return null;
  const kb = new InlineKeyboard();
  if (row.status === "pending" || row.status === "blocked") {
    kb.text("✓ Allow", `usr_allow:${row.userId}`);
  }
  if (row.status === "pending" || row.status === "allowed") {
    kb.text("⛔ Block", `usr_block:${row.userId}`);
  }
  kb.text("🗑 Delete", `usr_del:${row.userId}`);
  return kb;
}

export function taskCardKb(task: ProviderTask): InlineKeyboard {
  return new InlineKeyboard().text("Take", `t_take:${task.id}`).url("Open", task.url);
}

/* ----------------------------------------------------------------------- */
/* Legacy text formatter — still consumed by /users while the cards UX     */
/* is migrated; safe to keep because it produces text only.                */
/* ----------------------------------------------------------------------- */

export function userCardText(row: AllowedUserRow, primary: number): string {
  const primaryMarker = row.userId === primary ? " 🛡 primary" : "";
  const uname = row.username ? `@${row.username}` : "(no username)";
  const emoji = row.status === "allowed" ? "✓" : row.status === "blocked" ? "⛔" : "⏳";
  const notes = row.notes ? `\n_${row.notes}_` : "";
  return `${emoji} *${row.status}*${primaryMarker}\n${uname}\nid: \`${row.userId}\`${notes}`;
}

/* ----------------------------------------------------------------------- */
/* safeEditMenu — centralized edit-in-place wrapper for the v2 menu UX.    */
/* ----------------------------------------------------------------------- */

export interface MenuScreen {
  text: string;
  keyboard: InlineKeyboard;
  /** Optional parse_mode override; new screens default to plain text. */
  parseMode?: "Markdown" | "MarkdownV2" | "HTML";
}

export interface SafeEditMenuOptions {
  /** Logger for warn/error of non-recoverable edit failures. */
  log?: Logger;
  /** Set true to suppress callback ack (caller will ack themselves). */
  skipAck?: boolean;
}

export type SafeEditMenuResult =
  | { kind: "edited" }
  | { kind: "noop" }
  | { kind: "expired" }
  | { kind: "failed"; reason: string };

const NOT_MODIFIED_RE = /message is not modified/i;
const NOT_FOUND_RE = /message to edit not found|message can't be edited|chat not found/i;

/**
 * Edit the current callback's source message to a new screen, treating
 * Telegram's "message is not modified" as a silent success and downgrading
 * "message to edit not found" / closed-chat errors to a user-friendly
 * "menu expired" alert. All other failures are logged and acked.
 *
 * Caller must have a callbackQuery context (uses ctx.editMessageText). If
 * the context is not a callbackQuery (e.g. a fresh /sessions reply), the
 * caller should send a new message instead.
 */
export async function safeEditMenu(
  ctx: Context,
  screen: MenuScreen,
  opts: SafeEditMenuOptions = {}
): Promise<SafeEditMenuResult> {
  let result: SafeEditMenuResult;
  try {
    const editOptions: {
      reply_markup: InlineKeyboard;
      parse_mode?: "Markdown" | "MarkdownV2" | "HTML";
    } = {
      reply_markup: screen.keyboard,
    };
    if (screen.parseMode) editOptions.parse_mode = screen.parseMode;
    await ctx.editMessageText(screen.text, editOptions);
    result = { kind: "edited" };
  } catch (error) {
    const description = errorDescription(error);
    if (NOT_MODIFIED_RE.test(description)) {
      result = { kind: "noop" };
    } else if (NOT_FOUND_RE.test(description)) {
      opts.log?.warn({ err: description }, "menu edit target gone");
      result = { kind: "expired" };
    } else {
      opts.log?.error({ err: description }, "menu edit failed");
      result = { kind: "failed", reason: description };
    }
  }

  if (!opts.skipAck) {
    try {
      if (result.kind === "expired") {
        await ctx.answerCallbackQuery({ text: "menu expired", show_alert: true });
      } else if (result.kind === "failed") {
        await ctx.answerCallbackQuery({ text: `failed: ${result.reason}`, show_alert: true });
      } else {
        await ctx.answerCallbackQuery();
      }
    } catch (ackError) {
      opts.log?.warn({ err: errorDescription(ackError) }, "answerCallbackQuery failed");
    }
  }

  return result;
}

function errorDescription(error: unknown): string {
  if (error instanceof GrammyError) return error.description ?? error.message;
  if (error instanceof Error) return error.message;
  return String(error);
}

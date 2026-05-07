import { Composer, type Context } from "grammy";
import type { Logger } from "../../lib/logger.js";
import type { AllowlistService } from "../../services/allowlist.service.js";
import type { AllowedUserRow } from "../../domain/user.js";
import { TIMING } from "../../config/paths.js";
import { listKeyboard, type MenuScreen } from "./kb.js";
import { STATUS_EMOJI } from "../../domain/user.js";

export interface UsersDeps {
  log: Logger;
  allowlist: AllowlistService;
}

const USERNAME_DISPLAY_MAX = 24;

function shortUserLine(row: AllowedUserRow, primary: number, idx: number): string {
  const emoji = STATUS_EMOJI[row.status];
  const primaryMarker = row.userId === primary ? " 🛡" : "";
  const uname = row.username
    ? `@${row.username.length > USERNAME_DISPLAY_MAX ? row.username.slice(0, USERNAME_DISPLAY_MAX) + "…" : row.username}`
    : "(no username)";
  return `${idx + 1}. ${emoji} ${uname} · ${row.userId}${primaryMarker}`;
}

/**
 * Render the v2 allowlist list screen. Plain text, no parse_mode (Option A).
 * No owner-bound list callback — `/users` is primary-only and `usr_list` is
 * gated by `allowlist.isPrimary` instead of an embedded user id.
 */
export function renderUsersList(args: { rows: AllowedUserRow[]; primary: number }): MenuScreen {
  const { rows, primary } = args;
  const cap = TIMING.maxMenuItems;
  const visible = rows.slice(0, cap);
  if (visible.length === 0) {
    return {
      text: "👥 Allowlist (0)\n\nNo entries yet.",
      keyboard: listKeyboard({
        items: [],
        viewActionPrefix: "usr_view",
        listAction: "usr_list",
      }),
    };
  }
  const lines = visible.map((row, idx) => shortUserLine(row, primary, idx));
  let text = `👥 Allowlist (${rows.length})\n${lines.join("\n")}`;
  if (rows.length > visible.length) text += `\n\n+${rows.length - visible.length} more`;
  return {
    text,
    keyboard: listKeyboard({
      items: visible.map((row, idx) => ({ index: idx + 1, id: String(row.userId) })),
      viewActionPrefix: "usr_view",
      listAction: "usr_list",
    }),
  };
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
    const screen = renderUsersList({ rows, primary: deps.allowlist.primaryOperator });
    try {
      await ctx.reply(screen.text, { reply_markup: screen.keyboard });
    } catch (error) {
      deps.log.error({ err: String(error) }, "send users list failed");
    }
  });
  return c;
}

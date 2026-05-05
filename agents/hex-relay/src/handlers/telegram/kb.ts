import { InlineKeyboard } from "grammy";
import type { ProviderTask } from "../../domain/task.js";
import type { AllowedUserRow } from "../../domain/user.js";

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

export function userCardText(row: AllowedUserRow, primary: number): string {
  const primaryMarker = row.userId === primary ? " 🛡 primary" : "";
  const uname = row.username ? `@${row.username}` : "(no username)";
  const emoji = row.status === "allowed" ? "✓" : row.status === "blocked" ? "⛔" : "⏳";
  const notes = row.notes ? `\n_${row.notes}_` : "";
  return `${emoji} *${row.status}*${primaryMarker}\n${uname}\nid: \`${row.userId}\`${notes}`;
}

export function taskCardKb(task: ProviderTask): InlineKeyboard {
  return new InlineKeyboard().text("Take", `t_take:${task.id}`).url("Open", task.url);
}

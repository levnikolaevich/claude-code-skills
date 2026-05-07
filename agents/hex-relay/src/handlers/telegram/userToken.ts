import type { Context } from "grammy";

export function userTokenFromContext(ctx: Context): string | null {
  const u = ctx.from;
  if (!u) return null;
  if (u.username) return u.username;
  return String(u.id);
}

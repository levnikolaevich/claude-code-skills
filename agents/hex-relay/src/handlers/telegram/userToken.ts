import type { Context } from "grammy";

export function userTokenFromContext(ctx: Context): string | null {
  const u = ctx.from;
  if (!u) return null;
  return u.username ? u.username : String(u.id);
}

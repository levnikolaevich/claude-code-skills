import type { Db } from "../client.js";
import type { AllowedUserRow, AllowedUserStatus } from "../../../domain/user.js";
import { mapUserRow } from "../rowMappers.js";

export interface AuthRejectArgs {
  fromUserId: number | null;
  username: string | null;
  chatId: number | null;
  eventKind: string;
  textPreview: string | null;
}

export interface UpsertUserArgs {
  userId: number;
  username: string | null;
  status: AllowedUserStatus;
  addedBy: number | null;
  notes?: string | null;
}

function nowTs(): number {
  return Math.floor(Date.now() / 1000);
}

export type UsersRepo = ReturnType<typeof createUsersRepo>;

export function createUsersRepo(db: Db) {
  const insertReject = db.prepare(
    "INSERT INTO auth_rejects (ts, from_user_id, username, chat_id, event_kind, text_preview) " +
      "VALUES (?, ?, ?, ?, ?, ?)"
  );
  const upsert = db.prepare(
    "INSERT INTO allowed_users (user_id, username, status, added_by, added_at, notes) " +
      "VALUES (?, ?, ?, ?, ?, ?) " +
      "ON CONFLICT(user_id) DO UPDATE SET " +
      "username=COALESCE(excluded.username, allowed_users.username), " +
      "status=excluded.status, " +
      "added_by=COALESCE(excluded.added_by, allowed_users.added_by), " +
      "notes=COALESCE(excluded.notes, allowed_users.notes)"
  );
  const allCache = db.prepare("SELECT user_id, status FROM allowed_users");
  const markPending = db.prepare(
    "UPDATE allowed_users SET pending_notified_at = ? WHERE user_id = ? AND pending_notified_at IS NULL"
  );
  const getRow = db.prepare("SELECT * FROM allowed_users WHERE user_id = ?");
  const list = db.prepare(
    "SELECT * FROM allowed_users " +
      "ORDER BY (status='pending') DESC, (status='allowed') DESC, added_at DESC"
  );
  const deleteUser = db.prepare("DELETE FROM allowed_users WHERE user_id = ?");

  return {
    insertAuthReject(args: AuthRejectArgs): void {
      const preview = (args.textPreview ?? "").slice(0, 200);
      insertReject.run(
        nowTs(),
        args.fromUserId,
        args.username,
        args.chatId,
        args.eventKind,
        preview
      );
    },
    upsert(args: UpsertUserArgs): void {
      upsert.run(
        args.userId,
        args.username,
        args.status,
        args.addedBy,
        nowTs(),
        args.notes ?? null
      );
    },
    allowlistCacheSnapshot(): Map<number, AllowedUserStatus> {
      const rows = allCache.all() as Record<string, unknown>[];
      const out = new Map<number, AllowedUserStatus>();
      for (const r of rows) {
        out.set(Number(r.user_id), String(r.status) as AllowedUserStatus);
      }
      return out;
    },
    markPendingNotified(userId: number): void {
      markPending.run(nowTs(), userId);
    },
    getRow(userId: number): AllowedUserRow | null {
      const row = getRow.get(userId) as Record<string, unknown> | undefined;
      return row ? mapUserRow(row) : null;
    },
    list(): AllowedUserRow[] {
      const rows = list.all() as Record<string, unknown>[];
      return rows.map(mapUserRow);
    },
    delete(userId: number): number {
      const result = deleteUser.run(userId);
      return Number(result.changes ?? 0);
    },
  };
}

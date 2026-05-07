import type { Db } from "../types.js";
import type { SessionRow } from "../../../domain/session.js";
import { type AgentKind, DEFAULT_AGENT } from "../../../domain/message.js";
import { mapSessionRow } from "../rowMappers.js";

export interface SessionUpsertArgs {
  sessionId: string;
  agent?: AgentKind;
  source: string;
  model: string | null;
  cwd: string | null;
  transcriptPath: string | null;
  previousSession?: string | null;
  createdByUserId?: number | null;
}

function nowTs(): number {
  return Math.floor(Date.now() / 1000);
}

export type SessionsRepo = ReturnType<typeof createSessionsRepo>;

export function createSessionsRepo(db: Db) {
  const closeOthersForOwner = db.prepare(
    "UPDATE sessions SET ended_at=?, end_reason='replaced' " +
      "WHERE ended_at IS NULL AND session_id != ? AND created_by_user_id = ?"
  );
  const insertIgnore = db.prepare(
    "INSERT OR IGNORE INTO sessions " +
      "(session_id, started_at, source, previous_session, model, cwd, transcript_path, created_by_user_id, agent) " +
      "VALUES (?,?,?,?,?,?,?,?,?)"
  );
  const tagOwnerIfMissing = db.prepare(
    "UPDATE sessions SET created_by_user_id=? " +
      "WHERE session_id=? AND created_by_user_id IS NULL"
  );
  const getOwner = db.prepare("SELECT created_by_user_id FROM sessions WHERE session_id = ?");
  const getById = db.prepare("SELECT * FROM sessions WHERE session_id = ?");
  const allOwners = db.prepare("SELECT session_id, created_by_user_id FROM sessions");
  const lastActive = db.prepare(
    "SELECT session_id FROM sessions WHERE ended_at IS NULL " + "ORDER BY started_at DESC LIMIT 1"
  );
  const lastActiveForOwner = db.prepare(
    "SELECT session_id FROM sessions WHERE ended_at IS NULL AND created_by_user_id = ? " +
      "ORDER BY started_at DESC LIMIT 1"
  );
  const markEnded = db.prepare("UPDATE sessions SET ended_at=?, end_reason=? WHERE session_id=?");
  const cwdFor = db.prepare("SELECT cwd FROM sessions WHERE session_id=? LIMIT 1");

  return {
    upsert(args: SessionUpsertArgs): void {
      const ts = nowTs();
      if (args.createdByUserId !== undefined && args.createdByUserId !== null) {
        closeOthersForOwner.run(ts, args.sessionId, args.createdByUserId);
      }
      insertIgnore.run(
        args.sessionId,
        ts,
        args.source,
        args.previousSession ?? null,
        args.model,
        args.cwd,
        args.transcriptPath,
        args.createdByUserId ?? null,
        args.agent ?? DEFAULT_AGENT
      );
      if (args.createdByUserId !== undefined && args.createdByUserId !== null) {
        tagOwnerIfMissing.run(args.createdByUserId, args.sessionId);
      }
    },
    getOwner(sessionId: string): number | null {
      const row = getOwner.get(sessionId) as Record<string, unknown> | undefined;
      if (!row) return null;
      const v = row.created_by_user_id;
      return v === null || v === undefined ? null : Number(v);
    },
    getById(sessionId: string): SessionRow | null {
      const row = getById.get(sessionId) as Record<string, unknown> | undefined;
      return row ? mapSessionRow(row) : null;
    },
    allOwners(): Map<string, number | null> {
      const rows = allOwners.all() as Record<string, unknown>[];
      const out = new Map<string, number | null>();
      for (const r of rows) {
        const sid = String(r.session_id);
        const v = r.created_by_user_id;
        out.set(sid, v === null || v === undefined ? null : Number(v));
      }
      return out;
    },
    lastActiveSid(ownerUserId?: number | null): string | null {
      const row =
        ownerUserId === undefined || ownerUserId === null
          ? (lastActive.get() as Record<string, unknown> | undefined)
          : (lastActiveForOwner.get(ownerUserId) as Record<string, unknown> | undefined);
      return row ? String(row.session_id) : null;
    },
    markEnded(sessionId: string, reason: string): void {
      markEnded.run(nowTs(), reason, sessionId);
    },
    cwdFor(sessionId: string): string | null {
      const row = cwdFor.get(sessionId) as Record<string, unknown> | undefined;
      const v = row?.cwd;
      return typeof v === "string" ? v : null;
    },
  };
}

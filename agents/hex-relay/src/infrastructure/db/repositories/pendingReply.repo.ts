import { createHash } from "node:crypto";
import type { Db } from "../types.js";
import { type PendingReply, type AgentKind, DEFAULT_AGENT } from "../../../domain/message.js";
import { mapPendingRow } from "../rowMappers.js";

function nowTs(): number {
  return Math.floor(Date.now() / 1000);
}

export type PendingReplyRepo = ReturnType<typeof createPendingReplyRepo>;

export function createPendingReplyRepo(db: Db) {
  const insert = db.prepare(
    "INSERT INTO pending_reply " +
      "(session_id, inbound_msg_id, prompt_hash, created_at, agent) VALUES (?,?,?,?,?) " +
      "ON CONFLICT(session_id, inbound_msg_id) DO UPDATE SET " +
      "prompt_hash=excluded.prompt_hash, " +
      "agent=excluded.agent, " +
      "created_at=excluded.created_at"
  );
  const getLatest = db.prepare(
    "SELECT * FROM pending_reply WHERE session_id=? " +
      "ORDER BY created_at DESC, inbound_msg_id DESC LIMIT 1"
  );
  const getAllForSessionStmt = db.prepare(
    "SELECT * FROM pending_reply WHERE session_id=? " +
      "ORDER BY created_at ASC, inbound_msg_id ASC"
  );
  const del = db.prepare("DELETE FROM pending_reply WHERE session_id=?");
  const delOne = db.prepare("DELETE FROM pending_reply WHERE session_id=? AND inbound_msg_id=?");
  const findStaleStmt = db.prepare(
    "SELECT * FROM pending_reply WHERE created_at <= ? " +
      "ORDER BY created_at ASC, inbound_msg_id ASC"
  );
  const listOthers = db.prepare("SELECT * FROM pending_reply WHERE session_id != ?");
  const countActive = db.prepare("SELECT COUNT(*) AS c FROM pending_reply WHERE created_at > ?");
  const hasOpenForUserAgentStmt = db.prepare(
    "SELECT 1 FROM pending_reply pr " +
      "INNER JOIN sessions s ON s.session_id = pr.session_id " +
      "WHERE s.created_by_user_id = ? AND pr.agent = ? LIMIT 1"
  );

  return {
    set(
      sessionId: string,
      inboundId: number,
      prompt: string,
      agent: AgentKind = DEFAULT_AGENT
    ): void {
      const hash = createHash("sha256").update(prompt, "utf8").digest("hex");
      insert.run(sessionId, inboundId, hash, nowTs(), agent);
    },
    get(sessionId: string): PendingReply | null {
      const row = getLatest.get(sessionId) as Record<string, unknown> | undefined;
      return row ? mapPendingRow(row) : null;
    },
    getAllForSession(sessionId: string): PendingReply[] {
      const rows = getAllForSessionStmt.all(sessionId) as Record<string, unknown>[];
      return rows.map(mapPendingRow);
    },
    clear(sessionId: string): void {
      del.run(sessionId);
    },
    deleteOne(sessionId: string, inboundId: number): void {
      delOne.run(sessionId, inboundId);
    },
    findStaleOlderThan(retentionSec: number): PendingReply[] {
      const cutoff = nowTs() - retentionSec;
      const rows = findStaleStmt.all(cutoff) as Record<string, unknown>[];
      return rows.map(mapPendingRow);
    },
    listOthers(currentSessionId: string): PendingReply[] {
      const rows = listOthers.all(currentSessionId) as Record<string, unknown>[];
      return rows.map(mapPendingRow);
    },
    countActive(ttlSec = 3600): number {
      const r = countActive.get(nowTs() - ttlSec) as { c: number };
      return r.c;
    },
    hasOpenForUserAgent(userId: number, agent: AgentKind): boolean {
      const row = hasOpenForUserAgentStmt.get(userId, agent) as { 1: number } | undefined;
      return row !== undefined;
    },
  };
}

import { createHash } from "node:crypto";
import type { Db } from "../client.js";
import type { PendingReply } from "../../../domain/message.js";
import { mapPendingRow } from "../rowMappers.js";

function nowTs(): number {
  return Math.floor(Date.now() / 1000);
}

export type PendingReplyRepo = ReturnType<typeof createPendingReplyRepo>;

export function createPendingReplyRepo(db: Db) {
  const insert = db.prepare(
    "INSERT OR IGNORE INTO pending_reply " +
      "(session_id, inbound_msg_id, prompt_hash, created_at) VALUES (?,?,?,?)"
  );
  const get = db.prepare("SELECT * FROM pending_reply WHERE session_id=?");
  const del = db.prepare("DELETE FROM pending_reply WHERE session_id=?");
  const listOthers = db.prepare("SELECT * FROM pending_reply WHERE session_id != ?");
  const countActive = db.prepare("SELECT COUNT(*) AS c FROM pending_reply WHERE created_at > ?");

  return {
    set(sessionId: string, inboundId: number, prompt: string): void {
      const hash = createHash("sha256").update(prompt, "utf8").digest("hex");
      insert.run(sessionId, inboundId, hash, nowTs());
    },
    get(sessionId: string): PendingReply | null {
      const row = get.get(sessionId) as Record<string, unknown> | undefined;
      return row ? mapPendingRow(row) : null;
    },
    clear(sessionId: string): void {
      del.run(sessionId);
    },
    listOthers(currentSessionId: string): PendingReply[] {
      const rows = listOthers.all(currentSessionId) as Record<string, unknown>[];
      return rows.map(mapPendingRow);
    },
    countActive(ttlSec = 3600): number {
      const r = countActive.get(nowTs() - ttlSec) as { c: number };
      return r.c;
    },
  };
}

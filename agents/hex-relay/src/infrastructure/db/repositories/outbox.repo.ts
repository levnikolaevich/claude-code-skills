import type { Db } from "../client.js";
import type { OutboxEventType, OutboxRow, OutboxStatus } from "../../../domain/message.js";
import { mapOutboxRow } from "../rowMappers.js";

export interface OutboxEnqueueArgs {
  text: string;
  chatId: number;
  repliedToId: number | null;
  sessionId: string | null;
  auditMsgId?: number | null;
  eventType?: OutboxEventType;
}

export interface OutboxUpdate {
  status?: OutboxStatus;
  attempts?: number;
  nextAttemptAt?: number;
  tgMsgId?: number | null;
  error?: string | null;
  auditMsgId?: number | null;
}

export interface OutboxStatusCounts {
  queued: number;
  abandoned: number;
  unknown: number;
}

const FIELD_MAP: Record<keyof OutboxUpdate, string> = {
  status: "status",
  attempts: "attempts",
  nextAttemptAt: "next_attempt_at",
  tgMsgId: "tg_msg_id",
  error: "error",
  auditMsgId: "audit_msg_id",
};

function nowTs(): number {
  return Math.floor(Date.now() / 1000);
}

export type OutboxRepo = ReturnType<typeof createOutboxRepo>;

export function createOutboxRepo(db: Db) {
  const enqueue = db.prepare(
    "INSERT INTO outbox (ts, text, chat_id, status, next_attempt_at, " +
      "replied_to_id, session_id, audit_msg_id, event_type) " +
      "VALUES (?,?,?,'queued',?,?,?,?,?)"
  );
  const selectDue = db.prepare(
    "SELECT * FROM outbox WHERE status='queued' AND next_attempt_at<=? " + "ORDER BY id LIMIT ?"
  );
  const countQueued = db.prepare("SELECT COUNT(*) AS c FROM outbox WHERE status='queued'");
  const countAbandoned = db.prepare("SELECT COUNT(*) AS c FROM outbox WHERE status='abandoned'");
  const countUnknown = db.prepare("SELECT COUNT(*) AS c FROM outbox WHERE status='unknown'");

  return {
    enqueue(args: OutboxEnqueueArgs): number {
      const ts = nowTs();
      const result = enqueue.run(
        ts,
        args.text,
        args.chatId,
        ts,
        args.repliedToId,
        args.sessionId,
        args.auditMsgId ?? null,
        args.eventType ?? "reply"
      );
      return Number(result.lastInsertRowid);
    },
    selectDue(limit = 5): OutboxRow[] {
      const rows = selectDue.all(nowTs(), limit) as Record<string, unknown>[];
      return rows.map(mapOutboxRow);
    },
    update(rowId: number, fields: OutboxUpdate): void {
      const entries = Object.entries(fields).filter(([, v]) => v !== undefined);
      if (entries.length === 0) return;
      const cols = entries.map(([k]) => `${FIELD_MAP[k as keyof OutboxUpdate]}=?`).join(", ");
      const values = entries.map(([, v]) => v as unknown);
      db.prepare(`UPDATE outbox SET ${cols} WHERE id=?`).run(...(values as never[]), rowId);
    },
    counts(): OutboxStatusCounts {
      const q = countQueued.get() as { c: number };
      const a = countAbandoned.get() as { c: number };
      const u = countUnknown.get() as { c: number };
      return { queued: q.c, abandoned: a.c, unknown: u.c };
    },
  };
}

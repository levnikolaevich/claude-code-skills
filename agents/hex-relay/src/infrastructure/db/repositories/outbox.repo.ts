import type { Db } from "../types.js";
import {
  type OutboxEventType,
  type OutboxRow,
  type OutboxStatus,
  type AgentKind,
  DEFAULT_AGENT,
} from "../../../domain/message.js";
import { mapOutboxRow } from "../rowMappers.js";
import { observeDbOperation } from "../../../observability/metrics.js";
import { buildUpdateSet } from "./updateSet.js";

export interface OutboxEnqueueArgs {
  text: string;
  chatId: number;
  repliedToId: number | null;
  sessionId: string | null;
  auditMsgId?: number | null;
  eventType?: OutboxEventType;
  agent?: AgentKind;
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
      "replied_to_id, session_id, audit_msg_id, event_type, agent) " +
      "VALUES (?,?,?,'queued',?,?,?,?,?,?)"
  );
  const selectDue = db.prepare(
    "SELECT * FROM outbox WHERE status='queued' AND next_attempt_at<=? " + "ORDER BY id LIMIT ?"
  );
  const claimDueSelect = db.prepare(
    "SELECT id FROM outbox WHERE status='queued' AND next_attempt_at<=? ORDER BY id LIMIT ?"
  );
  const claimDueUpdate = db.prepare(
    "UPDATE outbox SET status='sending' WHERE id=? AND status='queued'"
  );
  const findById = db.prepare("SELECT * FROM outbox WHERE id=? LIMIT 1");
  const countQueued = db.prepare("SELECT COUNT(*) AS c FROM outbox WHERE status='queued'");
  const countAbandoned = db.prepare("SELECT COUNT(*) AS c FROM outbox WHERE status='abandoned'");
  const countUnknown = db.prepare("SELECT COUNT(*) AS c FROM outbox WHERE status='unknown'");

  const claimDueTxn = db.transaction((ts: number, limit: number) => {
    const selected = claimDueSelect.all(ts, limit) as { id: number }[];
    const claimed: Record<string, unknown>[] = [];
    for (const row of selected) {
      const result = claimDueUpdate.run(row.id);
      if (result.changes !== 1) continue;
      const claimedRow = findById.get(row.id) as Record<string, unknown> | undefined;
      if (claimedRow) claimed.push(claimedRow);
    }
    return claimed;
  });

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
        args.eventType ?? "reply",
        args.agent ?? DEFAULT_AGENT
      );
      return Number(result.lastInsertRowid);
    },
    selectDue(limit = 5): OutboxRow[] {
      const rows = selectDue.all(nowTs(), limit) as Record<string, unknown>[];
      return rows.map(mapOutboxRow);
    },
    claimDue(limit = 5): OutboxRow[] {
      const started = performance.now();
      try {
        const rows = claimDueTxn(nowTs(), limit);
        return rows.map(mapOutboxRow);
      } finally {
        observeDbOperation("outbox.claimDue", performance.now() - started);
      }
    },
    update(rowId: number, fields: OutboxUpdate): void {
      const updateSet = buildUpdateSet<OutboxUpdate>(fields, FIELD_MAP);
      if (!updateSet) return;
      db.prepare(`UPDATE outbox SET ${updateSet.clause} WHERE id=?`).run(
        ...updateSet.values,
        rowId
      );
    },
    counts(): OutboxStatusCounts {
      const q = countQueued.get() as { c: number };
      const a = countAbandoned.get() as { c: number };
      const u = countUnknown.get() as { c: number };
      return { queued: q.c, abandoned: a.c, unknown: u.c };
    },
  };
}

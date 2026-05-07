import type { Db } from "../types.js";
import {
  type InboundMessage,
  type MessageKind,
  type MessageStatus,
  type AgentKind,
  DEFAULT_AGENT,
} from "../../../domain/message.js";
import { mapInboundRow } from "../rowMappers.js";
import { observeDbOperation } from "../../../observability/metrics.js";
import { buildUpdateSet } from "./updateSet.js";

export interface MessageUpdate {
  status?: MessageStatus;
  kind?: MessageKind;
  sessionId?: string | null;
  attempts?: number;
  nextAttemptAt?: number;
  deliveredAt?: number | null;
  error?: string | null;
  repliedToId?: number | null;
  text?: string;
  mediaPath?: string | null;
}

export interface MessageCounts {
  inboundQueued: number;
  inboundFailed: number;
  inboundRejected: number;
}

const FIELD_MAP: Record<keyof MessageUpdate, string> = {
  status: "status",
  kind: "kind",
  sessionId: "session_id",
  attempts: "attempts",
  nextAttemptAt: "next_attempt_at",
  deliveredAt: "delivered_at",
  error: "error",
  repliedToId: "replied_to_id",
  text: "text",
  mediaPath: "media_path",
};

function nowTs(): number {
  return Math.floor(Date.now() / 1000);
}

export type MessagesRepo = ReturnType<typeof createMessagesRepo>;

export function createMessagesRepo(db: Db) {
  const insertInbound = db.prepare(
    "INSERT INTO messages " +
      "(ts, direction, kind, status, text, tg_chat_id, tg_msg_id, from_user_id, next_attempt_at, agent) " +
      "VALUES (?, 'inbound', 'text', 'queued', ?, ?, ?, ?, ?, ?)"
  );
  const insertTranscribingVoice = db.prepare(
    "INSERT INTO messages " +
      "(ts, direction, kind, status, text, tg_chat_id, tg_msg_id, from_user_id, media_path, next_attempt_at, agent) " +
      "VALUES (?, 'inbound', 'voice', 'transcribing', '', ?, ?, ?, ?, ?, ?)"
  );
  const insertRejected = db.prepare(
    "INSERT INTO messages (ts, direction, kind, status, text, tg_chat_id, tg_msg_id, error, agent) " +
      "VALUES (?, 'inbound', 'text', 'rejected', ?, ?, ?, ?, ?)"
  );
  const insertOutboundAudit = db.prepare(
    "INSERT INTO messages (ts, direction, status, text, session_id, replied_to_id, agent) " +
      "VALUES (?, 'outbound', 'queued', ?, ?, ?, ?)"
  );
  const selectDue = db.prepare(
    "SELECT * FROM messages WHERE direction='inbound' " +
      "AND status='queued' AND next_attempt_at<=? ORDER BY id LIMIT ?"
  );
  const claimDueSelect = db.prepare(
    "SELECT id FROM messages WHERE direction='inbound' " +
      "AND status='queued' AND next_attempt_at<=? ORDER BY id LIMIT ?"
  );
  const claimDueUpdate = db.prepare(
    "UPDATE messages SET status='delivering' WHERE id=? AND status='queued'"
  );
  const selectTranscribing = db.prepare(
    "SELECT * FROM messages WHERE direction='inbound' " +
      "AND status='transcribing' ORDER BY id LIMIT ?"
  );
  const findByTg = db.prepare(
    "SELECT * FROM messages WHERE direction='inbound' " + "AND tg_chat_id=? AND tg_msg_id=? LIMIT 1"
  );
  const findById = db.prepare("SELECT * FROM messages WHERE id=? LIMIT 1");
  const getChatIdById = db.prepare("SELECT tg_chat_id FROM messages WHERE id = ?");
  const countInboundQueued = db.prepare(
    "SELECT COUNT(*) AS c FROM messages WHERE direction='inbound' AND status='queued'"
  );
  const countInboundFailed = db.prepare(
    "SELECT COUNT(*) AS c FROM messages WHERE direction='inbound' " +
      "AND status IN ('failed','abandoned')"
  );
  const countInboundRejected = db.prepare(
    "SELECT COUNT(*) AS c FROM messages WHERE direction='inbound' AND status='rejected'"
  );
  const lastActivityForUserAgent = db.prepare(
    "SELECT MAX(ts) AS ts FROM messages " +
      "WHERE agent = ? AND (" +
      "  (direction = 'inbound' AND from_user_id = ?) " +
      "  OR (direction = 'outbound' AND replied_to_id IN " +
      "    (SELECT id FROM messages WHERE direction = 'inbound' AND from_user_id = ?))" +
      ")"
  );
  const hasActiveInboundForUserAgent = db.prepare(
    "SELECT 1 FROM messages " +
      "WHERE direction='inbound' AND from_user_id=? AND agent=? " +
      "AND status IN ('queued','delivering','transcribing') LIMIT 1"
  );

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
    insertInbound(
      text: string,
      tgChatId: number,
      tgMsgId: number,
      fromUserId: number,
      agent: AgentKind = DEFAULT_AGENT
    ): number {
      const ts = nowTs();
      const result = insertInbound.run(ts, text, tgChatId, tgMsgId, fromUserId, ts, agent);
      return Number(result.lastInsertRowid);
    },
    insertTranscribingVoice(
      tgChatId: number,
      tgMsgId: number,
      fromUserId: number,
      mediaPath: string,
      agent: AgentKind = DEFAULT_AGENT
    ): number {
      const ts = nowTs();
      const result = insertTranscribingVoice.run(
        ts,
        tgChatId,
        tgMsgId,
        fromUserId,
        mediaPath,
        ts,
        agent
      );
      return Number(result.lastInsertRowid);
    },
    insertRejected(
      text: string,
      tgChatId: number,
      tgMsgId: number,
      error: string,
      agent: AgentKind = DEFAULT_AGENT
    ): number {
      const result = insertRejected.run(nowTs(), text, tgChatId, tgMsgId, error, agent);
      return Number(result.lastInsertRowid);
    },
    insertOutboundAudit(
      text: string,
      sessionId: string | null,
      repliedToId: number | null,
      agent: AgentKind = DEFAULT_AGENT
    ): number {
      const result = insertOutboundAudit.run(nowTs(), text, sessionId, repliedToId, agent);
      return Number(result.lastInsertRowid);
    },
    selectDue(limit = 5): InboundMessage[] {
      const rows = selectDue.all(nowTs(), limit) as Record<string, unknown>[];
      return rows.map(mapInboundRow);
    },
    claimDue(limit = 5): InboundMessage[] {
      const started = performance.now();
      try {
        const rows = claimDueTxn(nowTs(), limit);
        return rows.map(mapInboundRow);
      } finally {
        observeDbOperation("messages.claimDue", performance.now() - started);
      }
    },
    selectTranscribing(limit = 2): InboundMessage[] {
      const started = performance.now();
      try {
        const rows = selectTranscribing.all(limit) as Record<string, unknown>[];
        return rows.map(mapInboundRow);
      } finally {
        observeDbOperation("messages.selectTranscribing", performance.now() - started);
      }
    },
    update(msgId: number, fields: MessageUpdate): void {
      const updateSet = buildUpdateSet<MessageUpdate>(fields, FIELD_MAP);
      if (!updateSet) return;
      const started = performance.now();
      try {
        db.prepare(`UPDATE messages SET ${updateSet.clause} WHERE id=?`).run(
          ...updateSet.values,
          msgId
        );
      } finally {
        observeDbOperation("messages.update", performance.now() - started);
      }
    },
    findByTg(chatId: number, msgId: number): InboundMessage | null {
      const row = findByTg.get(chatId, msgId) as Record<string, unknown> | undefined;
      return row ? mapInboundRow(row) : null;
    },
    findById(id: number): InboundMessage | null {
      const row = findById.get(id) as Record<string, unknown> | undefined;
      return row ? mapInboundRow(row) : null;
    },
    getChatId(id: number): number | null {
      const row = getChatIdById.get(id) as Record<string, unknown> | undefined;
      const v = row?.tg_chat_id;
      return v === null || v === undefined ? null : Number(v);
    },
    counts(): MessageCounts {
      const q = countInboundQueued.get() as { c: number };
      const f = countInboundFailed.get() as { c: number };
      const r = countInboundRejected.get() as { c: number };
      return {
        inboundQueued: q.c,
        inboundFailed: f.c,
        inboundRejected: r.c,
      };
    },
    lastActivityForUserAgent(userId: number, agent: AgentKind): number | null {
      const row = lastActivityForUserAgent.get(agent, userId, userId) as
        | { ts: number | null }
        | undefined;
      return row?.ts ?? null;
    },
    hasActiveInboundForUserAgent(userId: number, agent: AgentKind): boolean {
      return hasActiveInboundForUserAgent.get(userId, agent) !== undefined;
    },
  };
}

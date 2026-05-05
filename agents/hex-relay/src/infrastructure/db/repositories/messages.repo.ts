import type { Db } from "../client.js";
import type { InboundMessage, MessageKind, MessageStatus } from "../../../domain/message.js";
import { mapInboundRow } from "../rowMappers.js";

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
      "(ts, direction, kind, status, text, tg_chat_id, tg_msg_id, from_user_id, next_attempt_at) " +
      "VALUES (?, 'inbound', 'text', 'queued', ?, ?, ?, ?, ?)"
  );
  const insertTranscribingVoice = db.prepare(
    "INSERT INTO messages " +
      "(ts, direction, kind, status, text, tg_chat_id, tg_msg_id, from_user_id, media_path, next_attempt_at) " +
      "VALUES (?, 'inbound', 'voice', 'transcribing', '', ?, ?, ?, ?, ?)"
  );
  const insertRejected = db.prepare(
    "INSERT INTO messages (ts, direction, kind, status, text, tg_chat_id, tg_msg_id, error) " +
      "VALUES (?, 'inbound', 'text', 'rejected', ?, ?, ?, ?)"
  );
  const insertOutboundAudit = db.prepare(
    "INSERT INTO messages (ts, direction, status, text, session_id, replied_to_id) " +
      "VALUES (?, 'outbound', 'queued', ?, ?, ?)"
  );
  const selectDue = db.prepare(
    "SELECT * FROM messages WHERE direction='inbound' " +
      "AND status='queued' AND next_attempt_at<=? ORDER BY id LIMIT ?"
  );
  const selectTranscribing = db.prepare(
    "SELECT * FROM messages WHERE direction='inbound' " +
      "AND status='transcribing' ORDER BY id LIMIT ?"
  );
  const findByTg = db.prepare(
    "SELECT * FROM messages WHERE direction='inbound' " + "AND tg_chat_id=? AND tg_msg_id=? LIMIT 1"
  );
  const findRecentDeliveredVoiceByText = db.prepare(
    "SELECT * FROM messages WHERE direction='inbound' AND kind='voice' " +
      "AND status IN ('delivering','delivered') AND session_id IS NULL " +
      "AND text=? AND COALESCE(delivered_at, next_attempt_at, ts)>=? ORDER BY id DESC LIMIT 1"
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

  return {
    insertInbound(text: string, tgChatId: number, tgMsgId: number, fromUserId: number): number {
      const ts = nowTs();
      const result = insertInbound.run(ts, text, tgChatId, tgMsgId, fromUserId, ts);
      return Number(result.lastInsertRowid);
    },
    insertTranscribingVoice(
      tgChatId: number,
      tgMsgId: number,
      fromUserId: number,
      mediaPath: string
    ): number {
      const ts = nowTs();
      const result = insertTranscribingVoice.run(ts, tgChatId, tgMsgId, fromUserId, mediaPath, ts);
      return Number(result.lastInsertRowid);
    },
    insertRejected(text: string, tgChatId: number, tgMsgId: number, error: string): number {
      const result = insertRejected.run(nowTs(), text, tgChatId, tgMsgId, error);
      return Number(result.lastInsertRowid);
    },
    insertOutboundAudit(
      text: string,
      sessionId: string | null,
      repliedToId: number | null
    ): number {
      const result = insertOutboundAudit.run(nowTs(), text, sessionId, repliedToId);
      return Number(result.lastInsertRowid);
    },
    selectDue(limit = 5): InboundMessage[] {
      const rows = selectDue.all(nowTs(), limit) as Record<string, unknown>[];
      return rows.map(mapInboundRow);
    },
    selectTranscribing(limit = 2): InboundMessage[] {
      const rows = selectTranscribing.all(limit) as Record<string, unknown>[];
      return rows.map(mapInboundRow);
    },
    update(msgId: number, fields: MessageUpdate): void {
      const entries = Object.entries(fields).filter(([, v]) => v !== undefined);
      if (entries.length === 0) return;
      const cols = entries.map(([k]) => `${FIELD_MAP[k as keyof MessageUpdate]}=?`).join(", ");
      const values = entries.map(([, v]) => v as unknown);
      db.prepare(`UPDATE messages SET ${cols} WHERE id=?`).run(...(values as never[]), msgId);
    },
    findByTg(chatId: number, msgId: number): InboundMessage | null {
      const row = findByTg.get(chatId, msgId) as Record<string, unknown> | undefined;
      return row ? mapInboundRow(row) : null;
    },
    findRecentDeliveredVoiceByText(text: string, ttlSec = 300): InboundMessage | null {
      const row = findRecentDeliveredVoiceByText.get(text, nowTs() - ttlSec) as
        | Record<string, unknown>
        | undefined;
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
  };
}

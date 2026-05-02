export type MessageDirection = "inbound" | "outbound";
export type MessageKind = "text" | "image" | "document";
export type MessageStatus =
  | "queued"
  | "delivering"
  | "delivered"
  | "failed"
  | "abandoned"
  | "rejected";

export interface InboundMessage {
  id: number;
  ts: number;
  direction: "inbound";
  kind: MessageKind;
  status: MessageStatus;
  text: string;
  tgChatId: number | null;
  tgMsgId: number | null;
  sessionId: string | null;
  attempts: number;
  nextAttemptAt: number;
  deliveredAt: number | null;
  error: string | null;
}

export type OutboxStatus = "queued" | "sending" | "sent" | "abandoned" | "unknown";

export type OutboxEventType =
  | "reply"
  | "status_skill"
  | "status_todo"
  | "status_subagent"
  | "system";

export interface OutboxRow {
  id: number;
  ts: number;
  text: string;
  chatId: number;
  status: OutboxStatus;
  attempts: number;
  nextAttemptAt: number;
  repliedToId: number | null;
  sessionId: string | null;
  tgMsgId: number | null;
  auditMsgId: number | null;
  eventType: OutboxEventType;
  error: string | null;
}

export interface PendingReply {
  sessionId: string;
  inboundMsgId: number;
  promptHash: string;
  createdAt: number;
}

export const isStatusEvent = (e: OutboxEventType): boolean =>
  e === "status_skill" || e === "status_todo" || e === "status_subagent";

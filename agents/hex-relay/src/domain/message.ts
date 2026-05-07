export type MessageDirection = "inbound" | "outbound";
export type AgentKind = "claude" | "codex";
export const DEFAULT_AGENT: AgentKind = "claude";
export function isAgentKind(value: unknown): value is AgentKind {
  return value === "claude" || value === "codex";
}

export type MessageKind = "text" | "image" | "document" | "voice";
export type MessageStatus =
  | "queued"
  | "transcribing"
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
  fromUserId: number | null;
  sessionId: string | null;
  mediaPath: string | null;
  attempts: number;
  nextAttemptAt: number;
  deliveredAt: number | null;
  error: string | null;
  agent: AgentKind;
}

export type OutboxStatus = "queued" | "sending" | "sent" | "abandoned" | "unknown";

export type OutboxEventType =
  | "reply"
  | "ack"
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
  agent: AgentKind;
}

export interface PendingReply {
  sessionId: string;
  inboundMsgId: number;
  promptHash: string;
  createdAt: number;
  agent: AgentKind;
}

export const isStatusEvent = (e: OutboxEventType): boolean =>
  e === "status_skill" || e === "status_todo" || e === "status_subagent";

import type {
  InboundMessage,
  OutboxRow,
  OutboxStatus,
  MessageStatus,
  MessageKind,
  OutboxEventType,
  PendingReply,
} from "../../domain/message.js";
import type { SessionRow } from "../../domain/session.js";
import type { DispatchPhase, DispatchRunStatus, DispatchRun } from "../../domain/dispatch.js";
import type { MemoryRow } from "../../domain/memory.js";
import type { AllowedUserRow, AllowedUserStatus } from "../../domain/user.js";
import type { TodoStateRow } from "../../domain/todoState.js";

type Row = Record<string, unknown>;

function num(v: unknown): number {
  return typeof v === "number" ? v : Number(v);
}
function numOrNull(v: unknown): number | null {
  return v === null || v === undefined ? null : num(v);
}
function str(v: unknown): string {
  if (typeof v === "string") return v;
  if (v === null || v === undefined) return "";
  if (typeof v === "number" || typeof v === "boolean" || typeof v === "bigint") return String(v);
  return JSON.stringify(v) ?? "";
}
function strOrNull(v: unknown): string | null {
  return v === null || v === undefined ? null : str(v);
}

export function mapInboundRow(r: Row): InboundMessage {
  return {
    id: num(r.id),
    ts: num(r.ts),
    direction: "inbound",
    kind: str(r.kind) as MessageKind,
    status: str(r.status) as MessageStatus,
    text: str(r.text),
    tgChatId: numOrNull(r.tg_chat_id),
    tgMsgId: numOrNull(r.tg_msg_id),
    sessionId: strOrNull(r.session_id),
    attempts: num(r.attempts ?? 0),
    nextAttemptAt: num(r.next_attempt_at ?? 0),
    deliveredAt: numOrNull(r.delivered_at),
    error: strOrNull(r.error),
  };
}

export function mapOutboxRow(r: Row): OutboxRow {
  return {
    id: num(r.id),
    ts: num(r.ts),
    text: str(r.text),
    chatId: num(r.chat_id),
    status: str(r.status) as OutboxStatus,
    attempts: num(r.attempts ?? 0),
    nextAttemptAt: num(r.next_attempt_at ?? 0),
    repliedToId: numOrNull(r.replied_to_id),
    sessionId: strOrNull(r.session_id),
    tgMsgId: numOrNull(r.tg_msg_id),
    auditMsgId: numOrNull(r.audit_msg_id),
    eventType: (strOrNull(r.event_type) ?? "reply") as OutboxEventType,
    error: strOrNull(r.error),
  };
}

export function mapPendingRow(r: Row): PendingReply {
  return {
    sessionId: str(r.session_id),
    inboundMsgId: num(r.inbound_msg_id),
    promptHash: str(r.prompt_hash),
    createdAt: num(r.created_at),
  };
}

export function mapSessionRow(r: Row): SessionRow {
  return {
    sessionId: str(r.session_id),
    startedAt: num(r.started_at),
    endedAt: numOrNull(r.ended_at),
    source: str(r.source),
    previousSession: strOrNull(r.previous_session),
    model: strOrNull(r.model),
    cwd: strOrNull(r.cwd),
    transcriptPath: strOrNull(r.transcript_path),
    endReason: strOrNull(r.end_reason),
    createdByUserId: numOrNull(r.created_by_user_id),
  };
}

export function mapDispatchRun(r: Row, phases: DispatchPhase[]): DispatchRun {
  return {
    id: num(r.id),
    tsStarted: num(r.ts_started),
    tsFinished: numOrNull(r.ts_finished),
    trigger: str(r.trigger),
    sessionId: strOrNull(r.session_id),
    issueNumber: numOrNull(r.issue_number),
    issueTitle: strOrNull(r.issue_title),
    status: str(r.status) as DispatchRunStatus,
    budget5hPct: numOrNull(r.budget_5h_pct),
    budgetWeekPct: numOrNull(r.budget_week_pct),
    prNumber: numOrNull(r.pr_number),
    prUrl: strOrNull(r.pr_url),
    branch: strOrNull(r.branch),
    error: strOrNull(r.error),
    phases,
  };
}

export function mapDispatchPhase(r: Row): DispatchPhase {
  return {
    id: num(r.id),
    runId: num(r.run_id),
    phase: str(r.phase),
    tsStarted: num(r.ts_started),
    tsFinished: numOrNull(r.ts_finished),
    status: str(r.status),
    verdict: strOrNull(r.verdict),
    details: strOrNull(r.details),
  };
}

export function mapMemoryRow(r: Row): MemoryRow {
  return {
    id: num(r.id),
    tsCreated: num(r.ts_created),
    tsUsed: numOrNull(r.ts_used),
    category: str(r.category),
    text: str(r.text),
    tags: strOrNull(r.tags),
    source: strOrNull(r.source),
    expiresAt: numOrNull(r.expires_at),
  };
}

export function mapUserRow(r: Row): AllowedUserRow {
  return {
    userId: num(r.user_id),
    username: strOrNull(r.username),
    status: str(r.status) as AllowedUserStatus,
    addedBy: numOrNull(r.added_by),
    addedAt: num(r.added_at),
    pendingNotifiedAt: numOrNull(r.pending_notified_at),
    notes: strOrNull(r.notes),
  };
}

export function mapTodoRow(r: Row): TodoStateRow {
  return {
    sessionId: str(r.session_id),
    taskId: str(r.task_id),
    status: str(r.status),
    content: str(r.content),
    activeForm: strOrNull(r.active_form),
    updatedAt: num(r.updated_at),
  };
}

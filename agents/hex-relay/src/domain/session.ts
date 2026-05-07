import type { AgentKind } from "./message.js";

export interface SessionRow {
  sessionId: string;
  startedAt: number;
  endedAt: number | null;
  source: string;
  previousSession: string | null;
  model: string | null;
  cwd: string | null;
  transcriptPath: string | null;
  endReason: string | null;
  createdByUserId: number | null;
  agent: AgentKind;
}

export type SessionEventKind =
  | "session_start"
  | "user_prompt_submit"
  | "stop"
  | "stop_failure"
  | "subagent_stop";

export interface SessionListItem {
  sid: string;
  slug: string;
  ts: number;
  owner: number | null;
}

/**
 * Attribution rule used by session_start hook:
 * - if the session is already known -> keep its recorded owner
 * - if last-god-command.json yields operator_chat_id → that
 * - else if previous session exists → inherit owner (fallback to primary)
 * - else → primary operator
 */
export function resolveSessionOwner(args: {
  existingOwner: number | null;
  fromCommandFile: number | null;
  previousOwner: number | null;
  primaryOperator: number;
}): number {
  if (args.existingOwner !== null) return args.existingOwner;
  if (args.fromCommandFile !== null) return args.fromCommandFile;
  if (args.previousOwner !== null) return args.previousOwner;
  return args.primaryOperator;
}

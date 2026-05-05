import type { MemoryRow } from "../../domain/memory.js";
import type { DispatchPhase, DispatchRun } from "../../domain/dispatch.js";

export interface MemoryWire {
  id: number;
  ts_created: number;
  ts_used: number | null;
  category: string;
  text: string;
  tags: string | null;
  source: string | null;
  expires_at: number | null;
}

export interface DispatchPhaseWire {
  id: number;
  run_id: number;
  phase: string;
  ts_started: number;
  ts_finished: number | null;
  status: string;
  verdict: string | null;
  details: string | null;
}

export interface DispatchRunWire {
  id: number;
  ts_started: number;
  ts_finished: number | null;
  trigger: string;
  session_id: string | null;
  issue_number: number | null;
  issue_title: string | null;
  status: string;
  budget_5h_pct: number | null;
  budget_week_pct: number | null;
  pr_number: number | null;
  pr_url: string | null;
  branch: string | null;
  error: string | null;
  phases: DispatchPhaseWire[];
}

export function memoryRowToWire(r: MemoryRow): MemoryWire {
  return {
    id: r.id,
    ts_created: r.tsCreated,
    ts_used: r.tsUsed,
    category: r.category,
    text: r.text,
    tags: r.tags,
    source: r.source,
    expires_at: r.expiresAt,
  };
}

export function dispatchPhaseToWire(p: DispatchPhase): DispatchPhaseWire {
  return {
    id: p.id,
    run_id: p.runId,
    phase: p.phase,
    ts_started: p.tsStarted,
    ts_finished: p.tsFinished,
    status: p.status,
    verdict: p.verdict,
    details: p.details,
  };
}

export function dispatchRunToWire(r: DispatchRun): DispatchRunWire {
  return {
    id: r.id,
    ts_started: r.tsStarted,
    ts_finished: r.tsFinished,
    trigger: r.trigger,
    session_id: r.sessionId,
    issue_number: r.issueNumber,
    issue_title: r.issueTitle,
    status: r.status,
    budget_5h_pct: r.budget5hPct,
    budget_week_pct: r.budgetWeekPct,
    pr_number: r.prNumber,
    pr_url: r.prUrl,
    branch: r.branch,
    error: r.error,
    phases: r.phases.map(dispatchPhaseToWire),
  };
}

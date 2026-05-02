export type DispatchRunStatus = "started" | "running" | "finished" | "failed" | "abandoned";

export type DispatchPhaseStatus = "running" | "done" | "failed" | "skipped";

export interface DispatchRun {
  id: number;
  tsStarted: number;
  tsFinished: number | null;
  trigger: string;
  sessionId: string | null;
  issueNumber: number | null;
  issueTitle: string | null;
  status: DispatchRunStatus;
  budget5hPct: number | null;
  budgetWeekPct: number | null;
  prNumber: number | null;
  prUrl: string | null;
  branch: string | null;
  error: string | null;
  phases: DispatchPhase[];
}

export interface DispatchPhase {
  id: number;
  runId: number;
  phase: string;
  tsStarted: number;
  tsFinished: number | null;
  status: DispatchPhaseStatus | (string & {});
  verdict: string | null;
  details: string | null;
}

import type { Db } from "../client.js";
import type {
  DispatchPhase,
  DispatchPhaseStatus,
  DispatchRun,
  DispatchRunStatus,
} from "../../../domain/dispatch.js";
import { mapDispatchPhase, mapDispatchRun } from "../rowMappers.js";

export interface DispatchStartArgs {
  trigger: string;
  sessionId: string | null;
  issueNumber: number | null;
  issueTitle: string | null;
  budget5h: number | null;
  budgetWeek: number | null;
}

export interface DispatchPhaseArgs {
  runId: number;
  phase: string;
  status: DispatchPhaseStatus;
  verdict: string | null;
  details: string | null;
}

export interface DispatchEndArgs {
  status: DispatchRunStatus;
  prNumber: number | null;
  prUrl: string | null;
  branch: string | null;
  error: string | null;
}

function nowTs(): number {
  return Math.floor(Date.now() / 1000);
}

export type DispatchRepo = ReturnType<typeof createDispatchRepo>;

export function createDispatchRepo(db: Db) {
  const insertRun = db.prepare(
    "INSERT INTO dispatch_runs (ts_started, trigger, session_id, issue_number, " +
      "issue_title, status, budget_5h_pct, budget_week_pct) " +
      "VALUES (?,?,?,?,?,'started',?,?)"
  );
  const findOpenPhase = db.prepare(
    "SELECT id FROM dispatch_phases WHERE run_id=? AND phase=? AND ts_finished IS NULL"
  );
  const updatePhase = db.prepare(
    "UPDATE dispatch_phases SET status=?, verdict=?, details=?, ts_finished=? WHERE id=?"
  );
  const insertPhase = db.prepare(
    "INSERT INTO dispatch_phases (run_id, phase, ts_started, ts_finished, " +
      "status, verdict, details) VALUES (?,?,?,?,?,?,?)"
  );
  const endRun = db.prepare(
    "UPDATE dispatch_runs SET ts_finished=?, status=?, pr_number=?, pr_url=?, " +
      "branch=?, error=? WHERE id=?"
  );
  const recentRuns = db.prepare("SELECT * FROM dispatch_runs ORDER BY ts_started DESC LIMIT ?");
  const phasesForRun = db.prepare(
    "SELECT id, run_id, phase, status, verdict, ts_started, ts_finished, details " +
      "FROM dispatch_phases WHERE run_id=? ORDER BY ts_started"
  );

  return {
    start(args: DispatchStartArgs): number {
      const result = insertRun.run(
        nowTs(),
        args.trigger,
        args.sessionId,
        args.issueNumber,
        args.issueTitle,
        args.budget5h,
        args.budgetWeek
      );
      return Number(result.lastInsertRowid);
    },
    phase(args: DispatchPhaseArgs): void {
      const open = findOpenPhase.get(args.runId, args.phase) as { id: number } | undefined;
      const ts = nowTs();
      const finished = args.status === "running" ? null : ts;
      if (open) {
        updatePhase.run(args.status, args.verdict, args.details, finished, open.id);
      } else {
        insertPhase.run(
          args.runId,
          args.phase,
          ts,
          finished,
          args.status,
          args.verdict,
          args.details
        );
      }
    },
    end(runId: number, args: DispatchEndArgs): void {
      endRun.run(nowTs(), args.status, args.prNumber, args.prUrl, args.branch, args.error, runId);
    },
    recent(n = 10): DispatchRun[] {
      const runs = recentRuns.all(n) as Record<string, unknown>[];
      const out: DispatchRun[] = [];
      for (const r of runs) {
        const phaseRows = phasesForRun.all(Number(r.id)) as Record<string, unknown>[];
        const phases: DispatchPhase[] = phaseRows.map(mapDispatchPhase);
        out.push(mapDispatchRun(r, phases));
      }
      return out;
    },
  };
}

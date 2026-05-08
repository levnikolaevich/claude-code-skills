<!-- SOURCE-OF-TRUTH: shared/references/evaluation_summary_contract.md. Edit ONLY here; run `node tools/marketplace/shared.mjs sync` -->

# Evaluation Summary Contract

Machine-readable summary rules for the evaluation platform.

## Envelope

Every summary uses this JSON envelope:

```json
{
  "schema_version": "1.0.0",
  "summary_kind": "evaluation-worker",
  "run_id": "run-id",
  "identifier": "story-or-task-id",
  "producer_skill": "ln-xxx",
  "produced_at": "2026-04-10T10:00:00Z",
  "payload": {}
}
```

Allowed coordinator kind: `evaluation-coordinator`. Allowed worker kinds: `evaluation-worker`, `review-research`, `review-findings`, `review-docs`, `review-repair`, `review-merge`, `review-refinement`.

## Worker Payload

Required: `worker`, `status`, `operation`, `warnings`. Optional: `verdict`, `metrics`, `decisions`, `findings`, `artifact_path`, `report_path`, `metadata`, `evidence_basis_counts`.

Findings should be normalized structured objects. Large human-readable reports live in separate artifacts. Research-oriented workers point to source-backed evidence through metrics, findings, or artifact paths instead of duplicating long evidence text.

## Coordinator Payload

Required: `status`, `final_result`, `report_path`, `worker_count`, `issues_total`, `severity_counts`, `warnings`, `cleanup_verified`. Optional: `results_log_path`, `overall_score`, `artifact_path`, `metadata`.

## Paths And Freshness

Managed worker summaries are written under `.hex-skills/runtime-artifacts/runs/{parent_run_id}/evaluation-worker/`. Coordinator summaries are written under `.hex-skills/runtime-artifacts/runs/{run_id}/evaluation-coordinator/`.

At merge time, compare research summary `produced_at` values against `research_freshness_hours` when configured. Stale research adds a warning; it does not auto-invalidate the run.

**Version:** 1.0.0
**Last Updated:** 2026-04-10

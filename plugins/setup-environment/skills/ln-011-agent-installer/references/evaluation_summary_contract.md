<!-- SOURCE-OF-TRUTH: shared/references/evaluation_summary_contract.md. Edit ONLY here; run `node tools/marketplace/shared.mjs sync` -->

# Evaluation Summary Contract

Machine-readable summary rules for the evaluation platform.

## Envelope

Every summary uses the shared envelope:

```json
{
  "schema_version": "1.0.0",
  "summary_kind": "evaluation-worker",
  "run_id": "run-ln-310-20260410-abc123",
  "identifier": "story-42",
  "producer_skill": "ln-311",
  "produced_at": "2026-04-10T10:00:00Z",
  "payload": {}
}
```

## Allowed Summary Kinds

Coordinator:
- `evaluation-coordinator`

Workers:
- `evaluation-worker`
- `review-research`
- `review-findings`
- `review-docs`
- `review-repair`
- `review-merge`
- `review-refinement`

## Evaluation Worker Payload

Required fields:
- `worker`
- `status`
- `operation`
- `warnings`

Optional fields:
- `verdict`
- `metrics`
- `decisions`
- `findings`
- `artifact_path`
- `report_path`
- `metadata`
- `evidence_basis_counts`

Rules:
- prefer compact structured objects over free-text prose
- `findings` entries should be normalized, not narrative paragraphs
- large human-readable reports live in separate artifacts

## Evaluation Coordinator Payload

Required fields:
- `status`
- `final_result`
- `report_path`
- `worker_count`
- `issues_total`
- `severity_counts`
- `warnings`
- `cleanup_verified`

Optional fields:
- `results_log_path`
- `overall_score`
- `artifact_path`
- `metadata`

## Paths

Managed workers:
- `.hex-skills/runtime-artifacts/runs/{parent_run_id}/evaluation-worker/{producer_skill}--{identifier}.json`

Coordinators:
- `.hex-skills/runtime-artifacts/runs/{run_id}/evaluation-coordinator/{identifier}.json`

## Research Evidence Rule

Research-oriented workers must place source-backed evidence in:
- `payload.metrics.research_sources`
- `payload.findings`
- referenced runtime artifacts

Summaries should point to evidence, not duplicate full evidence text.

### Freshness (pause-resume safety net)

Worker summaries carry `produced_at` in the envelope. At merge time, the merge worker must:
1. Compare each research summary `produced_at` against current time.
2. If older than `research_freshness_hours` (default: 1h), mark as `stale` and add warning: `"research_stale: ln-311 evidence is {N}h old; consider re-running research lane"`.
3. Stale research does not auto-invalidate — it adds a warning for human review.

This primarily covers paused/resumed evaluations. Single-run pipelines complete research and merge within minutes.

**Version:** 1.0.0
**Last Updated:** 2026-04-10

# Audit Summary Contract

Machine-readable summary contract for 6XX audit workers.

Audit coordinators consume JSON summaries first and read markdown worker reports only for detailed evidence.

## Envelope

Audit workers use the shared coordinator envelope:

```json
{
  "schema_version": "1.0.0",
  "summary_kind": "audit-worker",
  "run_id": "ln-620-global-...",
  "identifier": "global",
  "producer_skill": "ln-621",
  "produced_at": "2026-03-27T10:00:00Z",
  "payload": {}
}
```

Rules:
- `summary_kind` for 6XX workers is `audit-worker`.
- `run_id` is mandatory for every audit summary envelope.
- If the caller does not pass `runId`, the worker generates a standalone `run_id` before emitting the summary.
- `identifier` must be stable inside the run.
- Use the domain or target only. Worker disambiguation belongs in the artifact filename, not the envelope identifier.

Examples:
- `docs-readme`
- `users`
- `job-processing`

## Payload

Required payload fields:

```json
{
  "status": "completed",
  "category": "Security",
  "report_path": ".hex-skills/runtime-artifacts/runs/<run_id>/audit-report/ln-621--global.md",
  "score": 8.5,
  "issues_total": 3,
  "severity_counts": {
    "critical": 0,
    "high": 1,
    "medium": 2,
    "low": 0
  },
  "warnings": []
}
```

Allowed `status` values:
- `completed` - worker finished normally and produced a usable report
- `skipped` - worker was intentionally skipped for scope or applicability reasons
- `error` - worker could not finish normally; report may contain partial evidence

`complete` is invalid. Use `completed`.

Optional payload fields:
- `diagnostic_scores`
- `domain_name`
- `scan_scope`
- `metadata`

## `summaryArtifactPath`

When the coordinator passes `summaryArtifactPath`:
- write the JSON summary to that exact path
- use the exact managed filename, normally `{worker}--{identifier}.json`

When `summaryArtifactPath` is absent:
- write the JSON summary to the standalone run-scoped path
- optionally echo the same summary in structured output for the caller

## Relationship to Worker Markdown Reports

Every audit worker still writes its markdown report.

The JSON summary is not a replacement for the report. It is the transport contract for:
- scores
- severity totals
- category labels
- report location

The markdown report remains the evidence artifact for findings tables and extended data blocks.

## Canonical Paths

- managed: `.hex-skills/runtime-artifacts/runs/{parent_run_id}/audit-worker/{worker}--{identifier}.json`
- standalone: `.hex-skills/runtime-artifacts/runs/{run_id}/audit-worker/{worker}--{identifier}.json`

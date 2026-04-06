# Coordinator Summary Contract

Machine-readable worker outputs for standalone workers and coordinator runtimes.

## General Rules

- Every worker summary uses the same envelope.
- Workers remain standalone-capable.
- In managed invocation, pass both `runId` and `summaryArtifactPath`.
- In standalone invocation, pass neither and let the worker write to its family-specific default path.
- If `summaryArtifactPath` is provided, write the summary JSON to that exact path.
- If `summaryArtifactPath` is not provided, return the same summary in structured output and write it to the standalone run-scoped path.

### Output Path Guard

- Workers MUST NOT write any artifact (summary, report, or intermediate file) to the project root directory.
- When standalone (no `summaryArtifactPath`), workers generate a standalone `run_id` and write the summary JSON to the family-specific run-scoped artifact path. Chat output is used for human-readable verdicts only.
- **Prohibited filenames in project root:** `report.md`, `review_report.md`, `summary.json`, `results.md`, or any ad-hoc artifact directly in `./`.
- Coordinators consume summaries, not prose chat output.
- Runtime artifacts are always run-scoped. File naming is family-specific to avoid collisions for the same identifier.
- `ln-1000` consumes coordinator stage summaries, not kanban rereads or free-text stage output.

## Shared Envelope

Required fields for every worker summary:

```json
{
  "schema_version": "1.0.0",
  "summary_kind": "story-plan",
  "run_id": "run-ln-220-20260326-abc123",
  "identifier": "epic-7",
  "producer_skill": "ln-221",
  "produced_at": "2026-03-26T10:00:00Z",
  "payload": {}
}
```

Rules:
- `summary_kind` describes the operation, not the coordinator.
- `run_id` is mandatory for every summary envelope.
- If the caller does not pass `runId`, the worker generates a standalone `run_id` before emitting the summary.
- `identifier` is domain-specific and stable inside the run.
- `payload` shape is domain-specific and validated by schema.
- the envelope itself is validated by the shared coordinator-runtime schema layer

## Environment Worker Summaries

Status names follow `shared/references/runtime_status_catalog.md`.

Allowed `summary_kind` values:
- `env-agent-install`
- `env-mcp-config`
- `env-config-sync`
- `env-instructions`

Payload fields:
- `status` (`completed`, `skipped`, `error`)
- `targets`
- `changes`
- `warnings`
- `detail`

## Story Plan Worker Summary

`summary_kind`:
- `story-plan`

Payload fields:
- `mode`
- `epic_id`
- `stories_planned`
- `stories_created`
- `stories_updated`
- `stories_canceled`
- `story_urls`
- `warnings`
- `kanban_updated`
- `research_path_used`

## Task Plan Worker Summary

`summary_kind`:
- `task-plan`

Payload fields:
- `mode`
- `story_id`
- `task_type`
- `tasks_created`
- `tasks_updated`
- `tasks_canceled`
- `task_urls`
- `kanban_updated`
- `dry_warnings_count`
- `warnings`

## Pipeline Stage Coordinator Summary

`summary_kind`:
- `pipeline-stage`

Payload fields:
- `stage`
- `story_id`
- `status`
- `final_result`
- `story_status`
- `verdict`
- `readiness_score`
- `quality_score`
- `warnings`
- `artifact_path`
- `metadata`

## Existing Coordinator Families

Older stateful families use the same run-scoped policy even when their payload differs.

Examples:
- `task-status` execution summaries
- story quality summaries
- story test summaries
- `audit-coordinator` summaries
- optimization summaries

## Task Execution Worker Summary

`summary_kind`:
- `task-status`

Payload fields:
- `worker`
- `status`
- `from_status`
- `to_status`
- `result`
- `tests_run`
- `files_changed`
- `issues`
- `score`
- `comment_path`
- `error`
- `warnings`
- `artifact_path`
- `metadata`

Rules:
- `identifier` must be the `task_id`.
- `ln-400` consumes the JSON summary, not worker prose.
- Managed path: `.hex-skills/runtime-artifacts/runs/{parent_run_id}/task-status/{task_id}--{worker}.json`
- Standalone path: `.hex-skills/runtime-artifacts/runs/{run_id}/task-status/{task_id}--{worker}.json`

## Quality Worker Summary

`summary_kind`:
- `quality-worker`

Payload fields:
- `worker`
- `status`
- `verdict`
- `score`
- `issues`
- `warnings`
- `artifact_path`
- `metadata`

Paths:
- managed: `.hex-skills/runtime-artifacts/runs/{parent_run_id}/quality-worker/{worker}--{story_id}.json`
- standalone: `.hex-skills/runtime-artifacts/runs/{run_id}/quality-worker/{worker}--{story_id}.json`

## Test Planning Worker Summary

`summary_kind`:
- `test-planning-worker`

Payload fields:
- `worker`
- `status`
- `warnings`
- `research_comment_path`
- `manual_result_path`
- `test_task_id`
- `test_task_url`
- `coverage_summary`
- `planned_scenarios`
- `metadata`

Paths:
- managed: `.hex-skills/runtime-artifacts/runs/{parent_run_id}/test-planning-worker/{worker}--{story_id}.json`
- standalone: `.hex-skills/runtime-artifacts/runs/{run_id}/test-planning-worker/{worker}--{story_id}.json`

## Docs Generation Summary

`summary_kind`:
- `docs-generation`

Payload fields:
- `worker`
- `status`
- `created_files`
- `skipped_files`
- `quality_inputs`
- `validation_status`
- `warnings`
- `metadata`

## Audit Coordinator Summary

`summary_kind`:
- `audit-coordinator`

Payload fields:
- `status`
- `final_result`
- `report_path`
- `results_log_path`
- `overall_score`
- `worker_count`
- `issues_total`
- `severity_counts`
- `warnings`
- `artifact_path`
- `metadata`

## Dependency Upgrade Summary

`summary_kind`:
- `dependency-worker`
- `dependency-coordinator`

Worker payload fields:
- `status`
- `package_manager`
- `upgrades`
- `warnings`
- `errors`
- `verification`
- `artifact_path`
- `metadata`

Coordinator payload fields:
- `status`
- `package_managers`
- `workers_activated`
- `total_packages`
- `upgraded`
- `skipped`
- `failed`
- `breaking_changes`
- `verification_passed`
- `per_worker`
- `warnings`
- `artifact_path`
- `metadata`

Paths:
- managed worker: `.hex-skills/runtime-artifacts/runs/{parent_run_id}/dependency-worker/{producer_skill}--{identifier}.json`
- standalone worker: `.hex-skills/runtime-artifacts/runs/{run_id}/dependency-worker/{producer_skill}--{identifier}.json`
- managed coordinator: `.hex-skills/runtime-artifacts/runs/{run_id}/dependency-coordinator/{identifier}.json`

## Modernization Summary

`summary_kind`:
- `modernization-worker`
- `modernization-coordinator`

Worker payload fields:
- `status`
- `changes_applied`
- `changes_discarded`
- `verification`
- `warnings`
- `artifact_path`
- `metadata`

Coordinator payload fields:
- `status`
- `input_source`
- `workers_activated`
- `modules_replaced`
- `loc_removed`
- `bundle_reduction`
- `verification_passed`
- `per_worker`
- `warnings`
- `artifact_path`
- `metadata`

Paths:
- managed worker: `.hex-skills/runtime-artifacts/runs/{parent_run_id}/modernization-worker/{producer_skill}--{identifier}.json`
- standalone worker: `.hex-skills/runtime-artifacts/runs/{run_id}/modernization-worker/{producer_skill}--{identifier}.json`
- managed coordinator: `.hex-skills/runtime-artifacts/runs/{run_id}/modernization-coordinator/{identifier}.json`

## Benchmark Summary

`summary_kind`:
- `benchmark-worker`

Worker payload fields:
- `status`
- `scenarios_total`
- `scenarios_passed`
- `scenarios_failed`
- `activation_valid`
- `validity_verdict`
- `report_path`
- `warnings`
- `metrics`
- `artifact_path`
- `metadata`

Paths:
- managed worker: `.hex-skills/runtime-artifacts/runs/{parent_run_id}/benchmark-worker/{producer_skill}--{identifier}.json`
- standalone worker: `.hex-skills/runtime-artifacts/runs/{run_id}/benchmark-worker/{producer_skill}--{identifier}.json`

## Epic Planning Summary

`summary_kind`:
- `epic-plan`

Payload fields:
- `mode`
- `scope_identifier`
- `epics_created`
- `epics_updated`
- `epics_canceled`
- `epic_urls`
- `warnings`
- `kanban_updated`
- `infrastructure_epic_included`

## Scope Decomposition Summary

`summary_kind`:
- `scope-decomposition`

Payload fields:
- `scope_identifier`
- `epic_runs_completed`
- `story_runs_completed`
- `prioritization_runs_completed`
- `warnings`
- `final_result`

The envelope remains the same. Only `summary_kind` and `payload` change.

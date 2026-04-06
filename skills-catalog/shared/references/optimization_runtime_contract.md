# Optimization Runtime Contract

Deterministic runtime for `ln-810-performance-optimizer`.

Canonical phase/status names: `shared/references/runtime_status_catalog.md`

## Runtime Location

```text
.hex-skills/optimization/
  runtime/active/ln-810/{slug}.json
  runtime/runs/{run_id}/manifest.json
  runtime/runs/{run_id}/state.json
  runtime/runs/{run_id}/checkpoints.json
  runtime/runs/{run_id}/history.jsonl
  {slug}/context.md
  {slug}/ln-814-log.tsv
```

## Commands

```bash
node shared/scripts/optimization-runtime/cli.mjs start --slug align-endpoint --manifest-file <file>
node shared/scripts/optimization-runtime/cli.mjs status --slug align-endpoint
node shared/scripts/optimization-runtime/cli.mjs record-worker-result --payload '{...}'
node shared/scripts/optimization-runtime/cli.mjs record-summary --payload '{...}'
node shared/scripts/optimization-runtime/cli.mjs record-cycle --payload '{...}'
node shared/scripts/optimization-runtime/cli.mjs checkpoint --phase PHASE_8_EXECUTE --payload '{...}'
node shared/scripts/optimization-runtime/cli.mjs advance --to PHASE_9_CYCLE_BOUNDARY
node shared/scripts/optimization-runtime/cli.mjs pause --reason "..."
node shared/scripts/optimization-runtime/cli.mjs complete
```

## Phase Graph

- `PHASE_0_PREFLIGHT`
- `PHASE_1_PARSE_INPUT`
- `PHASE_2_PROFILE`
- `PHASE_3_WRONG_TOOL_GATE`
- `PHASE_4_RESEARCH`
- `PHASE_5_SET_TARGET`
- `PHASE_6_WRITE_CONTEXT`
- `PHASE_7_VALIDATE_PLAN`
- `PHASE_8_EXECUTE`
- `PHASE_9_CYCLE_BOUNDARY`
- `PHASE_10_AGGREGATE`
- `PHASE_11_REPORT`
- `DONE`
- `PAUSED`

## Required State Fields

- `execution_mode`
- `cycle_config`
- `current_cycle`
- `cycles`
- `phases`
- `worker_results`
- `child_runs`
- `stop_reason`
- `target_metric`
- `context_file`
- `report_ready`
- `summary_recorded`
- `summary_artifact_path`

## Guard Rules

- `PHASE_3_WRONG_TOOL_GATE -> PHASE_10_AGGREGATE` only on `gate_verdict=BLOCK`
- `PHASE_4_RESEARCH -> PHASE_10_AGGREGATE` only when no hypotheses remain
- `PHASE_6_WRITE_CONTEXT -> PHASE_7_VALIDATE_PLAN` requires context file path
- `PHASE_7_VALIDATE_PLAN -> PHASE_8_EXECUTE` requires `GO | GO_WITH_CONCERNS | WAIVED`
- `PHASE_2_PROFILE -> PHASE_3_WRONG_TOOL_GATE` requires matching `ln-811` summary
- `PHASE_4_RESEARCH -> PHASE_5_SET_TARGET` requires matching `ln-812` summary
- `PHASE_7_VALIDATE_PLAN -> PHASE_8_EXECUTE` requires matching `ln-813` summary and `GO | GO_WITH_CONCERNS | WAIVED`
- `PHASE_8_EXECUTE -> PHASE_9_CYCLE_BOUNDARY` requires matching `ln-814` summary or `skipped_by_mode` in `plan_only`
- `PHASE_9_CYCLE_BOUNDARY -> PHASE_2_PROFILE` only when no stop reason is recorded
- `DONE` requires final report checkpoint and optimization coordinator summary

## Canonical Status Sets

- Wrong Tool Gate verdicts: `PROCEED`, `CONCERNS`, `WAIVED`, `BLOCK`
- Validation verdicts: `GO`, `GO_WITH_CONCERNS`, `WAIVED`, `NO_GO`
- Execution checkpoint statuses: `completed`, `skipped_by_mode`
- Cycle status: `completed`

## Worker Summary Contract

`ln-811`, `ln-812`, `ln-813`, and `ln-814` write `optimization-worker` summary envelopes.

Managed mode:
- `ln-810` checkpoints `child_run` metadata before invoking the worker
- Worker receives deterministic `runId` and exact `summaryArtifactPath`
- `ln-810` records the emitted worker summary envelope with `record-worker-result`

Standalone mode:
- Worker generates its own `run_id`
- Worker writes the same `optimization-worker` summary envelope under `.hex-skills/runtime-artifacts/runs/{run_id}/optimization-worker/`

`ln-810` writes an `optimization-coordinator` summary envelope before `complete`.

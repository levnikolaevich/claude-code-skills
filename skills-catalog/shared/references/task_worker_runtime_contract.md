# Task Worker Runtime Contract

Runtime family for `ln-401`, `ln-402`, `ln-403`, and `ln-404`.

## Runtime Location

```text
.hex-skills/task-worker/runtime/
  active/{worker}/{task_id}.json
  runs/{run_id}/manifest.json
  runs/{run_id}/state.json
  runs/{run_id}/checkpoints.json
  runs/{run_id}/history.jsonl
```

## CLI

```bash
node shared/scripts/task-worker-runtime/cli.mjs start --skill ln-401 --task-id T-123 --manifest-file <file>
node shared/scripts/task-worker-runtime/cli.mjs status --skill ln-401 --task-id T-123
node shared/scripts/task-worker-runtime/cli.mjs checkpoint --skill ln-401 --task-id T-123 --phase PHASE_0_CONFIG --payload '{...}'
node shared/scripts/task-worker-runtime/cli.mjs record-summary --skill ln-401 --task-id T-123 --payload '{...}'
node shared/scripts/task-worker-runtime/cli.mjs advance --skill ln-401 --task-id T-123 --to PHASE_1_RESOLVE_TASK
node shared/scripts/task-worker-runtime/cli.mjs pause --skill ln-401 --task-id T-123 --reason "..."
node shared/scripts/task-worker-runtime/cli.mjs complete --skill ln-401 --task-id T-123
```

Coordinator-invoked start rules:
- pass both `--run-id` and `--summary-artifact-path`
- or pass neither for standalone mode

## Summary Contract

- `summary_kind = task-status`
- `identifier = task_id`
- `producer_skill = worker skill`
- `payload.worker = worker skill`

Managed artifact path:
- `.hex-skills/runtime-artifacts/runs/{parent_run_id}/task-status/{task_id}--{worker}.json`

Standalone artifact path:
- `.hex-skills/runtime-artifacts/runs/{run_id}/task-status/{task_id}--{worker}.json`

## Phase Profiles

### `ln-401`
- `PHASE_0_CONFIG`
- `PHASE_1_RESOLVE_TASK`
- `PHASE_2_LOAD_CONTEXT`
- `PHASE_3_GOAL_GATE_BLUEPRINT`
- `PHASE_4_START_WORK`
- `PHASE_5_IMPLEMENT_AND_VERIFY_AC`
- `PHASE_6_QUALITY_AND_HANDOFF`
- `PHASE_7_WRITE_SUMMARY`
- `PHASE_8_SELF_CHECK`

### `ln-402`
- `PHASE_0_CONFIG`
- `PHASE_1_RESOLVE_TASK`
- `PHASE_2_LOAD_CONTEXT`
- `PHASE_3_REVIEW_CHECKS`
- `PHASE_4_AC_VALIDATION`
- `PHASE_5_SIDE_EFFECT_SCAN`
- `PHASE_6_DECISION_AND_MECHANICAL_CHECKS`
- `PHASE_7_WRITE_REVIEW_OUTPUT`
- `PHASE_8_WRITE_SUMMARY`
- `PHASE_9_SELF_CHECK`

### `ln-403`
- `PHASE_0_CONFIG`
- `PHASE_1_RESOLVE_TASK`
- `PHASE_2_LOAD_CONTEXT`
- `PHASE_3_PLAN_REWORK`
- `PHASE_4_IMPLEMENT_FIXES`
- `PHASE_5_QUALITY_AND_ROOT_CAUSE`
- `PHASE_6_HANDOFF_TO_REVIEW`
- `PHASE_7_WRITE_SUMMARY`
- `PHASE_8_SELF_CHECK`

### `ln-404`
- `PHASE_0_CONFIG`
- `PHASE_1_RESOLVE_TASK`
- `PHASE_2_LOAD_CONTEXT`
- `PHASE_3_VALIDATE_TEST_PLAN`
- `PHASE_4_START_WORK`
- `PHASE_5_IMPLEMENT_AND_RUN`
- `PHASE_6_HANDOFF_TO_REVIEW`
- `PHASE_7_WRITE_SUMMARY`
- `PHASE_8_SELF_CHECK`

## Guard Rules

- no transition without current-phase checkpoint
- no `DONE` before worker summary is recorded
- no `DONE` before self-check passes
- `ln-401`, `ln-403`, and `ln-404` must emit `to_status = To Review`
- `ln-402` must emit `to_status = Done | To Rework`

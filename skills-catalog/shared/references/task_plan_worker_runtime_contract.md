# Task Plan Worker Runtime Contract

Runtime family for `ln-301` and `ln-302`.

## Runtime Location

```text
.hex-skills/task-plan-worker/runtime/
  active/{worker}/{story_id}.json
  runs/{run_id}/manifest.json
  runs/{run_id}/state.json
  runs/{run_id}/checkpoints.json
  runs/{run_id}/history.jsonl
```

## CLI

```bash
node shared/scripts/task-plan-worker-runtime/cli.mjs start --skill ln-301 --story PROJ-123 --manifest-file <file>
node shared/scripts/task-plan-worker-runtime/cli.mjs status --skill ln-301 --story PROJ-123
node shared/scripts/task-plan-worker-runtime/cli.mjs checkpoint --skill ln-301 --story PROJ-123 --phase PHASE_0_CONFIG --payload '{...}'
node shared/scripts/task-plan-worker-runtime/cli.mjs record-summary --skill ln-301 --story PROJ-123 --payload '{...}'
node shared/scripts/task-plan-worker-runtime/cli.mjs advance --skill ln-301 --story PROJ-123 --to PHASE_1_LOAD_INPUTS
node shared/scripts/task-plan-worker-runtime/cli.mjs pause --skill ln-301 --story PROJ-123 --reason "..."
node shared/scripts/task-plan-worker-runtime/cli.mjs complete --skill ln-301 --story PROJ-123
```

Coordinator-invoked start rules:
- pass both `--run-id` and `--summary-artifact-path`
- or pass neither for standalone mode

## Summary Contract

- `summary_kind = task-plan`
- `identifier = story_id`
- `producer_skill = worker skill`

Managed artifact path:
- `.hex-skills/runtime-artifacts/runs/{parent_run_id}/task-plan/{worker}--{story_id}.json`

Standalone artifact path:
- `.hex-skills/runtime-artifacts/runs/{run_id}/task-plan/{worker}--{story_id}.json`

## Phase Profiles

### `ln-301`
- `PHASE_0_CONFIG`
- `PHASE_1_LOAD_INPUTS`
- `PHASE_2_LOAD_CONTEXT`
- `PHASE_3_GENERATE_TASK_DOCS`
- `PHASE_4_VALIDATE_TASKS`
- `PHASE_5_CONFIRM_OR_AUTOAPPROVE`
- `PHASE_6_APPLY_CREATE`
- `PHASE_7_UPDATE_KANBAN`
- `PHASE_8_WRITE_SUMMARY`
- `PHASE_9_SELF_CHECK`

### `ln-302`
- `PHASE_0_CONFIG`
- `PHASE_1_LOAD_INPUTS`
- `PHASE_2_LOAD_EXISTING_TASKS`
- `PHASE_3_NORMALIZE_AND_CLASSIFY`
- `PHASE_4_CONFIRM_OR_AUTOAPPROVE`
- `PHASE_5_APPLY_REPLAN`
- `PHASE_6_UPDATE_KANBAN`
- `PHASE_7_WRITE_SUMMARY`
- `PHASE_8_SELF_CHECK`

## Guard Rules

- no transition without current-phase checkpoint
- no `DONE` before worker summary is recorded
- no `DONE` before self-check passes

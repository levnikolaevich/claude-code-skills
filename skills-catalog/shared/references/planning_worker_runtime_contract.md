# Planning Worker Runtime Contract

Runtime family for `ln-201`, `ln-221`, `ln-222`, and `ln-230`.

## Runtime Location

```text
.hex-skills/planning-worker/runtime/
  active/{worker}/{identifier}.json
  runs/{run_id}/manifest.json
  runs/{run_id}/state.json
  runs/{run_id}/checkpoints.json
  runs/{run_id}/history.jsonl
```

## CLI

```bash
node shared/scripts/planning-worker-runtime/cli.mjs start --skill ln-221 --identifier epic-7 --manifest-file <file>
node shared/scripts/planning-worker-runtime/cli.mjs status --skill ln-221 --identifier epic-7
node shared/scripts/planning-worker-runtime/cli.mjs checkpoint --skill ln-221 --identifier epic-7 --phase PHASE_0_CONFIG --payload '{...}'
node shared/scripts/planning-worker-runtime/cli.mjs record-summary --skill ln-221 --identifier epic-7 --payload '{...}'
node shared/scripts/planning-worker-runtime/cli.mjs advance --skill ln-221 --identifier epic-7 --to PHASE_1_RESOLVE_CONTEXT
node shared/scripts/planning-worker-runtime/cli.mjs pause --skill ln-221 --identifier epic-7 --reason "..."
node shared/scripts/planning-worker-runtime/cli.mjs complete --skill ln-221 --identifier epic-7
```

Coordinator-invoked start rules:
- pass both `--run-id` and `--summary-artifact-path`
- or pass neither for standalone mode

## Summary Contract

### `ln-201`
- `summary_kind = opportunity-discovery-worker`
- identifier is deterministic from the primary input (`ideas` hash or `context` hash)

Managed artifact path:
- `.hex-skills/runtime-artifacts/runs/{parent_run_id}/opportunity-discovery-worker/{worker}--{identifier}.json`

Standalone artifact path:
- `.hex-skills/runtime-artifacts/runs/{run_id}/opportunity-discovery-worker/{worker}--{identifier}.json`

### `ln-221` and `ln-222`
- `summary_kind = story-plan-worker`
- identifier defaults to `epic-{epicId}`

Managed artifact path:
- `.hex-skills/runtime-artifacts/runs/{parent_run_id}/story-plan-worker/{worker}--{identifier}.json`

Standalone artifact path:
- `.hex-skills/runtime-artifacts/runs/{run_id}/story-plan-worker/{worker}--{identifier}.json`

### `ln-230`
- `summary_kind = story-prioritization-worker`
- identifier defaults to `epic-{epicId}`

Managed artifact path:
- `.hex-skills/runtime-artifacts/runs/{parent_run_id}/story-prioritization-worker/{worker}--{identifier}.json`

Standalone artifact path:
- `.hex-skills/runtime-artifacts/runs/{run_id}/story-prioritization-worker/{worker}--{identifier}.json`

## Phase Profiles

### `ln-201`
- `PHASE_0_CONFIG`
- `PHASE_1_INPUT_PROCESSING`
- `PHASE_2_KILL_FUNNEL`
- `PHASE_3_RANK_SURVIVORS`
- `PHASE_4_WRITE_DISCOVERY_REPORT`
- `PHASE_5_WRITE_SUMMARY`
- `PHASE_6_SELF_CHECK`

### `ln-221`
- `PHASE_0_CONFIG`
- `PHASE_1_RESOLVE_CONTEXT`
- `PHASE_2_LOAD_TEMPLATE`
- `PHASE_3_GENERATE_STORIES`
- `PHASE_4_VALIDATE_STORIES`
- `PHASE_5_CONFIRM_OR_AUTOAPPROVE`
- `PHASE_6_APPLY_CREATE`
- `PHASE_7_UPDATE_KANBAN`
- `PHASE_8_WRITE_SUMMARY`
- `PHASE_9_SELF_CHECK`

### `ln-222`
- `PHASE_0_CONFIG`
- `PHASE_1_RESOLVE_CONTEXT`
- `PHASE_2_LOAD_EXISTING_STORIES`
- `PHASE_3_CLASSIFY_REPLAN`
- `PHASE_4_CONFIRM_OR_AUTOAPPROVE`
- `PHASE_5_APPLY_REPLAN`
- `PHASE_6_UPDATE_KANBAN`
- `PHASE_7_WRITE_SUMMARY`
- `PHASE_8_SELF_CHECK`

### `ln-230`
- `PHASE_0_CONFIG`
- `PHASE_1_DISCOVERY`
- `PHASE_2_LOAD_STORY_METADATA`
- `PHASE_3_ANALYZE_STORIES`
- `PHASE_4_GENERATE_PRIORITIZATION`
- `PHASE_5_WRITE_SUMMARY`
- `PHASE_6_SELF_CHECK`

## Guard Rules

- no transition without current-phase checkpoint
- no `DONE` before worker summary is recorded
- no `DONE` before self-check passes

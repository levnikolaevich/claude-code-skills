# Test Planning Worker Runtime Contract

Runtime family for `ln-521`, `ln-522`, and `ln-523`.

## Runtime Location

```text
.hex-skills/test-planning-worker/runtime/
  active/{worker}/{story_id}.json
  runs/{run_id}/manifest.json
  runs/{run_id}/state.json
  runs/{run_id}/checkpoints.json
  runs/{run_id}/history.jsonl
```

## CLI

```bash
node shared/scripts/test-planning-worker-runtime/cli.mjs start --skill ln-521 --story PROJ-123 --manifest-file <file>
node shared/scripts/test-planning-worker-runtime/cli.mjs status --skill ln-521 --story PROJ-123
node shared/scripts/test-planning-worker-runtime/cli.mjs checkpoint --skill ln-521 --story PROJ-123 --phase PHASE_0_CONFIG --payload '{...}'
node shared/scripts/test-planning-worker-runtime/cli.mjs record-summary --skill ln-521 --story PROJ-123 --payload '{...}'
node shared/scripts/test-planning-worker-runtime/cli.mjs advance --skill ln-521 --story PROJ-123 --to PHASE_1_RESOLVE_STORY
node shared/scripts/test-planning-worker-runtime/cli.mjs pause --skill ln-521 --story PROJ-123 --reason "..."
node shared/scripts/test-planning-worker-runtime/cli.mjs complete --skill ln-521 --story PROJ-123
```

Coordinator-invoked start rules:
- pass both `--run-id` and `--summary-artifact-path`
- or pass neither for standalone mode

## Summary Contract

- `summary_kind = test-planning-worker`
- `identifier = story_id`
- `producer_skill = worker skill`
- `payload.worker = worker skill`

Managed artifact path:
- `.hex-skills/runtime-artifacts/runs/{parent_run_id}/test-planning-worker/{worker}--{story_id}.json`

Standalone artifact path:
- `.hex-skills/runtime-artifacts/runs/{run_id}/test-planning-worker/{worker}--{story_id}.json`

## Phase Profiles

### `ln-521`
- `PHASE_0_CONFIG`
- `PHASE_1_RESOLVE_STORY`
- `PHASE_2_EXTRACT_DOMAIN`
- `PHASE_3_RESEARCH_PROBLEMS`
- `PHASE_4_RESEARCH_COMPETITORS`
- `PHASE_5_RESEARCH_COMPLAINTS`
- `PHASE_6_WRITE_COMMENT`
- `PHASE_7_WRITE_SUMMARY`
- `PHASE_8_SELF_CHECK`

### `ln-522`
- `PHASE_0_CONFIG`
- `PHASE_1_RESOLVE_STORY`
- `PHASE_2_SETUP_MANUAL_TEST_STRUCTURE`
- `PHASE_3_GENERATE_SCRIPT`
- `PHASE_4_UPDATE_TEST_DOCS`
- `PHASE_5_EXECUTE_AND_CAPTURE`
- `PHASE_6_WRITE_COMMENT`
- `PHASE_7_WRITE_SUMMARY`
- `PHASE_8_SELF_CHECK`

### `ln-523`
- `PHASE_0_CONFIG`
- `PHASE_1_RESOLVE_STORY`
- `PHASE_2_LOAD_RESEARCH_AND_MANUAL_RESULTS`
- `PHASE_3_ANALYZE_STORY_AND_TASKS`
- `PHASE_4_BUILD_RISK_PLAN`
- `PHASE_5_GENERATE_TEST_TASK_SPEC`
- `PHASE_6_DELEGATE_TASK_PLAN`
- `PHASE_7_WRITE_SUMMARY`
- `PHASE_8_SELF_CHECK`

## Guard Rules

- no transition without current-phase checkpoint
- no `DONE` before worker summary is recorded
- no `DONE` before self-check passes

# Quality Worker Runtime Contract

Runtime family for `ln-511`, `ln-512`, `ln-513`, and `ln-514`.

## Runtime Location

```text
.hex-skills/quality-worker/runtime/
  active/{worker}/{story_id}.json
  runs/{run_id}/manifest.json
  runs/{run_id}/state.json
  runs/{run_id}/checkpoints.json
  runs/{run_id}/history.jsonl
```

## CLI

```bash
node shared/scripts/quality-worker-runtime/cli.mjs start --skill ln-511 --story PROJ-123 --manifest-file <file>
node shared/scripts/quality-worker-runtime/cli.mjs status --skill ln-511 --story PROJ-123
node shared/scripts/quality-worker-runtime/cli.mjs checkpoint --skill ln-511 --story PROJ-123 --phase PHASE_0_CONFIG --payload '{...}'
node shared/scripts/quality-worker-runtime/cli.mjs record-summary --skill ln-511 --story PROJ-123 --payload '{...}'
node shared/scripts/quality-worker-runtime/cli.mjs advance --skill ln-511 --story PROJ-123 --to PHASE_1_RESOLVE_STORY
node shared/scripts/quality-worker-runtime/cli.mjs pause --skill ln-511 --story PROJ-123 --reason "..."
node shared/scripts/quality-worker-runtime/cli.mjs complete --skill ln-511 --story PROJ-123
```

Coordinator-invoked start rules:
- pass both `--run-id` and `--summary-artifact-path`
- or pass neither for standalone mode

## Summary Contract

- `summary_kind = quality-worker`
- `identifier = story_id`
- `producer_skill = worker skill`
- `payload.worker = worker skill`

Managed artifact path:
- `.hex-skills/runtime-artifacts/runs/{parent_run_id}/quality-worker/{worker}--{story_id}.json`

Standalone artifact path:
- `.hex-skills/runtime-artifacts/runs/{run_id}/quality-worker/{worker}--{story_id}.json`

## Phase Profiles

### `ln-511`
- `PHASE_0_CONFIG`
- `PHASE_1_RESOLVE_STORY`
- `PHASE_2_LOAD_SCOPE`
- `PHASE_3_METRICS_AND_STATIC_ANALYSIS`
- `PHASE_4_EXTERNAL_REF_VALIDATION`
- `PHASE_5_SCORE_AND_FINDINGS`
- `PHASE_6_WRITE_PUBLIC_OUTPUT`
- `PHASE_7_WRITE_SUMMARY`
- `PHASE_8_SELF_CHECK`

### `ln-512`
- `PHASE_0_CONFIG`
- `PHASE_1_LOAD_FINDINGS`
- `PHASE_2_FILTER_FIXABLE`
- `PHASE_3_VERIFY_CANDIDATES`
- `PHASE_4_APPLY_FIXES`
- `PHASE_5_VERIFY_BUILD_AND_REPORT`
- `PHASE_6_WRITE_SUMMARY`
- `PHASE_7_SELF_CHECK`

### `ln-513`
- `PHASE_0_CONFIG`
- `PHASE_1_RESOLVE_STORY`
- `PHASE_2_DISCOVER_TEST_COMMAND`
- `PHASE_3_EXECUTE_SUITE`
- `PHASE_4_NORMALIZE_RESULTS`
- `PHASE_5_WRITE_PUBLIC_OUTPUT`
- `PHASE_6_WRITE_SUMMARY`
- `PHASE_7_SELF_CHECK`

### `ln-514`
- `PHASE_0_CONFIG`
- `PHASE_1_PARSE_ARGS`
- `PHASE_2_DETECT_LOG_SOURCE_AND_COLLECT`
- `PHASE_3_CLASSIFY_ERRORS`
- `PHASE_4_ASSESS_LOG_QUALITY`
- `PHASE_5_MAP_STACKS_AND_RECOMMEND`
- `PHASE_6_WRITE_PUBLIC_OUTPUT`
- `PHASE_7_WRITE_SUMMARY`
- `PHASE_8_SELF_CHECK`

## Guard Rules

- no transition without current-phase checkpoint
- no `DONE` before worker summary is recorded
- no `DONE` before self-check passes

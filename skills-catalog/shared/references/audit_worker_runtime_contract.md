# Audit Worker Runtime Contract

Runtime family for all stateful 6XX audit workers.

## Runtime Location

```text
.hex-skills/audit-worker/runtime/
  active/{worker}/{identifier}.json
  runs/{run_id}/manifest.json
  runs/{run_id}/state.json
  runs/{run_id}/checkpoints.json
  runs/{run_id}/history.jsonl
```

## CLI

```bash
node shared/scripts/audit-worker-runtime/cli.mjs start --skill ln-621 --identifier global --manifest-file <file>
node shared/scripts/audit-worker-runtime/cli.mjs status --skill ln-621 --identifier global
node shared/scripts/audit-worker-runtime/cli.mjs checkpoint --skill ln-621 --identifier global --phase PHASE_0_CONFIG --payload '{...}'
node shared/scripts/audit-worker-runtime/cli.mjs record-summary --skill ln-621 --identifier global --payload '{...}'
node shared/scripts/audit-worker-runtime/cli.mjs advance --skill ln-621 --identifier global --to PHASE_1_RESOLVE_SCOPE
node shared/scripts/audit-worker-runtime/cli.mjs pause --skill ln-621 --identifier global --reason "..."
node shared/scripts/audit-worker-runtime/cli.mjs complete --skill ln-621 --identifier global
```

Coordinator-invoked start rules:
- pass both `--run-id` and `--summary-artifact-path`
- or pass neither for standalone mode

## Summary Contract

- `summary_kind = audit-worker`
- `identifier = domain-specific worker target`
- `producer_skill = worker skill`

Managed path:
- `.hex-skills/runtime-artifacts/runs/{parent_run_id}/audit-worker/{worker}--{identifier}.json`

Standalone path:
- `.hex-skills/runtime-artifacts/runs/{run_id}/audit-worker/{worker}--{identifier}.json`

## Phase Profiles

### Scan / Analyze / Report
- `ln-611..614`
- `ln-621..629`
- `ln-631..637`
- `ln-642..644`
- `ln-646..647`
- `ln-651..654`
- `PHASE_0_CONFIG`
- `PHASE_1_RESOLVE_SCOPE`
- `PHASE_2_LOAD_CONTEXT`
- `PHASE_3_LAYER1_SCAN`
- `PHASE_4_LAYER2_ANALYSIS`
- `PHASE_5_SCORE_FINDINGS`
- `PHASE_6_WRITE_REPORT`
- `PHASE_7_WRITE_SUMMARY`
- `PHASE_8_SELF_CHECK`

### Pattern Analysis
- `ln-641`
- `PHASE_0_CONFIG`
- `PHASE_1_RESOLVE_PATTERN`
- `PHASE_2_LOAD_CONTEXT`
- `PHASE_3_FIND_IMPLEMENTATIONS`
- `PHASE_4_ANALYZE_PATTERN`
- `PHASE_5_SCORE_GAPS`
- `PHASE_6_WRITE_REPORT`
- `PHASE_7_WRITE_SUMMARY`
- `PHASE_8_SELF_CHECK`

### Replacement Research
- `ln-645`
- `PHASE_0_CONFIG`
- `PHASE_1_RESOLVE_SCOPE`
- `PHASE_2_LOAD_CONTEXT`
- `PHASE_3_DISCOVER_CUSTOM_MODULES`
- `PHASE_4_RESEARCH_ALTERNATIVES`
- `PHASE_5_COMPARE_RECOMMEND`
- `PHASE_6_WRITE_REPORT`
- `PHASE_7_WRITE_SUMMARY`
- `PHASE_8_SELF_CHECK`

## Guard Rules

- no transition without current-phase checkpoint
- no `DONE` before worker summary is recorded
- no `DONE` before self-check passes
- no `DONE` before `final_result` is recorded

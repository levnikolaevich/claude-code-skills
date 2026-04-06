# Benchmark Worker Runtime Contract

Runtime family for stateful benchmark workers.

## Runtime Location

```text
.hex-skills/benchmark-worker/runtime/
  active/{worker}/{identifier}.json
  runs/{run_id}/manifest.json
  runs/{run_id}/state.json
  runs/{run_id}/checkpoints.json
  runs/{run_id}/history.jsonl
```

## CLI

```bash
node shared/scripts/benchmark-worker-runtime/cli.mjs start --skill ln-840-benchmark-compare --identifier suite-default --manifest-file <file>
node shared/scripts/benchmark-worker-runtime/cli.mjs status --skill ln-840-benchmark-compare --identifier suite-default
node shared/scripts/benchmark-worker-runtime/cli.mjs checkpoint --skill ln-840-benchmark-compare --identifier suite-default --phase PHASE_0_CONFIG --payload '{...}'
node shared/scripts/benchmark-worker-runtime/cli.mjs record-summary --skill ln-840-benchmark-compare --identifier suite-default --payload '{...}'
node shared/scripts/benchmark-worker-runtime/cli.mjs advance --skill ln-840-benchmark-compare --identifier suite-default --to PHASE_1_PREFLIGHT
node shared/scripts/benchmark-worker-runtime/cli.mjs pause --skill ln-840-benchmark-compare --identifier suite-default --reason "..."
node shared/scripts/benchmark-worker-runtime/cli.mjs complete --skill ln-840-benchmark-compare --identifier suite-default
```

Coordinator-invoked start rules:
- pass both `--run-id` and `--summary-artifact-path`
- or pass neither for standalone mode

## Summary Contract

- `summary_kind = benchmark-worker`
- `identifier = benchmark suite identifier`
- `producer_skill = ln-840-benchmark-compare`

Managed path:
- `.hex-skills/runtime-artifacts/runs/{parent_run_id}/benchmark-worker/{worker}--{identifier}.json`

Standalone path:
- `.hex-skills/runtime-artifacts/runs/{run_id}/benchmark-worker/{worker}--{identifier}.json`

## Phase Profile

- `ln-840-benchmark-compare`
- `PHASE_0_CONFIG`
- `PHASE_1_PREFLIGHT`
- `PHASE_2_LOAD_SUITE`
- `PHASE_3_RUN_SCENARIOS`
- `PHASE_4_PARSE_RESULTS`
- `PHASE_5_WRITE_REPORT`
- `PHASE_6_WRITE_SUMMARY`
- `PHASE_7_SELF_CHECK`

## Guard Rules

- no transition without current-phase checkpoint
- no `DONE` before worker summary is recorded
- no `DONE` before self-check passes
- no `DONE` before `final_result` is recorded

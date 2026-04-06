# Dependency Runtime Contract

Deterministic runtime for `ln-820-dependency-optimization-coordinator`.

## Commands

```bash
node shared/scripts/dependency-runtime/cli.mjs start --identifier repo-deps --manifest-file <file>
node shared/scripts/dependency-runtime/cli.mjs status --identifier repo-deps
node shared/scripts/dependency-runtime/cli.mjs checkpoint --phase PHASE_3_DELEGATE_UPGRADES --payload '{...}'
node shared/scripts/dependency-runtime/cli.mjs record-worker-result --payload '{...}'
node shared/scripts/dependency-runtime/cli.mjs record-summary --payload '{...}'
node shared/scripts/dependency-runtime/cli.mjs advance --to PHASE_4_COLLECT_RESULTS
node shared/scripts/dependency-runtime/cli.mjs complete
```

## Required State Fields

- `worker_plan`
- `worker_results`
- `child_runs`
- `verification_passed`
- `report_ready`
- `summary_recorded`

## Worker Summary Contract

`ln-821`, `ln-822`, and `ln-823` emit `dependency-worker` summary envelopes.

Managed mode:
- `ln-820` checkpoints `child_run`
- worker receives deterministic `runId` and exact `summaryArtifactPath`
- `ln-820` records the emitted worker summary with `record-worker-result`

Standalone mode:
- worker writes the same `dependency-worker` summary envelope under `.hex-skills/runtime-artifacts/runs/{run_id}/dependency-worker/`

`ln-820` records a final `dependency-coordinator` summary before `complete`.

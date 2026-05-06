# Modernization Runtime Contract

Deterministic runtime for `ln-830-code-modernization-coordinator`.

## Commands

```bash
node references/scripts/modernization-runtime/cli.mjs start --identifier repo-modernization --manifest-file <file>
node references/scripts/modernization-runtime/cli.mjs status --identifier repo-modernization
node references/scripts/modernization-runtime/cli.mjs checkpoint --phase PHASE_2_DELEGATE_WORKERS --payload '{...}'
node references/scripts/modernization-runtime/cli.mjs record-worker-result --payload '{...}'
node references/scripts/modernization-runtime/cli.mjs record-summary --payload '{...}'
node references/scripts/modernization-runtime/cli.mjs advance --to PHASE_3_COLLECT_RESULTS
node references/scripts/modernization-runtime/cli.mjs complete
```

## Required State Fields

- `worker_plan`
- `worker_results`
- `child_runs`
- `verification_passed`
- `report_ready`
- `summary_recorded`

## Worker Summary Contract

`ln-831` and `ln-832` emit `modernization-worker` summary envelopes.

Managed mode:
- `ln-830` checkpoints `child_run`
- worker receives deterministic `runId` and exact `summaryArtifactPath`
- `ln-830` records the emitted worker summary with `record-worker-result`

Standalone mode:
- worker writes the same `modernization-worker` summary envelope under `.hex-skills/runtime-artifacts/runs/{run_id}/modernization-worker/`

`ln-830` records a final `modernization-coordinator` summary before `complete`.

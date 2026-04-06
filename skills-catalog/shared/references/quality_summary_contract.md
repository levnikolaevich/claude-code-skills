# Quality Summary Contract

Machine-readable summaries for the `ln-510` family.

Envelope: `shared/references/coordinator_summary_contract.md`
Runtime family: `shared/references/quality_worker_runtime_contract.md`

## Worker Summary

`summary_kind`:
- `quality-worker`

Payload fields:
- `worker`
- `status` (`completed | skipped | error`)
- `verdict`
- `score`
- `issues`
- `warnings`
- `artifact_path`
- `metadata`

## Coordinator Output

`ln-510` still writes `.hex-skills/runtime-artifacts/runs/{run_id}/story-quality/{story_id}.json` for `ln-500`.

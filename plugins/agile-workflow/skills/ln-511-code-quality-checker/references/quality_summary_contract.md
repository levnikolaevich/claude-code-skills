<!-- SOURCE-OF-TRUTH: shared/references/quality_summary_contract.md. Edit ONLY here; run `node tools/marketplace/shared.mjs sync` -->

# Quality Summary Contract

Machine-readable summaries for the `ln-510` family.

Envelope: `references/coordinator_summary_contract.md`
Runtime family: `references/quality_worker_runtime_contract.md`

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

<!-- SOURCE-OF-TRUTH: shared/references/evaluation_worker_runtime_contract.md. Edit ONLY here; run `node tools/marketplace/shared.mjs sync` -->

# Evaluation Worker Runtime Contract

Canonical worker runtime contract for workers launched by `evaluation-runtime`.

Use this contract for:
- research workers
- findings workers
- documentation or repair workers
- merge workers
- refinement workers
- audit workers migrated onto the evaluation platform

## Goals

Workers must:
- remain standalone-invocable
- run under deterministic phase control
- emit a machine-readable summary before completion
- avoid parent-specific contract wording

## Required Commands

`references/scripts/evaluation-worker-runtime/cli.mjs` must provide:
- `start`
- `status`
- `checkpoint`
- `record-summary`
- `advance`
- `pause`
- `complete`

## Required Worker State

The runtime state must include:
- `self_check_passed`
- `summary_recorded`
- `summary_artifact_path`
- `summary`
- `final_result`

## Managed Invocation

Managed workers always receive:
- deterministic `runId`
- exact `summaryArtifactPath`

Managed workers must:
- write their summary JSON to that exact path
- keep public output concise because coordinators consume the JSON summary

## Standalone Invocation

Standalone workers:
- generate their own `run_id`
- write to the family-specific standalone path
- still emit the same summary envelope

## Summary Kind

Default worker summary kind:
- `evaluation-worker`

Use `references/evaluation_summary_contract.md` for payload rules.

## Self-Check Rule

No worker may complete unless:
- required phases are checkpointed
- `summary_recorded=true`
- `self_check_passed=true`

## Cleanup Rule

Workers that launch background processes must record cleanup evidence using:
- `references/cleanup_evidence_contract.md`

Workers that run iterative refinement must record:
- `refinement_trace`
- cleanup evidence for each refinement process

## Related Contracts

- `references/evaluation_coordinator_runtime_contract.md`
- `references/evaluation_summary_contract.md`
- `references/refinement_trace_contract.md`
- `references/cleanup_evidence_contract.md`

**Version:** 1.0.0
**Last Updated:** 2026-04-10

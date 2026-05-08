<!-- SOURCE-OF-TRUTH: plugins/agile-workflow/shared/references/cleanup_evidence_contract.md. Edit ONLY here; run `node tools/marketplace/shared.mjs sync` -->

# Cleanup Evidence Contract

Canonical evidence model for process cleanup in evaluation workflows.

## Required Fields

Each cleanup record must contain:
- `subject`
- `pid`
- `source_phase`
- `verify_attempts`
- `final_status`
- `verified_at`

## Required Collections

Coordinator/runtime state may maintain:
- `background_agent_cleanup`
- `refinement_cleanup`

## Final Status Rules

Allowed `final_status` values should be machine-verifiable.

Preferred values:
- `DEAD`
- `MISSING_PID`
- `VERIFY_FAILED`

`cleanup_verified=true` requires all expected cleanup records to end in `DEAD`.

## Source of Truth Rule

Do not use a boolean as the primary proof of cleanup.

Use cleanup records as the source of truth and derive:
- `cleanup_verified`
- `processes_verified_dead`

from those records.

**Version:** 1.0.0
**Last Updated:** 2026-04-10

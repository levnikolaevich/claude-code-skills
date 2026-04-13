# Refinement Trace Contract

Canonical trace format for iterative refinement.

## Required Entry Fields

Every refinement trace entry must include:
- `iteration`
- `perspective`
- `status`
- `verdict`
- `suggestions_total`
- `applied`
- `remaining_risk_max`
- `skip_reason_code`
- `skip_reason_detail`

## Required Perspectives

Standard perspectives (2-stage model):

Stage 1 (parallel):
1. `dry_run_executor`
2. `new_dev_tester`
3. `adversarial_reviewer`

Stage 2 (after merge):
4. `final_sweep`

`generic_quality` is not included — it is covered by the Phase 2 Codex review.

All 4 perspectives are mandatory when Codex is available. Each must appear in the trace; failed sessions must include the error reason.

## Valid Skip Reasons

- `codex_unavailable`
- `converged_before_iteration`
- `converged_low_impact`
- `max_iter_reached`
- `terminal_error_previous_iteration`

## Rules

- silent omission is forbidden
- a skipped angle without `skip_reason_detail` is a self-check failure
- `suggestions_total` and `applied` must be numeric, even when zero

**Version:** 1.0.0
**Last Updated:** 2026-04-10

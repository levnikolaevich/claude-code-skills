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

Current standard order:
1. `generic_quality`
2. `dry_run_executor`
3. `new_dev_tester`
4. `adversarial_reviewer`
5. `final_sweep`

Later perspectives may be skipped, but they still must appear in the trace with explicit skip reasons.

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

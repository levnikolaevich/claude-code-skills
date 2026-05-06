# Runtime Status Catalog

Canonical status and terminal-phase names for shared runtimes.

Use this file when:
- adding a new stateful runtime
- extending worker summary schemas
- documenting checkpoint payloads and verdicts

## Common Terminal Phases

- `DONE`
- `PAUSED`

## Worker Summary Statuses

Use these for machine-readable worker summary envelopes unless a family explicitly defines a different domain verdict:
- `completed`
- `skipped`
- `error`

Applies to:
- environment worker summaries
- audit worker summaries

## Review Agent Statuses

Allowed per-agent statuses:
- `launched`
- `result_ready`
- `dead`
- `failed`
- `skipped`

Legacy aliases are invalid. Use `PHASE_7_REFINEMENT`, not `PHASE_6_REFINE` or `PHASE_6_REFINEMENT`.

Resolved agent statuses:
- `result_ready`
- `dead`
- `failed`
- `skipped`

## Planning Progress Statuses

When a planning runtime needs a phase-local completion marker, use:
- `completed`

Example:
- `research_status=completed`

## Story Gate Verdicts

Canonical verdicts:
- `PASS`
- `CONCERNS`
- `WAIVED`
- `FAIL`

Completed test-task statuses accepted by Story Gate:
- `Done`
- `SKIPPED`
- `VERIFIED`

Story Gate finalization shortcut statuses:
- `skipped_by_verdict`

## Story Execution Workflow Statuses

Canonical task-board statuses used by story execution and story gate:
- `Backlog`
- `Todo`
- `In Progress`
- `To Review`
- `To Rework`
- `Done`
- `SKIPPED`
- `VERIFIED`

## Optimization Runtime Statuses

Wrong Tool Gate verdicts:
- `PROCEED`
- `CONCERNS`
- `WAIVED`
- `BLOCK`

Validation verdicts:
- `GO`
- `GO_WITH_CONCERNS`
- `WAIVED`
- `NO_GO`

Execution checkpoint statuses:
- `completed`
- `skipped_by_mode`

Cycle statuses:
- `completed`

## Iterative Refinement Exit Reasons

Canonical exit reasons for `PHASE_7_REFINEMENT` checkpoint:
- `CONVERGED` — verdict APPROVED, all risks mitigated
- `CONVERGED_LOW_IMPACT` — all suggestions in iteration are LOW impact (<10%)
- `MAX_ITER` — reached iteration limit (5); WARNING if MEDIUM/HIGH remain
- `ERROR` — advisor failed or timed out
- `SKIPPED` — advisor unavailable or disabled

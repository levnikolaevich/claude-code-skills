# Story Planning Runtime Contract

Runtime contract for `ln-220`.

Canonical phase/status names: `shared/references/runtime_status_catalog.md`

## Identifier

- `epic-{epicId}`

## Phases

- `PHASE_0_CONFIG`
- `PHASE_1_CONTEXT_ASSEMBLY`
- `PHASE_2_RESEARCH`
- `PHASE_3_PLAN`
- `PHASE_4_ROUTING`
- `PHASE_5_MODE_DETECTION`
- `PHASE_6_DELEGATE`
- `PHASE_7_FINALIZE`
- `PHASE_8_SELF_CHECK`
- `DONE`
- `PAUSED`

## Required State

- `context_ready`
- `research_status` (`completed`)
- `research_file`
- `ideal_plan_summary`
- `routing_summary`
- `epic_group_modes`
- `epic_results`
- `story_plan_summary`
- `final_result`
- `self_check_passed`
- `pending_decision`

## Guard Rules

- No transition without current-phase checkpoint.
- `PHASE_2_RESEARCH` requires `context_ready`.
- `PHASE_3_PLAN` requires `research_status`.
- `PHASE_4_ROUTING` requires `ideal_plan_summary`.
- `PHASE_5_MODE_DETECTION` requires `routing_summary`.
- `PHASE_6_DELEGATE` requires `epic_group_modes`.
- If `auto_approve=false`, `PHASE_6_DELEGATE` also requires resolved preview decision.
- `PHASE_7_FINALIZE` requires all expected `story-plan-worker` summaries.
- `PHASE_8_SELF_CHECK` requires `story-plan` coordinator summary.
- `DONE` requires `self_check_passed` and `final_result`.

## Pending Decisions

Use shared `pending_decision` schema for:
- missing context
- routing confirmation
- ambiguous `ADD` vs `REPLAN`
- preview confirmation

## Worker Summaries

Workers stay standalone-capable, but coordinator-invoked runs must pass both `runId` and `summaryArtifactPath`.
Child worker summaries use `summary_kind=story-plan-worker`.
After finalization, `ln-220` writes its own `story-plan` coordinator artifact.

# Epic Planning Runtime Contract

Runtime contract for `ln-210`.

Canonical phase/status names: `shared/references/runtime_status_catalog.md`

## Identifier

- scope identifier

## Phases

- `PHASE_0_CONFIG`
- `PHASE_1_DISCOVERY`
- `PHASE_2_RESEARCH`
- `PHASE_3_PLAN`
- `PHASE_4_MODE_DETECTION`
- `PHASE_5_PREVIEW`
- `PHASE_6_DELEGATE`
- `PHASE_7_FINALIZE`
- `PHASE_8_SELF_CHECK`
- `DONE`
- `PAUSED`

## Required State

- `discovery_summary`
- `research_summary`
- `ideal_plan_summary`
- `mode_detection`
- `epic_plan_summary`
- `final_result`
- `pending_decision`
- `self_check_passed`

## Guard Rules

- no transition without current-phase checkpoint
- `PHASE_2_RESEARCH` requires discovery summary
- `PHASE_3_PLAN` requires research summary
- `PHASE_4_MODE_DETECTION` requires ideal plan summary
- `PHASE_6_DELEGATE` requires preview confirmation when `auto_approve=false`
- `PHASE_8_SELF_CHECK` requires `epic-plan` coordinator summary
- `DONE` requires `self_check_passed` and `final_result`

## Coordinator Artifact

After `PHASE_7_FINALIZE`, `ln-210` writes an `epic-plan` coordinator artifact.

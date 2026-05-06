# Docs Runtime Contract

Runtime contract for `ln-110`.

Canonical phase/status names: `references/runtime_status_catalog.md`

## Identifier

- `project-docs`

## Phases

- `PHASE_0_CONFIG`
- `PHASE_1_CONTEXT_ASSEMBLY`
- `PHASE_2_DETECTION`
- `PHASE_3_DELEGATE`
- `PHASE_4_AGGREGATE`
- `PHASE_5_SELF_CHECK`
- `DONE`
- `PAUSED`

## Required State

- `context_ready`
- `detected_flags`
- `worker_plan`
- `worker_results`
- `quality_inputs`
- `self_check_passed`

## Guard Rules

- no transition without current-phase checkpoint
- `PHASE_2_DETECTION` requires `context_ready`
- `PHASE_3_DELEGATE` requires `detected_flags`
- `PHASE_4_AGGREGATE` requires all expected docs worker summaries
- `DONE` requires `self_check_passed` and `final_result`

## Worker Summaries

Docs workers emit `docs-generation` summaries using the shared envelope.

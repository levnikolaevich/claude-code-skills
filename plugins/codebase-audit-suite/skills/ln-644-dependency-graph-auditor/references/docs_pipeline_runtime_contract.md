# Docs Pipeline Runtime Contract

Runtime contract for `ln-100`.

Canonical phase/status names: `references/runtime_status_catalog.md`

## Identifier

- `docs-pipeline`

## Phases

- `PHASE_0_CONFIG`
- `PHASE_1_SOURCE_SCAN`
- `PHASE_2_CONFIRMATION`
- `PHASE_3_DELEGATE`
- `PHASE_4_QUALITY_GATE`
- `PHASE_5_CLEANUP`
- `PHASE_6_SELF_CHECK`
- `DONE`
- `PAUSED`

## Required State

- `source_manifest`
- `source_mode`
- `component_results`
- `quality_summary`
- `cleanup_summary`
- `pending_decision`

## Guard Rules

- no transition without current-phase checkpoint
- `PHASE_3_DELEGATE` requires confirmation decision when `auto_approve=false`
- `PHASE_4_QUALITY_GATE` requires at least one component summary
- `PHASE_5_CLEANUP` requires docs-quality summary
- `DONE` requires `self_check_passed` and `final_result`

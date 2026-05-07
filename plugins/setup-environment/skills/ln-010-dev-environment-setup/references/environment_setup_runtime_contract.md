<!-- SOURCE-OF-TRUTH: shared/references/environment_setup_runtime_contract.md. Edit ONLY here; run `node tools/marketplace/shared.mjs sync` -->

# Environment Setup Runtime Contract

Runtime contract for `ln-010`.

Canonical phase/status names: `references/runtime_status_catalog.md`

## Identifier

- `targets-{normalizedTargets}`

## Manifest Fields

- `targets`: setup targets, default `both`
- `dry_run`: when `true`, plan without mutating and allow `final_result=DRY_RUN_PLAN`
- `plugins`: marketplace plugin selection for `ln-013`, default `agile-workflow`
- `auto_install_providers`: MCP provider install permission for `ln-013`, default `false`
- `apply_ide_override`: IDE permission override permission for `ln-012`, default `false`
- `worker_registry`: default `ln-011`, `ln-012`, `ln-013`, `ln-014`

## Phases

- `PHASE_0_CONFIG`
- `PHASE_1_ASSESS`
- `PHASE_1B_PROVIDER_SELECTION`
- `PHASE_2_DISPATCH_PLAN`
- `PHASE_3_WORKER_EXECUTION`
- `PHASE_4_VERIFY`
- `PHASE_5_WRITE_ENV_STATE`
- `PHASE_6_SELF_CHECK`
- `DONE`
- `PAUSED`

## Required State

- `assess_summary`
- `provider_selection` (`{ chosen, available, reason, selected_by }`)
- `dispatch_plan`
- `worker_results`
- `verification_summary`
- `env_state_written`
- `self_check_passed`
- `final_result`
- `pending_decision`

## Guard Rules

- No transition without current-phase checkpoint.
- `PHASE_1B_PROVIDER_SELECTION` requires `assess_summary`.
- `PHASE_2_DISPATCH_PLAN` requires `provider_selection.chosen`.
- `PHASE_3_WORKER_EXECUTION` requires `dispatch_plan`.
- `PHASE_4_VERIFY` requires all dispatched worker summaries.
- `PHASE_5_WRITE_ENV_STATE` requires `verification_summary`.
- `DONE` requires `self_check_passed`.
- `DONE` also requires `env_state_written`, except `final_result=DRY_RUN_PLAN`.

## Worker Summaries

Workers stay standalone-first and may optionally write:
- `env-agent-install`
- `env-mcp-config`
- `env-marketplace-align`
- `env-instructions`

Coordinator consumes only the shared summary envelope.
Every worker summary envelope must include `run_id`; standalone workers generate one when the caller does not pass `runId`.
Worker payload `status` uses `completed`, `skipped`, or `error`.

## Managed Worker Handoff

For every dispatched worker:
- compute deterministic `child_run_id`
- compute exact `childSummaryArtifactPath`
- materialize a child manifest
- checkpoint `child_run` metadata before invocation
- start `environment-worker-runtime` in managed mode
- invoke the worker with both `runId` and `summaryArtifactPath`
- read the artifact and record it through `record-worker`

`ln-015` is part of the environment family, but it is standalone cleanup and not part of the `ln-010` dispatch set.

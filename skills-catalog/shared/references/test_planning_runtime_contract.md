# Test Planning Runtime Contract

Runtime contract for `ln-520`.

Canonical phase/status names: `shared/references/runtime_status_catalog.md`

## Identifier

- Story ID

## Phases

- `PHASE_0_CONFIG`
- `PHASE_1_DISCOVERY`
- `PHASE_2_RESEARCH`
- `PHASE_3_MANUAL_TESTING`
- `PHASE_4_AUTO_TEST_PLANNING`
- `PHASE_5_FINALIZE`
- `PHASE_6_SELF_CHECK`
- `DONE`
- `PAUSED`

## Required State

- `simplified`
- `worker_results`
- `child_runs`
- `research_status`
- `manual_status`
- `test_task_id`
- `test_task_url`
- `coverage_summary`
- `self_check_passed`

## Guard Rules

- no transition without current-phase checkpoint
- non-simplified mode requires `ln-521` before manual testing
- non-simplified mode requires `ln-522` before auto-test planning
- finalization requires `ln-523` summary
- `DONE` requires `self_check_passed` and `final_result`

## Worker Summaries

Workers emit `test-planning-worker` summaries using the shared envelope.
Managed delegation passes deterministic child `run_id` plus exact `summaryArtifactPath`, checkpoints `child_run` metadata, and advances only from the worker artifact.
Worker runtime family: `shared/references/test_planning_worker_runtime_contract.md`

Managed delegation sequence:
1. compute deterministic child `run_id`
2. compute exact child artifact path
3. start `test-planning-worker-runtime`
4. checkpoint `child_run`
5. invoke worker with both transport inputs
6. record only the resulting `test-planning-worker` artifact

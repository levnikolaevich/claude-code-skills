# Quality Runtime Contract

Runtime contract for `ln-510`.

Canonical phase/status names: `shared/references/runtime_status_catalog.md`

## Identifier

- Story ID

## Phases

- `PHASE_0_CONFIG`
- `PHASE_1_DISCOVERY`
- `PHASE_2_CODE_QUALITY`
- `PHASE_3_CLEANUP`
- `PHASE_4_AGENT_REVIEW`
- `PHASE_5_CRITERIA`
- `PHASE_6_LINTERS`
- `PHASE_7_REGRESSION`
- `PHASE_8_LOG_ANALYSIS`
- `PHASE_9_FINALIZE`
- `PHASE_10_SELF_CHECK`
- `DONE`
- `PAUSED`

## Required State

- `fast_track`
- `worker_results`
- `child_runs`
- `review_summary`
- `criteria_summary`
- `linters_summary`
- `aggregated_issues`
- `quality_score`
- `quality_verdict`
- `self_check_passed`

## Guard Rules

- no transition without current-phase checkpoint
- `PHASE_3_CLEANUP` requires `ln-511` summary
- `PHASE_8_LOG_ANALYSIS` requires `ln-513` summary
- `PHASE_9_FINALIZE` requires `ln-514` summary
- `DONE` requires `self_check_passed` and `final_result`

## Worker Summaries

Workers emit `quality-worker` summaries using the shared envelope.
Managed delegation passes deterministic child `run_id` plus exact `summaryArtifactPath`, checkpoints `child_run` metadata, and advances only from the worker artifact.
Worker runtime family: `shared/references/quality_worker_runtime_contract.md`

Managed delegation sequence:
1. compute deterministic child `run_id`
2. compute exact child artifact path
3. start `quality-worker-runtime`
4. checkpoint `child_run`
5. invoke worker with both transport inputs
6. record only the resulting `quality-worker` artifact

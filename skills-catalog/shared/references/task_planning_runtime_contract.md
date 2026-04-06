# Task Planning Runtime Contract

Runtime contract for `ln-300`.

## Identifier

- `story-{storyId}`

## Phases

- `PHASE_0_CONFIG`
- `PHASE_1_DISCOVERY`
- `PHASE_2_DECOMPOSE`
- `PHASE_3_READINESS_GATE`
- `PHASE_4_MODE_DETECTION`
- `PHASE_5_DELEGATE`
- `PHASE_6_VERIFY`
- `PHASE_7_SELF_CHECK`
- `DONE`
- `PAUSED`

## Required State

- `discovery_ready`
- `ideal_plan_summary`
- `readiness_score`
- `readiness_findings`
- `mode_detection`
- `plan_result`
- `child_run`
- `verification_summary`
- `final_result`
- `self_check_passed`
- `pending_decision`

## Guard Rules

- No transition without current-phase checkpoint.
- `PHASE_2_DECOMPOSE` requires `discovery_ready`.
- `PHASE_3_READINESS_GATE` requires `ideal_plan_summary`.
- `PHASE_4_MODE_DETECTION` requires `readiness_score`.
- `readiness_score < 4` blocks the run.
- `readiness_score` `4-5` requires a resolved approval decision before mode detection.
- `PHASE_5_DELEGATE` requires `mode_detection`.
- `PHASE_6_VERIFY` requires task-plan worker summary.
- `PHASE_7_SELF_CHECK` requires `verification_summary`.
- `DONE` requires `self_check_passed` and `final_result`.

## Pending Decisions

Use shared `pending_decision` schema for:
- ambiguous `ADD` vs `REPLAN`
- readiness approval
- missing critical Story context

## Worker Summaries

Workers stay standalone-capable, but coordinator-invoked runs must pass both `runId` and `summaryArtifactPath`.
Every `task-plan` summary uses the shared envelope with mandatory `run_id`; standalone workers generate one when the caller does not pass `runId`.
The runtime may checkpoint child task-plan worker metadata in `child_run`, but phase advancement still depends on the final `task-plan` artifact.

Managed delegation sequence:
1. compute deterministic child `runId`
2. compute exact child `summaryArtifactPath`
3. start `task-plan-worker-runtime`
4. checkpoint `child_run`
5. invoke worker with both transport inputs
6. record only the child `task-plan` artifact

## Coordinator Stage Summary

After `PHASE_6_VERIFY`, `ln-300` writes a `pipeline-stage` coordinator summary for Stage 0.

Minimum semantics:
- `stage = 0`
- `story_id`
- `status = completed`
- `final_result`
- `story_status`
- `readiness_score`

`ln-1000` consumes this artifact as the machine-readable completion signal for Stage 0.

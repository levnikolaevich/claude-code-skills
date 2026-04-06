# Story Execution Runtime Contract

Deterministic runtime for `ln-400-story-executor`.

## Runtime Location

```text
.hex-skills/story-execution/runtime/
  active/ln-400/{story_id}.json
  runs/{run_id}/manifest.json
  runs/{run_id}/state.json
  runs/{run_id}/checkpoints.json
  runs/{run_id}/history.jsonl
```

## Commands

```bash
node shared/scripts/story-execution-runtime/cli.mjs start --story PROJ-123 --manifest-file <file>
node shared/scripts/story-execution-runtime/cli.mjs status --story PROJ-123
node shared/scripts/story-execution-runtime/cli.mjs checkpoint --phase PHASE_3_SELECT_WORK --payload '{...}'
node shared/scripts/story-execution-runtime/cli.mjs record-worker --task-id T-123 --payload '{...}'
node shared/scripts/story-execution-runtime/cli.mjs record-group --group-id G-1 --payload '{...}'
node shared/scripts/story-execution-runtime/cli.mjs record-stage-summary --story PROJ-123 --payload '{...}'
node shared/scripts/story-execution-runtime/cli.mjs advance --to PHASE_4_TASK_EXECUTION
node shared/scripts/story-execution-runtime/cli.mjs pause --reason "..."
node shared/scripts/story-execution-runtime/cli.mjs complete
```

## Phase Graph

- `PHASE_0_CONFIG`
- `PHASE_1_DISCOVERY`
- `PHASE_2_WORKTREE_SETUP`
- `PHASE_3_SELECT_WORK`
- `PHASE_4_TASK_EXECUTION`
- `PHASE_5_GROUP_EXECUTION`
- `PHASE_6_VERIFY_STATUSES`
- `PHASE_6B_SCENARIO_VALIDATION`
- `PHASE_7_STORY_TO_REVIEW`
- `PHASE_8_SELF_CHECK`
- `DONE`
- `PAUSED`

## Required State Fields

- `current_task_id`
- `current_group_id`
- `processable_counts`
- `rework_counter_by_task`
- `inflight_workers`
- `worker_results_by_task`
- `worktree_ready`
- `story_transition_done`
- `tasks`
- `groups`

## Guard Rules

- no entry to `PHASE_3_SELECT_WORK` without successful worktree setup
- `PHASE_4_TASK_EXECUTION` requires selected task
- `PHASE_5_GROUP_EXECUTION` requires selected group
- `PHASE_4_TASK_EXECUTION -> PHASE_6_VERIFY_STATUSES` requires a latest `ln-402` task-status summary for the selected task
- `PHASE_5_GROUP_EXECUTION -> PHASE_6_VERIFY_STATUSES` requires a latest `ln-402` task-status summary for every task in the group
- Story cannot move to `To Review` while any `Todo`, `To Review`, or `To Rework` tasks remain
- Story cannot move to `To Review` while parallel workers are still inflight
- `DONE` requires a recorded Stage 2 coordinator artifact
- `DONE` requires `PHASE_8_SELF_CHECK` with `pass=true`

## Worker Result Contract

Task workers must write `task-status` summaries per `shared/references/coordinator_summary_contract.md`.

Coordinator semantics:
- `ln-400` consumes worker artifacts, not worker prose
- `ln-402` is the final task outcome source
- executor artifacts from `ln-401`, `ln-403`, and `ln-404` are execution evidence, not terminal review truth
- every managed worker run starts through `task-worker-runtime`
- coordinators checkpoint `child_run` metadata before invocation
- artifact paths are worker-disambiguated: `{task_id}--{worker}.json`

## Coordinator Stage Summary

After `PHASE_7_STORY_TO_REVIEW`, `ln-400` writes a `pipeline-stage` coordinator summary for Stage 2.

Minimum semantics:
- `stage = 2`
- `story_id`
- `status = completed`
- `final_result`
- `story_status = To Review`

`ln-1000` consumes this artifact as the machine-readable completion signal for Stage 2.

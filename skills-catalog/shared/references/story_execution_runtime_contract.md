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
node shared/scripts/story-execution-runtime/cli.mjs record-task --task-id T-123 --payload '{...}'
node shared/scripts/story-execution-runtime/cli.mjs record-group --group-id G-1 --payload '{...}'
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
- `worktree_ready`
- `story_transition_done`
- `tasks`
- `groups`

## Guard Rules

- no entry to `PHASE_3_SELECT_WORK` without successful worktree setup
- `PHASE_4_TASK_EXECUTION` requires selected task
- `PHASE_5_GROUP_EXECUTION` requires selected group
- Story cannot move to `To Review` while any `Todo`, `To Review`, or `To Rework` tasks remain
- Story cannot move to `To Review` while parallel workers are still inflight
- `DONE` requires `PHASE_8_SELF_CHECK` with `pass=true`

## Worker Result Contract

Task workers must write summaries per `shared/references/coordinator_summary_contract.md`.

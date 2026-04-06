# Test Planning Summary Contract

Machine-readable summaries for the `ln-520` family.

Envelope: `shared/references/coordinator_summary_contract.md`
Runtime family: `shared/references/test_planning_worker_runtime_contract.md`

## Worker Summary

`summary_kind`:
- `test-planning-worker`

Payload fields:
- `worker`
- `status` (`completed | skipped | error`)
- `warnings`
- `research_comment_path`
- `manual_result_path`
- `test_task_id`
- `test_task_url`
- `coverage_summary`
- `planned_scenarios`
- `metadata`

## Coordinator Output

`ln-520` writes `.hex-skills/runtime-artifacts/runs/{run_id}/story-tests/{story_id}.json` for `ln-500`.

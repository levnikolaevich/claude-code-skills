# Review Runtime Contract

Shared deterministic runtime for review coordinators such as `ln-310`.

Canonical phase/status names: `shared/references/runtime_status_catalog.md`

Use this contract when a skill needs:
- parallel external review agents
- resumable phase state
- machine-readable checkpoints
- deterministic merge gates before verdict/status changes

## Runtime Location

```text
.hex-skills/agent-review/runtime/
  active/{skill}/{identifier}.json
  runs/{run_id}/manifest.json
  runs/{run_id}/state.json
  runs/{run_id}/checkpoints.json
  runs/{run_id}/history.jsonl
```

## Commands

```bash
node shared/scripts/review-runtime/cli.mjs start --skill ln-310 --mode story --identifier PROJ-123 --manifest-file <file>
node shared/scripts/review-runtime/cli.mjs status --skill ln-310 --identifier PROJ-123
node shared/scripts/review-runtime/cli.mjs checkpoint --skill ln-310 --phase PHASE_2_AGENT_LAUNCH --payload '{...}'
node shared/scripts/review-runtime/cli.mjs advance --skill ln-310 --to PHASE_3_RESEARCH
node shared/scripts/review-runtime/cli.mjs register-agent --skill ln-310 --agent codex --metadata-file ... --result-file ...
node shared/scripts/review-runtime/cli.mjs record-stage-summary --skill ln-310 --identifier PROJ-123 --payload '{...}'
node shared/scripts/review-runtime/cli.mjs sync-agent --skill ln-310 --agent codex
node shared/scripts/review-runtime/cli.mjs pause --skill ln-310 --reason "..."
node shared/scripts/review-runtime/cli.mjs complete --skill ln-310
```

## Phase Graph

| Phase | Purpose |
|------|--------|
| `PHASE_0_CONFIG` | tools/config resolved |
| `PHASE_1_DISCOVERY` | inputs/materials loaded |
| `PHASE_2_AGENT_LAUNCH` | health check + prompt persistence + launch bookkeeping |
| `PHASE_3_RESEARCH` | foreground research/audit |
| `PHASE_4_DOCS` | domain extraction + inline documentation creation |
| `PHASE_5_AUTOFIX` | story-only repair phase |
| `PHASE_6_MERGE` | sync agents + critical verification + merge summary |
| `PHASE_7_REFINEMENT` | deterministic Codex refinement loop |
| `PHASE_8_APPROVE` | story-only approval/status mutation |
| `PHASE_9_SELF_CHECK` | final machine-readable checklist |
| `DONE` | terminal success |
| `PAUSED` | terminal/manual intervention needed |

Legacy aliases are invalid. Use `PHASE_7_REFINEMENT`; `PHASE_6_REFINE` and `PHASE_6_REFINEMENT` are not accepted.

Mode rules:
- `story`: all phases required
- `plan_review`: Phase 4, 5 and 8 must be checkpointed as `skipped_by_mode`
- `context`: Phase 4, 5 and 8 must be checkpointed as `skipped_by_mode`

## Agent Status Contract

Allowed values:
- `skipped`
- `launched`
- `result_ready`
- `dead`
- `failed`

Resolved statuses:
- `result_ready`
- `dead`
- `failed`
- `skipped`

Merge is blocked until every required agent is resolved.

## State Schema

Required fields in `state.json`:
- `run_id`
- `skill`
- `mode`
- `identifier`
- `phase`
- `complete`
- `health_check_done`
- `agents_required`
- `agents_available`
- `agents_skipped_reason`
- `docs_checkpoint`
- `merge_summary`
- `refinement_iterations`
- `self_check_passed`
- `final_result`
- `final_verdict`
- `agents`

Per-agent fields:
- `name`
- `status`
- `prompt_file`
- `result_file`
- `log_file`
- `metadata_file`
- `pid`
- `session_id`
- `started_at`
- `finished_at`
- `exit_code`
- `error`

## Guard Rules

- No transition without a checkpoint for the current phase.
- `PHASE_2_AGENT_LAUNCH -> PHASE_3_RESEARCH` requires recorded health check.
- If `agents_available > 0`, launch bookkeeping must exist before Phase 3.
- `PHASE_3_RESEARCH -> PHASE_4_DOCS` always. `PHASE_4_DOCS -> PHASE_5_AUTOFIX/PHASE_6_MERGE` requires `docs_checkpoint` in state (story mode).
- `PHASE_6_MERGE` is blocked until all required agents are resolved.
- `PHASE_7_REFINEMENT` requires a merge summary.

## Coordinator Stage Summary

`ln-310` in `mode=story` writes a `pipeline-stage` coordinator summary once Story routing is resolved.

Minimum semantics:
- `stage = 1`
- `story_id`
- `status = completed`
- `final_result`
- `story_status`
- `verdict`
- `readiness_score`

`ln-1000` consumes this artifact as the machine-readable completion signal for Stage 1.
- Non-SKIPPED `PHASE_7_REFINEMENT` exit requires `refinement_iterations >= 1`.
- `story` mode cannot skip Phase 4, 5, or Phase 8.
- `DONE` requires `PHASE_9_SELF_CHECK` checkpoint with `pass=true` and `final_result` set.

## Checkpoint Payload Guidance

| Phase | Required payload |
|------|-------------------|
| `PHASE_2_AGENT_LAUNCH` | `health_check_done`, `agents_available`, `agents_required`, optional `agents_skipped_reason` |
| `PHASE_4_DOCS` | `docs_checkpoint: { docs_created, docs_skipped_reason }` (story mode) |
| `PHASE_6_MERGE` | `merge_summary` |
| `PHASE_7_REFINEMENT` | `iterations` (int), `exit_reason` (enum: CONVERGED, CONVERGED_LOW_IMPACT, MAX_ITER, ERROR, SKIPPED), `applied` (int: fixes applied across all iterations) |
| `PHASE_8_APPROVE` | approval/status result summary |
| `PHASE_9_SELF_CHECK` | `pass`, `processes_verified_dead` (bool: all agent PIDs confirmed dead), optional `final_verdict` |

## Relationship to `agent_runner`

Runtime does not launch agents itself. Skills launch agents through `shared/agents/agent_runner.mjs`.

Deterministic sync depends on:
- `--metadata-file` for launch/finish metadata
- result file existence
- stored `pid` for dead-vs-alive resolution

Runtime is the source of truth for orchestration state. Prompt/result/log files remain the audit trail.

# Pipeline State Machine

Transition rules and guards for the 4-stage pipeline. Single Story mode — one story selected by user per run.

## States

| State | Description | Entry Condition |
|-------|------------|----------------|
| **QUEUED** | Story selected by user, worker not yet spawned | User selected story from available list |
| **STAGE_0** | ln-300-task-coordinator running | Story status = Backlog, NO tasks |
| **STAGE_1** | ln-310-multi-agent-validator running | Story status = Backlog, tasks exist |
| **STAGE_2** | ln-400-story-executor running | Story status = Todo or To Rework |
| **STAGE_3** | ln-500-story-quality-gate running | Story status = To Review |
| **DONE** | Story processing complete (branch pushed by ln-500) | Quality gate PASS/CONCERNS/WAIVED |
| **PAUSED** | Waiting for user input | Escalation triggered |

## Transitions

```
QUEUED --[worker spawned]--> STAGE_0 (if Backlog, no tasks)
QUEUED --[worker spawned]--> STAGE_1 (if Backlog, tasks exist)
QUEUED --[worker spawned]--> STAGE_2 (if Todo / To Rework / In Progress)
QUEUED --[worker spawned]--> STAGE_3 (if To Review)

STAGE_0 --[tasks created]--> STAGE_1
STAGE_0 --[creation failed]--> PAUSED

STAGE_1 --[GO verdict]--> STAGE_2
STAGE_1 --[NO-GO, retry exhausted]--> PAUSED

STAGE_2 --[all tasks Done]--> STAGE_3
STAGE_2 --[task stuck 3+ reworks]--> PAUSED    # Handled by ln-400 internally — escalated as Stage 2 ERROR

STAGE_3 --[PASS/CONCERNS/WAIVED]--> DONE (branch pushed by ln-500)
STAGE_3 --[FAIL, cycles < 2]--> STAGE_2   # reads metadata.rework_hint, passes --rework-focus to ln-400
STAGE_3 --[FAIL, cycles >= 2]--> PAUSED

PAUSED --[user resolves]--> (appropriate stage)
```

## Guards

| Transition | Guard | Failure Action |
|-----------|-------|---------------|
| QUEUED -> STAGE_0 | Story has NO tasks (`_(tasks not created yet)_`) | Route to Stage 0 |
| QUEUED -> STAGE_1 | Story HAS tasks (task lines under Story) | Route to Stage 1 |
| STAGE_0 -> STAGE_1 | ln-300 created 1-8 tasks successfully | If error, PAUSE |
| STAGE_1 -> STAGE_2 | ln-310 verdict = GO, Readiness >= 5 | Retry once, then PAUSE |
| STAGE_2 -> STAGE_3 | All tasks status = Done | Wait for remaining tasks |
| STAGE_3 -> DONE | Verdict IN (PASS, CONCERNS, WAIVED), ln-500 pushed branch | Branch finalization by ln-500 |
| STAGE_3 -> STAGE_2 | quality_cycles < 2 | Read `metadata.rework_hint` from Stage 3 artifact; pass `--rework-focus {blocking_categories}` to ln-400. If >= 2, PAUSE and escalate |

## Counters (per Story)

| Counter | Initial | Increment | Limit | On Limit |
|---------|---------|-----------|-------|----------|
| `quality_cycles` | 0 | +1 on STAGE_3 FAIL | 2 | Escalate to user |
| `validation_retries` | 0 | +1 on STAGE_1 NO-GO | 1 | Escalate to user |
| `crash_count` | 0 | +1 on confirmed crash | 1 | PAUSED + escalate |

## Stage-to-Status Mapping

| Story Status (kanban) | Pipeline Stage | Action |
|-----------------------|---------------|--------|
| Backlog (no tasks) | Stage 0 | Invoke ln-300 (create tasks) |
| Backlog (tasks exist) | Stage 1 | Invoke ln-310 (validate) |
| Todo (approved) | Stage 2 | Invoke ln-400 |
| In Progress | Stage 2 | Invoke ln-400 (continues) |
| To Rework | Stage 2 | Invoke ln-400 (fix tasks) |
| To Review | Stage 3 | Invoke ln-500 |
| Done | -- | Skip |
| Postponed | -- | Skip |
| Canceled | -- | Skip |

---
**Version:** 3.0.0
**Last Updated:** 2026-03-24

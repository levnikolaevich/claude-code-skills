# ln-1000 Pipeline Orchestrator - Architecture Reference

> **Purpose:** Human-readable architecture reference for maintainers.
> **Scope:** Current production runtime only. This file documents the active `Skill() + Agent()` model used by `ln-1000`.
> **Audience:** Developers extending or reviewing the pipeline. Execution details still live in `SKILL.md` and `references/`.

For the executable specification, read [SKILL.md](SKILL.md).

## Runtime Model

`ln-1000` is a sequential stage orchestrator. It does not use experimental team sessions, peer-message orchestration, or team-specific hooks.

### Execution levels

| Level | Primitive | Used by | Purpose |
|------|-----------|---------|---------|
| L1 | `Skill()` | `ln-1000` lead | Stage orchestration |
| L2 | `Skill()` or `Agent()` | Stage coordinators | Internal dispatch plus coordinator artifact emission |
| L3 | `Agent()` subagent | Heavy workers | Isolated implementation or analysis with worker runtime state |

### Active hierarchy

```text
ln-1000
  -> Skill("ln-300-task-coordinator")
  -> Skill("ln-310-multi-agent-validator")
  -> Skill("ln-400-story-executor")
  -> Skill("ln-500-story-quality-gate")
```

Each coordinator owns its own worker strategy and emits a stage artifact. `ln-1000` never reaches into worker internals and advances only from coordinator artifacts.

## Pipeline Flow

```text
Story selection
  -> Stage 0: ln-300 task planning
  -> Stage 1: ln-310 validation
  -> Stage 2: ln-400 execution
  -> Stage 3: ln-500 quality gate
  -> report + cleanup
```

### Status transitions

| Stage | Skill | Input | Output |
|------|-------|-------|--------|
| 0 | `ln-300` | Backlog without tasks | Backlog with tasks |
| 1 | `ln-310` | Backlog with tasks | Todo |
| 2 | `ln-400` | Todo or To Rework | To Review |
| 3 | `ln-500` | To Review | Done or To Rework |

## Core Principles

| Principle | Meaning |
|----------|---------|
| Sequential lead | One lead skill advances one story through the stages |
| Coordinator autonomy | Stage coordinators choose their own workers and tool mix |
| Isolate heavy work | Code-writing and other large tasks run in subagents |
| Inline control | Aggregation, routing, and stage decisions stay inline |
| Artifact-first progression | Stage completion comes from coordinator artifacts, not prose or chat memory |
| Checkpointed recovery | Resume from persisted state, not long-lived peer sessions |
| Single kanban writer per stage | The active coordinator owns its own state transition |

## Worker Pattern by Stage

### Stage 0: `ln-300`

- Plans task breakdown for the selected story
- Delegates task creation or replanning to stateful task-plan workers
- Returns a Stage 0 coordinator artifact to the lead

### Stage 1: `ln-310`

- Runs validation and readiness checks
- May launch external review agents or subagents internally
- Returns GO/NO-GO plus readiness signals

### Stage 2: `ln-400`

- Executes tasks in priority order
- Uses isolated subagents with task-worker runtimes for implementation, rework, and test execution
- Closes each task cycle from the latest `ln-402` artifact

### Stage 3: `ln-500`

- Runs quality gate and final verdict logic
- Invokes quality and test-planning coordinators, which checkpoint child worker runs as needed
- Finalizes story status and reporting

## Recovery and State

Pipeline state is persisted after each stage. Recovery reconstructs the next action from:

1. persisted pipeline state
2. stage artifacts already written
3. current kanban or Linear truth as a secondary assertion
4. git and worktree state

This design replaced the older peer-session and heartbeat model. There is no separate team lifecycle to monitor.

## Worktree Model

| Rule | Behavior |
|------|----------|
| Worktree owner | `ln-1000` creates and removes the shared worktree when needed |
| Inherited CWD | Stage coordinators and their subagents run inside the active worktree |
| No nested worktrees | Worker agents must not create their own worktrees under the pipeline worktree |
| Standalone execution | Coordinators can detect an existing feature branch and reuse it |

## Verification Model

After each stage, the lead performs read-only verification before advancing. The primary completion signal is the coordinator stage artifact, not free-text output:

| Stage | Key assertions |
|------|----------------|
| 0 | Valid Stage 0 artifact from `ln-300`; kanban checked secondarily |
| 1 | Valid Stage 1 artifact from `ln-310`; readiness/verdict checked there |
| 2 | Valid Stage 2 artifact from `ln-400`; kanban checked secondarily |
| 3 | Valid Stage 3 artifact from `ln-500`; verdict/state checked there |

If assertions fail, the pipeline pauses or retries according to [SKILL.md](SKILL.md).

## Non-Goals

- No experimental team runtime
- No peer-session message protocol
- No team cleanup API dependency
- No team-idle hooks
- No heartbeat-based supervision

## Related References

| Topic | File |
|------|------|
| Executable specification | [SKILL.md](SKILL.md) |
| State machine rules | [references/pipeline_states.md](references/pipeline_states.md) |
| Delegation runtime | [../../docs/architecture/AGENT_DELEGATION_PLATFORM_GUIDE.md](../../docs/architecture/AGENT_DELEGATION_PLATFORM_GUIDE.md) |
| Architecture principles | [../../docs/architecture/SKILL_ARCHITECTURE_GUIDE.md](../../docs/architecture/SKILL_ARCHITECTURE_GUIDE.md) |

---

**Last Updated:** 2026-03-26

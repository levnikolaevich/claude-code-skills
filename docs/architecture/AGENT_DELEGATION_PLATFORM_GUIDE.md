# Agent Delegation Platform Guide

**Operational delegation guidance for this repository (2026)**

<!-- SCOPE: Delegation roles used in this repo, context isolation, worktree handling, Windows/runtime constraints, and token-efficiency rules. -->

Based on: [Anthropic Building Effective Agents](https://www.anthropic.com/research/building-effective-agents), [Claude Code Subagents Docs](https://code.claude.com/docs/en/sub-agents), and production experience with `ln-1000-pipeline-orchestrator`.

## 1. Supported Delegation Roles

| Role | Tool | Context | Communication | Best for |
|------|------|---------|---------------|----------|
| **Skill** (coordinator) | `Skill()` | Inline, shares caller context | Direct return in same thread | Multi-step coordination, progressive disclosure, artifact-first stage control |
| **Subagent** (worker) | `Agent()` | Isolated context window | Final result plus persisted runtime state/artifact | Heavy file work, independent evaluation, context isolation |

**Repository rule:** this repo does not rely on experimental peer-session orchestration. All production workflows here use `Skill()` plus `Agent()` subagents only.

## 2. Selection Rule

| If you need... | Use | Why |
|----------------|-----|-----|
| Shared reasoning thread and direct stage control | `Skill()` | Caller needs the full control flow and state transitions |
| Isolation from heavy reads/writes or independent judgment | `Agent()` | Keeps implementation context out of the coordinator while leaving a worker artifact behind |
| Parallel external review | External CLI agent or separate `Agent()` calls | Same outcome without experimental runtime features |

**Rule of thumb:** isolate at the code-writing boundary, not at the orchestration boundary.

## 3. Current Repository Pattern

| Layer | Pattern in this repo |
|-------|----------------------|
| `ln-1000` | Sequential `Skill()` calls to `ln-300 -> ln-310 -> ln-400 -> ln-500`, advancing only from coordinator stage artifacts |
| Coordinators | Decide their own worker strategy internally and checkpoint child run metadata for resume |
| Heavy workers | `Agent()` subagents with isolated context, persisted runtime state, and machine-readable summaries |
| Review/aggregation steps | Usually inline `Skill()` calls where the caller must retain shared context |

Examples:
- `ln-400` executes from worker artifacts and treats the latest `ln-402` artifact as the final task outcome
- `ln-510` and `ln-520` checkpoint child worker runs for resume, but still advance only from worker artifacts
- `ln-310` may run external CLI agents, but not experimental team sessions

## 4. Lifecycle Characteristics

### Skill lifecycle

`INVOKED -> RUNNING inline -> RETURNED`

| Aspect | Details |
|--------|---------|
| Context | Shared with caller |
| Cost | Near-zero startup |
| Best use | Coordination, sequencing, aggregation |
| Risk | Large inline work can bloat caller context |

### Subagent lifecycle

`SPAWNED -> EXECUTING isolated -> RETURNED or ERROR`

| Aspect | Details |
|--------|---------|
| Context | Separate window |
| Cost | Higher startup than `Skill()` |
| Best use | File-heavy work, independent review, long-running bounded tasks |
| Result surface | Summary plus persisted runtime/artifact flows back to caller |

## 5. Worktree and State Rules

| Topic | Rule |
|-------|------|
| Worktree owner | Lead orchestrator creates/removes the shared worktree |
| Worker CWD | Coordinators and subagents inherit the active worktree |
| Nested worktrees | Do not create them inside worker agents |
| Pipeline state | Persist checkpoints after each stage, not via heartbeat loops |

Recovery pattern:
1. Read persisted pipeline state
2. Read coordinator or worker artifacts already written
3. Re-read kanban/source of truth only as a secondary assertion
4. Reconstruct next stage or child resume action
5. Resume with the next coordinator or child worker

## 6. Windows and Runtime Constraints

| Issue | Guidance |
|-------|----------|
| Shell startup cost on Windows | Prefer built-in file tools or MCP over shell for file operations |
| CRLF in scripts | Copy existing scripts or normalize explicitly |
| Long-running pipeline sessions | Use checkpoint recovery and compaction discipline, not idle-heartbeat protocols |

## 7. Token Efficiency Rules

| Technique | Effect |
|-----------|--------|
| Keep orchestration in `Skill()` | No process-spawn overhead for stage coordination |
| Push heavy implementation into `Agent()` | Large reasoning stays out of lead context |
| Load only the needed references | Progressive disclosure keeps idle cost low |
| Persist stage checkpoints and artifacts | Resume cheaply after interruptions without replaying long chat state |
| Compact before degradation | Avoid context drift in long runs |

## 8. Non-Goals

- No experimental team runtime
- No peer-session message protocol
- No team-idle hook dependency
- No heartbeat-driven worker supervision

If a future experiment uses those APIs, document it separately as experimental and do not present it as the default runtime model.

---

**Version:** 2.0.0
**Last Updated:** 2026-03-26

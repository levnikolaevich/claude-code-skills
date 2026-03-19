# Agent Delegation Platform Guide

**Operational best practices for Claude Code skill delegation (2026)**

<!-- SCOPE: Delegation roles (Skill/Agent), context isolation principles, worktree management, Windows compatibility, state persistence, token efficiency. -->

Based on: [Anthropic Building Effective Agents](https://www.anthropic.com/research/building-effective-agents), [Multi-Agent Research System](https://www.anthropic.com/engineering/multi-agent-research-system), [Claude Code Subagents Docs](https://code.claude.com/docs/en/sub-agents), and production experience with ln-1000-pipeline-orchestrator.

---

## 1. Three Delegation Roles

| Role | Tool | Context | Communication | Best for |
|------|------|---------|---------------|----------|
| **Skill** (coordinator) | Skill() | Inline — shares caller's context | Return value in same context | Multi-step coordination, progressive disclosure |
| **Agent** (worker) | Agent() | Isolated — own context window | Blocking return to caller | Heavy file operations, independent evaluation |
| **Agent Teams** (peer) | TeamCreate | Independent — own process | Async SendMessage | Multi-agent discussion, not used in pipeline |

**Decision rule:** Use Skill when the caller needs the reasoning thread. Use Agent when the task would bloat context (>5 files touched) or requires independent evaluation. Use Agent Teams only when agents need to negotiate with each other.

**In this repository:**
- **ln-1000 pipeline** uses Skill to call coordinators (ln-300/310/400/500)
- **Coordinators** (ln-400) use Agent for code-writing workers (ln-401/403/404) and Skill for reviewers (ln-402)
- **Quality coordinator** (ln-510) uses Skill for all checks (ln-511-514) and background bash for Codex/Gemini agents

## 2. Coordinator Lifecycle (Skill)

```
INVOKED via Skill() -> RUNNING (inline in caller context) -> RETURNED (result in context)
```

| Aspect | Details |
|--------|---------|
| Context | Shares caller's context — all reasoning visible to caller |
| Startup cost | Near-zero — no process spawn |
| Result delivery | Inline — caller sees everything the coordinator did |
| Error handling | Exception propagates to caller |
| Token impact | Coordinator orchestration adds to caller's context (~10-40K per coordinator) |

**Progressive disclosure:** Skill metadata (name + description) loaded at session start. Full SKILL.md content loaded only when Skill() invoked. This keeps idle skills cheap.

## 3. Worker Lifecycle (Agent)

```
SPAWNED via Agent() -> EXECUTING (isolated context) -> RETURNED (result text) | ERROR
```

| Aspect | Details |
|--------|---------|
| Context | Own window — implementation reasoning stays isolated |
| Startup cost | ~2-5 seconds (process spawn + context initialization) |
| Result delivery | Final output text returned to caller |
| Error handling | Crash = error returned to caller. No heartbeat needed |
| Token impact | Only result summary enters caller's context (~1-5K) |
| Effort control | `effort` frontmatter (2.1.78): set per-agent reasoning level |
| Runaway prevention | `maxTurns` frontmatter (2.1.78): limit agent turn count |

**When to isolate as Agent:**
- Code-writing tasks (ln-401/403/404) — heavy file I/O, implementation reasoning shouldn't bias reviewers
- Quality assessment needing independence — but note: ln-511-514 are currently Skill (inline) for context sharing with ln-510 coordinator

## 4. Context Isolation Principle

**Boundary rule:** Isolate at the code-writing boundary, not at the coordination boundary.

| What | Isolation | Rationale |
|------|-----------|-----------|
| Code writing (ln-401/403/404) | Agent (isolated) | Heavy I/O; reasoning shouldn't bias review |
| Code review (ln-402) | Skill (inline) | Reviewer benefits from Story AC + task context |
| Quality checks (ln-511-514) | Skill (inline) | Sequential checks share findings; coordinator needs results |
| Test planning (ln-521-523) | Skill (inline) | Planner needs implementation context |
| Codex/Gemini review | Background bash | Independent multi-model evaluation |

**5-file rule of thumb:** If a task touches more than ~5 files, isolate it in an Agent to prevent context bloat.

**Context budget:** With Opus 4.6 1M context, a full pipeline run (ln-300 + ln-310 + ln-400 orchestration + ln-500 orchestration) uses ~300-400K tokens (30-40%). Safe margin for rework cycles.

## 5. State Persistence

Pipeline state persisted to `.pipeline/state.json` after each stage completion. Recovery reads checkpoint + kanban.

| What is persisted | What is NOT persisted |
|-------------------|----------------------|
| story_state, quality_cycles, validation_retries, story_results, stage_timestamps, git_stats, readiness_scores | Ephemeral vars (reconstructed from checkpoint on recovery) |

**Recovery sequence:** Read state.json -> read checkpoint -> re-read kanban -> jump to next stage. Coordinator-level resume handled by kanban (Done tasks skipped by coordinator query).

## 6. Windows Compatibility

| Issue | Root Cause | Fix |
|-------|-----------|-----|
| `$CLAUDE_PROJECT_DIR` undefined | Env var not in hook shell context | Use relative paths |
| CRLF in .sh files | Write tool uses platform default | Use Bash `cp` for scripts |
| Sleep prevention | Pipeline exceeds idle timeout | `prevent-sleep.ps1` via PowerShell |

### Codex CLI Performance on Windows

Codex uses PowerShell for shell commands (hardcoded). `agent_runner.mjs` auto-detects Windows and adds performance hint to prompt, directing Codex to prefer built-in file tools over shell commands.

## 7. Worktree Isolation

| Model | Who Creates | Who Uses | Who Cleans Up |
|-------|-------------|----------|---------------|
| **Pipeline** | ln-1000 Phase 3.4 | All coordinators (inherit CWD) | ln-1000 Phase 5 (after cd to project root) |
| **Standalone** | ln-400 Phase 1 (self-detection) | ln-400 + ln-500 | ln-500 Phase 7 |

**Self-detection:** Coordinators check `git branch --show-current`. If on `feature/*` -> use current branch, skip worktree creation.

**Pipeline worktree lifecycle:**
1. ln-1000 creates worktree + branch in Phase 3.4
2. All Skill() calls inherit the worktree CWD
3. ln-500 commits + pushes (Phase 7) but skips worktree removal (CWD is inside worktree)
4. ln-1000 cd's to project root, then removes worktree in Phase 5

**Do NOT use `isolation: worktree` on Agent workers** — they inherit the lead's worktree. Adding isolation would create nested worktrees.

## 8. Delegation Principles

| Principle | Application |
|-----------|-------------|
| Lead coordinates via Skills | ln-1000 calls ln-300/310/400/500 as Skill(). Never spawns separate workers |
| Coordinators manage own dispatch | ln-400 decides Agent vs Skill for its workers. ln-1000 does not interfere |
| Skills as-is | Call skills exactly as documented. No modifications or bypasses |
| Kanban verification | After EVERY Skill call, re-read kanban and ASSERT expected state |
| Single kanban writer per stage | Each coordinator manages its own status transitions |
| bypassPermissions for Agent workers | `mode: "bypassPermissions"` in Agent() calls. Skills inherit caller's mode |

## 9. Token Efficiency

| Technique | Savings |
|-----------|---------|
| Inline coordinators (no worker spawn) | ~8-12 min overhead eliminated per pipeline |
| Agent isolation for code-writing | Implementation context stays in Agent, not lead |
| Progressive disclosure for Skills | Idle skills cost ~100 tokens (metadata only) |
| Stage-level checkpoints (not per-heartbeat) | Reduced state persistence overhead |
| Auto-compact at 80% | Prevents degraded quality in long pipeline runs |

### Context Degradation Prevention

Set `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE=80` in `settings.json` to trigger auto-compaction at 80% context usage.

---

**Version:** 2.0.0
**Last Updated:** 2026-03-19

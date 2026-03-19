# ln-1000 Pipeline Orchestrator — Architecture Reference

> **Purpose:** Human-readable architecture reference for developers and maintainers. Describes how the pipeline works, its components, and runtime behaviour.
> **Scope:** Conceptual overview, diagrams, per-stage breakdown, verification checklists, report format. NOT an execution spec — agents use `SKILL.md` and `references/` directly.
> **Audience:** Developers reviewing or extending the pipeline. Not loaded by agents during execution.

For full implementation spec (all phases, pseudocode, error handling), see `SKILL.md`.

## Execution Levels

Three levels of agent execution, each with different isolation and lifecycle:

```
Level 1: TeamCreate Teammate          Level 2: Skill() call             Level 3: Agent() subagent
─────────────────────────────          ──────────────────                ────────────────────────
Spawned by ln-1000 Lead               Called WITHIN teammate            Spawned BY a coordinator skill
Has own conversation context           Runs in caller's context          Has ISOLATED context
Communicates via SendMessage           Direct return value               Direct return value
Lives until shutdown_request           Lives within caller's turn        Lives until task complete
One per stage (fresh each time)        No overhead, no isolation         Full isolation, parallel-capable
```

**Example chain:** ln-1000 spawns teammate (L1) → teammate calls `Skill("ln-400")` (L2, inline) → ln-400 calls `Agent("ln-401...")` (L3, isolated subagent).

## Pipeline Flow with I/O

```
Phase 1: Discovery       Phase 2: Pre-flight       Phase 3: Team Setup
┌──────────────────┐     ┌──────────────────┐      ┌────────────────────────┐
│ IN:  kanban_board │────→│ IN:  Story desc  │─────→│ IN:  settings_template │
│ OUT: Story list   │     │ OUT: answers{}   │      │ OUT: Team + worktree   │
│      user picks 1 │     │      or skip     │      │      state.json        │
└──────────────────┘     └──────────────────┘      │      hooks installed   │
                                                    └──────────┬─────────────┘
                                                               │
Phase 4: Event Loop (heartbeat ~60s) ◄─────────────────────────┘
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  Per-stage sub-flow (Plan Gate):                                        │
│  Plan Worker (read-only) → Lead evaluates criteria → Execute Worker     │
│                                                                         │
│  STAGE 0 ──→ STAGE 1 ──→ STAGE 2 ──→ STAGE 3 ──→ DONE                 │
│  ln-300       ln-310       ln-400       ln-500                          │
│  Task Plan    Validate     Execute      Quality Gate                    │
│                                                                         │
│  Safety: Sender validation → State guard → ACK protocol                 │
│          Crash detection (3-step) → Lost message (done-flag poll)        │
└─────────────────────────────────────────────────────────────────────────┘
                                   │
Phase 5: Cleanup ◄─────────────────┘
┌──────────────────────────────────────────────────────┐
│ IN:  story_state, stage_notes, git_stats             │
│ OUT: Pipeline report, TeamDelete, .pipeline/ removed │
└──────────────────────┬───────────────────────────────┘
                       │
Phase 6: Meta-Analysis ◄┘
┌──────────────────────────────────────────────────────┐
│ IN:  pipeline report, stage metrics, infra_issues    │
│ OUT: ## Meta-Analysis appended to report             │
│      docs/tasks/reports/quality-trend.md updated     │
└──────────────────────────────────────────────────────┘
```

## Plan Gate: Two-Agent Pattern

Every stage runs TWO agents sequentially ("Generator and Critic"):

```
Plan Worker (read-only)                    Execute Worker (fresh)
┌──────────────────────────┐               ┌──────────────────────────┐
│ Reads codebase + Story   │   APPROVE     │ Calls Skill("ln-{NNN}") │
│ Sends JSON plan ─────────┼──→ Lead ──────┼→ Full execution          │
│ Cannot write files       │   evaluates   │ Writes code, updates     │
│ Cannot call Skill()      │   criteria    │   kanban, checkpoints    │
└──────────────────────────┘               └──────────────────────────┘
        ▲                          │
        └──── REVISE (max 2x) ─────┘
```

Plan is NOT passed to Execute Worker. It's a gate check only — Lead evaluates, then spawns a fresh execute worker that works independently.

## Teammates: Per-Stage Breakdown

### Stage 0 Teammate → ln-300 (Task Planning)

```
ln-1000 Lead
  └─ Agent(name: "story-{id}-decompose", team: "pipeline-...")     ← L1: teammate
       └─ Skill("ln-300-task-coordinator")                  ← L2: inline
            ├─ Agent("ln-301-task-creator ...")               ← L3: subagent (creates tasks)
            └─ Agent("ln-302-task-replanner ...")             ← L3: subagent (if replan needed)
```

| Aspect | Detail |
|--------|--------|
| **Input** | Story in Backlog (no tasks), business_answers |
| **What happens** | ln-300 analyzes Story, builds 1-8 task plan (Foundation-First), delegates to ln-301 |
| **ln-301 (subagent)** | Creates task files/Linear issues, updates kanban |
| **Output to Lead** | "Stage 0 COMPLETE. {N} tasks. Plan score: {X}/4" |
| **Effort** | low (template-based, no deep analysis) |
| **Duration** | 2-5 min |

### Stage 1 Teammate → ln-310 (Validation)

```
ln-1000 Lead
  └─ Agent(name: "story-{id}-validate", team: "pipeline-...")     ← L1: teammate
       └─ Skill("ln-310-multi-agent-validator")             ← L2: inline
            ├─ Agent("codex-review", background=true)       ← external agent (Codex CLI)
            ├─ Agent("gemini-review", background=true)      ← external agent (Gemini CLI)
            ├─ MCP Ref research (foreground)                ← inline research
            ├─ 27-criteria Penalty Points audit             ← inline
            └─ Phase 5: Merge agent results + debate        ← inline
```

| Aspect | Detail |
|--------|--------|
| **Input** | Story in Backlog (tasks exist), task metadata |
| **What happens** | Parallel: Codex + Gemini review in background. Foreground: 27-criteria audit, MCP Ref research, auto-fix. Then merge + debate agent findings |
| **External agents** | Codex CLI and Gemini CLI (not Claude subagents — separate processes via `agent_runner.mjs`) |
| **Output to Lead** | "Stage 1 COMPLETE. Verdict: GO/NO-GO. Readiness: {X}. Agents: codex(2/3),gemini(1/2)" |
| **Effort** | medium |
| **Duration** | 5-15 min (agents run in parallel with audit) |

### Stage 2 Teammate → ln-400 (Execution)

```
ln-1000 Lead
  └─ Agent(name: "story-{id}-implement", team: "pipeline-...")     ← L1: teammate
       └─ Skill("ln-400-story-executor")                    ← L2: inline
            │
            │  Task loop (per task, priority: To Review > To Rework > Todo):
            │
            ├─ Agent("ln-401-task-executor {taskId}")        ← L3: subagent (writes code)
            │    └─ Skill("ln-402-task-reviewer {taskId}")  ← L2: inline in ln-400 (reviews + commits)
            │
            ├─ Agent("ln-403-task-rework {taskId}")          ← L3: subagent (fixes review issues)
            │    └─ Skill("ln-402-task-reviewer {taskId}")  ← L2: inline in ln-400
            │
            └─ Agent("ln-404-test-executor {taskId}")        ← L3: subagent (runs test tasks)
                 └─ Skill("ln-402-task-reviewer {taskId}")  ← L2: inline in ln-400
```

| Aspect | Detail |
|--------|--------|
| **Input** | Story in Todo/To Rework, tasks with implementation details, feature branch |
| **What happens** | Loop: pick task → delegate to executor (subagent) → immediate review (inline) → next |
| **ln-401 (subagent)** | Implements task code in isolated context. Leaves changes uncommitted |
| **ln-402 (inline)** | Reviews code in ln-400's context. Only ln-402 commits code |
| **ln-403 (subagent)** | Fixes review findings. Isolated context for rework |
| **ln-404 (subagent)** | Executes test tasks. Same lifecycle as ln-401 |
| **Parallel groups** | Tasks in same parallel group spawn concurrently, then review sequentially |
| **Output to Lead** | "Stage 2 COMPLETE. All tasks Done. Story set to To Review" |
| **Effort** | medium |
| **Duration** | 15-60+ min (most time-consuming stage) |

**Why ln-402 is inline:** Reviewer's result drives the next action (approve vs rework). Running inline in ln-400's context gives direct access to the decision flow. Subagent would only return a final result, losing interaction.

### Stage 3 Teammate → ln-500 (Quality Gate)

```
ln-1000 Lead
  └─ Agent(name: "story-{id}-qa", team: "pipeline-...")     ← L1: teammate
       └─ Skill("ln-500-story-quality-gate")                ← L2: inline
            ├─ Skill("ln-510-quality-coordinator")          ← L2: inline
            │    ├─ Agent("ln-511-code-quality-checker")     ← L3: subagent (metrics + static analysis)
            │    ├─ Agent("ln-512-tech-debt-cleaner")        ← L3: subagent (auto-fixes)
            │    ├─ Agent("ln-513-regression-checker")       ← L3: subagent (runs tests)
            │    ├─ Agent("codex-review", background)       ← external agent
            │    └─ Agent("gemini-review", background)      ← external agent
            │
            └─ Skill("ln-520-test-planner")                 ← L2: inline (skipped if fast-track)
                 ├─ Agent("ln-521-test-researcher")          ← L3: subagent
                 ├─ Agent("ln-522-manual-tester")            ← L3: subagent
                 └─ Agent("ln-523-auto-test-planner")        ← L3: subagent
```

| Aspect | Detail |
|--------|--------|
| **Input** | Story in To Review, code on feature branch, readiness_score |
| **What happens** | Quality checks (ln-510) → test planning (ln-520, if not fast-track) → verdict |
| **Fast-track** | If readiness == 10: skip MCP Ref, agent review, test planning. Still run metrics + regression |
| **Verdict** | PASS/CONCERNS → Story → Done, branch pushed. FAIL → fix tasks created, Story → To Rework |
| **ln-500 is sole kanban writer for Done** | Lead only ASSERTs (read-only verify), never updates kanban to Done |
| **Output to Lead** | "Stage 3 COMPLETE. Verdict: {X}. Quality Score: {Y}/100. Agents: ..." |
| **Effort** | medium |
| **Duration** | 10-30 min |

## Teammate Lifecycle (all stages)

```
  Lead                              Teammate                        Skill (inside teammate)
   │                                   │                                   │
   ├─ Agent(name, team)───────────────→│ SPAWNED                           │
   │                                   ├─ Skill("ln-{NNN}")──────────────→│
   │                                   │                                   ├─ Agent() subagents...
   │                                   │                                   ├─ work...
   │                                   │                                   ├─ done
   │                                   │←──────────────────────────────────┤
   │                                   ├─ Write checkpoint                 │
   │                                   ├─ Write stage_notes                │
   │    "Stage N COMPLETE"  ←──────────┤ SendMessage                       │
   │                                   │                                   │
   ├─ "ACK Stage N" ─────────────────→│                                   │
   │                                   ├─ Write done.flag                  │
   ├─ shutdown_request ──────────────→│                                   │
   │                                   ├─ approve: true                    │
   │                                   └─ EXIT                             │
   │                                                                       │
   ├─ Spawn next stage teammate...                                         │
```

## Health Monitoring Summary

| Mechanism | Detects | Frequency |
|-----------|---------|-----------|
| **Stop hook** (exit 2) | Lead still running | Every ~60s (heartbeat) |
| **TeammateIdle hook** (exit 2) | Worker idle without done.flag | On worker idle |
| **Done-flag verification** | Lost completion messages | Every heartbeat |
| **3-step crash detection** | Worker crash (no report, no flag) | On suspicious idle |
| **Checkpoint + resume** | Crash recovery with context | On confirmed crash |

## Per-Stage VERIFY Checklists

Lead executes these read-only ASSERTs after each stage completion, **before** advancing state. If any ASSERT fails → `PAUSED` + escalate (except Stage 3 PASS which is non-blocking WARN).

### After Stage 0 COMPLETE (Task Planning)

| # | Check | Source |
|---|-------|--------|
| 1 | Re-read kanban board | Fresh state |
| 2 | Tasks exist under Story {id} | Kanban/Linear |
| 3 | Task count IN 1..8 | Kanban/Linear |

**On pass:** `story_state = STAGE_1`, spawn Stage 1 plan worker
**On fail:** `story_state = PAUSED`, escalate

### After Stage 1 GO (Validation)

| # | Check | Source |
|---|-------|--------|
| 1 | Re-read kanban board | Fresh state |
| 2 | Story status = Todo | Kanban/Linear (ln-310 set this) |
| 3 | Readiness score >= 5 | Worker report |

**On pass:** `story_state = STAGE_2`, spawn Stage 2 plan worker
**On fail:** `story_state = PAUSED`, escalate
**On NO-GO:** Retry once (fresh worker), then PAUSED

### After Stage 2 COMPLETE (Execution)

| # | Check | Source |
|---|-------|--------|
| 1 | Re-read kanban board | Fresh state |
| 2 | Story status = To Review | Kanban/Linear (ln-400 set this) |
| 3 | All tasks status = Done | Kanban/Linear |
| 4 | Feature branch has commits | `git log origin/{base}..HEAD --oneline` > 0 |

**On pass:** `story_state = STAGE_3`, spawn Stage 3 plan worker
**On fail:** `story_state = PAUSED`, escalate

### After Stage 3 PASS/CONCERNS/WAIVED (Quality Gate)

| # | Check | Source |
|---|-------|--------|
| 1 | Re-read kanban board | Fresh state |
| 2 | Story status = Done | Kanban/Linear (ln-500 is sole writer) |
| 3 | All tasks status = Done | Kanban/Linear |
| 4 | Branch pushed to remote | `git branch -r` contains feature branch |
| 5 | Extract git_stats | `stage_3_notes` or fallback `git diff --stat` |

**On pass:** `story_state = DONE`
**On fail:** WARN user (non-blocking — story likely Done, verification incomplete)

**Note:** Lead does NOT update kanban to Done — ln-500 is the sole kanban writer for Done status (per AGENT_TEAMS_PLATFORM_GUIDE §9: Single kanban writer). Lead only reads and ASSERTs.

### After Stage 3 FAIL

| # | Check | Source |
|---|-------|--------|
| 1 | Re-read kanban board | Fresh state |
| 2 | Story status = To Rework | Kanban/Linear (ln-500 set this) |
| 3 | quality_cycles < 2 | Pipeline state |

**If rework allowed:** `story_state = STAGE_2`, spawn Stage 2 (fix cycle)
**If limit reached:** `story_state = PAUSED`, escalate with score degradation analysis

## Pipeline Report Format

Generated in Phase 5 at `docs/tasks/reports/pipeline-{date}.md`. Combines worker stage notes with pipeline metrics.

### Report Structure

```
# Pipeline Report — {date}

**Story:** {id} — {title}
**Branch:** {branch_name}
**Final State:** DONE | PAUSED
**Duration:** {wall-clock time}

## Task Planning (ln-300)
| Tasks | Plan Score | Duration |
|-------|-----------|----------|
| {N} created | {score}/4 | {time} |
{stage_notes[0]: Key Decisions + Artifacts}

## Validation (ln-310)
| Verdict | Readiness | Agent Review | Duration |
|---------|-----------|-------------|----------|
| GO/NO-GO | {score}/10 | codex(N/M),gemini(N/M) | {time} |
{stage_notes[1]: Key Decisions + Artifacts}

## Implementation (ln-400)
| Status | Files | Lines | Duration |
|--------|-------|-------|----------|
| Done | {files_changed} | +{added}/-{deleted} | {time} |
{stage_notes[2]: Key Decisions + Artifacts}

## Quality Gate (ln-500)
| Verdict | Score | Agent Review | Rework | Duration |
|---------|-------|-------------|--------|----------|
| PASS/FAIL | {score}/100 | codex(N/M),gemini(N/M) | {cycles} | {time} |
{stage_notes[3]: Key Decisions + Artifacts}

## Pipeline Metrics
| Wall-clock | Workers | Crashes | Retries | Infra Issues |
|------------|---------|---------|---------|--------------|
| {duration} | {count} | {N} | {N} | {N} |

## Meta-Analysis
| Stage | Skill  | Duration | Worker  | Skill Result                              |
|-------|--------|----------|---------|-------------------------------------------|
| 0     | ln-300 | {time}   | {✓/⚠/✗} | Plan {score}/4, {N} tasks                 |
| 1     | ln-310 | {time}   | {✓/⚠/✗} | {GO/NO-GO}, Readiness {score}/10          |
| 2     | ln-400 | {time}   | {✓/⚠/✗} | {files} files, +{add}/-{del}              |
| 3     | ln-500 | {time}   | {✓/⚠/✗} | {verdict}, Score {score}/100, {rework} rework |
### Problems & Limitations
{infra issues table or "None detected."}
### Improvement Candidates
{numbered list or "None — pipeline ran clean."}
```

### Stage Notes (written by workers)

Each worker writes `{PIPELINE_DIR}/stage_{N}_notes_{id}.md` with consistent structure:

```
## {Stage Name}
**Skill:** ln-{NNN}
**Agent Review:** codex(N/M),gemini(N/M) | SKIPPED({reason})
### Key Decisions
- {1-3 bullets: rationale, challenges, choices}
### Artifacts
- {file paths, Linear URLs, commit SHAs, branch info}
```

### Terminal Summary (shown to user)

```
Pipeline Complete:
| Story | Branch | Planning | Validation | Implementation | Quality Gate | State |
|-------|--------|----------|------------|----------------|-------------|-------|
| {id} | {branch} | {N} tasks | GO {score} | Done | PASS {score} | DONE |

Report saved: docs/tasks/reports/pipeline-{date}.md
```

## Pipeline Definition of Done

Pipeline-level verification (Phase 5). Per-stage checks are in VERIFY blocks above.

| # | Criterion | Verified By | Scope |
|---|-----------|-------------|-------|
| 1 | User selected Story | `selected_story_id` is set | Always |
| 2 | Business questions resolved | `business_answers` stored OR skip | Always |
| 3 | Team created + operated | team exists in state | Always |
| 4 | Story reached terminal state | `story_state IN (DONE, PAUSED)` | Always |
| 5 | Per-stage verifications passed | All VERIFY blocks above passed | DONE only |
| 6 | Pipeline report generated | File exists at `docs/tasks/reports/` | Always |
| 7 | Pipeline summary shown to user | Phase 5 table output | Always |
| 8 | Team cleaned up | TeamDelete (or force-clean) | Always |
| 9 | Worktree resolved | DONE: cleaned by ln-500. PAUSED: saved + cleaned by lead | Always |
| 10 | Meta-Analysis run | Phase 6 completed, appended to pipeline report | Always |

## Phase 5 Cleanup Sequence

```
 1. Write state.json: complete=true        ← Stop hook passes through
 2. Self-verify DoD (table above)
 3. Read stage notes from .pipeline/
 4. Write pipeline report
 5. Show terminal summary to user
 6. Shutdown remaining workers             ← SendMessage(shutdown_request)
 7. TeamDelete (force-clean if hung)       ← rm -rf ~/.claude/teams/{name} as fallback
 8. Worktree cleanup:
    DONE   → already cleaned by ln-500
    PAUSED → git add -A → commit WIP → push → git worktree remove --force
 9. Stop sleep prevention (Windows)
10. Delete .pipeline/ directory
11. Phase 6: Meta-Analysis (see SKILL.md `## Phase 6`)
```

## File Map

| File | Purpose | Read by |
|------|---------|---------|
| `SKILL.md` | Full implementation spec (phases 0-6) | Lead agent |
| `references/worker_prompts.md` | Prompt templates for all teammates | Lead (at spawn time) |
| `references/phases/phase4_handlers.md` | ON message handlers (stage completion, crash) | Lead (Phase 4) |
| `references/phases/phase4_heartbeat.md` | Health monitoring + structured heartbeat output | Lead (Phase 4) |
| `references/worker_health_contract.md` | Lifecycle, keepalive hooks, respawn rules | Lead (reference) |
| `references/pipeline_states.md` | State machine transitions + guards | Lead (routing) |
| `references/checkpoint_format.md` | Checkpoint + state.json schemas | Lead + workers |
| `references/message_protocol.md` | Message formats + parsing regex | Lead + workers |
| `references/kanban_parser.md` | Story extraction from kanban board | Lead (Phase 1) |
| `references/settings_template.json` | Permissions + hooks config | Lead (Phase 3) |
| `references/hooks/*.sh` | Keepalive hook scripts | Claude Code runtime |
| `docs/tasks/reports/quality-trend.md` | Cross-run quality trend tracker (created in target project) | Lead (Phase 6) |

---
**Version:** 1.0.0
**Last Updated:** 2026-03-09

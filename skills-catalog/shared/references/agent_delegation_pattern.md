# Agent Delegation Pattern

Standard pattern for skills delegating work to an external CLI AI agent (Codex) via `shared/agents/agent_runner.mjs`. Opus is the native fallback.

For deterministic orchestration, pair this file with the active coordinator runtime contract for the skill family. Evaluation-platform validators use `shared/references/evaluation_coordinator_runtime_contract.md`, keep run state in `.hex-skills/evaluation/`, and use `--metadata-file` for launch/finish bookkeeping.

## When to Use

- Skill benefits from model specialization (planning, code analysis, structured review)
- Second opinion on generated plans or validation results
- Claude Opus remains meta-orchestrator; external agents are workers

## Agent Selection Matrix

| Skill Group | Primary Agent | Model | Fallback | Use Case |
|-------------|--------------|-------|----------|----------|
| Decomposition | Codex | Codex CLI runtime default | Opus | Scope analysis, epic planning |
| Task management | Codex | Codex CLI runtime default | Opus | Task decomposition, plan review |
| Execution | Opus (native) | claude-opus-4-6 | -- | Direct code writing |
| Validation | Codex | Codex CLI runtime default | Self-review (if agent fails) | Story/Tasks + context validation |
| Quality review | Codex | Codex CLI runtime default | Self-review (if agent fails) | Code review |

## Inline Agent Review

Agent review is inline in parent skills, not in separate worker skills:

| Parent Role | Review Type | Mode File |
|-------------|-------------|-----------|
| Story/context validator | Story/Tasks | `modes/story.md` |
| Story/context validator | Context | `modes/context.md` |
| Story/context validator | Plan review | `modes/plan_review.md` |
| Quality coordinator | Code | `modes/code.md` |

All modes assembled with `review_base.md` + mode file per "Step: Build Prompt" in shared workflow.

**Benefits:**
- No indirection: parent skill launches agents directly, no Skill() delegation overhead
- Parallel architecture: agents run in background while parent does its own validation
- Reference passing: Story/Tasks provided as Linear URLs or local file paths
- Critical verification: Claude independently evaluates each suggestion and either accepts or rejects

## Invocation Pattern

```bash
# Short prompt
node shared/agents/agent_runner.mjs --agent codex --prompt "Review this plan..."

# Large context via file with output (recommended)
node shared/agents/agent_runner.mjs --agent codex --prompt-file prompt.md --output-file result.md --cwd /project

# Large context with deterministic metadata
node shared/agents/agent_runner.mjs --agent codex --prompt-file prompt.md --output-file result.md --metadata-file result.meta.json --cwd /project

# Resume session (continues prior conversation context)
node shared/agents/agent_runner.mjs --agent codex --resume-session abc-123 --prompt-file followup.md --output-file result.md --cwd /project

# Health check
node shared/agents/agent_runner.mjs --health-check
```

## Runner Output Contract

### Stdout (JSON)

```json
{
  "success": true,
  "agent": "codex",
  "response": "...",
  "duration_seconds": 12.4,
  "error": null,
  "session_id": "7f9f9a2e-1b3c-4c7a-9b0e-...",
  "session_resumed": false,
  "pid": 12345,
  "log_file": ".hex-skills/agent-review/codex/PROJ-123_storyreview.log",
  "output_file": ".hex-skills/agent-review/codex/PROJ-123_storyreview_result.md",
  "started_at": "2026-03-26T12:00:00Z",
  "finished_at": "2026-03-26T12:00:12Z",
  "exit_code": 0
}
```

- `session_id`: captured from agent output after execution (null if capture failed)
- `session_resumed`: true only when `--resume-session` was used and succeeded
- `pid`, `log_file`, `output_file`, `started_at`, `finished_at`, `exit_code`: deterministic runtime bookkeeping fields for review coordinators

### Metadata File (when `--metadata-file` used)

This file is written by `agent_runner.mjs`. Review runtime may later resolve the same agent to `dead` or `skipped`, but those values are runtime state, not runner-written metadata.

```json
{
  "agent": "codex",
  "status": "launched | result_ready | failed",
  "pid": 12345,
  "started_at": "2026-03-26T12:00:00Z",
  "finished_at": "2026-03-26T12:00:12Z",
  "success": true,
  "exit_code": 0,
  "session_id": "7f9f9a2e-1b3c-4c7a-9b0e-...",
  "error": null,
  "log_file": "...log",
  "output_file": "...result.md"
}
```

Runtime-enabled skills should prefer metadata files over ad-hoc process reasoning.

### Result File Format (when --output-file used)

```markdown
<!-- AGENT_REVIEW_RESULT -->
<!-- agent: codex -->
<!-- timestamp: 2026-02-11T14:30:00Z -->
<!-- duration_seconds: 12.40 -->
<!-- exit_code: 0 -->
<!-- session_id: 7f9f9a2e-1b3c-4c7a-9b0e-... -->

{full agent report: markdown analysis (Goal, Analysis Process, Findings) + ## Structured Data with JSON block}

<!-- END_AGENT_REVIEW_RESULT -->
```

- `session_id` line is included only when captured (omitted if null)

**Behavior:**
- If agent writes to output file natively (codex `-o`): runner reads, wraps with metadata, rewrites
- Runner always captures stdout and wraps the result file with metadata markers (codex natively writes via `-o`; the runner layers metadata on top).
- Result file always has metadata markers regardless of agent type

**Contract:** The result file is the runner's responsibility. Skills MUST NOT write or rewrite result files. Skills read the result file after the runner exits. The only file the skill writes is `{identifier}_session.json` (extracted from result file `<!-- session_id: ... -->` metadata line).

## Prompt Guidelines

1. **Be specific** -- state exactly what output format you expect
2. **Include filtering rules** -- confidence thresholds, impact minimums
3. **Use prompt-file** -- avoids Windows shell escaping for long text
4. **Request Report + JSON** -- agents produce markdown analysis + `## Structured Data` with JSON block for programmatic parsing
5. **Keep scope narrow** -- one task per call, not multi-step workflows
6. **Pass references** -- provide Linear URLs or file paths, let agents access content themselves
7. **Include CRITICAL CONSTRAINTS** -- enforce project-file read-only behavior via prompt

## Agent Safety Model

External agents run in non-interactive mode (`exec` / `-p`) with tool access for analysis:

| Level | Codex |
|-------|-------|
| **CLI flags** | `--full-auto` (full tool access: read/write files, run commands, internet) |
| **Output** | `--color never` (clean log) + `-o {file}` (final result to file) + `-C {cwd}` (working dir) |
| **Prompt** | Focus on analysis; may write trivial fixes |

## Agent Timeout Policy

**Hard timeout (30 min default).** `agent_runner.mjs` kills the agent process after `hard_timeout_seconds` (configurable per agent in registry, override via `--timeout` CLI flag). Agents are prompted to finish within 25 minutes; 30 min provides headroom. Agent stdout streams to a `.log` file for real-time visibility. On both timeout and normal completion, the runner kills the entire process tree. On Windows — `taskkill /T /F /PID`; on Unix — process group kill.

**Monitoring:** Check agent liveness via log file stat (mtime growing = alive). Read `tail -10` of log for current stage. No separate heartbeat file — the log IS the heartbeat.

| Condition | Action |
|-----------|--------|
| Log file growing (mtime changes) | Healthy — agent actively working |
| Log static for 3+ min | Possibly stuck — read last 20 lines to diagnose |
| Agent exceeds hard timeout | Runner kills process, returns `success: false, error: "Hard timeout"` |
| Agent exited with error (non-zero) | Mark as FAILED, use other agent's results |
| Agent process crashed/disappeared | Mark as FAILED |

**FORBIDDEN:** Using TaskStop to kill agent background tasks. The runner handles timeout internally.

**Optional: Agent log streaming (Claude Code 2.1.98+):**
`Monitor(command="tail -f {agent_log} | grep --line-buffered -E 'Phase|ERROR|DONE'", timeout_ms=1800000, description="{agent} progress")`
Supplementary to `run_in_background` — adds observability, not control.

## MCP Failure Resilience

External agents may have MCP servers (Linear, GitHub, etc.) configured in their global settings. If an MCP server fails during agent startup (expired auth, network error, timeout), the agent process may crash before processing the prompt.

| Failure Mode | Symptom | Handling |
|-------------|---------|----------|
| MCP auth expired | Agent exits non-zero immediately (< 5s) | Treat as agent crash; use other agent's results |
| MCP server timeout | Agent hangs during init, eventually crashes | Same — crash handling via Fallback Rules |
| MCP tool call fails mid-review | Agent may skip tool or error in output | Agent prompted to degrade gracefully (use local files) |

**Mitigation layers:**
1. **Prompt-level:** Templates instruct agents to use local alternatives when Linear/tools unavailable
2. **Runner-level:** Non-zero exit code captured; `success: false` returned to skill
3. **Skill-level:** Fallback Rules apply — one agent crash does not block the review
4. **User-level:** If the advisor agent crashes on MCP, skill returns SKIPPED; user should check agent CLI MCP configuration (`~/.codex/config.json`)

## Fallback Rules

Per `shared/references/agent_review_workflow.md` Fallback Rules section. For non-review agent invocations (200/300 groups): on failure, fall back to Opus (native Claude).

## Integration Points in Orchestrator Lifecycle

```
Phase 1: DISCOVERY
Phase 2: PLAN ← external agent for analysis/decomposition
Phase 3: MODE DETECTION
Phase 4: AUTO-FIX ← 20 criteria, Penalty Points = 0 (story validation)
Phase 5: MERGE ← inline agent review results + Claude's own findings
Phase 6: DELEGATE
Phase 7: AGGREGATE
Phase 8: REPORT
```

## Startup: Agent Availability Check

**Health check is performed inline at the start of agent review.**

**MANDATORY READ:** Load `shared/references/agent_review_workflow.md` "Step: Health Check" (disabled flags check + agent probe).

**HARD RULES:**
1. **Check `{project_root}/.hex-skills/environment_state.json` disabled flags BEFORE running health-check.** Disabled agents are never probed. Validate against the shared environment-state contract first. **File not found → proceed with all agents (default=enabled).**
2. **ALWAYS execute the agent runner health check**. Runtime-enabled skills should use `node shared/agents/agent_runner.mjs --health-check --json`; manual skills may use text mode.
3. **Do NOT invent alternative checks** (e.g., `where`, `which`, `--version`, PATH lookup). ONLY the command above is valid.
4. **Only command output determines availability.** Do NOT reason about file existence, environment, or installation — run the command and read its output.
5. **If command fails** (file not found, import error, any exception) → treat as "all agents unavailable" → return SKIPPED verdict.

| Situation | Impact |
|-----------|--------|
| >=1 agent OK (not disabled, health check passed) | Run agents, return suggestions |
| `{project_root}/.hex-skills/environment_state.json` not found | Proceed with all agents (default=enabled, no exclusions) |
| All agents disabled in `{project_root}/.hex-skills/environment_state.json` | Return `{verdict: "SKIPPED", reason: "all agents disabled"}` |
| All agents UNAVAILABLE (health check) | Return `{verdict: "SKIPPED", reason: "no agents available"}` |
| Command error/not found | Same as UNAVAILABLE |

## Background Execution + Process-as-Arrive Pattern

Codex runs as a background task. Claude continues foreground work; when the result file is ready, it proceeds to Critical Verification. If Codex fails, fall back to Opus self-review.

```
                +-- Codex (background) --> completes --> Step 6: Verify --+
Prompt ------+                                                             +--> Accept verified suggestions
                                                           fails --> Self-Review fallback
```

**Rules:**
1. Launch Codex as a background Bash task (`run_in_background=true`) via `agent_runner.mjs` — ALL modes, including Plan Mode (agents are external OS processes, not affected by Claude Code plan mode)
2. Codex receives the assembled prompt with `--output-file`
3. When Codex completes (background task notification): read result file, proceed to Critical Verification
4. Codex has a **hard timeout** (30 min default) — runner kills process at limit (see Agent Timeout Policy)
5. If Codex fails: log failure, fall back to Opus self-review
6. Log all attempts for user visibility (agent name, duration, suggestion count)

## Critical Verification

Claude MUST independently verify each agent suggestion. Do NOT trust blindly.

```
Agent Suggestion --> Claude Evaluation --> AGREE? --> Accept as-is
                                      --> REJECT? --> Reject with reason (final)
```

**Verification criteria:**
- Is the suggestion factually correct? (check code, docs, standards)
- Does it align with project architecture and conventions?
- Does Claude's own analysis support or contradict the suggestion?

| Evaluation | Action |
|------------|--------|
| AGREE — suggestion is correct and valuable | Accept as-is |
| AGREE with modification — good idea, minor adjustment needed | Accept modified version |
| REJECT — incorrect, irrelevant, or contradicted by evidence | Reject (final, with reason logged) |

## Reference Passing Pattern

Standard steps before launching agents (performed inside agent review workers):

1. **Get references:** Call Linear MCP `get_issue(storyId)` for Story URL + `list_issues(parent)` for Task URLs. If project stores tasks locally → use file paths.
2. **Ensure .hex-skills/agent-review/:** If `.hex-skills/agent-review/` exists, reuse as-is. If not, create it with `.gitignore` (content: `*` + `!.gitignore`). Create `.hex-skills/agent-review/{agent}/` subdirs only if they don't exist. Do NOT add `.hex-skills/agent-review/` to project root `.gitignore`.
3. **Build prompt:** Load template, fill placeholders including `{review_goal}`, `{project_context}`, `{focus_hint}` (per-agent). See `agent_review_workflow.md` "Step: Build Prompt" steps 1-9.
4. **Save prompt:** To `.hex-skills/agent-review/{agent}/{identifier}_{review_type}_prompt.md` (per-agent — differ by `{focus_hint}`)
5. **Run agents:** `--prompt-file .hex-skills/agent-review/{agent}/{identifier}_{review_type}_prompt.md --output-file .hex-skills/agent-review/{agent}/{identifier}_{review_type}_result.md --cwd {project_dir}` — agents access Story/Tasks via references, runner writes result file per agent
6. **No cleanup** — `.hex-skills/agent-review/` persists as audit trail

**Why reference passing instead of content materialization:**
- Agents have internet access — they can read Linear directly
- No need to load full content into files (simpler workflow, fewer steps)
- If agent cannot access Linear — agent falls back to local files (`docs/tasks/`, `git log`). Reports what it couldn't access.
- Prompts stay focused (references instead of full content dumps)

## Review Persistence Pattern

```
.hex-skills/agent-review/
├── .gitignore                                      # * + !.gitignore
├── review_history.md                               # Append-only review log (all reviews)
├── context/                                         # Materialized files for agent access (context, plans)
│   ├── arch-proposal_context.md
│   └── velvet-giggling-acorn_plan.md
├── codex/
│   ├── arch-proposal_contextreview_prompt.md        # Per-agent prompt (differs by {focus_hint})
│   ├── arch-proposal_session.json                   # Session tracking for resume
│   ├── arch-proposal_contextreview_result.md        # Result (written by agent_runner.mjs)
│   ├── PROJ-123_storyreview_prompt.md
│   ├── PROJ-123_session.json
│   ├── PROJ-123_storyreview_result.md
│   └── PROJ-123_codereview_result.md
```

**Benefits:**
- Full audit trail of what was asked and what was returned
- Debug agent issues by comparing prompt vs result
- Track review history across multiple Stories
- Per-agent isolation — easy to audit Codex quality and refinement runs
- Review artifacts show verification reasoning for transparency

## Verdict Escalation Rules

| Worker | Escalation? | Mechanism |
|--------|-------------|-----------|
| Story review worker | No | Suggestions are editorial; Story validation Gate verdict unchanged |
| Code review worker | Yes | Findings with `area=security` or `area=correctness` can escalate PASS -> CONCERNS in code quality coordinator |

## Anti-Patterns

| DON'T | DO |
|-------|-----|
| Auto-retry in runner | Let skill decide fallback |
| Embed full story/task content in prompt | Pass references (Linear URLs / file paths) |
| Delete review artifacts after agents complete | Persist per-agent prompts and results in `.hex-skills/agent-review/{agent}/` |
| Write/rewrite result files from skill | Result files are runner's responsibility; skill only reads them and writes `_session.json` |
| Trust agent output blindly | Claude critically verifies each suggestion independently |
| Use agents for project file writes | Agents write only to `-o` output file; analysis-only |
| Chain multiple agent calls | One call per task; use `--resume-session` only for context continuity |
| Hard-depend on agent availability | Always have Opus fallback |
| Run health check separately from agent launch | Health check is first step of inline agent review |
| Kill agent tasks with TaskStop | Runner handles hard timeout internally; TaskStop is forbidden |
| Assume `proc.kill()` kills child processes | Runner uses process tree kill (`taskkill /T` on Windows, `os.killpg` on Unix) |
| Skip agent review phase | Agent review is MANDATORY in validator (after discovery) and quality coordinator (after cleanup) |
| Start each review verification from scratch | Load review history for dedup + calibration |
| Re-summarize agent findings in review log | Reference agent result files (self-documented reports) |
| Dump full project context into agent prompts | Inject compact project context (~300 tokens): architecture, principles, tech stack, past rejections. NO full dumps. |

---
**Version:** 4.0.0
**Last Updated:** 2026-03-22

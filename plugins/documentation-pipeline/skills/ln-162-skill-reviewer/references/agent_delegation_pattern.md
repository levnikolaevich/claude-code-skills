<!-- SOURCE-OF-TRUTH: shared/references/agent_delegation_pattern.md. Edit ONLY here; run `node tools/marketplace/shared.mjs sync` -->

# Agent Delegation Pattern

Standard pattern for skills delegating work to a non-host external CLI AI advisor via `references/agents/agent_runner.mjs`. Host self-review is the native fallback.

For deterministic orchestration, pair this file with the active coordinator runtime contract for the skill family. Evaluation-platform validators use `references/evaluation_coordinator_runtime_contract.md`, keep run state in `.hex-skills/evaluation/`, and use `--metadata-file` for launch/finish bookkeeping.

## When to Use

- Skill benefits from model specialization (planning, code analysis, structured review)
- Second opinion on generated plans or validation results
- The current host agent remains meta-orchestrator; external advisors are workers

## Agent Selection Matrix

| Skill Group | Primary Agent | Model | Fallback | Use Case |
|-------------|--------------|-------|----------|----------|
| Decomposition | Non-host advisor | Agent registry runtime default | Host self-review | Scope analysis, epic planning |
| Task management | Non-host advisor | Agent registry runtime default | Host self-review | Task decomposition, plan review |
| Execution | Host agent | Current runtime | -- | Direct code writing |
| Validation | Non-host advisor | Agent registry runtime default | Host self-review (if advisor fails) | Story/Tasks + context validation |
| Quality review | Non-host advisor | Agent registry runtime default | Host self-review (if advisor fails) | Code review |

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
- Critical verification: the host agent independently evaluates each suggestion and either accepts or rejects

## Invocation Pattern

```bash
# Short prompt
node references/agents/agent_runner.mjs --agent {advisor_agent} --prompt "Review this plan..."

# Large context via file with output (recommended)
node references/agents/agent_runner.mjs --agent {advisor_agent} --prompt-file prompt.md --output-file result.md --cwd /project

# Large context with deterministic metadata
node references/agents/agent_runner.mjs --agent {advisor_agent} --prompt-file prompt.md --output-file result.md --metadata-file result.meta.json --cwd /project

# Resume session (continues prior conversation context)
node references/agents/agent_runner.mjs --agent {advisor_agent} --resume-session abc-123 --prompt-file followup.md --output-file result.md --cwd /project

# Health check for a Claude host
node references/agents/agent_runner.mjs --health-check --json --host-agent claude

# Health check for a Codex host
node references/agents/agent_runner.mjs --health-check --json --host-agent codex
```

## Runner Output Contract

### Stdout (JSON)

```json
{
  "success": true,
  "agent": "{advisor_agent}",
  "response": "...",
  "duration_seconds": 12.4,
  "error": null,
  "session_id": "7f9f9a2e-1b3c-4c7a-9b0e-...",
  "session_resumed": false,
  "pid": 12345,
  "log_file": ".hex-skills/agent-review/{advisor_agent}/PROJ-123_storyreview.log",
  "output_file": ".hex-skills/agent-review/{advisor_agent}/PROJ-123_storyreview_result.md",
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
  "agent": "{advisor_agent}",
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
<!-- agent: {advisor_agent} -->
<!-- timestamp: 2026-02-11T14:30:00Z -->
<!-- duration_seconds: 12.40 -->
<!-- exit_code: 0 -->
<!-- session_id: 7f9f9a2e-1b3c-4c7a-9b0e-... -->

{full agent report: markdown analysis (Goal, Analysis Process, Findings) + ## Structured Data with JSON block}

<!-- END_AGENT_REVIEW_RESULT -->
```

- `session_id` line is included only when captured (omitted if null)

**Behavior:**
- If agent writes to output file natively (advisor native output): runner reads, wraps with metadata, rewrites
- Runner always captures stdout and wraps the result file with metadata markers (when an advisor natively writes via `-o`, the runner layers metadata on top).
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

| Level | Advisor CLI |
|-------|-------|
| **CLI flags** | Registry-defined non-interactive flags for analysis |
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
| Agent exited with error (non-zero) | Mark as FAILED, use available results |
| Agent process crashed/disappeared | Mark as FAILED |

**FORBIDDEN:** Using TaskStop to kill agent background tasks. The runner handles timeout internally.

**Optional: Agent log streaming (Claude Code 2.1.98+):**
`Monitor(command="tail -f {agent_log} | grep --line-buffered -E 'Phase|ERROR|DONE'", timeout_ms=1800000, description="{agent} progress")`
Supplementary to `run_in_background` — adds observability, not control.

## MCP Failure Resilience

External agents may have MCP servers (Linear, GitHub, etc.) configured in their global settings. If an MCP server fails during agent startup (expired auth, network error, timeout), the agent process may crash before processing the prompt.

| Failure Mode | Symptom | Handling |
|-------------|---------|----------|
| MCP auth expired | Agent exits non-zero immediately (< 5s) | Treat as agent crash; use available results |
| MCP server timeout | Agent hangs during init, eventually crashes | Same — crash handling via Fallback Rules |
| MCP tool call fails mid-review | Agent may skip tool or error in output | Agent prompted to degrade gracefully (use local files) |

**Mitigation layers:**
1. **Prompt-level:** Templates instruct agents to use local alternatives when Linear/tools unavailable
2. **Runner-level:** Non-zero exit code captured; `success: false` returned to skill
3. **Skill-level:** Fallback Rules apply — one agent crash does not block the review
4. **User-level:** If the advisor agent crashes on MCP, skill returns SKIPPED; user should check the advisor CLI MCP configuration

## Fallback Rules

Per `references/agent_review_workflow.md` Fallback Rules section. For non-review agent invocations (200/300 groups): on failure, fall back to host self-review.

## Lifecycle Details

Detailed startup checks, background execution, persistence, and verdict escalation live in `references/agent_review_workflow.md`. Load that file only when the skill actually runs an agent review loop.

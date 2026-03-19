# Agent Delegation Pattern

Standard pattern for skills delegating work to external CLI AI agents (Codex, Gemini) via `shared/agents/agent_runner.mjs`.

## When to Use

- Skill benefits from model specialization (planning, code analysis, structured review)
- Second opinion on generated plans or validation results
- Claude Opus remains meta-orchestrator; external agents are workers

## Agent Selection Matrix

| Skill Group | Primary Agent | Model | Fallback | Use Case |
|-------------|--------------|-------|----------|----------|
| Decomposition | Gemini | gemini-3-flash-preview | Opus | Scope analysis, epic planning |
| Task management | Codex | gpt-5.3-codex | Opus | Task decomposition, plan review |
| Execution | Opus (native) | claude-opus-4-6 | -- | Direct code writing |
| Validation | codex-review + gemini-review | parallel | Self-review (if both fail) | Story/Tasks + context validation |
| Quality review | codex-review + gemini-review | parallel | Self-review (if both fail) | Code review |

## Inline Agent Review

Agent review is inline in parent skills, not in separate worker skills:

| Parent Role | Review Type | Mode File | Challenge Template |
|-------------|-------------|-----------|-------------------|
| Story/context validator | Story/Tasks | `modes/story.md` | `challenge_review.md` |
| Story/context validator | Context | `modes/context.md` | `challenge_review.md` |
| Story/context validator | Plan review | `modes/plan_review.md` | `challenge_review.md` |
| Quality coordinator | Code | `modes/code.md` | `challenge_review.md` |

All modes assembled with `review_base.md` + mode file per "Step: Build Prompt" in shared workflow.

**Benefits:**
- No indirection: parent skill launches agents directly, no Skill() delegation overhead
- Parallel architecture: agents run in background while parent does its own validation
- Reference passing: Story/Tasks provided as Linear URLs or local file paths
- Critical verification: Claude independently verifies each suggestion
- Debate protocol: Claude challenges agent when disagreeing, accepts only convincing evidence

## Invocation Pattern

```bash
# Short prompt
node shared/agents/agent_runner.mjs --agent codex --prompt "Review this plan..."

# Large context via file with output (recommended)
node shared/agents/agent_runner.mjs --agent codex-review --prompt-file prompt.md --output-file result.md --cwd /project

# Resume session for debate (challenge/follow-up rounds only)
node shared/agents/agent_runner.mjs --agent codex-review --resume-session abc-123 --prompt-file challenge.md --output-file result.md --cwd /project

# Health check
node shared/agents/agent_runner.mjs --health-check
```

## Runner Output Contract

### Stdout (JSON)

```json
{
  "success": true,
  "agent": "codex-review",
  "response": "...",
  "duration_seconds": 12.4,
  "error": null,
  "session_id": "7f9f9a2e-1b3c-4c7a-9b0e-...",
  "session_resumed": false
}
```

- `session_id`: captured from agent output after execution (null if capture failed)
- `session_resumed`: true only when `--resume-session` was used and succeeded

### Result File Format (when --output-file used)

```markdown
<!-- AGENT_REVIEW_RESULT -->
<!-- agent: codex-review -->
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
- If agent doesn't write (gemini): runner captures stdout, parses, writes file with metadata
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

| Level | Codex | Gemini |
|-------|-------|--------|
| **CLI flags** | `--full-auto` (full tool access for analysis: read files, run commands, internet) | `--yolo` (auto-approve + sandbox, `permissive-open` profile — network allowed) |
| **Output** | `--color never` (clean log) + `-o {file}` (final result to file) + `-C {cwd}` (working dir) | `-m gemini-3-flash-preview` |
| **Prompt** | CRITICAL CONSTRAINTS: read-only for PROJECT files, may write to -o output | CRITICAL CONSTRAINTS: read-only for PROJECT files |

## Agent Timeout Policy

**Hard timeout (30 min default).** `agent_runner.mjs` kills the agent process after `hard_timeout_seconds` (configurable per agent in registry, override via `--timeout` CLI flag). Agents are prompted to finish within 25 minutes; 30 min provides headroom for long analyses. The runner writes process-level `heartbeat.json` every 30s and streams stdout to a log file for real-time visibility. On both timeout and normal completion, the runner kills the entire process tree (not just the immediate child) to prevent orphaned Codex/Gemini sub-processes. On Windows — `taskkill /T /F /PID`; on Unix — process group kill.

| Condition | Action |
|-----------|--------|
| Agent running, log file growing | Healthy — heartbeat shows `alive: true` with increasing `log_size_bytes` |
| Agent running, log static for 5+ min | Possibly stuck — heartbeat still shows `alive: true`. Runner will kill at hard timeout. |
| Agent exceeds hard timeout | Runner kills process, returns `success: false, error: "Hard timeout"` |
| Agent exited with error (non-zero) | Mark as FAILED, use other agent's results |
| Agent process crashed/disappeared | Mark as FAILED |

**FORBIDDEN:** Using TaskStop to kill agent background tasks. The runner handles timeout internally.

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
4. **User-level:** If both agents crash on MCP, skill returns SKIPPED; user should check agent CLI MCP configuration (`~/.codex/config.json`, `~/.gemini/settings.json`)

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
1. **Check `docs/environment_state.json` disabled flags BEFORE running health-check.** Disabled agents are never probed.
2. **ALWAYS execute the EXACT command** `node shared/agents/agent_runner.mjs --health-check` — no modifications, no substitutions.
3. **Do NOT invent alternative checks** (e.g., `where`, `which`, `--version`, PATH lookup). ONLY the command above is valid.
4. **Only command output determines availability.** Do NOT reason about file existence, environment, or installation — run the command and read its output.
5. **If command fails** (file not found, import error, any exception) → treat as "all agents unavailable" → return SKIPPED verdict.

| Situation | Impact |
|-----------|--------|
| >=1 agent OK (not disabled, health check passed) | Run agents, return suggestions |
| All agents disabled (environment_state.json) | Return `{verdict: "SKIPPED", reason: "all agents disabled"}` |
| All agents UNAVAILABLE (health check) | Return `{verdict: "SKIPPED", reason: "no agents available"}` |
| Command error/not found | Same as UNAVAILABLE |

## Background Execution + Process-as-Arrive Pattern

Both agents run as background tasks. First-finished agent processed immediately while second is still running.

```
              +-- Agent A (background) --> completes first --> Step 6: Verify + Debate --+
Prompt ------+                                                                           +--> Merge verified suggestions
              +-- Agent B (background) --> completes second --> Step 6: Verify + Debate --+
                               both fail? -> Self-Review fallback
```

**Rules:**
1. Launch BOTH agents as background Bash tasks (`run_in_background=true`) via `agent_runner.mjs` — ALL modes, including Plan Mode (agents are external OS processes, not affected by Claude Code plan mode)
2. Both agents receive identical prompt, run simultaneously with `--output-file`
3. When first agent completes (background task notification): read result file, proceed to Critical Verification
4. When second agent completes: read result file, verify, merge with first batch
5. Agents have a **hard timeout** (30 min default) — runner kills process at limit (see Agent Timeout Policy)
6. If an agent fails: log failure, continue with available results
7. Log all attempts for user visibility (agent name, duration, suggestion count)

## Critical Verification + Debate Protocol

Claude MUST independently verify each agent suggestion. Do NOT trust blindly.

```
Agent Suggestion --> Claude Evaluation --> AGREE? --> Accept as-is
                                      --> DISAGREE/UNCERTAIN? --> Challenge Round 1
                                                                    |
                                              Agent DEFEND (convincing, convincing) --> Accept
                                              Agent WITHDRAW -----------------------> Reject (final)
                                              Agent DEFEND (weak) ------------------> Follow-Up Round
                                              Agent MODIFY (acceptable) ------------> Accept modified
                                              Agent MODIFY (disagree) --------------> Follow-Up Round
                                                                                         |
                                              Agent DEFEND (new evidence, convincing) -> Accept
                                              Agent DEFEND (same/weaker) -------------> Reject (final)
                                              Agent WITHDRAW -------------------------> Reject (final)
                                              Agent MODIFY (acceptable) --------------> Accept modified
                                              Agent MODIFY (disagree) ----------------> Reject (final)
```

### Session Resume for Debate Rounds

Per `shared/references/agent_review_workflow.md` Step: Critical Verification + Debate, section (c).

### Challenge Round 1

1. Build prompt from `shared/agents/prompt_templates/challenge_review.md`
2. Fill: original suggestion details + Claude's specific counterargument
3. Save to `.agent-review/{agent}/{id}_{reviewtype}_challenge_{N}_prompt.md`
4. Read `session_id` from `.agent-review/{agent}/{identifier}_session.json`
5. Run same agent with `--resume-session {session_id}` + challenge prompt + `--output-file`
6. Parse response (DEFEND/WITHDRAW/MODIFY)

**Round 1 Resolution:**

| Agent Response | Action |
|----------------|--------|
| DEFEND + convincing evidence (convincing) | Accept agent's suggestion |
| WITHDRAW | Reject (final) |
| DEFEND + weak evidence | Proceed to Follow-Up Round |
| MODIFY + acceptable revision | Accept modified version |
| MODIFY + still disagree | Proceed to Follow-Up Round |

### Follow-Up Round (1 max, only for suggestions not resolved in Round 1)

1. Build prompt from `shared/agents/prompt_templates/challenge_review.md` with updated placeholders:
   - `{counterargument}` = Claude's specific rejection reason from Round 1, including: what evidence was insufficient, what was checked, why revision was not accepted
2. Save to `.agent-review/{agent}/{id}_{reviewtype}_followup_{N}_prompt.md`
3. Read `session_id` from `.agent-review/{agent}/{identifier}_session.json`
4. Run same agent with `--resume-session {session_id}` + follow-up prompt + `--output-file`
5. Parse response

**Follow-Up Resolution (final, no further rounds):**

| Agent Response | Action |
|----------------|--------|
| DEFEND + new evidence not seen in Round 1 (convincing) | Accept agent's suggestion |
| DEFEND + same/weaker evidence | Reject (final) |
| WITHDRAW | Reject (final) |
| MODIFY + acceptable revision | Accept modified version |
| MODIFY + still disagree | Reject (final) |

### "Convincing" Criteria

- Agent cites specific standard/RFC/benchmark Claude hadn't considered
- Agent shows concrete code path Claude missed
- Claude cannot refute the new evidence

### Debate Limits

**Maximum 2 rounds per suggestion** (1 challenge + 1 follow-up). Follow-up only triggers for non-final rejections in Round 1. WITHDRAW in any round is always final.

## Reference Passing Pattern

Standard steps before launching agents (performed inside agent review workers):

1. **Get references:** Call Linear MCP `get_issue(storyId)` for Story URL + `list_issues(parent)` for Task URLs. If project stores tasks locally → use file paths.
2. **Ensure .agent-review/:** If `.agent-review/` exists, reuse as-is. If not, create it with `.gitignore` (content: `*` + `!.gitignore`). Create `.agent-review/{agent}/` subdirs only if they don't exist. Do NOT add `.agent-review/` to project root `.gitignore`.
3. **Build prompt:** Load template, fill placeholders including `{review_goal}`, `{project_context}`, `{focus_hint}` (per-agent). See `agent_review_workflow.md` "Step: Build Prompt" steps 1-9.
4. **Save prompt:** To `.agent-review/{agent}/{identifier}_{review_type}_prompt.md` (per-agent — differ by `{focus_hint}`)
5. **Run agents:** `--prompt-file .agent-review/{agent}/{identifier}_{review_type}_prompt.md --output-file .agent-review/{agent}/{identifier}_{review_type}_result.md --cwd {project_dir}` — agents access Story/Tasks via references, runner writes result file per agent
6. **No cleanup** — `.agent-review/` persists as audit trail

**Why reference passing instead of content materialization:**
- Agents have internet access — they can read Linear directly
- No need to load full content into files (simpler workflow, fewer steps)
- If agent cannot access Linear — agent falls back to local files (`docs/tasks/`, `git log`). Reports what it couldn't access.
- Prompts stay focused (references instead of full content dumps)

## Review Persistence Pattern

```
.agent-review/
├── .gitignore                                      # * + !.gitignore
├── review_history.md                               # Append-only review log (all reviews)
├── context/                                         # Materialized files for agent access (context, plans)
│   ├── arch-proposal_context.md
│   └── velvet-giggling-acorn_plan.md
├── codex/
│   ├── arch-proposal_contextreview_prompt.md        # Per-agent prompt (differs by {focus_hint})
│   ├── arch-proposal_session.json                   # Session tracking for debate resume
│   ├── arch-proposal_contextreview_result.md        # Result (written by agent_runner.mjs)
│   ├── PROJ-123_storyreview_prompt.md
│   ├── PROJ-123_session.json
│   ├── PROJ-123_storyreview_result.md
│   ├── PROJ-123_storyreview_challenge_1_prompt.md   # Round 1 debate (per-agent)
│   ├── PROJ-123_storyreview_challenge_1_result.md
│   ├── PROJ-123_storyreview_followup_1_prompt.md    # Follow-up (per-agent)
│   ├── PROJ-123_storyreview_followup_1_result.md
│   └── PROJ-123_codereview_result.md
└── gemini/
    ├── arch-proposal_contextreview_prompt.md        # Per-agent prompt (differs by {focus_hint})
    ├── arch-proposal_session.json
    ├── arch-proposal_contextreview_result.md
    ├── PROJ-123_storyreview_prompt.md
    ├── PROJ-123_session.json
    ├── PROJ-123_storyreview_result.md
    └── PROJ-123_codereview_result.md
```

**Benefits:**
- Full audit trail of what was asked and what was returned
- Debug agent issues by comparing prompt vs result
- Track review history across multiple Stories
- Per-agent isolation — easy to compare Codex vs Gemini quality
- Challenge artifacts show debate reasoning for transparency

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
| Delete review artifacts after agents complete | Persist per-agent prompts and results in `.agent-review/{agent}/` |
| Write/rewrite result files from skill | Result files are runner's responsibility; skill only reads them and writes `_session.json` |
| Trust agent output blindly | Claude critically verifies each suggestion + debates if disagreeing |
| Use agents for project file writes | Agents write only to `-o` output file; analysis-only |
| Chain multiple agent calls | One call per task; challenge/follow-up use `--resume-session` for context continuity |
| Hard-depend on agent availability | Always have Opus fallback |
| Run health check separately from agent launch | Health check is first step of inline agent review |
| Kill agent tasks with TaskStop | Runner handles hard timeout internally; TaskStop is forbidden |
| Assume `proc.kill()` kills child processes | Runner uses process tree kill (`taskkill /T` on Windows, `os.killpg` on Unix) |
| Skip agent review phase | Agent review is MANDATORY in validator (after discovery) and quality coordinator (after cleanup) |
| Start each review verification from scratch | Load review history for dedup + calibration |
| Re-summarize agent findings in review log | Reference agent result files (self-documented reports) |
| Dump full project context into agent prompts | Inject compact project context (~300 tokens): architecture, principles, tech stack, past rejections. NO full dumps. |

---
**Version:** 3.0.0
**Last Updated:** 2026-02-11

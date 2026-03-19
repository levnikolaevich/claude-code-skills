# Agent Review Workflow (Shared)

Common workflow for all agent review workers. Each skill provides parameters and unique logic; this reference defines the shared execution mechanics.

## Parameters (provided by each skill)

| Parameter | Description | Examples |
|-----------|-------------|---------|
| `review_mode` | Mode file name (determines template) | `code`, `story`, `context`, `plan_review` |
| `review_type` | File naming suffix | `contextreview`, `storyreview`, `codereview` |
| `identifier` | Unique label for file naming | `PROJ-123`, `review_20260227_143000` |
| `verdict_acceptable` | Verdict for "no issues" | `CONTEXT_ACCEPTABLE`, `STORY_ACCEPTABLE`, `CODE_ACCEPTABLE` |

## Plan Mode Behavior

> **Note:** "Plan Mode" is a framework execution flag (read-only). Unrelated to `mode=plan_review` (review type that evaluates plan documents).

When running in Plan Mode (per `shared/references/plan_mode_pattern.md`, Workflow B):

`.agent-review/` is git-ignored (`*`) — writing there is NOT a project modification. All persistence steps work normally.

| Step | Plan Mode Change |
|------|-----------------|
| Health Check through Save Review Summary | **No change** — all steps use `.agent-review/` which is outside project |
| Skill-specific project edits (e.g., Compare & Correct) | **Skip until approval** — output findings to chat, apply on user confirmation |
| Aggregate + Return | **Output to chat** in addition to normal persistence |

## Step: Health Check

**1. Check disabled flags** (before probing):
```
IF docs/environment_state.json exists:
  Read file → for each agent (codex, gemini):
    IF agent.disabled == true → exclude from health check
  IF all agents disabled → return {verdict: "SKIPPED", reason: "all agents disabled"}
IF file not exists: proceed with all agents (no exclusions)
```

**2. Probe remaining agents:**
```
node shared/agents/agent_runner.mjs --health-check
```

- If 0 agents available (after disabled exclusions) -> return `{verdict: "SKIPPED", reason: "no agents available"}`
- Display: `"Agent Health: codex-review OK, gemini-review OK"` (or `"disabled"` / `"unavailable"` per agent)

## Step: Ensure .agent-review/

- If `.agent-review/` exists -> reuse as-is, do NOT recreate `.gitignore`
- If `.agent-review/` does NOT exist -> create it + `.agent-review/.gitignore` (content: `*` + `!.gitignore`)
- Create `.agent-review/{agent}/` subdirs only if they don't exist
- Do NOT add `.agent-review/` to project root `.gitignore`

## Step: Build Prompt

Assemble the review prompt from base template + mode-specific content:

1. Read `shared/agents/prompt_templates/review_base.md` (shared sections)
2. Read `shared/agents/prompt_templates/modes/{review_mode}.md` (mode = code/story/context)
3. Parse mode file sections (split by `## section_name` headers):
   - `## header` -> `{mode_header}`
   - `## constraints` -> `{mode_constraints}`
   - `## body` -> `{mode_body}`
   - `## alt_title` -> `{mode_alt_title}`
   - `## alt_extra` -> `{mode_alt_extra}`
   - `## schema` -> parse key-value pairs for `{mode_verdict}`, `{mode_areas}`, `{mode_suggestion_desc}`, `{mode_reason_desc}`, `{mode_verdict_question}`
4. Replace all `{mode_*}` placeholders in base with corresponding mode content
5. Fill instance variables: `{story_ref}`, `{task_refs}` (code/story) or `{review_title}`, `{context_refs}`, `{focus_areas}` (context) or `{plan_ref}`, `{codebase_context}`, `{focus_areas}` (plan_review)
   > **External file rule:** Any file referenced in agent prompts that resides outside the project CWD MUST be copied to `.agent-review/context/` before use as placeholder value. Agents are sandboxed to project CWD and cannot read external paths. Use the materialized local path in the prompt.
6. Assemble `{review_goal}` — Claude formulates 1-2 sentence review goal based on:
   - Story/Tasks analysis from validation phases
   - Known project risks and patterns
   - What a surface-level review would miss
   Example: `"Catch correctness bugs in 5-level TM/cache lookup: schema constraints impossible in PostgreSQL, cache key collisions, batch bottlenecks."`
7. Assemble `{project_context}` — Claude builds compact context (~300 tokens):
   - Architecture: from CLAUDE.md or docs/architecture.md (1 line)
   - Principles: from CLAUDE.md (1 line, key constraints)
   - Tech stack: from docs/tech_stack.md or CLAUDE.md (1 line)
8. Assemble `{focus_hint}` — optional, per-agent differentiation:
   - For codex-review: `"Primary focus: correctness bugs, schema feasibility, data integrity, error handling, code-level edge cases"`
   - For gemini-review: `"Primary focus: performance at scale, security/isolation, resource management, architectural patterns"`
   - If only 1 agent available: leave empty (agent covers everything)
   Note: `{focus_hint}` is a HINT, not a restriction. Agent may report findings outside focus.
9. Save assembled prompt to `.agent-review/{agent}/{identifier}_{review_type}_prompt.md`
   Note: prompt is now agent-specific (different `{focus_hint}` per agent), so save per-agent, not shared.

## Step: Run Agents (background, process-as-arrive)

a) Launch BOTH agents as background Bash tasks (`run_in_background=true`):

```
node shared/agents/agent_runner.mjs --agent codex-review \
  --prompt-file .agent-review/codex/{identifier}_{review_type}_prompt.md \
  --output-file .agent-review/codex/{identifier}_{review_type}_result.md \
  --cwd {cwd}

node shared/agents/agent_runner.mjs --agent gemini-review \
  --prompt-file .agent-review/gemini/{identifier}_{review_type}_prompt.md \
  --output-file .agent-review/gemini/{identifier}_{review_type}_result.md \
  --cwd {cwd}
```

**Heartbeat monitoring (while agents work):**
- After launching agents, output to chat: `"Agents launched: codex-review + gemini-review. Continuing with foreground work..."`
- `agent_runner.mjs` writes process-level heartbeat to `.agent-review/{agent}/heartbeat.json` every 30s (independent of agent behavior). Fields: `pid`, `alive`, `elapsed_seconds`, `log_size_bytes`, `updated_at`.
- Agent stdout streams to `.agent-review/{agent}/{identifier}_{review_type}.log` in real time. Read log tail for detailed progress.
- Between foreground phases, Read `heartbeat.json` for each agent and output status: `"[Heartbeat] codex-review: alive, 63s, log 489KB"`
- Agents may also write their own `heartbeat.json` with `step`/`detail` fields (per prompt instruction) — this supplements the runner's process-level heartbeat.
- When foreground work completes and agents haven't returned yet, Read heartbeat files and output: `"Foreground complete. Waiting for agents... codex-review: {alive/elapsed}, gemini-review: {alive/elapsed}"`
- Do NOT poll in a sleep-loop — the framework sends background task notifications automatically
- When each agent completes, immediately output: `"Agent {name} completed ({duration}s). {N} suggestions found."` Then proceed to parse results.

b) When first agent completes (background task notification):
   - Result file is already written by agent_runner.mjs -- do NOT write or rewrite it
   - Read `.agent-review/{agent}/{identifier}_{review_type}_result.md`
   - The result file contains the agent's full review report (markdown analysis + `## Structured Data` with JSON) wrapped in metadata markers
   - Parse JSON from `## Structured Data` section (```json block) between `<!-- AGENT_REVIEW_RESULT -->` / `<!-- END_AGENT_REVIEW_RESULT -->` markers
   - Parse `session_id` from `<!-- session_id: ... -->` metadata line in result file
   - The report text above Structured Data serves as the agent's reasoning (used during Critical Verification for deeper context)
   - Write `.agent-review/{agent}/{identifier}_session.json`: `{"agent": "...", "session_id": "...", "review_type": "...", "created_at": "..."}`
   - Proceed to Critical Verification for this agent's suggestions

c) When second agent completes:
   - Read its result file, parse suggestions
   - Run Critical Verification for second batch
   - Merge verified suggestions from both agents

d) If an agent fails: log failure, continue with available results

## Step: Critical Verification + Debate

Per Debate Protocol in `shared/references/agent_delegation_pattern.md`.

For EACH suggestion from agent results:

a) **Claude Evaluation:** Independently assess against the actual code — is the issue real? Actionable? Conflicts with project patterns? Read the agent's Analysis Process and Evidence sections from the report for deeper understanding of the suggestion's basis.

b) **AGREE** -> accept as-is. **DISAGREE** -> apply debate triage.

c) **Debate triage** (determines whether to challenge or reject outright):

```
IF review_mode == "code":
  IF area IN {security, correctness} → full debate (Challenge + Follow-Up)
  ELSE IF confidence >= 95 AND impact_percent >= 20 → full debate
  ELSE → reject without debate (no challenge rounds)
ELSE:
  → full debate for all areas (story/context/plan_review modes)
```

Rationale: In code mode, only security/correctness findings affect the quality verdict (quality coordinator normalization matrix). Debate rounds cost agent session resume + parsing -- reserve for verdict-affecting findings. High-confidence high-impact findings in other areas still get debated as exception.

d) **Challenge + Follow-Up (with session resume):** Follow Debate Protocol (Challenge Round 1 -> Follow-Up Round if not resolved). Resume agent's review session for full context continuity:
   - Read `session_id` from `.agent-review/{agent}/{identifier}_session.json`
   - Run with `--resume-session {session_id}` -- agent continues in same session, preserving file analysis and reasoning
   - If `session_resumed: false` in result -> log warning, result still valid (stateless fallback)
   - Challenge files: `.agent-review/{agent}/{identifier}_{review_type}_challenge_{N}_prompt.md` / `_result.md`
   - Follow-up files: `.agent-review/{agent}/{identifier}_{review_type}_followup_{N}_prompt.md` / `_result.md`

e) **Persist:** all challenge and follow-up prompts/results in `.agent-review/{agent}/`

## Step: Aggregate + Return

- Collect ACCEPTED suggestions only (after verification + debate)
- Deduplicate by `(area, issue)` -- keep higher confidence
- **Return** JSON with suggestions + agent_stats + debate_log. **NO cleanup/deletion.**

## Step: Verify Agent Cleanup

After collecting results from all agents, verify no orphaned processes remain:

1. Read `.agent-review/{agent}/heartbeat.json` for each completed agent — extract `pid`
2. Run verification per agent:
```
node shared/agents/agent_runner.mjs --verify-dead {pid}
```
3. Expected: exit code 0, `{"pid": N, "status": "DEAD"}`
4. If exit code 1 (process alive after cleanup attempt): log warning `"WARNING: Agent PID {pid} still alive after cleanup"` — continue, do not block workflow
5. Display: `"Agent cleanup: codex-review PID {pid} DEAD, gemini-review PID {pid} DEAD"`

**Note:** `agent_runner.mjs` kills process trees automatically on both completion and timeout. This step is a safety net — it should always find processes dead. If it doesn't, `--verify-dead` will attempt a second tree kill.

## Step: Save Review Summary

After returning results, append a summary entry to `.agent-review/review_history.md`. If the file doesn't exist, create it with header `# Agent Review History`.

Entry format (per `shared/references/agent_review_memory.md`):

```markdown
## {identifier} | {review_type} | {YYYY-MM-DD}
- Verdict: {verdict}
- Accepted ({count}): {1-line per accepted suggestion, max 5}
- Rejected ({count}): {1-line per rejected suggestion, max 3}
- Reports: codex .agent-review/codex/{id}_{type}_result.md, gemini .agent-review/gemini/{id}_{type}_result.md
- Stats: codex ({accepted}/{total}), gemini ({accepted}/{total})
```

## Fallback Rules

| Condition | Action |
|-----------|--------|
| Both agents succeed | Aggregate verified suggestions from both |
| One agent fails | Use successful agent's verified suggestions, log failure |
| Both agents fail | Return `{verdict: "SKIPPED", reason: "agents failed"}` |
| Agent crashes immediately (< 5s, non-zero exit) | Likely MCP init failure (expired auth); log error, use other agent. If both crash -> SKIPPED + note to check agent MCP config |

## Critical Rules

- Read-only review -- agents must NOT modify project files (enforced by prompt CRITICAL CONSTRAINTS)
- Same base prompt to all agents. Only `{focus_hint}` differs per agent.
- Agents produce structured review report (markdown analysis + `## Structured Data` with JSON block). Agent stdout streams to log file for real-time visibility.
- Log all attempts for user visibility (agent name, duration, suggestion count)
- **Persist** per-agent prompts in `.agent-review/{agent}/`, results and challenge artifacts in `.agent-review/{agent}/` -- do NOT delete
- Ensure `.agent-review/.gitignore` exists before creating files (only create if `.agent-review/` is new)
- **HARD TIMEOUT (30 min default):** `agent_runner.mjs` kills the agent process after `hard_timeout_seconds` (configurable in registry, override via `--timeout`). Agents are prompted to finish within 25 minutes; 30 min provides headroom. On timeout, runner writes `timeout` heartbeat and returns `success: false`. **TaskStop is still FORBIDDEN** for agent background tasks — the runner handles timeout internally.
- **CRITICAL VERIFICATION:** Do NOT trust agent suggestions blindly. Claude MUST independently verify each suggestion and debate if disagreeing. Accept only after verification.

## Definition of Done

- All available agents launched as background tasks (or gracefully failed with logged reason)
- Per-agent prompts persisted in `.agent-review/{agent}/` (differ only by `{focus_hint}`)
- Raw results persisted in `.agent-review/{agent}/` (no cleanup)
- Each suggestion critically verified by Claude; challenges executed for disagreements
- Follow-up rounds executed for suggestions rejected after Round 1 (DEFEND+weak / MODIFY+disagree)
- Challenge and follow-up prompts/results persisted alongside review artifacts
- Deduplicated verified suggestions returned with verdict, agent_stats, and debate_log
- `.agent-review/.gitignore` exists (created only if `.agent-review/` was new)
- Session files persisted in `.agent-review/{agent}/{identifier}_session.json` for debate resume
- Review summary appended to `.agent-review/review_history.md`
- Agent process trees verified dead after results collection (Step: Verify Agent Cleanup)

## Step: Meta-Analysis

**MANDATORY READ:** Load `shared/references/meta_analysis_protocol.md`

After returning results, run meta-analysis on agent delegation effectiveness: coverage, efficiency, prompt quality. Output summary table to chat with improvement suggestions. If pattern is actionable and reproducible (across 3+ runs), suggest creating issue.

## Output Schema (common structure)

```yaml
verdict: "{verdict_acceptable} | SUGGESTIONS | SKIPPED"
suggestions:
  - area: "..."
    issue: "What is wrong"
    suggestion: "Specific fix"
    confidence: 95
    impact_percent: 15
    source: "codex-review"
    resolution: "accepted | accepted_after_debate | accepted_after_followup | rejected"
agent_stats:
  - name: "codex-review"
    duration_s: 12.4
    suggestion_count: 3
    accepted_count: 2
    challenged_count: 1
    followup_count: 1
    status: "success | failed | timeout"
debate_log:
  - suggestion_summary: "..."
    agent: "codex-review"
    rounds:
      - round: 1
        claude_position: "..."
        agent_decision: "DEFEND | WITHDRAW | MODIFY"
        resolution: "accepted | rejected | follow_up"
    final_resolution: "accepted | accepted_after_debate | accepted_after_followup | rejected"
```

## Shared Reference Files

- **Agent delegation pattern:** `shared/references/agent_delegation_pattern.md`
- **Review base template:** `shared/agents/prompt_templates/review_base.md`
- **Review mode files:** `shared/agents/prompt_templates/modes/` (code.md, story.md, context.md)
- **Prompt template (challenge):** `shared/agents/prompt_templates/challenge_review.md`
- **Challenge schema:** `shared/agents/schemas/challenge_review_schema.json`
- **Agent registry:** `shared/agents/agent_registry.json`
- **Agent runner:** `shared/agents/agent_runner.mjs`
- **Agent review memory (write-only):** `shared/references/agent_review_memory.md` — defines review_history.md format (human audit trail)
- **Meta-analysis protocol:** `shared/references/meta_analysis_protocol.md`

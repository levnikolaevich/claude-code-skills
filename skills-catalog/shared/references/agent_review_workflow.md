# Agent Review Workflow (Shared)

Common workflow for all agent review workers. Each skill provides parameters and unique logic; this reference defines the shared execution mechanics.

> **Preferred orchestration path:** Evaluation-platform coordinators that need deterministic phase control should use `shared/references/evaluation_coordinator_runtime_contract.md` plus `shared/scripts/evaluation-runtime/cli.mjs`. This file defines shared review mechanics; runtime-enabled skills persist state/checkpoints instead of relying on conversational memory.

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

`.hex-skills/agent-review/` is git-ignored (`*`) — writing there is NOT a project modification. All persistence steps work normally.

| Step | Plan Mode Change |
|------|-----------------|
| Health Check through Save Review Summary | **No change** — all steps use `.hex-skills/agent-review/` which is outside project |
| Skill-specific project edits (e.g., Compare & Correct) | **Skip until approval** — output findings to chat, apply on user confirmation |
| Aggregate + Return | **Output to chat** in addition to normal persistence |

## Step: Health Check

**1. Check disabled flags** (before probing):
```
IF `{project_root}/.hex-skills/environment_state.json` exists and passes shared environment-state validation:
  Read file → for codex agent:
    IF agent.disabled == true → exclude from health check
  IF all agents disabled → return {verdict: "SKIPPED", reason: "all agents disabled"}
IF file not exists: proceed with all agents (no exclusions)
```

**2. Probe remaining agents:**
```
node shared/agents/agent_runner.mjs --health-check --json
```

- If 0 agents available (after disabled exclusions) -> return `{verdict: "SKIPPED", reason: "no agents available"}`
- Runtime-enabled skills should checkpoint: `health_check_done`, `agents_available`, `agents_required`, optional `agents_skipped_reason`

## Step: Ensure .hex-skills/agent-review/

- If `.hex-skills/agent-review/` exists -> reuse as-is, do NOT recreate `.gitignore`
- If `.hex-skills/agent-review/` does NOT exist -> create it + `.hex-skills/agent-review/.gitignore` (content: `*` + `!.gitignore`)
- Create `.hex-skills/agent-review/{agent}/` subdirs only if they don't exist
- **Clean `.hex-skills/agent-review/context/`** before materializing new files: delete all files in `context/` (not the directory itself). Prevents agents from reading stale files from previous runs
- Do NOT add `.hex-skills/agent-review/` to project root `.gitignore`

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
   > **External file rule:** Any file referenced in agent prompts that resides outside the project CWD MUST be copied to `.hex-skills/agent-review/context/` before use as placeholder value. Agents are sandboxed to project CWD and cannot read external paths. Use the materialized local path in the prompt.
6. Assemble `{review_goal}` — Claude formulates 1-2 sentence review goal based on:
   - Story/Tasks analysis from validation phases
   - Known project risks and patterns
   - What a surface-level review would miss
   Example: `"Catch correctness bugs in 5-level TM/cache lookup: schema constraints impossible in PostgreSQL, cache key collisions, batch bottlenecks."`
7. Assemble `{project_context}` — Claude builds compact context (~300 tokens):
   - Architecture: from CLAUDE.md or docs/architecture.md (1 line)
   - Principles: from CLAUDE.md (1 line, key constraints)
   - Tech stack: from docs/tech_stack.md or CLAUDE.md (1 line)
8. Assemble `{focus_hint}` — read from `focus_hint` field in `agent_registry.json` for each agent.
   - If only 1 agent available: leave empty (agent covers everything)
   Note: `{focus_hint}` is a HINT, not a restriction. Agent may report findings outside focus.
9. Save assembled prompt to `.hex-skills/agent-review/{agent}/{identifier}_{review_type}_prompt.md`
   Note: prompt is now agent-specific (different `{focus_hint}` per agent), so save per-agent, not shared.

## Step: Run Agents (background, sync-before-merge)

a) Launch the advisor agent (codex) as a background Bash task (`run_in_background=true`):

```
node shared/agents/agent_runner.mjs --agent {agent_name} \
  --prompt-file .hex-skills/agent-review/{agent}/{identifier}_{review_type}_prompt.md \
  --output-file .hex-skills/agent-review/{agent}/{identifier}_{review_type}_result.md \
  --metadata-file .hex-skills/agent-review/{agent}/{identifier}_{review_type}_metadata.json \
  --cwd {cwd}
```
Launch per available agent from `--list-agents` (currently codex only; fallback to Opus self-review if unavailable).

**Runtime-first monitoring (preferred):**
- Register each launched agent in the active coordinator runtime with prompt/result/log/metadata paths
- Evaluation-platform validators use `node shared/scripts/evaluation-runtime/cli.mjs sync-agent --skill {skill} --identifier {identifier}` before merge gates
- Merge is allowed only after every required agent is `result_ready | dead | failed | skipped`

**Waiting for agents (MANDATORY):**
Use the Claude `Monitor` tool with 2-minute cycles to wait for agent results. `Monitor` is a built-in Claude Code tool (available since 2.1.98+) that streams filtered shell output as conversation events.

```
Monitor(
  command="tail -f {agent_log} | grep --line-buffered -E 'Phase|ERROR|DONE'",
  timeout_ms=120000,
  description="{agent_name} review"
)
```

After each Monitor return: check result file for `<!-- END_AGENT_REVIEW_RESULT -->` marker. If not ready, start next Monitor cycle.
Do NOT use sleep loops, `Bash(run_in_background=true)`, or ad-hoc stat polling as primary wait mechanism.
Fallback: `Bash(run_in_background=true)` ONLY when Monitor is unavailable (Bedrock/Vertex/Foundry runtimes).

> **BLOCKING MODEL:** Background agents enable foreground work in parallel. But before merging results (Critical Verification step), ALL agents must be **resolved**. Runtime-enabled skills resolve from metadata + result files through their active coordinator runtime. Manual, non-runtime skills use the liveness protocol below. Do NOT begin Critical Verification until this condition is met for every launched agent.


**Agent Liveness Protocol (MANDATORY before declaring agent failed/timed out):**

Before marking an agent as failed, timed out, or unavailable, MUST run all 3 checks:

1. **Log mtime:** `stat .hex-skills/agent-review/{agent}/{identifier}_{review_type}.log`
   - mtime < 3 min ago -> agent ALIVE, keep waiting
   - mtime > 3 min ago -> proceed to step 2
2. **Log content:** `tail -5 .hex-skills/agent-review/{agent}/{identifier}_{review_type}.log`
   - Shows active work (web search, file reads, tool calls) -> agent ALIVE, keep waiting
   - Shows error/crash/empty -> proceed to step 3
3. **Process check:** `node shared/agents/agent_runner.mjs --verify-dead {pid}`
   - Exit code 1 (ALIVE) -> agent ALIVE, keep waiting
   - Exit code 0 (DEAD) -> agent DEAD, check result file

Only after ALL checks confirm DEAD -> mark agent as failed/timed out.

| Log mtime | Log content | Process | Verdict |
|-----------|-------------|---------|----------|
| < 3 min | active work | ALIVE | WAIT -- agent is working |
| < 3 min | active work | DEAD | CHECK result file -- may have just finished |
| > 3 min | error/empty | DEAD | FAILED -- agent crashed |
| > 3 min | last line = work | ALIVE | WAIT -- agent may be in long operation |

> **PATIENCE REQUIREMENT — DO NOT PREMATURELY SKIP AGENTS:**
> Codex typically takes 10-20 minutes for complex reviews. This is NORMAL, not a sign of failure.
>
> **Prohibited behaviors:**
> - Deciding an agent is "stuck" because it has been running for 5, 10, or even 20 minutes
> - Rationalizing "we can proceed without agent results" when the agent is still alive
> - Treating slow progress as equivalent to no progress
> - Skipping an agent because "it's taking too long" when liveness checks show ALIVE
>
> **The ONLY path to marking an agent as failed** is the Liveness Protocol above where ALL 3 checks confirm DEAD. If any check returns ALIVE — WAIT. The hard timeout in `agent_runner.mjs` (30 min) is the only valid time boundary.

b) When the agent completes (background task notification):
   - Result file is already written by agent_runner.mjs -- do NOT write or rewrite it
   - Read `.hex-skills/agent-review/{agent}/{identifier}_{review_type}_result.md`
   - The result file contains the agent's full review report (markdown analysis + `## Structured Data` with JSON) wrapped in metadata markers
   - Parse JSON from `## Structured Data` section (```json block) between `<!-- AGENT_REVIEW_RESULT -->` / `<!-- END_AGENT_REVIEW_RESULT -->` markers
   - For plan_review mode: also extract `## Refined Plan` section (between header and `## Structured Data`). Store as `refined_plan_text`
   - Parse `session_id` from `<!-- session_id: ... -->` metadata line in result file
   - The report text above Structured Data serves as the agent's reasoning (used during Critical Verification for deeper context)
   - Write `.hex-skills/agent-review/{agent}/{identifier}_session.json`: `{"agent": "...", "session_id": "...", "review_type": "...", "created_at": "..."}`
   - Proceed to Critical Verification for this agent's suggestions

c) (reserved — multi-agent parallel path removed; Codex is the sole external advisor.)

d) If an agent fails: log failure, continue with available results

## Step: Critical Verification

For EACH suggestion from agent results:

a) **Claude Evaluation:** Independently assess against the actual code -- is the issue real? Actionable? Conflicts with project patterns? Read the agent's Analysis Process and Evidence sections from the report for deeper understanding of the suggestion's basis.

b) **AGREE** -> accept as-is. **REJECT** -> skip (Claude's independent judgment is final).

**Architecture Gate (MANDATORY for every AGREE'd suggestion):**
Before applying any accepted suggestion, explicitly verify:
> "Does this change implement the architecturally correct solution directly, without backward compatibility shims, legacy workarounds, or transitional scaffolding?"
- If the suggestion introduces compat layers or legacy support where a clean implementation is feasible -> convert AGREE to REJECT. Note: "Rejected at Architecture Gate: introduces legacy/compat layer."
- If the suggestion is the clean, direct solution -> proceed to apply.

c) **Persist:** all evaluation decisions in review summary.

**Response discipline:**
- Forbidden: "Great point!", "You're absolutely right!", "Let me implement that now" (before verifying against code)
- Required: Restate the technical issue → verify against actual code → AGREE (implement) or REJECT (push back with code/test evidence)
- When disagreeing: cite specific code lines or test results, not opinions

## Step: Iterative Refinement (MANDATORY when Codex available)

After Critical Verification, run a 2-stage refinement using Codex. This automates the manual "show to Codex -> get feedback -> fix -> repeat" cycle.

**ONE PERSPECTIVE = ONE CODEX SESSION.** Each perspective launches a separate `agent_runner.mjs` process. Never combine multiple perspectives into one Codex prompt. Never use `--resume-session` — each iter{N}/ subdirectory = independent Codex process with its own PID.

**Pre-condition:** Merge phase applied all accepted suggestions. The artifact is in its "current best" state.

**Skip condition:** Codex unavailable in health check OR disabled in `{project_root}/.hex-skills/environment_state.json`. If skipped -> log `"Iterative Refinement: SKIPPED (Codex unavailable)"`.

**Stage 1: Parallel Specialized Reviews (3 independent Codex sessions)**

1. Build artifact (current state of reviewed artifact).
2. For EACH of 3 perspectives (`dry_run_executor`, `new_dev_tester`, `adversarial_reviewer`), in parallel:
   a. Load perspective from `shared/agents/prompt_templates/refinement_perspectives.md`.
   b. Build prompt via `shared/agents/prompt_templates/iterative_refinement.md`.
   c. Save prompt to `.hex-skills/agent-review/refinement/{identifier}/iter{N}/prompt.md` (iter1=dry_run, iter2=new_dev, iter3=adversarial).
   d. Launch independent Codex process:
   ```
   node shared/agents/agent_runner.mjs --agent codex \
     --prompt-file .hex-skills/agent-review/refinement/{identifier}/iter{N}/prompt.md \
     --output-file .hex-skills/agent-review/refinement/{identifier}/iter{N}/result.md \
     --cwd {project_dir}
   ```
3. Wait for ALL 3 via Claude `Monitor` tool with 2-minute cycles.
4. Parse results, merge findings (deduplicate by area+issue, keep higher confidence).
5. Classify: HIGH (impact >= 20%), MEDIUM (10-19%), LOW (< 10%).
6. Architecture Gate on each accepted fix.
7. Apply accepted fixes.
8. Kill all 3 processes: `node agent_runner.mjs --verify-dead {pid}` per session.
9. Record cleanup evidence.

If ALL 3 fail → EXIT(ERROR), skip Stage 2.
If some fail → continue with available results.

**Stage 2: Final Sweep (1 Codex session)**

1. Build artifact (post-fix state after Stage 1).
2. Load `final_sweep` perspective.
3. Build prompt with `{previous_findings_summary}` from Stage 1.
4. Save prompt to `.hex-skills/agent-review/refinement/{identifier}/iter4/prompt.md`.
5. Launch Codex (single independent session).
6. Wait via Claude `Monitor` tool.
7. Parse result, apply accepted fixes.
8. Kill process, record cleanup evidence.

**Exit states:**
- `COMPLETED` — both stages done, all results merged
- `PARTIAL_ERROR` — Stage 1 had failures but Stage 2 completed
- `ERROR` — all Stage 1 sessions failed
- `SKIPPED` — Codex unavailable

**Post-refinement display:** `"Iterative Refinement: Stage 1 ({N}/3 perspectives), Stage 2 (final_sweep), {total} suggestions, {applied} applied, exit: {reason}"`

**Append to `.hex-skills/agent-review/review_history.md`:**
```markdown
### Refinement: {identifier} | {YYYY-MM-DD}
- Stages: 2, Exit: {COMPLETED|PARTIAL_ERROR|ERROR|SKIPPED}
- Stage 1 perspectives: {completed_list} (failed: {failed_list})
- Total suggestions: {count}, Applied: {count}
```

## Step: Aggregate + Return

- Collect ACCEPTED suggestions only (after Critical Verification)
- Deduplicate by `(area, issue)` -- keep higher confidence
- **Return** JSON with suggestions + agent_stats. **NO cleanup/deletion.**

## Step: Verify Agent Cleanup

After collecting results from all agents, verify no orphaned processes remain:

1. Extract `pid` from runner stdout or from `{identifier}_{review_type}_metadata.json`
2. Run verification per agent:
```
node shared/agents/agent_runner.mjs --verify-dead {pid}
```
3. Expected: exit code 0, `{"pid": N, "status": "DEAD"}`
4. If exit code 1 (process alive after cleanup attempt): runner auto-kills it. Re-run `--verify-dead` to confirm. If still alive after second attempt → log ERROR.
5. Display: `"Agent cleanup: {agent} PID {pid} DEAD"` for each agent

**Note:** `agent_runner.mjs` kills process trees automatically on both completion and timeout. Per-call cleanup (step 4b in Iterative Refinement) handles most cases. This final step is a sweep for any missed PIDs — especially from Phase 2 background agents. On Windows, Codex processes accumulate if not explicitly killed via `--verify-dead`.

## Step: Save Review Summary

After returning results, append a summary entry to `.hex-skills/agent-review/review_history.md`. If the file doesn't exist, create it with header `# Agent Review History`.

Entry format (per `shared/references/agent_review_memory.md`):

```markdown
## {identifier} | {review_type} | {YYYY-MM-DD}
- Verdict: {verdict}
- Accepted ({count}): {1-line per accepted suggestion, max 5}
- Rejected ({count}): {1-line per rejected suggestion, max 3}
- Reports: codex .hex-skills/agent-review/codex/{id}_{type}_result.md
- Stats: codex ({accepted}/{total})
```

## Fallback Rules

| Condition | Action |
|-----------|--------|
| Codex succeeds | Aggregate verified suggestions |
| Codex fails | Fall back to Opus self-review; log failure |
| Codex + self-review both fail | Return `{verdict: "SKIPPED", reason: "advisor failed"}` |
| Codex crashes immediately (< 5s, non-zero exit) | Likely MCP init failure (expired auth); log error, fall back to self-review. Note to check agent MCP config. |
| Agent result not ready after expected time | Run Liveness Protocol before declaring failed. Log growing = WAIT |

## Critical Rules

- Read-only review -- agents must NOT modify project files (enforced by prompt CRITICAL CONSTRAINTS)
- Same base prompt to all agents. Only `{focus_hint}` differs per agent.
- Agents produce structured review report (markdown analysis + `## Structured Data` with JSON block). Agent stdout streams to log file for real-time visibility.
- Log all attempts for user visibility (agent name, duration, suggestion count)
- **Persist** per-agent prompts in `.hex-skills/agent-review/{agent}/`, results in `.hex-skills/agent-review/{agent}/` -- do NOT delete
- Ensure `.hex-skills/agent-review/.gitignore` exists before creating files (only create if `.hex-skills/agent-review/` is new)
- **HARD TIMEOUT (30 min default):** `agent_runner.mjs` kills the agent process after `hard_timeout_seconds` (configurable in registry, override via `--timeout`). On timeout, returns `success: false`. Monitor liveness via log file stat (growing = alive). **TaskStop is still FORBIDDEN** — the runner handles timeout internally.
- **MANDATORY: Agent progress monitoring via Claude `Monitor` tool:** `Monitor(command="tail -f {agent_log} | grep --line-buffered 'Phase|ERROR|DONE'", timeout_ms=120000)` with 2-minute cycles. This is the primary wait mechanism, not optional. Fallback to `Bash(run_in_background=true)` only when Monitor unavailable.
- **CRITICAL VERIFICATION:** Do NOT trust agent suggestions blindly. Claude MUST independently verify each suggestion. Accept only after verification.
- **OUTPUT PATH GUARD:** ALL agent review artifacts (prompts, results, logs, metadata, refinement files, review history) MUST reside under `.hex-skills/agent-review/`. NEVER write agent review output to the project root directory or any path outside `.hex-skills/`.

## Definition of Done

- All available agents launched as background tasks (or gracefully failed with logged reason)
- Per-agent prompts persisted in `.hex-skills/agent-review/{agent}/` (differ only by `{focus_hint}`)
- Raw results persisted in `.hex-skills/agent-review/{agent}/` (no cleanup)
- Each suggestion critically verified by Claude (AGREE or REJECT)
- Deduplicated verified suggestions returned with verdict and agent_stats
- `.hex-skills/agent-review/.gitignore` exists (created only if `.hex-skills/agent-review/` was new)
- Iterative Refinement executed (or SKIPPED if Codex unavailable)
- Refinement artifacts persisted in `.hex-skills/agent-review/refinement/`
- Review summary appended to `.hex-skills/agent-review/review_history.md`
- Agent process trees verified dead after results collection (Step: Verify Agent Cleanup)

## Step: Meta-Analysis

**MANDATORY READ:** Load `shared/references/meta_analysis_protocol.md`

After returning results, run meta-analysis on agent delegation effectiveness: coverage, efficiency, prompt quality. Output summary table to chat with improvement suggestions. If pattern is actionable and reproducible (across 3+ runs), suggest creating issue.

## Output Schema (common structure)

`runtime_status` follows `shared/references/runtime_status_catalog.md`.
`execution_outcome` is runner-local transport telemetry, not a coordinator runtime enum.

```yaml
verdict: "{verdict_acceptable} | SUGGESTIONS | SKIPPED"
suggestions:
  - area: "..."
    file: "path/to/file.ext"
    line_start: 42
    line_end: 58
    issue: "What is wrong"
    suggestion: "Specific fix"
    recommended_action: "fix | investigate | monitor | accept_risk"
    confidence: 95
    impact_percent: 15
    source: "{agent}"
    resolution: "accepted | rejected"
agent_stats:
  - name: "{agent}"
    duration_s: 12.4
    suggestion_count: 3
    accepted_count: 2
    runtime_status: "result_ready | failed | dead | skipped"
    execution_outcome: "success | failed | timeout"
refinement:
  iterations: 3
  exit_reason: "CONVERGED | CONVERGED_LOW_IMPACT | MAX_ITER | ERROR | SKIPPED"
  total_suggestions: 8
  total_applied: 6
```

### Mode-specific extensions

**plan_review:** Agent results may include `refined_plan_included: true` in JSON and a `## Refined Plan` section with the corrected plan text. The orchestrator uses the best agent's refined plan as base and patches remaining accepted suggestions from the other agent on top.

## Shared Reference Files

- **Evaluation runtime contract:** `shared/references/evaluation_coordinator_runtime_contract.md`
- **Agent delegation pattern:** `shared/references/agent_delegation_pattern.md`
- **Review base template:** `shared/agents/prompt_templates/review_base.md`
- **Review mode files:** `shared/agents/prompt_templates/modes/` (code.md, story.md, context.md)
- **Iterative refinement template:** `shared/agents/prompt_templates/iterative_refinement.md`
- **Agent registry:** `shared/agents/agent_registry.json`
- **Agent runner:** `shared/agents/agent_runner.mjs`
- **Agent review memory (write-only):** `shared/references/agent_review_memory.md` -- defines review_history.md format (human audit trail)
- **Meta-analysis protocol:** `shared/references/meta_analysis_protocol.md`

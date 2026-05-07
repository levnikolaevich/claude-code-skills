<!-- SOURCE-OF-TRUTH: shared/references/meta_analysis_protocol.md. Edit ONLY here; run `node tools/marketplace/shared.mjs sync` -->

# Meta-Analysis Protocol

Universal post-completion protocol for all coordinators and orchestrators.
Run as the LAST step after all delegated work completes and results are aggregated.
Output to chat — visible to the user.

**Scope:** Self-audit for the skill that just ran. Evaluates deliverable quality + execution efficiency.
For standalone session analysis: `ln-002-session-analyzer`. For multi-day patterns: `/audit-sessions`.

## Skill Types

| Type | Key Metrics |
|------|-------------|
| `planning-coordinator` | Plan completeness, scope coverage, task quality |
| `review-coordinator` — with agents | Coverage, findings quality, blind spots, agent effectiveness |
| `review-coordinator` — workers only | Coverage, findings quality, blind spots |
| `execution-orchestrator` | Stage completion, failure points, quality score |
| `optimization-coordinator` | Hypotheses applied/removed, strike result, impact achieved |

## Universal Dimensions

### 1. Deliverable Quality
- Did output meet the stated goal?
- Scope coverage: were all required areas addressed?
- Any critical gaps or incomplete deliverables?
- What was missed that should have been caught? (blind spots, edge cases, scope omissions)

### 2. Worker / Subskill Effectiveness
| Worker/Subskill | Status | Result |
|----------------|--------|--------|
| {name} | ✓ OK / ⚠ Degraded / ✗ Failed | {brief result} |
- Bottleneck: {slowest worker/stage, if applicable}

### 3. Failure Points
- Errors, timeouts, crashes, retries during this run
- Infra issues (missing files, message delivery, permissions)
- Manual interventions required

### 4. Improvement Candidates
Top 1-3 **focus areas** for next run — tied to specific weaknesses of THIS run (NOT generic).
Format: `{weakness observed} → {concrete action for next run}`
IF trend data exists (`quality-trend.md` or `results_log.md`): note direction (improving/stable/declining).

### 5. Assumption Audit
Compare actual outcome against pre-execution expectations (Goal Articulation Gate):
- Did the stated REAL GOAL match the actual deliverable?
- What surprised you — what wasn't anticipated in planning?
- One sentence: what would you change knowing what you know now?

### 6. Prediction Accuracy (where measurable)

Compare what the skill predicted/planned with what actually happened. Not all types have quantitative predictions — use what's available.

| Aspect | Question |
|--------|----------|
| Prediction vs Reality | What did the skill predict that can be verified against outcomes? |
| Hit Rate | What fraction of predictions/recommendations were useful? |
| Waste | What work was produced but never used (discarded findings, removed tasks, rejected hypotheses)? |
| Blind Spots | What important things were NOT predicted but emerged during execution? |

### 7. Execution Trace (self-audit)

Scan your conversation context for ALL errors and inefficiencies during THIS skill's execution.

#### 7a. Skill Improvement Analysis

For each problem found, propose a specific fix to the skill/command file:

| Category | What to look for | Typical Fix |
|----------|-----------------|-------------|
| Unclear steps | Edit failures, wrong file targeted, content mismatch | Add file path, expected content hint to step |
| Missing scripts | Bash/Python scripts written ad-hoc each run | Move to `references/scripts/` — load instead of generate |
| Vague phases | Tool loops (3+ same tool without progress), trial-and-error | Decompose into explicit sub-steps |
| Missing tools | Permission denials, hook blocks | Update `allowed-tools` in frontmatter |
| Wasted reads | Full-file reads (>100 lines) without outline | Add "outline first" to step |
| Bash fallbacks | `cat`, `grep`, `head` in Bash when MCP exists | Name explicit MCP tool in step |
| Agent issues | Subagent timeouts, empty results | Narrow agent prompt, add essential context |
| Repeated work | Same file read multiple times, same info re-gathered | Add "cache this" note, reuse across steps |

#### 7b. Session Error Log

Group ALL failed/wasted tool calls by problem type. Raw facts:

| Problem Type | Count | Examples |
|-------------|-------|---------|
| Wrong target | {N} | Looked at file X when needed Y (Step 3) |
| Retry storm | {N} | 3 attempts at edit before correct anchor (Step 5) |
| Hash mismatch | {N} | Stale hash after prior edit (Step 4) |
| Anchor not found | {N} | anchor didn't match content (Step 2) |
| Permission denied | {N} | Hook blocked built-in Read (Step 1) |
| Unnecessary work | {N} | Read 500-line file without outline, re-read same file 3x |
| Dead end | {N} | Explored approach X, abandoned, switched to Y (Step 6) |

Skip table if 0 errors.

#### 7c. Subagent Session Analysis

If subagents were launched during execution (Agent tool, Codex, Claude), analyze each separately.

Session locations:

| Agent | Path | Format |
|-------|------|--------|
| Claude (Agent tool) | Results visible in conversation context | Direct |
| Claude (JSONL) | `~/.claude/projects/*/*.jsonl` | JSONL with `message.usage` token data |
| Claude (active) | `~/.claude/sessions/{PID}.json` | JSON `{pid, sessionId, cwd}` |
| Codex | `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl` | JSONL with `token_count` events |

For each agent that participated, produce a **separate** error table flagged with agent name:

```
#### Subagent Errors: {Agent Name}
| Problem Type | Count | Examples |
|-------------|-------|---------|
| {type} | {N} | {brief} |
```

Analyze by same categories as §7b. Skip agent section if agent had 0 errors.
If no subagents were used, skip §7c entirely.

For deeper session analysis beyond self-audit, use `ln-002-session-analyzer`.

## Output Format

Output to chat. **Show ONLY items with findings.** Goal: actionable improvements to THIS skill/command.

```
### Meta-Analysis: {Skill Name}

#### Improvements
| # | Dim | Finding | Target | Fix |
|---|-----|---------|--------|-----|
| 1 | §7a | 3 edit failures in Phase 4 | ln-400 Step 2 | Add file path |
| 2 | §7a | test.sh written ad-hoc (2 retries) | ln-520 | Move to `references/scripts/` |
| 3 | §1 | Security section skipped | ln-400 Phase 1 | Add to scope checklist |

#### Session Errors
| Problem Type | Count | Examples |
|-------------|-------|---------|
| Retry storm | 4 | 3x edit_file on config.ts (Step 5) |
| Wrong target | 2 | Read utils.ts instead of helpers.ts (Step 3) |

#### Subagent Errors: Codex
| Problem Type | Count | Examples |
|-------------|-------|---------|
| Text not found | 3 | edit_file mismatch on utils.ts |

IF no findings AND no errors: "Meta-analysis: clean run."
```

Section tags (§1-§7) may be used in Dim column for traceability but are optional.
Type-specific metrics (Plan Stability, Rework Rate, etc.) remain in §Universal Dimensions as evaluation criteria — appear in output only when they reveal a problem.

## DRY Rule

All output templates live ONLY in this file. SKILL.md and command files MUST NOT define their own output format — they reference this protocol via MANDATORY READ.

**Related tools:**
- Session analysis: `ln-002-session-analyzer` (standalone, any session)
- Multi-day audit: `/audit-sessions` command (3-day retrospective)

## Issue Suggestion Triggers (patterns across 3+ runs)

| Pattern | Likely Cause | Action |
|---------|-------------|--------|
| Worker consistently ✗ Failed | Wrong config or missing prereq | Check worker setup |
| Same blind spot repeated | Goal too narrow | Broaden scope in prompt |
| Failure points > 2 per run | Infra or config issue | Fix root cause |
| Same improvement candidate repeated | Not actionable in current design | Create GitHub issue |
| Improvement implemented but no trend change | Fix ineffective or measured wrong | Review metric validity |
| Prediction accuracy < 50% consistently | Skill making wrong predictions | Review methodology, add validation step |
| Waste > 50% (discarded/total) | Over-generation of findings/hypotheses | Tighten acceptance criteria, add pre-filter |
| Edit failures > 3 per run | Step instructions lack file paths or content hints | Add explicit paths and anchors to affected steps |
| Tool loops repeated across runs | Phase too vague for reliable execution | Decompose phase into explicit sub-steps |
| Read waste > 30% of reads | Missing outline-first guidance | Add "outline before read" to affected phases |
| Bash fallbacks persistent | Instructions don't name MCP tools | Replace prose with explicit tool names in steps |
| Same script recreated across runs | Skill missing pre-built script | Add to `references/scripts/` and reference from step |

If pattern is reproducible:
> Consider creating issue: https://github.com/levnikolaevich/claude-code-skills/issues

---
**Version:** 4.2.0
**Last Updated:** 2026-03-21

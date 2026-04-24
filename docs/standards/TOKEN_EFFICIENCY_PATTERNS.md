# Token Efficiency Patterns

<!-- SCOPE: Research document. Patterns for reducing context noise and improving agent efficiency when processing CLI output, error messages, and tool results. Source analysis: RTK (rtk-ai/rtk). -->

## 1. Problem Statement

Agent sessions consume tokens on raw CLI output: verbose test results, unfiltered build errors, duplicated log lines. These patterns reduce noise at the skill level — no external tooling required.

## 2. Context Window Budget (200K)

| Component | Tokens | Notes |
|-----------|--------|-------|
| System prompt | ~2K | Fixed overhead |
| Skills (loaded) | 1-5K each | Auto-invoked skills load on match |
| MCP tool definitions | 10-20K | 5 servers x ~5K each = 25K (12.5%) |
| LSP diagnostics | 2-5K | Language server output |
| CLAUDE.md chain | 2-5K | Global + project + local |
| Memory files | 1-2K | MEMORY.md, auto-memory |
| **Available for conversation** | **~170K** | After all overhead |

**MCP overhead rule:** Count servers x 5K. WARN if >5 servers or >25K total. Each MCP server registers all tool schemas upfront, even if unused.

**Instruction file budgets** (Anthropic official + IFScale research): `AGENTS.md` ≤200 lines (ideally ≤150, per Anthropic memory docs — *"target under 200 lines per CLAUDE.md file"*); `CLAUDE.md` as an `@AGENTS.md` import stub ≤50 lines (ideally ≤20); user-added imperatives across all loaded files ≤100 (IFScale arxiv 2507.11538 peak around 150–200 total; Claude Code's built-in system prompt already consumes part of the budget). Reference: `skills-catalog/shared/references/agent_instructions_writing_guide.md`. Use tables, not prose. Link to `docs/` for details.

**Tool output is the hidden killer:** A single `cargo test` or `npm test` can produce thousands of lines. Mitigation: RTK-style PostToolUse filter hook truncates output before it enters context. See Pattern 6 below.

---

## 3. Core Patterns

| # | Pattern | What It Does | Where Applied |
|---|---------|-------------|---------------|
| 1 | **Message Normalization** | Replace runtime values (UUIDs, timestamps, IPs, paths) with placeholders to enable grouping | `shared/references/output_normalization.md` |
| 2 | **Error Deduplication** | Group identical normalized lines, report count instead of repeating | `shared/references/output_normalization.md` |
| 3 | **Failure Grouping** | Classify errors by root cause category (import, assertion, timeout, runtime) | `shared/references/output_normalization.md` |
| 4 | **Smart Truncation** | Normalize → deduplicate → group → THEN truncate (not raw tail) | `shared/references/output_normalization.md` |
| 5 | **Trend Tracking** | Append scores to results_log for improving/stable/declining detection | `shared/references/results_log_pattern.md` |
| 6 | **Hook Health Check** | Validate hook configs, scripts, dependencies before relying on them | `shared/references/hook_health_check.md` |

## 4. Applicability Matrix (Source: RTK Analysis)

Analysis of RTK (Rust Token Killer) — CLI proxy reducing output by 60-90%.

| # | RTK Feature | Verdict | Rationale |
|---|-------------|---------|-----------|
| 1 | PreToolUse hook command rewrite (`updatedInput`) | Adapt | Useful pattern for path aliasing; risky for magic command substitution (hides real commands, breaks debugging) |
| 2 | TOML declarative output filters (48+ built-in) | Skip | We are a skills collection, not a CLI runtime. No binary to filter stdout |
| 3 | SQLite token analytics (`rtk gain`) | Skip | Over-engineering. `/cost` and ccusage cover this |
| 4 | Session history analysis (`rtk learn`) | Adapt | Pattern valuable; JSONL parsing fragile. Better as a skill reading Claude Code history |
| 5 | Missed optimization discovery (`rtk discover`) | Skip | Specific to RTK. Concept already in ln-511, ln-640 |
| 6 | Error output recovery (`rtk tee`) | **Skip** | Claude Code already persists the full session transcript (JSONL at `transcript_path`) including Bash stdout/stderr for both success and failure. A custom `.hex-skills/logs/error_recovery/` duplicates that without adding actionable value — short-lived v1.21.0–1.21.1 hook reverted in v1.22.0 |
| 7 | Dual hooks: rewrite + suggest (`systemMessage`) | **Adopt** | Non-blocking `systemMessage` ideal for skill recommendations |
| 8 | Slim awareness file (compact LLM context) | Adapt | Good idea; Claude Code already supports per-directory CLAUDE.md natively |
| 9 | Ultra-compact mode (`--ultra-compact`) | Skip | Agent reads SKILL.md, not CLI output. Irrelevant |
| 10 | Inline TOML test fixtures | Skip | We don't write executable code |
| 11 | Cost economics module (`cc_economics`) | Skip | Requires runtime + SQLite. Over-engineering |
| 12 | Per-project filter overrides | Skip | Already have CLAUDE.md + .local.md |
| 13 | Hook integrity check (`rtk init --show`) | **Adopt** | Validate hooks.json, script existence, dependencies |

### Adopted Patterns Detail

**Pattern 7 (Suggest Hook):**
PreToolUse:Bash hook. `systemMessage`-only (no blocking, no modification). Pattern-matches Bash commands to recommend relevant skills. Example: `npm test` → "For test analysis, consider ln-513/ln-514". Script: `hooks/skill-suggest.sh` (~40 lines).

**Pattern 13 (Hook Health Check):**
Integrated into `ln-010` assessment and verification flow. Validates: JSON syntax of hooks.json, script file existence, dependency availability (node). See `shared/references/hook_health_check.md`.

## 5. Skills Modernization

| Skill | Change | Shared Reference |
|-------|--------|-----------------|
| **ln-402** (task-reviewer) | Normalize + deduplicate lint/typecheck output before truncating to 50 lines | `shared/references/output_normalization.md` |
| **ln-513** (regression-checker) | Group failing tests by error category in verdict | `shared/references/output_normalization.md` |
| **ln-622** (build-auditor) | Append build_health score to results_log with trend | `shared/references/results_log_pattern.md` |
| **ln-811** (performance-profiler) | Deduplicate suspicion stack entries across call chain steps | `shared/references/output_normalization.md` |
| **ln-013** (marketplace/config aligner) | Align Claude and Codex marketplace plugins without shared active plugin roots | `shared/references/hook_health_check.md` |
| **ln-514** (test-log-analyzer) | §6 Message Normalization → MANDATORY READ to shared | `shared/references/output_normalization.md` |

## 6. What NOT to Adopt

| Anti-Pattern | Why |
|-------------|-----|
| Runtime CLI proxy binary | Skills are markdown instructions, not executables |
| SQLite tracking database | Over-engineering for a skills collection |
| Automatic command rewriting | Hides real commands, violates "no magic parameters" principle |
| Output compression at transport level | Agent's built-in tools (Read, Grep) already handle this |
| Inline executable tests | Our tests are DoD checklists + ln-310 multi-agent validation |
| External style-wrappers (headroom, caveman) | Same rationale as RTK binary §4: runtime proxies / response-style hijackers conflict with per-skill output contracts and hide failure context |
| Custom error-recovery logs (when Claude Code transcript covers it) | Claude Code already stores tool stdout/stderr (incl. failures) in the session transcript at `transcript_path`. A separate `.hex-skills/logs/error_recovery/` directory duplicates that, costs context tokens via `additionalContext`, and adds maintenance with zero recovery benefit for the agent |

---
**Last Updated:** 2026-03-20

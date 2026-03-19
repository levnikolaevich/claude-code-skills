# Token Efficiency Patterns

<!-- SCOPE: Research document. Patterns for reducing context noise and improving agent efficiency when processing CLI output, error messages, and tool results. Source analysis: RTK (rtk-ai/rtk). -->

## 1. Problem Statement

Agent sessions consume tokens on raw CLI output: verbose test results, unfiltered build errors, duplicated log lines. These patterns reduce noise at the skill level — no external tooling required.

## 2. Core Patterns

| # | Pattern | What It Does | Where Applied |
|---|---------|-------------|---------------|
| 1 | **Message Normalization** | Replace runtime values (UUIDs, timestamps, IPs, paths) with placeholders to enable grouping | `shared/references/output_normalization.md` |
| 2 | **Error Deduplication** | Group identical normalized lines, report count instead of repeating | `shared/references/output_normalization.md` |
| 3 | **Failure Grouping** | Classify errors by root cause category (import, assertion, timeout, runtime) | `shared/references/output_normalization.md` |
| 4 | **Smart Truncation** | Normalize → deduplicate → group → THEN truncate (not raw tail) | `shared/references/output_normalization.md` |
| 5 | **Trend Tracking** | Append scores to results_log for improving/stable/declining detection | `shared/references/results_log_pattern.md` |
| 6 | **Hook Health Check** | Validate hook configs, scripts, dependencies before relying on them | `shared/references/hook_health_check.md` |

## 3. Applicability Matrix (Source: RTK Analysis)

Analysis of RTK (Rust Token Killer) — CLI proxy reducing output by 60-90%.

| # | RTK Feature | Verdict | Rationale |
|---|-------------|---------|-----------|
| 1 | PreToolUse hook command rewrite (`updatedInput`) | Adapt | Useful pattern for path aliasing; risky for magic command substitution (hides real commands, breaks debugging) |
| 2 | TOML declarative output filters (48+ built-in) | Skip | We are a skills collection, not a CLI runtime. No binary to filter stdout |
| 3 | SQLite token analytics (`rtk gain`) | Skip | Over-engineering. `/cost` and ccusage cover this |
| 4 | Session history analysis (`rtk learn`) | Adapt | Pattern valuable; JSONL parsing fragile. Better as a skill reading Claude Code history |
| 5 | Missed optimization discovery (`rtk discover`) | Skip | Specific to RTK. Concept already in ln-511, ln-640 |
| 6 | Error output recovery (`rtk tee`) | **Adopt** | PostToolUse hook saves full output on failure. ~25 lines bash |
| 7 | Dual hooks: rewrite + suggest (`systemMessage`) | **Adopt** | Non-blocking `systemMessage` ideal for skill recommendations |
| 8 | Slim awareness file (compact LLM context) | Adapt | Good idea; Claude Code already supports per-directory CLAUDE.md natively |
| 9 | Ultra-compact mode (`--ultra-compact`) | Skip | Agent reads SKILL.md, not CLI output. Irrelevant |
| 10 | Inline TOML test fixtures | Skip | We don't write executable code |
| 11 | Cost economics module (`cc_economics`) | Skip | Requires runtime + SQLite. Over-engineering |
| 12 | Per-project filter overrides | Skip | Already have CLAUDE.md + .local.md |
| 13 | Hook integrity check (`rtk init --show`) | **Adopt** | Validate hooks.json, script existence, dependencies |

### Adopted Patterns Detail

**Pattern 6 (Error Recovery Hook):**
PostToolUse:Bash hook. On exit_code != 0: save full stderr+stdout to `logs/error_recovery/` with 20-file rotation, 1MB cap. Return `systemMessage` with path. Script: `hooks/error-recovery.sh` (~25 lines).

**Pattern 7 (Suggest Hook):**
PreToolUse:Bash hook. `systemMessage`-only (no blocking, no modification). Pattern-matches Bash commands to recommend relevant skills. Example: `npm test` → "For test analysis, consider ln-513/ln-514". Script: `hooks/skill-suggest.sh` (~40 lines).

**Pattern 13 (Hook Health Check):**
Integrated into ln-005 environment scanner. Validates: JSON syntax of hooks.json, script file existence, dependency availability (node). See `shared/references/hook_health_check.md`.

## 4. Skills Modernization

| Skill | Change | Shared Reference |
|-------|--------|-----------------|
| **ln-402** (task-reviewer) | Normalize + deduplicate lint/typecheck output before truncating to 50 lines | `shared/references/output_normalization.md` |
| **ln-513** (regression-checker) | Group failing tests by error category in verdict | `shared/references/output_normalization.md` |
| **ln-622** (build-auditor) | Append build_health score to results_log with trend | `shared/references/results_log_pattern.md` |
| **ln-811** (performance-profiler) | Deduplicate suspicion stack entries across call chain steps | `shared/references/output_normalization.md` |
| **ln-005** (environment-scanner) | Validate hooks.json integrity, scripts, dependencies | `shared/references/hook_health_check.md` |
| **ln-514** (test-log-analyzer) | §6 Message Normalization → MANDATORY READ to shared | `shared/references/output_normalization.md` |

## 5. What NOT to Adopt

| Anti-Pattern | Why |
|-------------|-----|
| Runtime CLI proxy binary | Skills are markdown instructions, not executables |
| SQLite tracking database | Over-engineering for a skills collection |
| Automatic command rewriting | Hides real commands, violates "no magic parameters" principle |
| Output compression at transport level | Agent's built-in tools (Read, Grep) already handle this |
| Inline executable tests | Our tests are DoD checklists + ln-310 multi-agent validation |

---
**Last Updated:** 2026-03-15

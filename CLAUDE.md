# CLAUDE.md

> **SCOPE:** Entry point with rules and navigation ONLY. Guides in `docs/`. Workflows in `SKILL.md`. Public docs in `README.md`.

Skills collection for Claude Code with config-driven Agile task management (Linear or File Mode).

## Critical Rules

| Rule | Details |
|------|---------|
| **Architecture Guide** | Read `docs/architecture/SKILL_ARCHITECTURE_GUIDE.md` before any skill work |
| **MANDATORY READ** | Use `**MANDATORY READ:** Load {file}`. Passive refs are NOT followed |
| **Path Resolution** | Relative to skills repo root, NOT target project |
| **Sequential Numbering** | 1, 2, 3 (NOT 1.5). Sub-steps: Na/Nb (3a, 4a) |
| **Docs in English** | Stories/Tasks can be EN/RU |
| **No version auto-updates** | Update ONLY when user explicitly requests |
| **YAML quoting** | Wrap `description:` in quotes if it contains `:` |
| **Research-to-Action Gate** | No defect = informational, not actionable |
| **No hardcoded counts** | Counts ONLY in README.md badge |
| **No Changes sections** | `**Version:** X.Y.Z` + `**Last Updated:**` at end |
| **DoD with checkboxes** | `## Definition of Done` with `- [ ]` items |
| **Worker independence** | No parent/peer refs in L3 Workers |

## MCP Tool Preferences

Prefer `hex-line` for code/config/script/test files.
- Use `outline` before large reads, then `read_file` with ranges.
- Use `edit_file` / `write_file` for writes, `bulk_replace` for multi-file text rename, `verify` after conflicts or delayed follow-up edits, and `changes` for diff review.
- Use `hex-graph` only for symbol, reference, architecture, and semantic diff questions.
- With the hook active, project-scoped text `Read`/`Edit`/`Write`/`Grep`/`Glob` are redirected to `hex-line`. Built-in tools stay fine for images, PDFs, notebooks, and text paths outside the current project root.

## Quick Understanding

| What | How |
|------|-----|
| Project overview + tree | `cat README.md` |
| Architecture (L0-L3) | `cat docs/architecture/SKILL_ARCHITECTURE_GUIDE.md` |
| Key workflow | `ln-700 -> ln-100 -> ln-200 -> ln-1000` |
| Tool config (Linear/File) | `cat skills-catalog/shared/references/environment_state_contract.md` |
| Skill metadata | `head -20 {ln-NNN}/SKILL.md` |

## Navigation

**DAG:** CLAUDE.md -> `docs/README.md` -> topic docs. Read SCOPE tag first.

| Topic | File |
|-------|------|
| Writing Guidelines | `docs/architecture/SKILL_ARCHITECTURE_GUIDE.md` section Writing Guidelines |
| Environment State | `skills-catalog/shared/references/environment_state_contract.md` |
| Risk-Based Testing | `skills-catalog/shared/references/risk_based_testing_guide.md` |
| Frontmatter fields | `skills-catalog/shared/references/frontmatter_reference.md` |
| Hooks reference | `skills-catalog/shared/references/hooks_reference.md` |
| Questions format | `skills-catalog/shared/references/questions_format.md` |
| Hook Design | `docs/best-practice/HOOK_DESIGN_GUIDE.md` |
| MCP Tool Design | `docs/best-practice/MCP_TOOL_DESIGN_GUIDE.md` |
| Token Efficiency | `docs/standards/TOKEN_EFFICIENCY_PATTERNS.md` |
| Prompt Caching | `docs/best-practice/PROMPT_CACHING_GUIDE.md` |
| npm Packages | `docs/standards/NPM_PACKAGE_BEST_PRACTICES.md` |

## Maintenance

Version update (ONLY on explicit request): update `**Version:**` in SKILL.md, version in README.md tables, CHANGELOG.md paragraph.

## Compact Instructions

Preserve in priority order during /compact:
- Architecture decisions and rationale (NEVER summarize)
- Modified files and their key changes
- Current verification status (pass/fail)
- Open TODOs and rollback notes
- Tool outputs (can delete, keep summary only)

**Last Updated:** 2026-03-20

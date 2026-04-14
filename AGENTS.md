# AGENTS.md

> **SCOPE:** Entry point with rules and navigation only. Enforceable skill rules live in `skills-catalog/shared/references/`. Maintainer references live in `docs/`. Public documentation lives in `README.md`.

Skills collection for Codex with config-driven Agile task management (Linear or File Mode).

## Critical Rules

**Read this table before starting any work.**

| Rule | When to Apply | Details |
|------|---------------|---------|
| **Read Skill Contract first** | Before editing or reviewing skills | `cat skills-catalog/shared/references/skill_contract.md` - enforceable `SKILL.md` contract for structure, delegation, and coupling |
| **Read Architecture Guide second** | Before designing or refactoring skills | `cat docs/architecture/SKILL_ARCHITECTURE_GUIDE.md` - maintainer reference for hierarchy, heuristics, token efficiency, and red flags |
| **MANDATORY READ pattern** | File references in `SKILL.md` | Use `**MANDATORY READ:** Load {file}`. Passive refs (`See`, `Per`, `Follows`) are not followed by agents. Group multiple into one block at the section start |
| **Path Resolution** | File paths in `SKILL.md` | Relative to skills repo root, not target project. Every `SKILL.md` with file refs includes `> **Paths:**` after frontmatter |
| **Sequential Numbering** | Phases, sections, steps | `1, 2, 3, 4` not `1, 1.5, 2`. Exception: `4a`, `4b` for create/replan splits |
| **Docs in English** | All documentation | Stories and Tasks can be EN or RU regardless of provider |
| **Code Comments 15-20%** | Writing code in skills | WHY, not WHAT. No historical notes, no code examples. Task or ADR IDs only as spec refs |
| **No version auto-updates** | After changes | Update versions only when the user explicitly asks. Default: change files, do not touch versions |
| **YAML description quoting** | `SKILL.md` frontmatter | If `description:` contains `:`, wrap it in double quotes |
| **Research-to-Action Gate** | Before turning research into changes | Ask: "What specific defect in current skill output does this fix?" No defect means informational, not actionable |
| **No hardcoded counts** | Documentation files | Counts only in the README badge (`skills-NNN`). Everywhere else: no aggregate counts |
| **No Changes sections** | `SKILL.md` versioning | Use `**Version:** X.Y.Z` and `**Last Updated:** YYYY-MM-DD` only |
| **DoD with checkboxes** | All `SKILL.md` files | `## Definition of Done` with `- [ ]` items |
| **Worker independence** | L3 worker `SKILL.md` | No `**Parent:**`, no `**Coordinator:**`, no peer cross-references as public contract |

## Workflow Principles

**Plan first.** For any task with 3+ steps or architectural impact, produce a written plan before implementing. If something goes sideways during execution, STOP and re-plan rather than patch forward.

**Verify before "done".** Never mark a task complete without evidence: diffs against main where relevant, passing tests, logs showing the new behavior. Ask yourself: "would a staff engineer approve this in review?"

**Demand elegance, not over-engineering.** For non-trivial changes, pause and ask "is there a more elegant approach?" If a fix feels hacky, rewrite it with what you now know. For simple fixes, skip this — don't invent complexity.

**Core principles.** Simplicity first · find root causes, no temporary patches · minimize blast radius, change only what's necessary.

## MCP Tool Preferences

Use `hex-line` first for repo file reads/search/edits on code, config, scripts, and tests.
- Use `hex-graph` first for symbol identity, references, architecture, edit blast radius, clone groups, and semantic diff risk.
- Built-in `Read/Edit/Write/Grep` and shell repo inspection are fallback only when MCP is unavailable, unsupported, or outside scope.
- When the hex-line hook is active, project-scoped text `Read/Edit/Write/Grep/Glob` are hard-routed to `hex-line`; built-in exceptions are binary/media and text paths outside the current project root.
- Do not use shell repo-wide search/read patterns such as `rg`, `grep`, `cat`, `find`, or recursive tree dumps when `hex-line` or `hex-graph` covers the task.
- Shell is still appropriate for Git history, build/test/runtime commands, package managers, Docker, images, PDFs, notebooks, and user-level `.claude/settings*.json` work outside the repo.

| Instead of | Use | Why |
|-----------|-----|-----|
| Read | `mcp__hex-line__read_file` | Discovery-first reads with revision support when needed |
| Edit | `mcp__hex-line__edit_file` | Hash-verified edits with conservative follow-up flow |
| Write | `mcp__hex-line__write_file` | Direct writes without broad rereads |
| Grep | `mcp__hex-line__grep_search` | Summary-first search with optional edit-ready hunks |
| Glob | `mcp__hex-line__inspect_path` | Pattern-based file discovery inside an explicit root |
| Text rename across files | `mcp__hex-line__bulk_replace` | Explicit-root multi-file rename/refactor |

- Preferred cheap flow: `inspect_path -> outline -> read_file(minimal, ranges)` and only request `edit_ready=true` / rich output when revisions or checksums are required.
- Before delayed same-file follow-up edits, carry `base_revision` and run `verify` instead of rereading blindly.
- Do not start discovery with repo-root wildcard `inspect_path` such as `pattern="*.md"` unless you intentionally need a repo inventory. Narrow `path` first.
- For text search, prefer `grep_search(output_mode="summary")` first. Escalate to `output_mode="content"` only after narrowing `path`, `glob`, or pattern, or when canonical hunks/checksums are required.
- Use `allow_large_output=true` only when a large `grep_search(output_mode="content")` payload is explicitly needed. Default behavior is intentionally capped and should be treated as the safe path.
- Do not use `find_symbols` on broad/common bare names until you narrow by `path` or can immediately refine with `name + file` or `workspace_qualified_name`.

## Quick Understanding

| What | How |
|------|-----|
| Project overview + full tree | `cat README.md` |
| Skill count | `ls -d ln-*/SKILL.md \| wc -l` |
| Skill contract | `cat skills-catalog/shared/references/skill_contract.md` |
| Architecture patterns (L0-L3) | `cat docs/architecture/SKILL_ARCHITECTURE_GUIDE.md` |
| Agent delegation runtime | `cat docs/architecture/AGENT_DELEGATION_PLATFORM_GUIDE.md` |
| Tool configuration | `cat skills-catalog/shared/references/environment_state_contract.md` |
| Key workflow | `ln-700 -> ln-100 -> ln-200 -> ln-1000` |
| Skill metadata | `head -20 {ln-NNN}/SKILL.md` |
| Reference files for a skill | `ls {ln-NNN}/references/` |
| Shared templates | `ls skills-catalog/shared/templates/` |
| Questions format | `cat skills-catalog/shared/references/questions_format.md` |

## Navigation

**DAG:** `AGENTS.md` -> `docs/README.md` -> topic docs. Read the `SCOPE` tag first in each doc.

| Topic | File |
|-------|------|
| Skill contract | `skills-catalog/shared/references/skill_contract.md` |
| Agent instructions writing guide | `skills-catalog/shared/references/agent_instructions_writing_guide.md` |
| Writing guidelines | `docs/architecture/SKILL_ARCHITECTURE_GUIDE.md` |
| Environment State | `skills-catalog/shared/references/environment_state_contract.md` |
| Risk-Based Testing | `skills-catalog/shared/references/risk_based_testing_guide.md` |
| Frontmatter fields | `skills-catalog/shared/references/frontmatter_reference.md` |
| Questions format | `skills-catalog/shared/references/questions_format.md` |
| Hooks reference | `skills-catalog/shared/references/hooks_reference.md` |
| Hook design | `docs/best-practice/HOOK_DESIGN_GUIDE.md` |
| MCP tool design | `docs/best-practice/MCP_TOOL_DESIGN_GUIDE.md` |
| MCP output contract | `docs/best-practice/MCP_OUTPUT_CONTRACT_GUIDE.md` |
| Token efficiency | `docs/standards/TOKEN_EFFICIENCY_PATTERNS.md` |
| Prompt caching | `docs/best-practice/PROMPT_CACHING_GUIDE.md` |
| npm packages | `docs/standards/NPM_PACKAGE_BEST_PRACTICES.md` |

## Maintenance

**Version update protocol** (only when the user explicitly requests it):

1. Update `**Version:**` in `{skill}/SKILL.md`
2. Update version in README feature tables
3. Update `CHANGELOG.md` with one summary paragraph per date (`## YYYY-MM-DD`)

## Compact Instructions

Preserve in priority order during `/compact`:
- architecture decisions and rationale
- modified files and key changes
- current verification status
- open TODOs and rollback notes
- tool outputs as summaries only

**Last Updated:** 2026-04-11

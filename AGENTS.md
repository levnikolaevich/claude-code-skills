# AGENTS.md

> **SCOPE:** Entry point with rules and navigation only. Enforceable skill rules live in `shared/references/`. Maintainer references live in `docs/`. Public documentation lives in `README.md`.

Skills collection for Codex with config-driven Agile task management (Linear, GitHub Issues, or File Mode).

## Critical Rules

**Read this table before starting any work.**

| Rule | When to Apply | Details |
|------|---------------|---------|
| **Read Skill Contract first** | Before editing or reviewing skills | `cat shared/references/skill_contract.md` - enforceable `SKILL.md` contract for structure, delegation, and coupling |
| **Read Architecture Guide second** | Before designing or refactoring skills | `cat docs/architecture/SKILL_ARCHITECTURE_GUIDE.md` - maintainer reference for hierarchy, heuristics, token efficiency, and red flags |
| **MANDATORY READ pattern** | File references in `SKILL.md` | Use `**MANDATORY READ:** Load {file}` for execution-critical refs in `SKILL.md`. Passive refs (`See`, `Per`, `Follows`) are not followed by agents. `@path` imports are for harness memory/context files (`CLAUDE.md`), not the canonical `SKILL.md` loading contract. Group multiple targets into one block at the section start |
| **Path Resolution** | File paths in `SKILL.md` | Relative to skills repo root, not target project. Every `SKILL.md` with file refs includes `> **Paths:**` after frontmatter |
| **Sequential Numbering** | Phases, sections, steps | `1, 2, 3, 4` not `1, 1.5, 2`. Exception: `4a`, `4b` for create/replan splits |
| **Docs in English** | All documentation | Stories and Tasks can be EN or RU regardless of provider |
| **Code Comments 15-20%** | Writing code in skills | WHY, not WHAT. No historical notes, no code examples. Task or ADR IDs only as spec refs |
| **No version auto-updates** | After changes | Update versions only when the user explicitly asks. Default: change files, do not touch versions |
| **YAML description quoting** | `SKILL.md` frontmatter | If `description:` contains `:`, wrap it in double quotes |
| **Research-to-Action Gate** | Before turning research into changes | Ask: "What specific defect in current skill output does this fix?" No defect means informational, not actionable |
| **Plugin-first edits** | Any skill or shared-resource change | Edit real skills under `plugins/<plugin>/skills/<skill>/`. Single-skill support files live in that skill's `references/`. Files reused by 2+ skills live in root `shared/`, are mapped in `tools/marketplace/shared-registry.json`, then distributed with `node tools/marketplace/shared.mjs sync` and validated with `node tools/marketplace/validate.mjs` |
| **Distributed file marker** | Reading any file under `plugins/*/skills/*/references/` | If the file's first ~5 lines contain a `SOURCE-OF-TRUTH: shared/<path>` marker — edit the file at that shared path instead, then run `node tools/marketplace/shared.mjs sync`. Never edit the marked copy under `references/`. JSON files use a sidecar `<file>.SOURCE.md` next to them — same rule applies |
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
- When the hex-line hook is active, project-scoped text `Read/Edit/Write/Grep/Glob` receive hex-line guidance by default; explicit `hooks.mode: "blocking"` hard-routes them to `hex-line`. Built-in exceptions are binary/media, plan files in Plan Mode, and text paths outside the current project root.
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
| Skill inventory | `Get-ChildItem plugins -Recurse -Filter SKILL.md` |
| Skill contract | `cat shared/references/skill_contract.md` |
| Architecture patterns (L0-L3) | `cat docs/architecture/SKILL_ARCHITECTURE_GUIDE.md` |
| Agent delegation runtime | `cat docs/architecture/AGENT_DELEGATION_PLATFORM_GUIDE.md` |
| Tool configuration | `cat shared/references/environment_state_contract.md` |
| Loop health model | `cat shared/references/loop_health_contract.md` |
| Procedural SOP/TWI guide | `cat shared/references/procedural_skill_sop_guide.md` |
| Key workflow | `ln-700 -> ln-100 -> ln-200 -> ln-1000` |
| Skill metadata | `Get-Content plugins/<plugin>/skills/<skill>/SKILL.md -TotalCount 20` |
| Reference files for a skill | `Get-ChildItem plugins/<plugin>/skills/<skill>/references/` |
| Shared templates | `Get-ChildItem shared/templates/` |

## Navigation

**DAG:** `AGENTS.md` -> `docs/README.md` -> topic docs. Read the `SCOPE` tag first in each doc.

| Topic | File |
|-------|------|
| Skill contract | `shared/references/skill_contract.md` |
| Agent instructions writing guide | `shared/references/agent_instructions_writing_guide.md` |
| Writing guidelines | `docs/architecture/SKILL_ARCHITECTURE_GUIDE.md` |
| Environment State | `shared/references/environment_state_contract.md` |
| Loop Health | `shared/references/loop_health_contract.md` |
| Procedural SOP/TWI | `shared/references/procedural_skill_sop_guide.md` |
| Risk-Based Testing | `shared/references/risk_based_testing_guide.md` |
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

**Last Updated:** 2026-05-06

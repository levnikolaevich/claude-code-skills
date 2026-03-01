# CLAUDE.md

<!-- SCOPE: Repository rules and AI agent instructions ONLY. -->

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository

Zoned Labs fork of [levnikolaevich/claude-code-skills](https://github.com/levnikolaevich/claude-code-skills), trimmed from 106 to 54 skills for a small team. Enterprise planning/decomposition skills removed; docs pipeline, execution workers, quality checks, and full audit suite retained.

> [!WARNING]

> Before starting any work with skills in this repository, **ALWAYS read** [docs/SKILL_ARCHITECTURE_GUIDE.md](docs/SKILL_ARCHITECTURE_GUIDE.md) for industry best practices: Orchestrator-Worker Pattern, Single Responsibility Principle, Token Efficiency, and Red Flags to avoid.

## Documentation Levels

| Level | Files | Audience |
|-------|-------|----------|
| **1. Project** | CLAUDE.md + docs/ | AI agent developing/maintaining skills |
| **2. Public** | README.md | GitHub visitors (developers, users) |
| **3. Templates** | {skill}/references/*_template.md | Target projects created by skills |

**No duplication** across levels. Same concepts in different files serve different contexts.

## Writing Guidelines

See [Writing Guidelines](docs/SKILL_ARCHITECTURE_GUIDE.md#writing-guidelines-progressive-disclosure-pattern) in SKILL_ARCHITECTURE_GUIDE.md.

## Visual Documentation

All skills have `diagram.html` (embedded Mermaid) + `shared/css/diagram.css`. See [Visual Documentation](README.md#-visual-documentation) in README.md.

## Available Skills

**54 skills** in 5 categories:

| Category | Skills | Examples |
|----------|--------|----------|
| **0XX Shared/Research** | 5 | ln-001, ln-002, ln-003, ln-004, ln-005 |
| **1XX Documentation** | 13 | ln-100 through ln-150, ln-600, ln-601, ln-610 |
| **4XX Execution** | 3 | ln-401, ln-402, ln-404 |
| **5XX Quality** | 5 | ln-510 through ln-514 |
| **6XX Audit** | 28 | ln-620 through ln-653 |

**Key workflow:** ln-100-documents-pipeline -> create tasks in Linear -> ln-401-task-executor -> ln-402-task-reviewer -> ln-510-quality-coordinator

## Key Concepts

### Configuration Auto-Discovery
All skills automatically find settings from `docs/tasks/kanban_board.md`: Team ID, Next Epic Number, Next Story Number. Create via ln-130-tasks-docs-creator or ln-100-documents-pipeline. If missing, skills request data from user.

### Task Hierarchy, Kanban Board, Development Principles
See [README.md](README.md) for detailed structure and references.

## Important Details

**Testing:** Risk-Based Testing (2-5 E2E, 3-8 Integration, 5-15 Unit, Priority >=15). See [risk_based_testing_guide.md](shared/references/risk_based_testing_guide.md).

**Code Comments:** 15-20% ratio. Explain WHY, not WHAT. NO Epic/Task IDs, NO historical notes, NO code examples.

**Documentation Language:** All docs in English except Stories/Tasks in Linear (can be English/Russian).

**Sequential Numbering:** Phases/Sections/Steps: 1, 2, 3, 4 (NOT 1, 1.5, 2).

**File References in Skills:** MUST use `**MANDATORY READ:** Load {file}` pattern. Passive references (`See`, `Per`, `Follows`) are NOT followed by agents.

**Path Resolution:** File paths in SKILL.md (`shared/`, `references/`, `../ln-*`) are relative to skills repo root, NOT target project.

## Working with Skill Files

**SKILL.md Metadata:** YAML frontmatter with `name` and `description`. If `description` contains colons (`:`), wrap in double quotes.

**Reference Files:** Stored in `{skill}/references/` — templates, integration guides, checklists, structure templates.

## Versioning

All skills have versions at end of file: `**Version:** X.Y.Z` + `**Last Updated:** YYYY-MM-DD`. Do NOT add **Changes:** sections — git history tracks changes.

## Maintenance After Changes

> [!WARNING]

> Version updates are performed ONLY when explicitly requested by the user, NOT automatically.

**Default:** Make changes to skill files. Do NOT update versions in SKILL.md, CLAUDE.md, README.md, or CHANGELOG.md.

**When user explicitly requests version update:**
1. Update skill version in `{skill}/SKILL.md`
2. Update CHANGELOG.md — one summary paragraph per date (`## YYYY-MM-DD`), no duplicate dates
3. Update Last Updated date below

**Last Updated:** 2026-03-01

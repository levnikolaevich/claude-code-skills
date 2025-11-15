# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository

This is a collection of skills for Claude Code, integrated with Linear for Agile-style task management.

> **⚠️ IMPORTANT:** Before starting any work with skills in this repository, **ALWAYS read** [docs/SKILL_ARCHITECTURE_GUIDE.md](docs/SKILL_ARCHITECTURE_GUIDE.md) for industry best practices (2024-2025): Orchestrator-Worker Pattern, Single Responsibility Principle, Token Efficiency, Task Decomposition guidelines, and Red Flags to avoid.

## Writing Guidelines (Progressive Disclosure Pattern)

**When updating CLAUDE.md, SKILL.md files, or documentation, follow these rules for token efficiency:**

| Content Type | Format | Rationale |
|--------------|--------|-----------|
| **Skill descriptions** | < 200 chars in SKILL.md frontmatter | Clarity, focused scope |
| **Workflows** | Reference table with link to SKILL.md | Avoid duplication (DRY) |
| **Examples** | Table rows (verdict + rationale) | 60-80% more compact than paragraphs |
| **Lists** | Bullet points with inline details | Progressive disclosure |
| **References** | One-line format (source - topics - key insight) | Scannable, no verbose paragraphs |
| **Comparisons** | Table with columns | Visual clarity, easy scanning |
| **Step-by-step processes** | Inline arrow notation (Step 1 → Step 2 → Step 3) | Compact flow representation |

**When verbose content is justified:**
- ❌ Anti-patterns (educational value - prevents mistakes)
- 🎓 Complex architectural explanations (orchestrator patterns, state machines)
- ⚠️ Critical rules with rationale (INVEST criteria, task sizing)

**Compression targets:**
- CLAUDE.md: ~250 lines (achieved 237 lines, -60% from 593 lines)
- SKILL_ARCHITECTURE_GUIDE.md: ~500 lines (achieved 497 lines, -27% from 680 lines)
- Individual SKILL.md: < 800 lines (optimal: 400-600 lines)

**See:** [Writing Guidelines](docs/SKILL_ARCHITECTURE_GUIDE.md#writing-guidelines-progressive-disclosure-pattern) in SKILL_ARCHITECTURE_GUIDE.md for detailed format examples.

## Visual Documentation

All skills have state diagrams in `diagram.html` files for visualizing workflows and decision points.

**Structure:** `diagram.html` (embedded Mermaid) + `shared/css/diagram.css` (universal styles). No separate .mmd files.

> **Note:** For diagram types, viewing instructions, editing guide, and color coding, see [Visual Documentation](README.md#-visual-documentation) in README.md.

### Available Skills

**24 skills in 5 categories:** Pre-Planning (5), Planning (6), Execution (6), Validation (2), Documentation (2), Testing & Quality (3)

**Indexing:** 00 = orchestrator, 10-50 = story coordinators, 1X-5X = workers.

**Key skills:**
- **ln-61-docs-creator** - Create project documentation (requirements, architecture, technical specs) before coding
- **ln-70-epic-creator** → **ln-71-story-manager** → **ln-10-story-decomposer** - Decompose scope into executable tasks
- **ln-00-story-pipeline** - Full pipeline automation: task planning → verification → execution → review → Done
- **ln-30-story-executor** - Orchestrate task execution with auto-review invocation
- **ln-20-story-validator** - Auto-fix Stories/Tasks against 15 industry standard criteria
- **ln-40-story-quality-gate** - Two-pass review with Early Exit Pattern (Code Quality → Regression → Manual Testing)

> **Note:** Complete skill list with descriptions and versions in README.md feature tables.

## Key Concepts

### Task Hierarchy
- **Epic** (Linear Project) → **User Story** (Linear Issue with label "user-story", parentId=null) → **Task** (Linear Issue with parentId=Story ID)

> **Note:** See [Task Hierarchy](README.md#-key-concepts) in README.md for visual representation.

### Configuration Auto-Discovery
All skills automatically find settings from `docs/tasks/kanban_board.md`:
- **Team ID** - from Linear Configuration table
- **Next Epic Number** - from Linear Configuration table
- **Next Story Number** - from Epic Story Counters table

**How to create:** Use ln-61-docs-creator skill (Phase 9-10) to generate kanban_board.md (Phase 9) and optionally HTML presentation (Phase 10).

**Important:** If file is missing, skills request data directly from user.

### Kanban Board Structure

`docs/tasks/kanban_board.md` uses **hierarchical format** for task tracking (Status → Epic → Story → Tasks):

**Sections:** Backlog → Todo (✅ APPROVED) → In Progress → To Review → To Rework → Done (Last 5 tasks)

**Format:**
```markdown
**Epic N: Epic Title**
  📖 [LINEAR_ID: USXXX Story Title](link) ✅ APPROVED
    - [LINEAR_ID: EP#_## Task Title](link)
```

**Key Rules:** Epic → Story (📖, 2-space indent) → Tasks (-, 4-space indent). ✅ APPROVED marker added by ln-20-story-validator. Stories without tasks only in Backlog. Done section: max 5 tasks.

> **Note:** For complete format details, Epics Overview section, and visual representation, see kanban_board.md structure in README.md.

### Linear Integration
All skills use Linear MCP to create/update tasks:
- `mcp__linear-server__create_project()` - for Epics
- `mcp__linear-server__create_issue()` - for Stories and Tasks
- `mcp__linear-server__update_issue()` - for status and description updates

Linear API reference located in `ln-70-epic-creator/references/linear_integration.md`.

### Development Principles

**Hierarchy (when conflicts):** 1) Industry Standards & RFCs → 2) Security Standards (OWASP, NIST) → 3) Development Principles (KISS/YAGNI/DRY apply WITHIN standard boundaries).

**Core:** Standards First, YAGNI, KISS, DRY, Consumer-First, Task Granularity (3-5h optimal, Story max 6 tasks), Value-Based Testing (2-5 E2E, 3-8 Integration, 5-15 Unit, Priority ≥15), No Legacy Code (remove backward compat shims).

> **Note:** Full principles with rationales in [Development Principles](README.md#-key-concepts) in README.md.

### Task Templates

**Epic:** ln-70-epic-creator/references/epic_template_universal.md (Goal, Scope, Success Criteria, Risks, Phases)

**Story:** ln-71-story-manager/references/story_template_universal.md (8 sections: Statement, Context, AC, Test Strategy, Implementation Tasks, Technical Notes + Library Research, DoD)

**Task:** ln-11-task-creator/references/task_template_implementation.md (7 sections: Context, Implementation Plan, Technical Approach, AC, Affected Components, Existing Code Impact, DoD)

**Story Finalizer Test Task:** ln-50-story-test-planner/references/test_task_template.md (11 sections: Context, Risk Matrix, E2E/Integration/Unit tests, Coverage, DoD, Test Fixes, Infra, Docs, Cleanup)

**Verification Checklist:** ln-20-story-validator/references/verification_checklist.md

### DAG Documentation Support

**All documentation skills support Directed Acyclic Graph (DAG) structure:**

- **SCOPE Tags** - HTML comments defining document boundaries (what IS/IS NOT in scope), redirect out-of-scope content
- **Maintenance Sections** - Update Triggers, Verification, Last Updated (in all generated docs)
- **README Hub** - Central navigation (`docs/project/README.md`)

**Supported skills:** ln-61-docs-creator v5.5.0, ln-62-html-builder v2.3.1, ln-60-docs-system v1.0.2, ln-63-docs-updater v2.0.0, ln-22-adr-creator v4.0.0, ln-21-guide-creator v4.0.0, ln-23-manual-creator v1.1.0

> **Note:** Full DAG structure details and example SCOPE tags in README.md.

## Decomposition Workflow

Three levels of decomposition, each with automatic CREATE/REPLAN mode:

| Level | Skill | Input | Output | Mode Selection |
|-------|-------|-------|--------|----------------|
| **1** | ln-70-epic-creator | Scope/initiative | 3-7 Epics | Batch Mode only |
| **2** | ln-71-story-manager | Epic number | 5-10 Stories | Auto (builds IDEAL → checks existing → CREATE/REPLAN) |
| **3** | ln-10-story-decomposer | Story number | 1-6 Implementation tasks | Auto (builds IDEAL → checks existing → CREATE/REPLAN) |

**Workflow:** Scope → Epics (ln-70-epic-creator) → Stories (ln-71-story-manager with Phase 0 Library Research) → Implementation Tasks (ln-10-story-decomposer) → Test Task (ln-50-story-test-planner after manual testing)

> **Note:** Complete flow example and optimal counts by complexity in README.md. All use Decompose-First Pattern.

## Skill Workflows

Detailed workflows are documented in each skill's SKILL.md file. Quick reference:

| Skill | Purpose | Key Phases | Details |
|-------|---------|-----------|---------|
| ln-70-epic-creator | Create 3-7 Epics from scope | Discovery → Analysis → Sequential Loop | [SKILL.md](ln-70-epic-creator/SKILL.md) |
| ln-71-story-manager | Create/replan Stories | Phase 0 Research → IDEAL Plan → CREATE/REPLAN | [SKILL.md](ln-71-story-manager/SKILL.md) |
| ln-10-story-decomposer | Create/replan implementation tasks | Analysis → IDEAL Plan → CREATE/REPLAN | [SKILL.md](ln-10-story-decomposer/SKILL.md) |
| ln-50-story-test-planner | Plan test task after manual testing | Risk Assessment → Impact Analysis → Delegation | [SKILL.md](ln-50-story-test-planner/SKILL.md) |
| ln-31-task-executor | Execute implementation tasks | Read guides → Implement → Quality gates | [SKILL.md](ln-31-task-executor/SKILL.md) |
| ln-34-test-executor | Execute Story Finalizer test tasks | 6 steps: Fix tests → New tests → Infra → Docs → Cleanup → Verify | [SKILL.md](ln-34-test-executor/SKILL.md) |
| ln-32-task-reviewer | Review tasks | Load task + diffs → Checklist → Accept/Fixes/Rework | [SKILL.md](ln-32-task-reviewer/SKILL.md) |
| ln-33-task-rework | Fix tasks after review | Load feedback → Fix → Quality gates → Submit | [SKILL.md](ln-33-task-rework/SKILL.md) |
| ln-20-story-validator | Auto-fix and approve Stories | Discovery → Guide creation → 15 auto-fixes → Approve | [SKILL.md](ln-20-story-validator/SKILL.md) |
| ln-30-story-executor | Orchestrate Story execution | Load tasks → Priority loop (Review/Rework/Execute) → Auto-invoke reviewer | [SKILL.md](ln-30-story-executor/SKILL.md) |
| ln-40-story-quality-gate | Two-pass Story review | Pass 1: Testing + Quality → Test/Refactor task. Pass 2: Verify → Done | [SKILL.md](ln-40-story-quality-gate/SKILL.md) |

> **Note:** All workflows follow Orchestrator-Worker Pattern. See [SKILL_ARCHITECTURE_GUIDE.md](docs/SKILL_ARCHITECTURE_GUIDE.md) for architectural principles.

## Important Details

### Structural Validation of Stories and Tasks (checklist #0a + #0b)
ln-20-story-validator checks compliance with Story and Task templates, and automatically fixes:
- **Story (#0a):** Verifies 8 Story sections per story_template_universal.md (including Test Strategy)
- **Tasks (#0b):** Sequential validation - verifies 7 sections for EACH Task one by one per task_template_universal.md (including Existing Code Impact)
- **Performance:** Loads task metadata first (Phase 2), then fetches full description for ONE task at a time (Phase 4 step 2) to avoid token waste and truncation
- Adds missing sections with placeholders, reorders sections to match template
- Updates Story + each Task in Linear via `mcp__linear-server__update_issue()`
- Skips fix for Done/Canceled objects and objects older than 30 days

### Testing and Documentation

**Tests:** All tests (E2E/Integration/Unit) in Story's final test task. Value-Based Testing: 2-5 E2E, 3-8 Integration, 5-15 Unit per Story (10-28 total max). Priority ≥15 scenarios MUST be tested. See [risk_based_testing_guide.md](ln-50-story-test-planner/references/risk_based_testing_guide.md) for full methodology.

**Temporary Scripts:** `scripts/tmp_[story_id].sh` - Created by ln-40-story-quality-gate Pass 1, deleted by ln-34-test-executor Step 6.

**Documentation:** ALWAYS integrated in the same task (NOT separate tasks). Ensures atomicity and relevance.

### Code Comments (ln-31-task-executor)
15-20% ratio. Explain WHY (reasoning), not WHAT. NO Epic/Task IDs, NO historical notes, NO code examples. Only critical technical details (DB optimizations, API quirks, constraints).

### Guide Auto-Creation (ln-20-story-validator Phase 3)
Auto-creates missing guides via ln-21-guide-creator before approval. Links in Story Technical Notes.

### Documentation Language
**All documentation in this repository MUST be in English** (SKILL.md, templates, comments, README, generated docs).

**Exception:** Stories and Tasks in Linear can be English/Russian. ln-20-story-validator ALWAYS preserves original language - DO NOT translate.

### Sequential Numbering

**Rule:** Phases/Sections/Steps: 1, 2, 3, 4 (NOT 1, 1.5, 2). Questions: Q1, Q2, Q3 (NOT Q1, Q1.5, Q2). **If inserting:** Renumber all subsequent items.

**Exceptions:**

| Case | Format | Example | When Valid |
|------|--------|---------|------------|
| **Conditional Branching** | Letter suffixes | Phase 4a (CREATE), Phase 4b (REPLAN), Phase 5 | Mutually exclusive paths (if-else, EITHER A OR B) |
| **Loop Internals** | Steps inside Phase | Phase 3: Loop → Step 1 → Step 2 → Step 3 → Repeat | Cyclic workflows with repeated sub-steps |

## Working with Skill Files

### SKILL.md Metadata
Each SKILL.md starts with YAML frontmatter:
```yaml
---
name: skill-name
description: Short description for Claude Code skill selector
---
```

### Reference Files
Stored in `{skill}/references/` and used by skill for:
- Document templates (epic_template_universal.md, story_template_universal.md, task_template_universal.md, test_task_template.md)
- Integration guides (linear_integration.md)
- Checklists (verification_checklist.md)
- Structure templates (guide_template.md)

## Skill Output Formatting

### Chat Prefixes
Skills use emoji prefixes in chat output for visual differentiation when orchestrated:
- ⚙️ [EXECUTOR] - ln-31-task-executor (implementation tasks), ln-34-test-executor (Story Finalizer test tasks)
- 🔍 [REVIEWER] - ln-32-task-reviewer (task reviews)

**Purpose:** Helps users track which agent/skill is working when multiple skills are invoked via Skill tool.

## Versioning

All skills and templates have versions and last update dates at end of file:
```
**Version:** X.Y.Z
**Last Updated:** YYYY-MM-DD
```

**IMPORTANT:** Do NOT add **Changes:** section in SKILL.md files and here. Git history tracks all changes.

## Maintenance After Changes

**When making changes to skills, ALWAYS update these files:**

1. **Update skill version** in `{skill}/SKILL.md` (at end of file)
2. **Update version in CLAUDE.md** in "Available Skills" section (lines 95-122)
3. **Update version in README.md** in feature tables (lines 30-70)
4. **Update CHANGELOG.md** with changes following [Keep a Changelog](https://keepachangelog.com/) format:
   - Add new version section `## [X.Y.Z] - YYYY-MM-DD`
   - Categorize changes: Added / Changed / Deprecated / Removed / Fixed / Security
   - Be specific: skill names, version changes, key features
5. **Update Last Updated date** in CLAUDE.md (below)

**Example CHANGELOG entry:**
```markdown
## [1.0.1] - 2025-11-12

### Changed
- **ln-30-story-executor v2.6.0 → v3.0.0** - Critical task loading rules, automatic loop restart
```

**Last Updated:** 2025-11-15
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository

This is a collection of skills for Claude Code, integrated with Linear for Agile-style task management.

## Skill Structure

All skills follow a unified structure:
- `SKILL.md` - Main skill file with metadata (frontmatter YAML) and description
- `references/` - Reference templates and guides used by the skill

**Template Ownership Principle:**
- Each skill owns its templates in its own `references/` directory (Single Source of Truth)
- Templates are NOT copied to project during setup
- Skills use templates directly from their `references/` when generating documents
- Example: x-adr-creator uses `x-adr-creator/references/adr_template.md` when creating ADRs
- Example: x-guide-creator uses `x-guide-creator/references/guide_template.md` when creating guides

## Visual Documentation

All skills have **state diagrams** for visualizing workflows, decision points, and state transitions.

### Diagram Files

Each skill directory contains:
- `diagram.mmd` - Mermaid source file (text-based, git-friendly, editable)
- `diagram.html` - Standalone HTML file for viewing diagram in browser

### Diagram Format

**Mermaid** (https://mermaid.js.org/) - chosen for:
- ✅ Git-friendly (text format, easy diffs)
- ✅ Native GitHub/GitLab rendering
- ✅ Easy to edit and maintain
- ✅ Can convert to PNG/SVG if needed

### Diagram Types by Workflow

**1. Linear Workflows** (`graph TD` - sequential phases):
- x-docs-creator, x-html-builder, x-docs-system, x-docs-updater
- x-adr-creator, x-guide-creator
- x-task-rework, x-test-executor

**2. State Machine Workflows** (`stateDiagram-v2` or `graph TD` with states):
- x-task-executor (Todo → In Progress → To Review)
- x-test-executor (Todo → In Progress → To Review)
- x-task-rework (To Rework → In Progress → To Review)

**3. Branching Workflows** (`graph TD` with decision nodes):
- x-task-reviewer (3 verdicts: Accept/Minor Fixes/Needs Rework)
- x-story-reviewer (Two-pass: Pass 1 Path A/B, Pass 2 Pass/Fail)
- x-story-creator (Single/Batch Mode)
- x-task-manager (Decompose → Check existing → Create/Replan)
- x-story-finalizer (Risk-Based Testing: Priority ≥15 decision tree)

**4. Looping Workflows** (`graph TD` with loop-back arrows):
- x-story-executor (Priority 1/2/3 → reload → re-evaluate)
- x-epic-creator (FOR EACH domain → sequential loop)

**5. Single-Path Auto-Fix** (`graph TD` linear, no branching):
- x-story-verifier (ALWAYS approve after 16 auto-fixes)

### Color Coding

Standard colors across all diagrams:
- **Discovery/Preparation:** `#E3F2FD` (light blue) - initial setup phases
- **Loop/Processing:** `#FFF9C4` (light yellow) - active work, iterations
- **Decision Points:** `#FFE0B2` (light orange) - conditional branches, choices
- **Actions/Updates:** `#C8E6C9` (light green) - state changes, updates
- **Critical/Stop:** `#FFCDD2` (light red) - stop conditions, critical rules

### How to View Diagrams

**Option 1: HTML file (easiest)**
- Double-click `diagram.html` in skill folder
- Opens in default browser with rendered diagram

**Option 2: Online editor**
- Copy `diagram.mmd` content
- Paste into https://mermaid.live/
- View/edit/export as PNG/SVG

**Option 3: VS Code**
- Install extension: "Markdown Preview Mermaid Support"
- Open `diagram.mmd`
- Press `Ctrl+Shift+V` for preview

**Option 4: GitHub/GitLab**
- View `.mmd` files directly in repository
- Diagrams render automatically in markdown

### Available Skills

**Pre-Planning:**
1. `x-docs-creator/` - Create comprehensive project documentation BEFORE development begins. Generates 4 MD documents (requirements, architecture, technical specs, README hub) + creates ADR directory structure + optional kanban_board.md + optional HTML presentation (via Phase 10 x-html-builder invocation). Universal for any IT project. **Use FIRST before x-epic-creator.** (v5.5.0)
2. `x-html-builder/` - Build interactive HTML presentation from project documentation. Template Ownership: all HTML/CSS/JS templates in references/ directory (12 files). 6 tabs: Overview (landing), Requirements (FRs/NFRs/ADRs), Architecture (C4 diagrams), Technical Spec (API/data/infra), Roadmap (Kanban-style epic progress), Guides (how-to). Uses Diátaxis framework. SCOPE tags for each tab. Use AFTER x-docs-creator or invoked automatically in Phase 10. (v2.3.1)
3. `x-docs-system/` - Orchestrator that creates complete documentation system (MD docs + HTML presentation) in one command. Invokes x-docs-creator and x-html-builder. (v1.0.2)
4. `x-docs-updater/` - Update existing project documentation based on code changes. Scans git diff and updates affected sections. Preserves existing content. (v2.0.0 with SCOPE tag validation)
5. `x-adr-creator/` - Create minimal Architecture Decision Records (ADRs) through 5-question dialog. Categorizes as Strategic (business, patterns) or Technical (frameworks, infra). Nygard format with 7 sections (~300-500 words). Use after x-docs-creator creates project structure. (v3.0.0)

**Planning:**
6. `x-epic-creator/` - Decompose scope/initiative into 3-7 Epics (Linear Projects) through interactive dialog. Batch Mode only. (v3.0.0)
7. `x-story-manager/` - Universal Story operations (create/replan) with automatic Epic decomposition. Analyzes Epic, builds IDEAL Story plan (5-10 Stories), then creates or replans existing Stories (KEEP/UPDATE/OBSOLETE/CREATE). Decompose-First Pattern with Epic extraction (parse Epic structure, ask user only for gaps). (v7.0.0)
8. `x-task-manager/` - Universal task operations (create/replan) with automatic Story decomposition. Analyzes Story, builds optimal task plan (1-6 tasks), then creates or replans existing tasks (KEEP/UPDATE/OBSOLETE/CREATE). Decompose-First Pattern. Reads guide links from Story Technical Notes. (v5.0.0)
9. `x-story-finalizer/` - Create final Story task after manual testing passes. Invoked by x-story-reviewer Pass 1. Generates comprehensive task with 11 sections: tests (E2E-first Risk-Based), existing test fixes, infrastructure updates, documentation updates, legacy code cleanup (NO dialog). **Excludes performance/load testing** (see x-story-finalizer/references/risk_based_testing_guide.md)

**Execution:**
10. `x-story-executor/` - Orchestrate Story execution (Todo/In Progress → ready for x-story-reviewer). Prioritizes To Review → To Rework → Todo. Invokes x-task-reviewer, x-task-rework, x-task-executor, x-test-executor. Loads task metadata only, delegates full loading to executors/reviewers. (v2.2.0)
11. `x-task-executor/` - ⚙️ Execute implementation tasks ONLY (Todo → In Progress → To Review). KISS/YAGNI principles. Reads guide links from Task Technical Approach. NOT for test tasks. Chat output prefix: ⚙️ [EXECUTOR]. (v8.0.0)
12. `x-test-executor/` - ⚙️ Execute Story Finalizer test tasks from x-story-finalizer (Todo → In Progress → To Review). E2E-first Risk-Based Testing (2-5 E2E, 3-8 Integration, 5-15 Unit, 10-28 total, Priority ≥15). Includes Fix Existing Tests (Section 8), Infrastructure Updates (Section 9), Documentation Updates (Section 10), Legacy Code Cleanup (Section 11). **USE THIS for test tasks from x-story-finalizer.** Chat output prefix: ⚙️ [EXECUTOR]. (v4.0.0)
13. `x-task-reviewer/` - 🔍 Review tasks (To Review → Done/Rework) distinguishing test/implementation. Chat output prefix: 🔍 [REVIEWER]. (v7.1.0)
14. `x-task-rework/` - Fix tasks after review (To Rework → In Progress → To Review)

**Validation:**
15. `x-story-verifier/` - **Auto-fix and approve** Stories (8 sections) and their Tasks (7 sections) against industry standards and best practices before approval (Backlog → Todo). **ALWAYS auto-fixes all 15 verification criteria** (including Industry Standards Compliance) - no "Needs Work" path exists. Checks RFC/protocol compliance BEFORE applying KISS/YAGNI. Sequential task validation (loads metadata first, then full descriptions one by one). Auto-creates guides and inserts links in Story Technical Notes. Displays summary table (Story + Tasks + guides + warnings). (v9.1.0)
16. `x-story-reviewer/` - Two-pass review: Pass 1 (After impl tasks Done) → Manual testing + create test/refactoring task. Pass 2 (After test task Done) → Verify tests + Story Done

**Documentation:**
17. `x-guide-creator/` - **Research and create** minimal project guides (6 sections, 300-500 words). AUTO-RESEARCH via MCP Ref/Context7. NO ADR concepts. Returns guide path for linking. (v4.0.0 minimal format)

## Key Concepts

### Task Hierarchy
- **Epic** (Linear Project) → **User Story** (Linear Issue with label "user-story", parentId=null) → **Task** (Linear Issue with parentId=Story ID)

### Configuration Auto-Discovery
All skills automatically find settings from `docs/tasks/kanban_board.md`:
- **Team ID** - from Linear Configuration table
- **Next Epic Number** - from Linear Configuration table
- **Next Story Number** - from Epic Story Counters table

**How to create:** Use x-docs-creator skill (Phase 9-10) to generate kanban_board.md (Phase 9) and optionally HTML presentation (Phase 10).

**Important:** If file is missing, skills request data directly from user.

### Kanban Board Structure

`docs/tasks/kanban_board.md` uses **hierarchical format** for task tracking (Status → Epic → Story → Tasks):

**Work in Progress Sections:**
- `### Backlog` - Stories awaiting verification (with or without tasks)
- `### Todo` - Verified Stories ready to execute (✅ APPROVED marker)
- `### In Progress` - Stories being actively worked on
- `### To Review` - Tasks completed and awaiting review
- `### To Rework` - Tasks needing fixes after review
- `### Done (Last 5 tasks)` - Recently completed tasks (max 5, oldest removed)

**Format:**
```markdown
**Epic N: Epic Title**

  📖 [LINEAR_ID: USXXX Story Title](link)
    - [LINEAR_ID: EP#_## Task 1 Title](link)
    - [LINEAR_ID: EP#_## Task 2 Title](link)

  📖 [LINEAR_ID: USYYY Story Title](link) ✅ APPROVED
    - [LINEAR_ID: EP#_## Task 3 Title](link)
```

**Key Rules:**
- **Hierarchy preserved:** Epic header → Story (📖, 2-space indent) → Tasks (-, 4-space indent)
- **✅ APPROVED marker:** Added by x-story-verifier when Story moves Backlog → Todo
- **Stories without tasks:** Only allowed in Backlog section (placeholder `_(tasks not created yet)_`)
- **Done section:** Maximum 5 **tasks** (not Stories), oldest removed when exceeding limit
- **Epic grouping:** All work items grouped under Epic headers across all status sections

**Epics Overview Section:**
Tracks Epic status separately from work items:
```markdown
## Epics Overview

**Active:**
- [Epic 7: OAuth Authentication](link) - In Progress

**Completed:**
- [Epic 6: User Management](link) - Completed
```

### Linear Integration
All skills use Linear MCP to create/update tasks:
- `mcp__linear-server__create_project()` - for Epics
- `mcp__linear-server__create_issue()` - for Stories and Tasks
- `mcp__linear-server__update_issue()` - for status and description updates

Linear API reference located in `x-epic-creator/references/linear_integration.md`.

### Development Principles

**Hierarchy of Principles (when conflicts arise):**
1. **Industry Standards & RFCs** (OAuth 2.0, REST API design, OpenAPI, protocol standards)
2. **Security Standards** (OWASP Top 10, NIST guidelines)
3. **Development Principles** (KISS/YAGNI/DRY apply WITHIN standard boundaries)

**Core Principles:**
- **Standards First:** Follow industry standards (OAuth 2.0, REST, RFCs) before applying KISS/YAGNI. When KISS conflicts with standard → Standard wins. Rationale: Integration, security, maintainability > short-term simplicity.
- **YAGNI:** Do not add functionality ahead of time
- **KISS:** Simplest solution that works (within standard boundaries)
- **DRY:** Do not duplicate code
- **Consumer-First:** Consumer first (API endpoint), then provider (Repository)
- **Task Granularity:** Optimal task size 3-5 hours development time (atomic, testable units that fit in 1-2 work sessions with clear testing boundaries). Too small (< 3h) → combine with related work. Too large (> 8h) → decompose further. **Story limit: max 6 tasks (12-30 hours total)**. Rationale: Easy to estimate, track, and review; reduces scope creep and context switching.
- **Value-Based Testing:** Prioritize by business risk (money/security/data). Test critical paths, not coverage metrics. Limits: 2-5 E2E, 3-8 Integration, 5-15 Unit per Story (10-28 total max, all tests in Story's final task). **See:** x-story-finalizer/references/risk_based_testing_guide.md for complete methodology
- **No Legacy Code:** When refactoring existing code (identified in task's "Existing Code Impact" section), remove backward compatibility shims, workarounds, and deprecated patterns. Clean codebase > supporting old implementations. Rationale: Technical debt compounds; addressing it immediately prevents future maintenance burden.

### Task Templates

**Epic Template:** `x-epic-creator/references/epic_template_universal.md`
- Goal, Scope (In/Out), Success Criteria, Risks, Phases

**Story Template:** `x-story-creator/references/story_template_universal.md`
- 8 sections: Story statement (As a/I want/So that), Context, AC (Given-When-Then), Test Strategy, Implementation Tasks, Technical Notes, DoD

**Task Template:** `x-task-manager/references/task_template_universal.md`
- 7 required sections: Context, Implementation Plan, Technical Approach, AC, Affected Components, Existing Code Impact, DoD

**Story Finalizer Task Template:** `x-story-finalizer/references/test_task_template.md`
- 11 sections: Context, Risk Priority Matrix, E2E Tests (2-5 max), Integration Tests (3-8 max), Unit Tests (5-15 max), Critical Path Coverage, DoD, Existing Tests to Fix/Update, Infrastructure Changes, Documentation Updates, Legacy Code Cleanup

**Story Verification Checklist:** `x-story-verifier/references/verification_checklist.md`
- Checklist for verifying Stories and all their Tasks before approval

### DAG Documentation Support

**All documentation skills now support Directed Acyclic Graph (DAG) structure:**

**SCOPE Tags:**
- HTML comments in first 3-5 lines of each document
- Define document boundaries (what IS in scope, what IS NOT)
- Redirect out-of-scope content to correct documents
- Example: `<!-- SCOPE: Functional Requirements ONLY. DO NOT add: Implementation details → Technical_Specification.md -->`

**Maintenance Sections:**
- Present in all generated documents (requirements, architecture, technical specs, ADRs, guides)
- **Update Triggers**: When to update document (dependency changes, new features, schema changes)
- **Verification**: How to verify document is current (check versions, diagrams match code)
- **Last Updated**: Date tracking for document freshness

**README Hub:**
- Central navigation document (`docs/project/README.md`)
- Links to all core documents
- Quick links by role (developers, architects, product owners)
- Documentation structure overview

**Supported Skills (with versions):**
- `x-docs-creator` v5.5.0 - Generates docs with SCOPE tags + Maintenance + README hub + kanban_board.md + ADR directory structure
- `x-html-builder` v2.3.1 - Builds HTML presentation with 6 tabs (Overview, Requirements+ADRs, Architecture, Technical Spec, Roadmap Kanban, Guides). SCOPE tags for each tab
- `x-docs-system` v1.0.2 - Orchestrates full documentation system
- `x-docs-updater` v2.0.0 - Validates SCOPE tags when updating
- `x-adr-creator` v3.0.0 - Creates minimal ADRs with categorization (Strategic/Technical). 7 sections, 300-500 words, 5 questions, table format
- `x-guide-creator` v4.0.0 - Creates minimal guides (6 sections, 300-500 words, MCP Ref + Context7, NO ADR concepts)

## Decomposition Workflow

Creator skills support different decomposition approaches:

### x-epic-creator (Batch Mode Only)
- Always decomposes scope → 3-7 Epics
- Interactive dialog for each Epic
- Use when starting new initiative

### x-story-manager (Universal Auto-Decomposition)
- **No mode selection needed** - automatic decomposition with Epic extraction
- Always analyzes Epic and builds IDEAL Story plan (5-10 Stories)
- Then checks existing Stories:
  - No Stories → Create all from plan
  - Has Stories → Replan (KEEP/UPDATE/OBSOLETE/CREATE)
- Optimal Story count determined by Epic complexity:
  - Simple (1-3 features) → 3-5 Stories
  - Medium (4-7 features) → 6-8 Stories
  - Complex (8+ features) → 8-10 Stories
- Epic extraction: Parse Epic structure for Q1-Q6, ask user only for missing info

### x-task-manager (Universal Auto-Decomposition)
- **No mode selection needed** - automatic decomposition
- Always analyzes Story and builds IDEAL plan (1-6 tasks)
- Then checks existing tasks:
  - No tasks → Create all from plan
  - Has tasks → Replan (KEEP/UPDATE/OBSOLETE/CREATE)
- Optimal task count determined by Story complexity:
  - Simple (1-2 AC) → 1 task
  - Medium (3-4 AC) → 2-3 tasks
  - Complex (5+ AC) → 3-6 tasks
- Consumer-First ordering applied automatically

### Complete Decomposition Flow

**Full workflow** for breaking down scope into deliverable tasks:

1. **Scope → Epics** (x-epic-creator)
   - Input: Architectural requirement or business scope
   - Output: 3-7 Epics (logical domains/modules)
   - Example: "E-commerce platform" → "User Management", "Product Catalog", "Shopping Cart", "Payment", "Order Management"
   - **Note:** Always Batch Mode (no Single Mode)

2. **Epic → Stories** (x-story-manager)
   - Input: Epic number (e.g., Epic 7)
   - Output: 5-10 User Stories automatically decomposed based on Epic complexity
   - Automatically determines optimal count: Simple (1-3 features) → 3-5 Stories, Medium (4-7 features) → 6-8 Stories, Complex (8+ features) → 8-10 Stories
   - Example: "User Management Epic" → "Register user", "Login with email", "Reset password", "Update profile", "Manage sessions"
   - If Stories already exist → Replan mode (KEEP/UPDATE/OBSOLETE/CREATE)

3. **Story → Tasks** (x-task-manager)
   - Input: Story number (e.g., US004)
   - Output: 1-6 Implementation Tasks automatically decomposed based on Story complexity (test task created later by x-story-finalizer after manual testing)
   - Automatically determines optimal count: Simple (1-2 AC) → 1 task, Medium (3-4 AC) → 2-3 tasks, Complex (5+ AC) → 3-6 tasks
   - Example: "Login Story" → "Implement login endpoint" (4h), "Add session management" (3h), "Create login UI" (5h)
   - If tasks already exist → Replan mode (KEEP/UPDATE/OBSOLETE/CREATE)

**Result:** Complete hierarchy from scope to executable tasks with proper Linear parentId relationships.

**Key Differences:**
- **x-epic-creator:** Always Batch Mode (scope → 3-7 Epics)
- **x-story-manager:** Universal Auto-Decomposition (NO mode selection, automatic replan, Epic extraction)
- **x-task-manager:** Universal Auto-Decomposition (NO mode selection, automatic replan)

## Skill Workflows

### 1. Creating Epics (x-epic-creator)
1. **Discovery:** Auto-discover Team ID + Next Epic Number
2. **Scope Analysis:** Identify 3-7 logical domains from scope
3. **Sequential Processing (Loop):** For EACH domain one by one:
   - Ask 5 questions (goal, scope in/out, success criteria, risks)
   - Generate Epic markdown
   - Show preview
   - User types "confirm"
   - Create Linear Project
   - Update kanban_board.md (increment by 1)
   - Move to next domain

### 2. Managing Stories (x-story-manager)
1. **Discovery:** Auto-discover Team ID + Epic + Next Story Number
2. **Extract from Epic:** Parse Epic structure for Q1-Q6 (persona, capability, value, AC, app type)
3. **Gather Missing:** Ask user only for information not found in Epic
4. **Build IDEAL Plan:** Analyze Epic Scope → Build IDEAL Story plan (5-10 Stories)
5. **Check Existing:** Query Linear for existing Stories in Epic
6. **CREATE MODE** (if no Stories):
   - Generate Story documents (8 sections) from IDEAL plan
   - Show preview → User confirms → Create in Linear
7. **REPLAN MODE** (if Stories exist):
   - Load existing Stories
   - Compare IDEAL vs existing
   - Categorize operations (KEEP/UPDATE/OBSOLETE/CREATE)
   - Show replan summary with diffs → User confirms → Execute operations

### 3. Managing Tasks (x-task-manager)
1. **Discovery:** Auto-discover Team ID + Parent Story
2. **Analyze & Decompose (ALWAYS):**
   - Load Story (AC, Technical Notes)
   - Build IDEAL task plan (1-4 tasks, Consumer-First, 3-5 hours each)
   - Extract guide links
3. **Check Existing:** Query Linear for Story's child tasks
   - No tasks → Create Mode (generate + create all)
   - Has tasks → Replan Mode (compare + propose operations)
4. **Replan Mode:**
   - Load existing task descriptions
   - Compare ideal vs existing
   - Categorize: KEEP/UPDATE/OBSOLETE/CREATE
   - Show summary + diffs
   - Confirm → Execute (update/cancel/create)
5. **Create Mode:**
   - Generate task documents from ideal plan
   - Show preview
   - Confirm → Create all in Linear

### 4. Creating Story Finalizer Task (x-story-finalizer)
**Invoked by x-story-reviewer Pass 1 after manual testing PASSED**
1. **Discovery:** Auto-discover Team ID + Parent Story
2. **Load Manual Test Results:** Parse structured Linear comment (Format v1.0) with AC, Test Results by AC, Edge Cases, Error Handling, Integration
3. **Analysis:** Story + all Done implementation Tasks
4. **Risk-Based Test Planning:** Calculate Priority (Business Impact × Probability) for all scenarios → Select tests by Priority ≥15
5. **Impact Analysis:**
   - Existing Tests: Identify tests affected by logic changes
   - Infrastructure: Determine packages, Docker, configs to update
   - Documentation: Find docs requiring updates (README, tests/README, CHANGELOG)
   - Legacy Cleanup: Identify workarounds, backward compat, deprecated patterns to remove
6. **Generation:** Comprehensive story finalizer task (11 sections) with E2E (2-5), Integration (3-8), Unit (5-15), test fixes, infra, docs, cleanup
7. **Confirmation:** "confirm" → creates Linear Issue as Story's final task

### 5. Executing Implementation Task (x-task-executor)
**For implementation tasks ONLY (NOT test tasks):**

1. **Phase 1:** Read referenced guides from Task Technical Approach
2. **Preparation:** ⚙️ [EXECUTOR] Task loaded → Load task (Todo) → In Progress
3. **Implementation:** Follow task checkboxes, KISS/YAGNI principles, apply patterns from guides, address Existing Code Impact section
4. **Quality Gates:** Type checking, lint
5. **Handoff:** ⚙️ [EXECUTOR] Implementation complete. Quality gates passed. Ready for review. → Comment in Linear → In Progress → To Review

**For test tasks:** Use x-test-executor (see workflow 5a below)

### 5a. Executing Story Finalizer Test Task (x-test-executor)
**For Story Finalizer test tasks ONLY (created by x-story-finalizer, 11 sections):**

1. **Preparation:** ⚙️ [EXECUTOR] Story finalizer task loaded → Load task (Todo) → In Progress
2. **Implementation (6 steps):**
   - **Step 1:** Fix existing tests (Section 8) - update tests affected by logic changes
   - **Step 2:** Implement new tests E2E→Integration→Unit (Sections 3-5) - Priority ≥15, 2-5 E2E, 3-8 Integration, 5-15 Unit
   - **Step 3:** Update infrastructure (Section 9) - package.json, Docker, configs
   - **Step 4:** Update documentation (Section 10) - README, tests/README, CHANGELOG
   - **Step 5:** Cleanup legacy code (Section 11) - workarounds, backward compat, deprecated patterns
   - **Step 6:** Final verification - all tests pass, infra works, docs complete
3. **Quality Gates:** Type checking, lint, all existing tests pass, all new tests pass (10-28 total), all Priority ≥15 scenarios tested, infrastructure works, documentation complete, legacy cleanup safe
4. **Handoff:** ⚙️ [EXECUTOR] Story finalizer task complete. 6 steps executed. All quality gates passed. Ready for review. → Comment in Linear → In Progress → To Review

### 6. Reviewing Task (x-task-reviewer)
1. **Preparation:** 🔍 [REVIEWER] Review started → Load task (To Review) + diffs
2. **Review Checklist:** Architecture, Docs, Security, Quality (for test tasks: + Tests, Priority ≥15 scenarios, test limits 10-28)
3. **Verdict:**
   - Accept ✅ → 🔍 [REVIEWER] Approved → Done → Done
   - Minor Fixes 🔧 → 🔍 [REVIEWER] Minor fixes applied → Apply + Done
   - Needs Rework ❌ → 🔍 [REVIEWER] Needs rework → To Rework (with detailed feedback)

### 7. Reworking Task (x-task-rework)
1. **Preparation:** Load task (To Rework) + review feedback
2. **Implementation:** Fix Must-fix items
3. **Quality Gates:** Type checking, lint (for test tasks: + re-test, Priority ≥15 scenarios, test limits 10-28)
4. **Submit:** Comment with fixes description → To Review

### 8. Verifying Story (x-story-verifier)
1. **Discovery:** Auto-discover Team ID + project docs
2. **Story + Tasks Overview:** Parse Story from Linear + all child Tasks metadata (ID, title, status, labels - NO descriptions yet)
3. **Critical Solution Review:**
   - Check existing guides in `docs/guides/`
   - If guide missing → Auto-create via x-guide-creator (guide-creator researches best practices automatically)
   - Save guide paths for linking
4. **Comprehensive Auto-Fix (ALL 14 Verification Criteria):**
   - **#1-2:** Story structure (8 sections), Tasks structure (7 sections EACH Task sequentially)
   - **#3:** Story statement (As a/I want/So that format clarified)
   - **#4:** Acceptance Criteria (Given/When/Then format, 3-5 AC)
   - **#5:** Solution optimization (2025 best practices)
   - **#6:** Library & version (current stable versions)
   - **#7:** Test Strategy (Risk-Based Testing: 2-5 E2E, 3-8 Integration, 5-15 Unit, 10-28 total, Priority ≥15)
   - **#8:** Documentation integration (remove standalone doc tasks, integrate into implementation)
   - **#9:** Story size & task granularity (TODO placeholders if too large/small)
   - **#10:** YAGNI violations (move premature features to future scope)
   - **#11:** KISS violations (simplify over-engineered solutions)
   - **#12:** Guide Links Insertion (auto-created and existing guides in Story Technical Notes "Related Guides:")
   - **#13:** Consumer-First Principle (reorder tasks: Consumer → Service → Provider)
   - **#14:** Code Quality Fundamentals (TODO placeholders for hardcoded values, magic numbers)
5. **ALWAYS Approve → Todo:**
   - Update Story status to "Todo" in Linear
   - Update ALL child Tasks status to "Todo" in Linear
   - Update kanban_board.md (Story + all Tasks: Backlog → Todo)
   - Add approval comment with summary of fixes
   - Optional warning comment if TODO placeholders exist (user review needed but don't block execution)
6. **Summary Table:** Display verification summary (Story verdict ✅ ALWAYS Approved, changes, guides, warnings + Tasks table with changes and guide links)

**Important:** x-story-verifier ALWAYS preserves Story and Tasks language (EN/RU) when updating descriptions. **No "Needs Work" path exists - all issues auto-fixed before approval.**

### 9. Executing Story (x-story-executor)
1. **Discovery:** Auto-discover Team ID
2. **Story + Tasks Overview:** Load Story + Tasks metadata (ID, title, status, labels - NO descriptions)
3. **Orchestration Loop:**
   - **Priority 1:** Review tasks (To Review) → Invoke task-reviewer with task ID
   - **Priority 2:** Fix rework tasks (To Rework) → Invoke x-task-rework with task ID
   - **Priority 3:** Execute tasks (Todo) → Invoke x-task-executor with task ID
   - **After each skill completes:** Reload tasks metadata and re-evaluate priorities
4. **Story Status Management:**
   - Update Story Todo → In Progress on first task execution
   - When all tasks Done → Recommend x-story-reviewer Pass 1 (don't invoke automatically)

### 10. Reviewing Story (x-story-reviewer)
**Two-pass approach:**

**Pass 1: After Implementation Tasks Done (NO test task yet)**
1. **Manual Functional Testing:**
   - Setup environment (check if app running)
   - Test each Story AC using curl (API) or puppeteer (UI)
   - Document results: Main Scenarios (PASS/FAIL), Edge Cases, Error Handling, Integration
   - Add Linear comment with structured test results (Format v1.0: AC + Test Results + Edge Cases + Errors + Integration)
2. **Code Quality Analysis:**
   - Scan for DRY/KISS/YAGNI violations across impl tasks
   - Check architecture issues (layer violations, pattern adherence)
   - Verify guides followed correctly
3. **Verdict:**
   - **Path A:** All AC passed + no issues → Invoke x-story-finalizer (Skill tool)
   - **Path B:** Issues found → Create ONE refactoring task (all issues together)

**Pass 2: After Test Task Done (manual invocation by user)**
1. **Test Verification:**
   - All tests pass (E2E 2-5, Integration 3-8, Unit 5-15, total 10-28)
   - All Priority ≥15 scenarios tested
   - E2E cover all Story AC from manual testing
   - Tests focus on business logic
   - Infrastructure updated (package.json, Dockerfile, compose, README, tests/README.md)
2. **Verdict:**
   - **Pass:** Mark Story Done in Linear
   - **Fail:** Create fix tasks, Story remains current state

## Important Details

### Structural Validation of Stories and Tasks (checklist #0a + #0b)
x-story-verifier checks compliance with Story and Task templates, and automatically fixes:
- **Story (#0a):** Verifies 8 Story sections per story_template_universal.md (including Test Strategy)
- **Tasks (#0b):** Sequential validation - verifies 7 sections for EACH Task one by one per task_template_universal.md (including Existing Code Impact)
- **Performance:** Loads task metadata first (Phase 2), then fetches full description for ONE task at a time (Phase 4 step 2) to avoid token waste and truncation
- Adds missing sections with placeholders
- Reorders sections to match template
- Updates Story + each Task in Linear via `mcp__linear-server__update_issue()`
- Skips fix for Done/Canceled objects and objects older than 30 days

### Testing and Documentation

**Tests:**
- All tests (E2E/Integration/Unit) are in Story's final test task
- Implementation tasks do NOT contain tests
- Value-Based Testing: 2-5 E2E, 3-8 Integration, 5-15 Unit per Story (10-28 total max)
- "Test OUR code, not frameworks" - test only own business logic
- Prioritize by business risk: Priority ≥15 scenarios (money, security, core flows) MUST be tested
- Skip trivial code: Simple CRUD, framework code, getters/setters already covered by E2E
- **Performance/load testing:** Excluded from automated testing (requires dedicated infrastructure/tools)
- **Full methodology:** See x-story-finalizer/references/risk_based_testing_guide.md

**Documentation:**
- Documentation is ALWAYS integrated in the same task (NOT separate tasks)
- This ensures atomicity and documentation relevance

### Code Comments (x-task-executor)
- 15-20% comment-to-code ratio
- Explain WHY (reasoning), not WHAT (what code does)
- NO Epic/Task IDs, NO historical notes, NO code examples
- Only critical technical details (database query optimizations, API quirks, constraints)

### Guide Auto-Creation (x-story-verifier Phase 3)
Before approving Story, x-story-verifier:
1. Checks if guides exist in `docs/guides/` for all patterns/packages
2. If guide missing → Auto-creates via x-guide-creator (which researches best practices automatically)
3. Links auto-created guides in Story Technical Notes
- **Note:** x-guide-creator handles all research (MCP Ref, Context7, WebSearch) in its Phase 0

### Documentation Language
**All documentation in this repository MUST be in English**. This includes:
- All SKILL.md files
- All reference templates
- All code comments
- All README files
- All generated project documentation

**Exception:** Stories and Tasks in Linear can be in English or Russian. When updating in Linear (especially in x-story-verifier), ALWAYS preserve original language - DO NOT translate content.

### Sequential Numbering
**All numbering in documentation MUST be sequential without fractional numbers**:
- Phases: 1, 2, 3, 4, 5, 6 (NOT 1, 1.5, 2, 3...)
- Sections: 1, 2, 3, 4 (NOT 1, 1.5, 2, 2.5...)
- Steps: 1, 2, 3, 4 (NOT 1, 2, 2.5, 3...)
- Questions: Q1, Q2, Q3 (NOT Q1, Q1.5, Q2...)

**Rationale:** Sequential numbering ensures clear structure, easy navigation, and prevents confusion when referencing sections.

**If you need to insert content:** Renumber all subsequent items instead of using fractional numbers.

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
- ⚙️ [EXECUTOR] - x-task-executor (implementation tasks), x-test-executor (Story Finalizer test tasks)
- 🔍 [REVIEWER] - x-task-reviewer (task reviews)

**Purpose:** Helps users track which agent/skill is working when multiple skills are invoked via Skill tool.

## Versioning

All skills and templates have versions and last update dates at end of file:
```
**Version:** X.Y.Z
**Last Updated:** YYYY-MM-DD
```

**IMPORTANT:** Do NOT add **Changes:** section in SKILL.md files and here. Git history tracks all changes.

**Last Updated:** 2025-11-08
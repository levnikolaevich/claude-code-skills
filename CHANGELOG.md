# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

**IMPORTANT:** One version entry per date. Combine all daily changes under the highest version number for that date.

---

## [3.0.0] - 2025-11-14

### Added

- **L2→L2 Delegation Rules** in SKILL_ARCHITECTURE_GUIDE.md
  - 5 strict rules for Level 2 orchestrator delegation with industry precedents
  - Examples: AWS Step Functions, LangGraph Multi-Agent Supervisors, Microsoft Scheduler Agent
  - Documented in ln-story-coordinator and ln-story-quality-coordinator SKILL.md files

- **Story Status Responsibility Matrix** in 3 skills
  - Clear ownership for 4 Story status transitions (Backlog→Todo, Todo→In Progress, In Progress→To Review, To Review→Done)
  - Added to: ln-story-processor, ln-story-coordinator, ln-story-quality-coordinator
  - Prevents status conflicts between skills

- **autoApprove Mechanism for Pipeline Automation**
  - ln-task-creator v2.0.0 → v2.1.0: Skip user confirmation when `autoApprove: true`
  - ln-task-replanner v2.0.0 → v2.1.0: Skip user confirmation when `autoApprove: true`
  - ln-task-coordinator v7.0.0 → v7.1.0: Pass `autoApprove: true` to workers
  - Enables full end-to-end Story execution without manual intervention

- **IDEAL Plan Data Sources** in ln-task-coordinator
  - Explicit documentation of 6 data sources for building task plans
  - Sources: Story AC, Technical Notes, Context, Complexity Analysis, Consumer-First Principle, Guide Links
  - Improves transparency and consistency in task decomposition

- **Explicit Pass Parameter** in ln-story-quality-coordinator
  - Usage Examples section with manual invocation scenarios
  - Pass determination logic: explicit parameter (pass: 1|2) OR auto-detect from test task status
  - Supports both automatic and manual workflow control

### Changed (BREAKING)

- **ln-story-processor v1.1.0 → v2.0.0** - Removed < 3 tasks condition
  - Always invokes ln-task-coordinator regardless of task count
  - Ensures consistent task structure verification and optimization
  - Added Story Status Responsibility Matrix

- **ln-story-coordinator v5.0.0 → v6.0.0** - Removed Priority 0 (Backlog verification)
  - Simplified from 4 priorities to 3 (To Review, To Rework, Todo/In Progress)
  - ln-story-validator now handles all Backlog tasks independently
  - Eliminates circular dependency between coordinator and validator
  - Added Story Status Responsibility Matrix
  - Added L2→L2 Delegation documentation
  - Updated diagram.html to reflect 3 priorities

### Changed

- **ln-story-quality-coordinator v6.0.0 → v7.1.0** - Orchestrator-Worker Pattern refinement
  - Phase 3-5 now use compact delegation format (removed worker internals from orchestrator)
  - Eliminated duplicate documentation with worker SKILL.md files (-58% in Phase 3-5 sections)
  - Improved token efficiency (-46 lines total: Phase 3 -9, Phase 4 -12, Phase 5 -25)
  - Enhanced maintainability (worker changes no longer require orchestrator updates)
  - Follows SKILL_ARCHITECTURE_GUIDE.md Orchestrator-Worker responsibilities table

- **ln-test-coordinator v7.1.0 → v7.2.0** - Orchestrator-Worker Pattern refinement
  - Phase 2, 4, 5 use compact format (removed worker internals, reference guide instead)
  - Eliminated duplication with risk_based_testing_guide.md (-197 lines, -40%)
  - Phase 2: 33→8 lines (-76%), Phase 4: 84→11 lines (-87%), Phase 5: 110→15 lines (-86%)
  - Enhanced maintainability (algorithm changes in guide don't require orchestrator updates)

- **ln-docs-system v1.0.2 → v1.1.0** - Compact worker delegation format
  - Phase 2-3 simplified (-22 lines, -63%)
  - Removed internal worker phase descriptions
  - Focus on invocation, expected output, completion flow

- **ln-task-coordinator v7.1.0 → v7.2.0** - Simplified worker descriptions
  - Phase 4a/4b compact format (-24 lines, -80%)
  - Removed detailed bullet lists of worker internals
  - Reference worker SKILL.md for details

- **ln-story-quality-coordinator** - Enhanced documentation and workflow clarity
  - Clarified Phase 3-5 execute work directly (not via delegation)
  - Added L2→L2 Delegation section (invoked by ln-story-coordinator)
  - Added Story Status Responsibility Matrix
  - Added Usage Examples with explicit pass parameter

- **Documentation Optimization** - Progressive Disclosure Pattern applied to all skills
  - Optimized ln-task-replanner/SKILL.md (744→562 lines, -24.5%) - table format, inline arrows, concise terms
  - Optimized ln-task-creator/SKILL.md (656→497 lines, -24.2%) - table format, compact validation
  - Optimized 24 frontmatter descriptions (average -25-30%, all now < 200 chars)
  - Applied skill-creator compliance: third-person voice, specific WHAT + WHEN, clarity > brevity
  - Added docs/SKILL_ARCHITECTURE_GUIDE.md Advanced Documentation Principles (23 new principles from 2024-2025 industry sources)
  - Added shared/concise_terms.md vocabulary (57 verbose→concise replacement pairs)

**Rationale:** Full pipeline automation support, clear Status ownership, L2→L2 delegation with strict rules for complex workflows

---

## [1.14.0] - 2025-11-14

### Changed

- **ln-adr-creator v3.0.0 → v4.0.0** - Unified documentation structure
  - Changed path: `docs/project/adrs/` → `docs/adrs/` for consistency
  - All documentation now in `docs/` root (adrs/, guides/, manuals/)

- **ln-story-validator v10.0.0 → v11.0.0** - Integrated 3-type documentation system
  - **Phase 2**: Auto-detects 3 doc types via triggers
    - Guide: "pattern", "-ing" forms → HOW to implement (ln-guide-creator)
    - Manual: package+version → HOW to use library (ln-manual-creator)
    - ADR: "choose", "vs" → WHY we decided (ln-adr-creator)
  - **Auto-creates:** Guides + Manuals + ADRs via AUTO-RESEARCH (MCP Ref/Context7)
  - **Phase 3 #13**: Renamed "Guide Links" → "Documentation Links" (links all 3 types)
  - **Phase 4**: Approval comment includes guides/manuals/ADRs paths
  - **diagram.html**: Updated flowchart with 3 documentation branches
  - **Example:** "httpx 0.24.0" → auto-creates `docs/manuals/httpx-0.24.0.md`

- **ln-manual-creator v1.0.0 → v1.1.0** - Integration with ln-story-validator
  - Now auto-invoked when package+version detected in Story Technical Notes
  - Updated integration documentation (Phase 2 auto-invocation)
  - diagram.html: Changed "Manual invocation" → "Auto-invoked by ln-story-validator"

**Rationale:** Unified AUTO-RESEARCH approach for all 3 documentation types (Guide/Manual/ADR). Follows Orchestrator-Worker Pattern - ln-story-validator delegates to specialized Workers.

---

## [2.0.0] - 2025-11-14

### Changed (BREAKING)

**5 Skills Renamed with Semantic Suffixes (L2 Domain Orchestrators):**

| Old Name | New Name | Version | Suffix Rationale |
|----------|----------|---------|------------------|
| x-story-executor | **ln-story-coordinator** | v5.0.0 → v6.0.0 | Coordinates Story execution workflow |
| x-story-verifier | **ln-story-validator** | v10.0.0 → v11.0.0 | Validates against industry standards |
| x-story-reviewer | **ln-story-quality-coordinator** | v6.0.0 → v7.0.0 | Coordinates quality review workflow |
| x-task-planner | **ln-task-coordinator** | v7.0.0 → v8.0.0 | Coordinates task planning workflow |
| x-test-task-planner | **ln-test-coordinator** | v7.0.0 → v8.0.0 | Coordinates test planning workflow |

**Impact:** All 109+ references updated across SKILL.md files, CLAUDE.md, README.md, diagram.html files, SKILL_ARCHITECTURE_GUIDE.md

**Rationale:** Semantic naming clearly distinguishes Level 2 Domain Orchestrators from Level 3 Workers

**3-Level Hierarchy Architecture (Industry Standard Implementation):**

**Added to SKILL_ARCHITECTURE_GUIDE.md:**
- New section "3-Level Hierarchy (Industry Standard)" with Microsoft [Scheduler Agent Supervisor Pattern](https://learn.microsoft.com/azure/architecture/patterns/scheduler-agent-supervisor) reference
- Level 1 (Top Orchestrator): ln-story-processor - coordinates full lifecycle
- Level 2 (Domain Orchestrators): x-*-coordinator skills - coordinate specific domains
- Level 3 (Workers): x-*-executor/reviewer/creator - execute atomic work
- Table with roles, responsibilities, data loading strategy, examples

**Updated in SKILL_ARCHITECTURE_GUIDE.md:**
- Old "Orchestrator-Worker Pattern" section examples now show 3-level structure (was 2-level)
- Cross-reference added from old section to new "3-Level Hierarchy" section

**Rationale:** Documentation now matches actual implementation reality, validated against Microsoft Architecture Center best practices

**Progressive Loading Pattern for L2 Orchestrators:**

**ln-story-coordinator v5.0.0 → v6.0.0 (formerly x-story-executor):**
- **BREAKING:** Phase 2 now loads Story metadata ONLY (ID, title, status, labels - NO description)
- Rationale: Level 2 Orchestrator pattern, saves 5,000+ tokens
- Updated DoD checklist for metadata-only loading

**ln-story-validator v10.0.0 → v11.0.0 (formerly x-story-verifier):**
- **BREAKING:** Metadata-only loading in Phase 1 (overview/coordination)
- FULL Story description loaded in Phase 2 Step 1 when analysis begins
- Rationale: Progressive loading pattern - load FULL context only when execution starts

**ln-story-quality-coordinator v6.0.0 → v7.0.0 (formerly x-story-reviewer):**
- **BREAKING:** Metadata-only loading in Phase 2 (preparation/coordination)
- FULL Story + Tasks descriptions loaded in Phase 3 Step 1-2 when analysis begins
- Rationale: Progressive loading pattern - orchestrators coordinate with metadata, workers execute with FULL data

**Impact:** 15,000+ token savings across typical Story workflow, scalable to Stories with many tasks

**Explicit Delegation Terminology:**

**ln-story-quality-coordinator Pass 2 Invocation:**
- **BREAKING:** Removed "Skip to Pass 2" auto-invocation logic from Pass 1
- Changed "auto-invoke" → "explicit delegation" throughout documentation
- ln-story-coordinator now explicitly delegates Pass 2 via Skill tool (orchestrator→orchestrator)
- Rationale: Clarifies that Skill tool calls are acceptable architectural pattern, internal auto-transitions are not

**ln-story-processor v1.1.0 → v2.0.0:**
- Updated terminology: "auto-invokes" → "explicitly delegates" for Pass 1 and Pass 2
- Clarified full pipeline automation via explicit delegation, not internal auto-transitions

**ln-story-coordinator v5.0.0 → v6.0.0:**
- Updated Phase 4 documentation: "Explicit delegation" to ln-story-quality-coordinator Pass 2
- Removed ambiguous "auto-invoke" terminology

### Architecture

**Validator vs Verifier Terminology Clarification:**
- **Validation** = checking against defined rules/standards (ln-story-validator)
- **Verification** = checking correctness/completeness (not used as skill suffix)
- Rationale: "validator" better reflects systematic standards compliance checking

**Microsoft Scheduler Agent Supervisor Pattern Implementation:**
- Scheduler (L1): ln-story-processor arranges workflow steps
- Agents (L2): x-*-coordinator skills encapsulate domain workflows
- Workers (L3): x-*-executor/reviewer skills execute atomic operations
- Minimizes Coordination: Metadata-only loading at L1+L2, FULL descriptions at L3

### Documentation

**All Changed Skills:**
- Updated frontmatter in 5 renamed SKILL.md files
- Updated version numbers to reflect BREAKING changes
- Updated CLAUDE.md Available Skills section with new names and versions
- Updated README.md skill tables with new names and versions
- Updated Last Updated dates to 2025-11-14

**SKILL_ARCHITECTURE_GUIDE.md v1.1.0 → v2.0.0:**
- Added 3-Level Hierarchy section (35 lines)
- Updated Orchestrator-Worker Pattern section to show 3 levels
- Added Microsoft Architecture Center pattern reference

### Summary

**Problem Solved:** Fixed critical architectural inconsistencies:
1. ✅ Documentation described 2-level model, implementation had 3 levels → Now documented as 3-level hierarchy with industry pattern reference
2. ✅ Skills misclassified as "workers" but calling other skills → Reclassified as Level 2 Domain Orchestrators with semantic naming
3. ✅ L2 orchestrators loading FULL descriptions → Now progressive loading (metadata → execution phases → FULL)
4. ✅ Ambiguous "auto-invoke" terminology → Clarified as "explicit delegation" via Skill tool

**Result:** Architecture now validated against Microsoft Scheduler Agent Supervisor Pattern with clear 3-level hierarchy, semantic naming, and progressive loading strategy.

---

## [1.14.0] - 2025-11-14

### Added

**Writing Guidelines (Progressive Disclosure Pattern):**
- Added new section to SKILL_ARCHITECTURE_GUIDE.md (after intro, before Table of Contents)
- Added new section to CLAUDE.md (after Repository intro, before Visual Documentation)
- **Structure Format table:** 8 content types with format rules (Comparisons, Criteria, Decision Trees, Examples, References, Workflows, Lists, Key Takeaways)
- **When Verbose Content Is Justified:** 3 cases (Anti-patterns, Educational workflows, Common pitfalls) with emoji markers (❌ 🎓 ⚠️)
- **Compression targets:** CLAUDE.md ~250 lines, SKILL_ARCHITECTURE_GUIDE.md ~500 lines, SKILL.md < 800 lines
- **Rationale:** Prevent future documentation bloat - write compactly from start, not after compression
- **Cross-references:** CLAUDE.md links to SKILL_ARCHITECTURE_GUIDE.md for detailed format examples

**ln-story-processor v1.0.0 - NEW Story Processing Orchestrator:**
- Complete Story processing workflow orchestrator from task planning to completion
- **Phase 1:** Discovery (Team ID + Story ID from request, metadata-only loading)
- **Phase 2:** Task Planning (delegates to x-task-planner if count < 3)
- **Phase 3:** Looping Workflow (Verify → Execute → Review Pass 1) until Story status = "To Review"
- **Phase 4:** Final Review Handoff (user manually invokes x-story-reviewer Pass 2)
- **Pattern:** Looping Workflow (Pattern 4 from SKILL_ARCHITECTURE_GUIDE.md)
- **Chat Prefix:** 🔄 [PROCESSOR]
- **Integration:** Added to CLAUDE.md as skill #12 (Execution section), README.md (Execution Skills table), total skills: 22 → 23

**risk_based_testing_examples.md:**
- New reference file (173 lines) with detailed examples of applying Minimum Viable Testing philosophy to real Stories
- Contains 3 examples: User Login Story (3 tests), Product Search Story (2 tests), Payment Processing Story (5 tests)
- Demonstrates what to test (OUR business logic) vs what to skip (library/framework/database behavior)

### Changed (BREAKING)

**x-story-reviewer v5.0.0 → v6.0.0 - Early Exit Pattern Implementation:**
- **BREAKING:** Reordered Pass 1 phases to Code Quality → Regression → Manual Testing (was: Regression → Manual → Code Quality)
- **Early Exit Pattern:** Each Pass 1 phase now fails fast and stops execution immediately when issues found
  - Phase 3: Code Quality Analysis (FAIL FAST FIRST) - if critical issues → create refactoring task, STOP Pass 1
  - Phase 4: Regression Check (FAIL FAST SECOND) - if tests fail → create fix task, STOP Pass 1
  - Phase 5: Manual Testing (FAIL FAST THIRD) - if AC fail → create fix task, STOP Pass 1
- **Rationale:** Prevents wasting time running tests on fundamentally flawed code
- **Impact:** Reduces average review time by catching critical issues earlier
- Updated diagram.html to show early exit decision nodes after each phase

**x-story-executor v3.4.0 → v5.0.0 - Priority 0 Auto-Verify + Auto Pass 2 + Orchestrator-Worker Pattern:**
- **BREAKING:** Added Priority 0 (Backlog) for auto-verifying new tasks before execution
- **Priority Order:** 🟣 Backlog (NEW!) → 🔴 To Review → 🟡 To Rework → 🟢 Todo
- **Priority 0 Logic:** When tasks in Backlog → auto-invoke x-story-verifier (Backlog → Todo) → loop back to Phase 3
- **Auto Pass 2:** When test task Done → Update Story (In Progress → To Review) → Auto-invoke x-story-reviewer Pass 2 → Story Done
- **Full Automation:** Complete Story lifecycle now fully automated (Todo → In Progress → To Review → Done) without manual intervention
- **Self-Healing:** New tasks (test/fix/refactor) created by Pass 1 auto-verified and executed automatically
- **Phase 4 Refactored:** From 6-step quality pipeline to single delegation step (invokes x-story-reviewer Pass 1 via Skill tool)
- **Eliminated 100% duplication** between x-story-executor Phase 4 and x-story-reviewer Pass 1
- **Orchestrator Pattern:** Task-level orchestration (Phase 3), delegates Story-level quality to worker (Phase 4)
- Reduced SKILL.md from 470 to ~360 lines (-23%) by removing duplicated quality gate implementations
- Fixed ASCII diagram, Priority 3 logic, DoD checklist

**ln-story-processor v1.0.0 → v1.1.0 - Full Pipeline Automation:**
- Exit condition from "Story To Review" → "Story Done" (reflects x-story-executor auto Pass 2)
- Updated Flow: Phase 3 now shows x-story-executor auto-verifies new tasks (Priority 0) and auto-invokes Pass 2
- Phase 4: Changed from "Final Review Handoff (manual Pass 2)" → "Completion Report (Story Done automatically)"

**x-task-planner v6.1.0 → v7.0.0 - Renamed from x-task-manager:**
- **BREAKING CHANGE:** Directory renamed `x-task-manager/` → `x-task-planner/`
- **Rationale:** "planner" better reflects orchestrator role in task planning coordination
- All 109+ references updated across CLAUDE.md, README.md, SKILL_ARCHITECTURE_GUIDE.md, and all skill files

**x-test-task-planner v6.0.0 → v7.0.0 - Renamed from x-test-task-creator:**
- **BREAKING:** Renamed to reflect orchestrator role (plans tests, delegates creation to ln-task-creator)
- Architecture improvements: Removed 60-65% content duplication between SKILL.md and risk_based_testing_guide.md
- Reduced SKILL.md from 615 to 553 lines (-10%)
- Description shortened from 346 to 198 chars to fit 200 char recommended limit (-43%)
- Phase 4 (Risk-Based Test Planning) reduced from 167 to 105 lines
- Phase 6 (Confirmation & Delegation) reduced from 102 to 38 lines
- Moved Practical Examples (171 lines) to separate file risk_based_testing_examples.md
- Updated diagram.html: Phase 2-3 structure, Configuration Management added, sequential numbering, delegation logic

### Changed

**SKILL_ARCHITECTURE_GUIDE.md Documentation Compression (v1.0.0 → v1.1.0):**
- Compressed from 680 lines to 533 lines (-22%, ~147 lines saved net after adding Writing Guidelines)
- Applied Progressive Disclosure pattern: verbose text → compact tables
- **Tier 1 optimization (7 sections, LOW risk):**
  - Section 2 (Orchestrator-Worker Pattern): 73→20 lines (-53)
  - Section 3 (Single Responsibility): 50→22 lines (-28)
  - Section 4 (When to Split): 47→20 lines (-27)
  - Section 5 (When to Combine): 35→17 lines (-18)
  - Section 7 (Token Efficiency): 47→24 lines (-23)
  - Section 11 (References): 42→20 lines (-22)
  - Section 12 (Conclusion): 38→14 lines (-24)
- **Tier 2 preserved (2 sections, MEDIUM risk):**
  - Section 6 (Architecture Patterns): Kept verbose (educational examples)
  - Section 8 (Task Decomposition): Kept verbose (anti-pattern examples critical for learning)
- **Impact:** ~4,235 token savings (22% reduction), faster context loading, easier maintenance

**CLAUDE.md Documentation Compression:**
- Compressed from 593 lines to 257 lines (-57%, ~336 lines saved)
- Applied Progressive Disclosure pattern: brief summaries with links to README.md for details
- **Sections optimized:**
  - Skill Workflows: 172→22 lines (-150, replaced with reference table)
  - Visual Documentation: 46→7 lines (-39)
  - Decomposition Workflow: 64→14 lines (-50, compact table)
  - Important Details: 67→31 lines (-36)
  - Kanban Board: 42→16 lines (-26)
  - Available Skills: 36→14 lines (-22)
  - DAG Documentation: 29→12 lines (-17)
  - Development Principles: 18→7 lines (-11)
  - Task Templates: 16→11 lines (-5)
- **Rationale:** Reduce token consumption while preserving all critical information via references
- **Impact:** ~10,250 token savings, faster context loading, easier maintenance

**ln-task-executor v10.0.0 → v10.1.0 - Separation of Concerns:**
- **Removed:** Story status update logic from Phase 5
- **Rationale:** Story status management is x-story-executor's responsibility (orchestrator), not ln-task-executor (worker)
- **Impact:** Eliminates conflicting status policies between ln-task-executor and x-story-executor
- **Separation of Concerns:** Workers (ln-task-executor) focus on task execution, orchestrators (x-story-executor) manage Story lifecycle

### Documentation

**All Changed Skills:**
- Updated CLAUDE.md skill descriptions and versions
- Updated README.md skill tables with new versions and descriptions
- Updated diagram.html files for x-story-reviewer, x-story-executor, ln-story-processor, x-test-task-planner
- Updated Last Updated dates to 2025-11-14

### Summary

**Problem Solved:** Fixed 4 critical pipeline issues:
1. ✅ Wrong Pass 1 phase order → Now Code Quality → Regression → Manual Testing with early exit
2. ✅ Manual Pass 2 only → Now auto-invoked after test task Done
3. ✅ Backlog tasks invisible → Now Priority 0 auto-verifies before execution
4. ✅ Status policy conflicts → Story status now managed only by x-story-executor

**Result:** Seamless automatic pipeline from Story Todo → Done without manual intervention.

---

## [1.13.0] - 2025-01-14

### Added

**ln-manual-creator v1.0.0 - Package API Reference Manual Creator:**
- **NEW SKILL:** Create minimal Package API reference manuals (~300-500 words, OpenAPI-inspired format)
- **AUTO-RESEARCH:** Fully automated via MCP Context7 + Ref (library versions, method signatures, parameters)
- **4-Phase Workflow:**
  - Phase 0: Research & Discovery (10-15 min, automated)
  - Phase 1: Method Analysis (parse signatures, generate parameter tables)
  - Phase 2: Manual Generation (copy template, replace placeholders, validate)
  - Phase 3: Confirmation & Storage (save to docs/manuals/[package]-[version].md)
- **OpenAPI-Inspired Format:** Method signatures, parameters tables, neutral factual tone, version-specific
- **Template:** manual_template.md with placeholders for package info, methods, configuration, limitations
- **Visual Documentation:** diagram.html with Mermaid workflow (Linear Workflow, 4 phases)
- **Rationale:** Complements ln-guide-creator (patterns) and ln-adr-creator (decisions) with API reference documentation

### Changed

**Documentation Skills Category:**
- Updated skill count from 1 to 2 (ln-guide-creator + ln-manual-creator)
- Total repository skills: 23 → 24

**CLAUDE.md:**
- Updated Available Skills section (23 → 24 skills, Documentation: 1 → 2)
- Added ln-manual-creator v1.0.0 to DAG Documentation Support section

**README.md:**
- Updated skills badge (17 → 24)
- Added ln-manual-creator to Documentation Skills table with full description

---

## [1.7.0] - 2025-11-13

### Added

**ln-task-creator v1.0.0 - Universal Task Factory:**
- Worker skill for creating ALL 3 task types (implementation, refactoring, test) based on `taskType` parameter
- Phase 1: Template selection from ln-task-creator/references/
- Phase 2: Type-specific validation (implementation: NO test creation, refactoring: Regression Strategy, test: Priority ≥15 + limits)
- Invoked by orchestrators (x-task-planner, x-story-reviewer, x-test-task-planner)
- Owns all 3 product templates in ln-task-creator/references/

**ln-task-replanner v1.0.0 - Universal Task Replanner:**
- Worker skill for updating ALL 3 task types (implementation, refactoring, test)
- Compares IDEAL plan vs existing tasks, categorizes operations (KEEP/UPDATE/OBSOLETE/CREATE)
- Type-specific validation (same as ln-task-creator)
- Reads templates from ln-task-creator/references/

**ln-regression-checker v1.0.0:**
- Atomic worker skill for running existing test suites
- Auto-detects framework (pytest/jest/vitest/go test)
- Returns JSON verdict + Linear comment
- Single responsibility: test execution only

**ln-manual-tester v1.0.0:**
- Atomic worker skill for manual functional testing
- Tests AC + edge cases + error handling + integration using curl (API) or puppeteer (UI)
- Creates reusable temp script `scripts/tmp_[story_id].sh`
- Documents results in Linear (Format v1.0)

**ln-code-quality-checker v1.0.0:**
- Atomic worker skill for code quality analysis
- Checks 5 violation types (DRY/KISS/YAGNI/Architecture/Guide Compliance)
- Reports structured issues by severity (HIGH/MEDIUM/LOW)
- Fail Fast principle - runs FIRST in Phase 4

**SKILL_ARCHITECTURE_GUIDE.md v1.0.0:**
- Comprehensive guide documenting industry best practices for Claude Code skill architecture (2024-2025 standards)
- Covers Orchestrator-Worker Pattern, Single Responsibility Principle, Token Efficiency (lazy loading), Task Decomposition (Agile vertical slicing)
- Based on research from Claude Skills Guidelines, Multi-Agent Orchestration patterns, Pluralsight, and Humanizing Work guides

**refactoring_task_template.md (expanded):**
- Expanded from 83 lines → 513 lines with comprehensive refactoring guidance
- Added Code Quality Issues section, Refactoring Plan (3 phases), Regression Testing Strategy
- Code Simplification Principles (5 principles from code-simplifier agent)

**Test Result Format v1.0:**
- Standardized format for manual testing results in Linear comments (5 sections)
- Parseable by x-test-task-planner for test task generation

### Changed (BREAKING)

**x-test-task-planner v5.0.0 → v6.0.0 - Renamed from x-story-finalizer:**
- **BREAKING:** New name clearly indicates function (test task creator)
- Consistent with ln-task-creator naming pattern
- All 109 references updated across 29 files

**x-task-planner v5.1.0 → v6.0.0 - Refactored to Orchestrator Pattern:**
- Now delegates to ln-task-creator (CREATE MODE) and ln-task-replanner (REPLAN MODE)
- Orchestrator analyzes Story, builds IDEAL task plan (1-6 tasks, Consumer-First ordered)
- Breaking change: no longer generates task documents, creates Linear issues, or updates kanban_board.md directly

**ln-task-creator v1.0.0 → v2.0.0 - Universal Factory Pattern:**
- Refactored to create ALL 3 task types based on `taskType` parameter
- Breaking change: Requires `taskType` parameter
- Owns all 3 product templates

**ln-task-replanner v1.0.0 → v2.0.0 - Universal Replanner:**
- Refactored to replan ALL 3 task types
- Breaking change: Requires `taskType` parameter
- Reads templates from ln-task-creator/references/

**x-story-finalizer v4.0.0 → v5.0.0:**
- Refactored to delegate test task creation to universal factory
- Phase 6: CREATE MODE (ln-task-creator) or REPLAN MODE (ln-task-replanner) with taskType: "test"
- Breaking change: No longer creates Linear issues directly

**x-story-reviewer v4.0.0 → v5.0.0:**
- Refactored to delegate refactoring task creation to universal factory
- Path B: CREATE MODE (ln-task-creator) or REPLAN MODE (ln-task-replanner) with taskType: "refactoring"
- Breaking change: No longer creates Linear issues directly for refactoring tasks

### Changed

**x-story-executor v3.0.0 → v3.4.0:**
- Added detailed Phase 4 workflow documentation with 6 sequential steps and atomic worker skills
- Fixed ASCII diagram (replaced Russian "ЕДИНЫЙ ОРКЕСТРАТОР" with English "SINGLE ORCHESTRATOR")
- Improved diagram.html with UML State Diagram best practices (Single return point pattern, explicit loop control, visual priority hierarchy)
- Added Workflow Overview ASCII diagram visualizing full pipeline
- Full pipeline automation: automatically invokes x-story-reviewer Pass 1 when all implementation tasks Done

### Architecture

**Orchestrator-Worker Pattern Unified:**
- x-task-planner now follows same pattern as x-story-executor: orchestrator coordinates, workers execute
- Shared Resources Pattern: x-task-planner owns task_template_universal.md (shared by ln-task-creator and ln-task-replanner)
- Token Efficiency: Orchestrator loads only task IDs/count, workers load full descriptions when needed
- 90.2% Performance Improvement: Industry data (2024-2025)

**Universal Factory Pattern:**
- ln-task-creator now single source of truth for ALL task creation (implementation, refactoring, test)
- Template Ownership Centralized: ALL 3 task templates in ln-task-creator/references/
- Type-Specific Validation: Each task type has distinct validation rules
- CREATE and REPLAN Support: All 3 task types support both modes

### Documentation

**CLAUDE.md:**
- Added Testing & Quality Skills section (3 new skills)
- Updated x-task-planner to orchestrator pattern description
- Added ln-task-creator v1.0.0 (#9), ln-task-replanner v1.0.0 (#10)
- Updated Available Skills section

**README.md:**
- Added Testing & Quality Skills (3) table
- Updated Planning section with ln-task-creator, ln-task-replanner

---

## [1.1.0] - 2025-11-12

### Added

**Phase 0: Library & Standards Research in ln-story-manager v8.0.0:**
- Automated research via MCP Context7 (library versions, key APIs, limitations) + MCP Ref (best practices, RFC standards) BEFORE Story generation
- **Library Research subsection in story_template_universal.md v7.0.0:** Primary libraries table (name, version, purpose, docs), Key APIs, constraints, standards compliance
- **Related Guides subsection in story_template_universal.md v7.0.0:** Guide links inserted by x-story-verifier (auto-creates missing guides)
- **Expanded Technical Approach in task_template_universal.md v6.0.0:** Recommended Solution (library v[X.Y.Z], docs URL, standards compliance), Key APIs (method signatures), Implementation Pattern (pseudocode), Known Limitations, Alternatives

**Temporary Manual Testing Scripts workflow:**
- x-story-reviewer creates `scripts/tmp_[story_id].sh` for reusable manual testing
- Deleted by ln-test-executor after E2E/Integration/Unit tests implemented

### Changed

**ln-story-manager v7.0.0 → v8.0.0:**
- Added Phase 0 research workflow (15-20 min time-boxed)
- Research Summary inserted in ALL Story Technical Notes
- Updated Definition of Done, Example Usage includes Phase 0

**x-story-executor v2.6.0 → v3.0.0:**
- Critical task loading rules, automatic loop restart, delegation responsibility clarifications

**x-story-reviewer v3.5.0 → v4.0.0:**
- Two-pass structure detailed: Pass 1 (6 phases: Regression → Manual testing → Code quality → Verdict), Pass 2 (3 phases: Prerequisites → Test verification → Verdict)

**x-story-verifier v9.3.1 → v10.0.0:**
- Major restructuring (1077 lines), principle consolidation, improved clarity
- verification_checklist.md Check #6: Now validates Library Research table presence (populated by ln-story-manager Phase 0)

**x-task-planner v5.0.0 → v5.1.0:**
- Consolidated principles, improved documentation (630 lines restructured)

**ln-test-executor v4.0.0:**
- Added cleanup of temporary testing scripts in Step 6

**task_template_universal.md v5.1.0 → v6.0.0:**
- Technical Approach expanded from ~50 words to 200-300 words with library versions, key API signatures, pseudocode patterns, known limitations

**story_template_universal.md v6.0.0 → v7.0.0:**
- Added Library Research + Related Guides subsections in Technical Notes

### Updated

**CLAUDE.md:**
- Updated ln-story-manager description (v8.0.0, Phase 0 mention)
- Task Templates section (expanded Technical Approach details)
- Complete Decomposition Flow (Phase 0 in Epic → Stories)
- Testing and Documentation section (added Temporary Manual Testing Scripts)

**README.md:**
- Updated ln-story-manager version (7.0.0 → 8.0.0)
- Added Phase 0 description
- Updated skill version table

**All workflow diagrams:**
- Added Phase 0 (Library & Standards Research) node with Skip conditions decision
- Updated Overview sections

---

## [1.0.0] - 2025-11-10

### Added

- Initial plugin release with 17 production-ready skills
- Complete Agile workflow automation for Linear
- Plugin manifest (`.claude-plugin/plugin.json`) and marketplace support (`.claude-plugin/marketplace.json`)
- Skills organized in 5 categories: Pre-Planning (5), Planning (4), Execution (5), Validation (2), Documentation (1)
- Mermaid workflow diagrams for all skills (`.mmd` and `.html` files)
- Comprehensive documentation (CLAUDE.md, README.md)
- MIT License
- Installation support via plugin system and git clone (backward compatible)

### Skills Included

**Pre-Planning (5 skills):**
- ln-docs-creator v5.5.0 - Create comprehensive project documentation BEFORE development
- ln-html-builder v2.3.1 - Build interactive HTML presentation from project documentation
- ln-docs-system v1.0.2 - Orchestrator that creates complete documentation system
- ln-docs-updater v2.1.0 - Update existing project documentation based on code changes
- ln-adr-creator v3.0.0 - Create minimal Architecture Decision Records (ADRs)

**Planning (4 skills):**
- ln-epic-creator v4.0.0 - Decompose scope/initiative into 3-7 Epics (Linear Projects)
- ln-story-manager v7.0.0 - Universal Story operations (create/replan) with automatic Epic decomposition
- x-task-manager v5.0.0 - Universal task operations (create/replan) with automatic Story decomposition
- x-story-finalizer v4.1.0 - Create final Story task after manual testing passes

**Execution (5 skills):**
- x-story-executor v2.6.0 - Orchestrate Story execution through task workflow
- ln-task-executor v10.0.0 - Execute implementation tasks ONLY (not test tasks)
- ln-test-executor v4.0.0 - Execute Story Finalizer test tasks with Risk-Based Testing
- ln-task-reviewer v7.3.0 - Review completed tasks for quality and correctness
- ln-task-rework v5.1.0 - Fix tasks after review feedback

**Validation (2 skills):**
- x-story-verifier v9.3.1 - Auto-fix and approve Stories against industry standards before execution
- x-story-reviewer v3.5.0 - Two-pass Story review: manual testing + test verification

**Documentation (1 skill):**
- ln-guide-creator v4.0.0 - Research and create minimal project guides with best practices

### Features

- **Linear Integration**: Full MCP support for creating/updating Epics, Stories, and Tasks
- **Risk-Based Testing**: E2E-first approach with Priority ≥15 scenarios (2-5 E2E, 3-8 Integration, 5-15 Unit tests per Story)
- **Decompose-First Pattern**: Automatic Epic → Stories → Tasks decomposition with KEEP/UPDATE/OBSOLETE/CREATE operations
- **Template Ownership**: Each skill owns templates in its `references/` directory (Single Source of Truth)
- **Consumer-First Principle**: API endpoint → Service → Repository task ordering
- **Industry Standards Compliance**: RFC/protocol compliance checks before KISS/YAGNI application
- **DAG Documentation Support**: SCOPE tags, Maintenance sections, README hub for structured documentation
- **Auto-Guide Creation**: Automatic best practices research and guide generation during Story verification

### Documentation

- Complete workflow diagrams (Mermaid) for all 17 skills
- Comprehensive CLAUDE.md with development principles and task hierarchy
- README.md with installation instructions for all methods
- Reference templates for Epics, Stories, Tasks, ADRs, and Guides

### Installation Methods

1. **Plugin System** (recommended): `/plugin marketplace add` + `/plugin install`
2. **Direct Plugin**: `/plugin add levnikolaevich/claude-code-skills`
3. **Git Clone** (backward compatible): `git clone` into `~/.claude/skills/`

---

## Future Releases

### Planned

- Additional workflow optimizations
- Extended integration capabilities
- Community-contributed templates

---

**Links:**
- [Repository](https://github.com/levnikolaevich/claude-code-skills)
- [Issues](https://github.com/levnikolaevich/claude-code-skills/issues)
- [Contributing Guidelines](https://github.com/levnikolaevich/claude-code-skills#contributing)

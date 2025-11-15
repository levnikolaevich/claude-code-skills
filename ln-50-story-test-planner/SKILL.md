---
name: ln-50-story-test-planner
description: Plans Story test task by Risk-Based Testing after manual testing. Calculates priorities, selects E2E/Integration/Unit, delegates to ln-11-task-creator. Invoked by ln-40-story-quality-gate.
---

# Test Task Planner

Creates final Story task with comprehensive test coverage (Unit/Integration/E2E) PLUS existing test fixes, infrastructure updates, documentation, and legacy cleanup based on REAL manual testing results.

## When to Use This Skill

This skill should be used when:
- **Invoked by ln-40-story-quality-gate Pass 1** after manual functional testing PASSED
- **Invocation method:** Use Skill tool with command: `Skill(command: "ln-50-story-test-planner")`
- All implementation tasks in Story are Done
- Manual testing results documented in Linear comment
- Create final Story task covering: tests, test fixes, infrastructure, documentation, legacy cleanup

**Prerequisites:**
- All implementation Tasks in Story status = Done
- ln-40-story-quality-gate Pass 1 completed manual testing
- Manual test results in Linear comment (created by ln-40-story-quality-gate Phase 3 step 4)

**Automation:** Supports `autoApprove: true` (default when invoked by ln-40-story-quality-gate) to skip manual confirmation and run unattended.

## When NOT to Use

Do NOT use if:
- Manual testing NOT completed → Wait for ln-40-story-quality-gate Pass 1
- Manual test results NOT in Linear comment → ln-40-story-quality-gate must document first
- Implementation tasks NOT all Done → Complete impl tasks first

## How It Works

### Phase 1: Discovery (Automated)

Auto-discovers Team ID from `docs/tasks/kanban_board.md` (see CLAUDE.md "Configuration Auto-Discovery").

**Input:** Story ID from user (e.g., US001, API-42)

### Phase 2: Story + Tasks Analysis (NO Dialog)

**Step 0: Study Project Test Files**
1. Scan for test-related files:
   - tests/README.md (commands, setup, environment)
   - Test configs (jest.config.js, vitest.config.ts, pytest.ini)
   - Existing test structure (tests/, __tests__/ directories)
   - Coverage config (.coveragerc, coverage.json)
2. Extract: test commands, framework, patterns, coverage thresholds
3. Ensures test planning aligns with project practices

**Step 1: Load Manual Test Results**
1. Fetch Story from Linear (must have label "user-story")
2. Extract Story.id (UUID) - ⚠️ Use UUID, NOT short ID (required for Linear API)
3. Load manual test results comment (format: ln-43-manual-tester Format v1.0)
   - Search for the header containing "Manual Testing Results" (see `ln-43-manual-tester/references/test_result_format_v1.md`)
   - If not found → ERROR: Run ln-40-story-quality-gate Pass 1 first
4. Parse sections: AC results (PASS/FAIL), Edge Cases, Error Handling, Integration flows
5. Map to test design: PASSED AC → E2E, Edge cases → Unit, Errors → Error handling, Flows → Integration

**Step 2: Analyze Story + Tasks**
1. Parse Story: Goal, Test Strategy, Technical Notes
2. Fetch **all child Tasks** (parentId = Story.id, status = Done) from Linear
3. Analyze each Task:
   - Components implemented
   - Business logic added
   - Integration points created
   - Conditional branches (if/else/switch)
4. Identify what needs testing

### Phase 3: Parsing Strategy for Manual Test Results

**Process:** Locate Linear comment with the "Manual Testing Results" header described in `ln-43-manual-tester/references/test_result_format_v1.md` → Verify Format Version 1.0 → Extract structured sections (Acceptance Criteria, Test Results by AC, Edge Cases, Error Handling, Integration Testing) using regex → Validate (at least 1 PASSED AC, AC count matches Story, completeness check) → Map parsed data to test design structure

**Error Handling:** Missing comment → ERROR (run ln-40-story-quality-gate Pass 1 first), Missing format version → WARNING (try legacy parsing), Required section missing → ERROR (re-run ln-40-story-quality-gate), No PASSED AC → ERROR (fix implementation)

### Phase 4: Risk-Based Test Planning (Automated)

**Reference:** See `references/risk_based_testing_guide.md` for complete methodology (Business Impact/Probability tables, detailed decision trees, anti-patterns with code examples).

**E2E-First Approach:** Prioritize by business risk (Priority = Impact × Probability), not coverage metrics.

**Workflow:**

**Step 1: Risk Assessment**

Calculate Priority for each scenario from manual testing:

```
Priority = Business Impact (1-5) × Probability (1-5)
```

**Decision Criteria:**
- Priority ≥15 → **MUST test**
- Priority 9-14 → **SHOULD test** if not covered
- Priority ≤8 → **SKIP** (manual testing sufficient)

*See guide: Business Impact Table, Probability Table, Priority Matrix 5×5*

**Step 2: E2E Test Selection (2-5):** Baseline 2 (positive + negative) ALWAYS + 0-3 additional (Priority ≥15 only)

**Step 3: Unit Test Selection (0-15):** DEFAULT 0. Add ONLY for complex business logic (Priority ≥15): financial, security, algorithms

**Step 4: Integration Test Selection (0-8):** DEFAULT 0. Add ONLY if E2E gaps AND Priority ≥15: rollback, concurrency, external API errors

**Step 5: Validation:** Limits 2-28 total (realistic goal: 2-7). Auto-trim if >7 (keep 2 baseline + top 5 by Priority)

**Decision criteria details in guide:** Justification Checks, MANDATORY SKIP lists, Anti-Framework Rule

### Phase 5: Test Task Generation (Automated)

Generates complete Story Finalizer test task per `test_task_template.md` (11 sections):

**Sections 1-7:** Context, Risk Matrix, E2E/Integration/Unit Tests (with Priority scores + justifications), Coverage, DoD

**Section 8:** Existing Tests to Fix (analysis of affected tests from implementation tasks)

**Section 9:** Infrastructure Changes (packages, Docker, configs - based on test dependencies)

**Section 10:** Documentation Updates (README, CHANGELOG, tests/README, config docs)

**Section 11:** Legacy Code Cleanup (deprecated patterns, backward compat, dead code)

Shows preview for review.

### Phase 6: Confirmation & Delegation

**Step 1:** Preview generated test plan (always displayed for transparency)

**Step 2:** Confirmation logic:
- **autoApprove: true** (default for ln-40-story-quality-gate) → proceed automatically with no user input
- **Manual run** → prompt user to type "confirm" after reviewing the preview

**Step 3:** Check for existing test task

Query Linear: `list_issues(parentId=Story.id, labels=["tests"])`

**Decision:**
- **Count = 0** → **CREATE MODE** (Step 4a)
- **Count ≥ 1** → **REPLAN MODE** (Step 4b)

**Step 4a: CREATE MODE** (if Count = 0)

Invoke ln-11-task-creator worker with taskType: "test"

**Pass to worker:**
- taskType, teamId, storyData (Story.id, title, AC, Technical Notes, Context)
- manualTestResults (parsed from Linear comment)
- testPlan (e2eTests, integrationTests, unitTests, riskPriorityMatrix)
- infrastructureChanges, documentationUpdates, legacyCleanup

**Worker returns:** Task URL + summary

**Step 4b: REPLAN MODE** (if Count ≥ 1)

Invoke ln-12-task-replanner worker with taskType: "test"

**Pass to worker:**
- Same data as CREATE MODE + existingTaskIds

**Worker returns:** Operations summary + warnings

**Step 5:** Return summary to user
- CREATE MODE: "Test task created. Linear URL: [...]"
- REPLAN MODE: "Test task updated. Operations executed."

---

## Definition of Done

Before completing work, verify ALL checkpoints:

**✅ Manual Testing Results Parsed:**
- [ ] Linear comment "## 🧪 Manual Testing Results" found and parsed successfully
- [ ] Format Version 1.0 validated
- [ ] All required sections extracted: AC, Test Results by AC, Edge Cases, Error Handling, Integration Testing
- [ ] At least 1 AC marked as PASSED (cannot create test task if all AC failed)

**✅ Risk-Based Test Plan Generated:**
- [ ] Risk Priority Matrix calculated for all scenarios (Business Impact × Probability)
- [ ] E2E tests (2-5): Baseline 2 (positive/negative) + additional 0-3 with Priority ≥15 AND justification
- [ ] Integration tests (0-8): ONLY if E2E doesn't cover AND Priority ≥15 AND justification provided
- [ ] Unit tests (0-15): ONLY complex business logic with Priority ≥15 AND justification for each test
- [ ] **Total tests: 2-7 realistic goal** (hard limit: 2-28) - auto-trimmed if exceeds 7
- [ ] No test duplication: Each test adds unique business value
- [ ] No framework/library testing: Each test validates OUR business logic only

**✅ Story Finalizer Task Description Complete (11 sections):**
- [ ] Section 1 - Context: Story link, why final task needed
- [ ] Section 2 - Risk Priority Matrix: All scenarios with calculated Priority (Impact × Probability)
- [ ] Section 3 - E2E Tests (2-5 max): Baseline 2 + additional 0-3 with Priority ≥15 AND justification, based on ACTUAL manual testing
- [ ] Section 4 - Integration Tests (0-8 max): ONLY if E2E doesn't cover AND Priority ≥15 AND justification
- [ ] Section 5 - Unit Tests (0-15 max): ONLY complex business logic with Priority ≥15 AND justification for EACH test
- [ ] Section 6 - Critical Path Coverage: What MUST be tested (Priority ≥15) vs what skipped (≤14)
- [ ] Section 7 - Definition of Done: All tests pass, Priority ≥15 scenarios tested, **realistic goal 2-7 tests** (max 28), no flaky tests, each test beyond baseline 2 justified
- [ ] Section 8 - Existing Tests to Fix/Update: Affected tests + reasons + required fixes
- [ ] Section 9 - Infrastructure Changes: Packages, Docker, configs to update
- [ ] Section 10 - Documentation Updates: tests/README, README, CHANGELOG, other docs
- [ ] Section 11 - Legacy Code Cleanup: Костыли, backward compat, deprecated patterns, dead code

**✅ Worker Delegation Executed:**
- [ ] Checked for existing test task in Linear (labels=["tests"])
- [ ] CREATE MODE (if count = 0): Delegated to ln-11-task-creator with taskType: "test"
- [ ] REPLAN MODE (if count ≥ 1): Delegated to ln-12-task-replanner with taskType: "test"
- [ ] All required data passed to worker:
  - taskType, teamId, storyData (AC, Technical Notes, Context)
  - manualTestResults (parsed from Linear comment)
  - testPlan (e2eTests, integrationTests, unitTests, riskPriorityMatrix)
  - infrastructureChanges, documentationUpdates, legacyCleanup

**✅ Worker Completed Successfully:**
- [ ] ln-11-task-creator: Test task created in Linear + kanban_board.md updated
- [ ] ln-12-task-replanner: Operations executed + kanban_board.md updated
- [ ] Linear Issue URL returned from worker

**✅ Confirmation Handling:**
- [ ] Preview displayed (automation logs still capture full plan)
- [ ] Confirmation satisfied: autoApprove: true supplied or user typed "confirm" after manual review

**Output:**
- **CREATE MODE:** Linear Issue URL + confirmation message ("Created test task for Story US00X")
- **REPLAN MODE:** Operations summary + URLs ("Test task updated. X operations executed.")

---

## Example Usage

**Context:**
- ln-40-story-quality-gate Pass 1 completed manual testing
- Manual test results in Linear comment (3 AC PASSED, 2 edge cases discovered, error handling verified)

**Invocation (by ln-40-story-quality-gate via Skill tool):**
```
Skill(skill: "ln-50-story-test-planner", storyId: "US001")
```

**Execution (NO questions):**
1. Discovery → Team "API", Story: US001
2. Load Manual Test Results → Parse Linear comment (3 scenarios PASSED, 2 edge cases, 1 error scenario)
3. Analysis → Story + 5 Done implementation Tasks
4. Risk-Based Test Planning with Minimum Viable Testing:
   - Calculate Priority for each scenario (Business Impact × Probability)
   - E2E: 2 baseline tests (positive + negative for main endpoint) + 1 additional (critical edge case with Priority 20)
   - Integration: 0 tests (2 baseline E2E cover full stack)
   - Unit: 2 tests (tax calculation + discount logic with Priority ≥15)
   - **Total: 5 tests (within realistic goal 2-7)**
   - Auto-trim: Skipped 3 scenarios with Priority ≤14 (manual testing sufficient)
5. Impact Analysis:
   - Existing Tests: 2 test files need updates (mock responses changed)
   - Infrastructure: Add Playwright for UI E2E tests
   - Documentation: Update tests/README.md, main README.md
   - Legacy Cleanup: Remove deprecated API v1 compatibility shim
6. Generation → Complete story finalizer task (11 sections) with Risk Priority Matrix + justification for each test beyond baseline 2
7. Confirmation / autoApprove → Creates final Task with parentId=US001, label "tests"

## Reference Files

### risk_based_testing_guide.md (Skill-Specific)

**Purpose**: Risk-Based Testing methodology for test task planning

**Contents**: Risk Priority Matrix (Business Impact × Probability), test limits (E2E 2-5, Integration 0-8, Unit 0-15), decision tree, anti-patterns, test selection examples

**Location**: [ln-50-story-test-planner/references/risk_based_testing_guide.md](references/risk_based_testing_guide.md)

**Ownership**: ln-50-story-test-planner (orchestrator-specific logic)

**Usage**: ln-50-story-test-planner uses this guide in Phase 4 (Risk-Based Test Planning)

### test_task_template.md (MOVED)

**Purpose**: Story finalizer task structure (11 sections: tests + fixes + infrastructure + docs + cleanup)

**Location**: Moved to [ln-11-task-creator/references/test_task_template.md](../ln-11-task-creator/references/test_task_template.md)

**Ownership**: ln-11-task-creator (universal factory owns all product templates)

**Rationale**: Templates moved to universal factory (ln-11-task-creator) which creates ALL 3 task types (implementation, refactoring, test). ln-11-task-creator owns all product templates.

**Usage**: Workers (ln-11-task-creator, ln-12-task-replanner) read this template when generating test task documents (via `taskType: "test"`)

### linear_integration.md (Shared Reference)

**Location**: [ln-70-epic-creator/references/linear_integration.md](../ln-70-epic-creator/references/linear_integration.md)

**Purpose**: Linear API reference and integration patterns

## Best Practices

**Minimum Viable Testing Philosophy:** Start with 2 E2E tests per endpoint (positive + negative). Add more tests ONLY with critical justification. **Realistic goal: 2-7 tests per Story** (not 10-28). Each test beyond baseline 2 MUST justify: "Why does this test OUR business logic (not framework/library/database)?"

**Risk-Based Testing:** Prioritize by Business Impact × Probability (not coverage metrics). Test limits: 2-5 E2E (baseline 2 + additional 0-3), 0-8 Integration (default 0), 0-15 Unit (default 0). E2E-first from ACTUAL manual testing results. Priority ≥15 scenarios covered by tests, Priority ≤14 covered by manual testing.

**Anti-Duplication:** Each test validates unique business value. If 2 baseline E2E cover it, SKIP unit test. Test OUR code only (not frameworks/libraries/database queries). Focus on complex business logic ONLY (financial calculations, security algorithms, complex business rules). MANDATORY SKIP: CRUD, getters/setters, trivial conditionals, framework code, library functions, database queries.

**Auto-Trim:** If test plan exceeds 7 tests → auto-trim to 7 by Priority. Keep 2 baseline E2E always, trim lowest Priority tests. Document trimmed scenarios: "Covered by manual testing".

---

**Version:** 7.2.0
**Last Updated:** 2025-11-14

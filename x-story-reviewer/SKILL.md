---
name: x-story-reviewer
description: Review completed User Stories through manual functional testing. Pass 1: test implementation tasks and create test/refactoring task. Pass 2: verify tests and mark Story Done. Two-pass workflow ensures quality before completion. Auto-discovers team ID.
---

# Story Review Skill

Review completed User Stories through manual functional testing and code quality analysis.

## Overview

### Two-Pass Approach

**Pass 1: After Implementation Tasks Done**
- Manual functional testing against Story AC
- Code quality analysis (DRY/KISS/YAGNI)
- Create test task (via x-story-finalizer) OR refactoring task

**Pass 2: After Test Task Done**
- Verify tests cover all Priority ≥15 scenarios
- Check test limits (10-28 total: 2-5 E2E, 3-8 Integration, 5-15 Unit)
- Mark Story as Done

### When to Use This Skill

**Pass 1 Trigger:**
- All implementation tasks status = Done
- Test task does NOT exist OR test task NOT Done

**Pass 2 Trigger:**
- Test task status = Done (manual invocation by user)

### Why Story Review is Needed

**Philosophy:** Test REAL working code, not plans.

**Pass 1 Purpose:**
- Manually test actual functionality against Story AC
- Detect integration issues between impl tasks
- Find code quality issues (DRY/KISS/YAGNI violations)
- Create test task based on real working code + manual testing results
- OR create refactoring task if issues found

**Pass 2 Purpose:**
- Verify tests cover actual functionality
- Check Priority ≥15 scenarios tested and test limits (10-28 total)
- Final approval before Story Done

### Complete Workflow

```
Implementation Tasks (Done)
         ↓
x-story-reviewer Pass 1 (manual functional testing + code analysis)
         ↓
    [Path A: No issues]
         ↓
x-story-finalizer (creates test task with 11 sections)
         ↓
x-test-executor (Fix Tests → New Tests → Infrastructure → Docs → Cleanup)
         ↓
x-task-reviewer (reviews test task)
         ↓
Test task Done
         ↓
x-story-reviewer Pass 2 (verify tests → Story Done)

    [Path B: Issues found]
         ↓
Create refactoring task → Execute → x-story-reviewer Pass 1 again
```

**Critical:** Pass 2 can ONLY be invoked after test task status = Done.

---

## Pass 1 Workflow

### Phase 1: Discovery

Auto-discovers project configuration:
- **Team ID:** Reads `docs/tasks/readme.md`, `docs/tasks/kanban_board.md`, `docs/core/Setup.md` → Linear Configuration (not `gh` command and NOT Github Issues)
- **Project Docs:** Reads `CLAUDE.md` → Links to `docs/core/`, `docs/guides/`
- **Tracker:** Linear MCP integration

### Phase 2: Preparation

**Steps:**
1. **Select Story:**
   - If Story ID provided → Fetch specific Story
   - If no ID → List Stories with impl tasks Done, ask user to choose
2. **Determine review pass:**
   - Check if test task exists for this Story (load all Story tasks via parentId = Story.id, search for label "tests")
   - **Pass 1:** All impl tasks Done, NO test task yet OR test task NOT Done → Manual testing + create test/refactoring task (or refactoring task if issues found)
   - **Pass 2:** Test task EXISTS AND status = Done → Verify tests + Story Done
   - **Error:** If Pass 2 explicitly requested but test task missing/not Done → Display error message with current test task status
3. **Load Story and all Tasks:**
   - Read Story description FULLY (no truncation)
   - Read ALL child Tasks FULLY (status = Done)
   - Understand Story goal, AC, Technical Notes
4. **Load affected files:**
   - All files modified across all Story tasks
   - STRUCTURE.md, ARCHITECTURE.md, guides/
   - Infrastructure files (Dockerfile, compose, package.json, etc.)

### Phase 3: Regression Check (Pass 1 only)

**Verify existing tests still pass (no regression):**

0. **Verify containers have latest code:**
   - Read tests/README.md → identify test requirements
   - Find and read docker-compose*.yml files → understand container structure
   - Check freshness: `docker compose ps`, `docker inspect` timestamp vs `git log` in modified files
   - If outdated/stopped → `docker compose -f <file> up --build -d` → verify services Up
   - If fresh → continue

**Purpose:** Prevent testing stale code

1. **Run regression tests:**
   - Test setup already loaded (Step 0)
   - Containers already fresh (Step 0)
   - Execute test command → Capture full output (stdout + stderr)

2. **Verify zero failures:**
   - ✅ **Expected:** All existing tests pass (0 failures)
   - ❌ **Regression detected:** Any test failures
   - Parse output for: total tests, passed, failed, skipped

3. **Handle regression:**
   - If failures detected:
     * Document failed tests (test names, error messages)
     * Add comment to Story: "⚠️ Regression detected in existing tests. Implementation tasks broke X existing tests. Must fix before proceeding."
     * **STOP Pass 1** - do NOT proceed to Manual Testing
     * Create fix task for regression (parentId = Story)
     * Exit with error status
   - If all pass → Proceed to Phase 4 (Manual Testing)

**Purpose:** Catch regressions early before investing time in manual testing new functionality.

### Phase 4: Manual Functional Testing (Pass 1 only)

**Test real functionality against Story AC:**

**Steps:**

0. **Setup test script (first run only):**
   - Create `scripts/tmp_[story_id].sh`:
     ```bash
     #!/bin/bash
     # Variables
     BASE_URL="http://localhost:PORT"
     TOKEN="Bearer xxx"

     # Tests (curl commands below)
     ```
   - `chmod +x scripts/tmp_[story_id].sh`
   - If exists → reuse (from previous Pass 1 after refactoring)

1. **Find endpoints:**
   - Containers already running (Phase 3 Step 0)
   - Extract port from docker-compose ps
   - Extract API routes from impl tasks
   - Update BASE_URL in script with actual port

2. **Test each Story AC (Given-When-Then):**
   - **For API:** Append curl commands to `scripts/tmp_[story_id].sh`
     * Example: `curl -H "Authorization: $TOKEN" $BASE_URL/api/users`
     * Execute: `./scripts/tmp_[story_id].sh`
     * **If bugs found:** Append new curl commands, re-run script
     * Verify response status, body, headers
   - **For UI:** Use puppeteer MCP
     * Navigate to pages, click elements, verify text/state
   - Document results: What works ✓, What fails ✗, Edge cases discovered

3. **Record test results:**
   - **Main Scenarios:** PASS/FAIL for each Story AC
   - **Edge Cases:** Found during manual testing (empty inputs, large numbers, special characters, etc.)
   - **Error Handling:** Actual error responses (400/404/500, error messages)
   - **Integration:** Do impl tasks work together? (API → Service → Repository)

4. **Add Linear comment with structured test results:**
   - **Use standardized format** (see `references/manual_testing_comment_template.md`)
   - **Required sections:**
     - **Header:** Format Version 1.0, Story ID, Date, Status (X/Y AC passed)
     - **Acceptance Criteria:** Copy from Story with Given-When-Then format
     - **Test Results by AC:** One subsection per AC with:
       - Status (✅ PASS / ❌ FAIL)
       - Method (full curl command OR puppeteer code)
       - Result (actual HTTP status, response body, or UI state)
       - Notes (relevant observations)
     - **Edge Cases Discovered:** Numbered list with input/expected/actual/status
     - **Error Handling Verified:** Markdown table with HTTP codes, scenarios, messages
     - **Integration Testing:** Component flow validation (API → Service → Repository)
     - **Summary:** Overall result, coverage metrics, recommendation
   - **Include full curl commands** or puppeteer code for reproducibility
   - **Use emoji status indicators** (✅ PASS, ❌ FAIL, ⚠️ Not tested)
   - This structured comment will be parsed by x-story-finalizer for E2E-first test design

**Comment Format Reference:**

**Template Location:** `references/manual_testing_comment_template.md`

**Reference:** See `x-story-finalizer/references/risk_based_testing_guide.md` for Risk Priority Matrix methodology that x-story-finalizer will use to select automated tests.

**Why use structured format:**
- **Consistency:** All manual testing results follow same structure
- **Parseability:** x-story-finalizer can reliably extract sections using regex
- **Traceability:** Direct mapping from AC to test results to E2E tests
- **Completeness:** Ensures all aspects documented (AC, edge cases, errors, integration)

**Template includes:**
- Complete format specification (Format Version 1.0)
- Detailed instructions for filling each section
- Two comprehensive examples (API testing with curl, UI testing with puppeteer)
- Parsing instructions for x-story-finalizer

**Quick checklist before posting comment:**
- [ ] Format Version 1.0 header present
- [ ] All Story AC copied with Given-When-Then
- [ ] Test Results section has one entry per AC
- [ ] Full curl/puppeteer commands included
- [ ] Edge cases numbered sequentially
- [ ] Error handling table complete
- [ ] Integration flow validated
- [ ] Summary with recommendation

### Phase 5: Code Quality Analysis

**Scan for issues (DRY/KISS/YAGNI at Story level):**

1. **DRY violations:**
   - Use Grep to find code duplication across impl tasks
   - Check for copy-pasted validation logic, similar functions
   - Example: 3+ similar functions that could be refactored into shared method

2. **KISS violations:**
   - Over-engineered solutions (complex patterns for simple CRUD)
   - Unnecessary abstractions
   - Premature optimization

3. **YAGNI violations:**
   - Unused features (functions never called)
   - Premature features (beyond Story scope)
   - Use Grep to find unused exports, orphaned methods

4. **Architecture issues:**
   - Layer violations (direct DB calls from API layer)
   - Patterns not followed (Story says "Repository Pattern" but uses direct queries)

5. **Guides violations:**
   - Compare implementation with guides/ referenced in Story Technical Notes
   - Verify patterns match guide examples

**Collect ALL issues into single list for refactoring task.**

### Phase 6: Verdict and Next Steps

**Determine path based on Phase 4-5 results:**

#### Path A: All Tests Passed + No Code Quality Issues

**Criteria:**
- All Story AC work correctly ✓ (manual testing passed)
- No DRY/KISS/YAGNI violations ✓
- Architecture clean ✓
- Integration between tasks works ✓

**Actions:**

1. **Check for existing test task:**
   - Load all Story tasks (via parentId = Story.id)
   - Search for task with label "tests"
   - **If test task exists:**
     * Check test task status:
       - **Done** → Skip to Pass 2 (see Pass 2 Workflow)
       - **In Progress / To Review / Todo** → Report to user: "Test task [TASK-ID] already exists (status: [STATUS]). Wait for completion before running x-story-reviewer again."
       - **Exit:** Do NOT create new test task
   - **If test task does NOT exist:** Proceed to step 2

2. **Create test task (ONLY if no test task exists):**
   - Add Linear comment: "✅ All AC passed, no code quality issues"
   - **AUTOMATIC invocation (no user confirmation):** Invoke x-story-finalizer (Skill tool) → WAIT completion → test task created
   - Story remains current state until test task Done

3. **Next steps after x-story-finalizer completes:**
   - Test task created in Linear and kanban_board.md
   - Execute test task via x-test-executor (6 steps):
     * Step 1: Fix Existing Tests (Section 8)
     * Step 2: Implement New Tests E2E→Integration→Unit (Sections 3-5, Priority ≥15)
     * Step 3: Update Infrastructure (Section 9: package.json, Dockerfile, compose)
     * Step 4: Update Documentation (Section 10: tests/README.md, CHANGELOG.md)
     * Step 5: Cleanup Legacy Code (Section 11: workarounds, backward compat)
     * Step 6: Final Verification (all tests pass, 10-28 total)
   - Review test task via x-task-reviewer
   - When test task Done → Run x-story-reviewer Pass 2 (manual invocation)

#### Path B: Issues Found

**Criteria:**
- Functional bugs (AC failed during manual testing) OR
- Code quality issues (DRY/KISS/YAGNI/Architecture violations)

**Actions:**

1. **Create ONE refactoring task (all issues in single task):**
   - Use refactoring_task_template.md from references/
   - Generate task with:
     * Context: All problems from Phase 5 analysis
     * Refactoring Goal: Fix all issues
     * Technical Approach: Step-by-step fix plan
     * AC: All issues resolved
     * Affected Components: From Phase 5 analysis
     * Existing Code Impact: Tests to update, docs to update
   - Create Linear Issue (parentId = Story, status = Todo)

2. **Story remains in current state** until refactoring task Done

3. **After refactoring Done:** Run x-story-reviewer Pass 1 again
   - **Reuse test script:** `./scripts/tmp_[story_id].sh` to verify fixes
   - Cycle until clean

---

## Pass 2 Workflow

### Phase 1: Prerequisites Check

**Verify Pass 2 can proceed:**

**Steps:**

1. **Load Story and all tasks:**
   - Read Story description
   - Load all child tasks via parentId = Story.id
   - Identify test task (label "tests")

2. **Verify test task status:**
   - **If test task missing:**
     * Error: "Test task does not exist for this Story. Run Pass 1 first."
     * Exit without proceeding
   - **If test task status NOT Done:**
     * Error: "Test task status is [STATUS]. Wait for test task to complete before Pass 2."
     * Exit without proceeding
   - **If test task status = Done:**
     * Proceed to Phase 2

3. **Load test files:**
   - Identify test files from test task description (Sections 3-5: E2E, Integration, Unit)
   - Load infrastructure files (package.json, Dockerfile, compose, tests/README.md)

### Phase 2: Test Verification

**Verify tests cover functionality and meet quality standards:**

**Steps:**

1. **All tests pass:**
   - Run all Story tests: E2E (2-5) + Integration (3-8) + Unit (5-15)
   - Verify 0 failures
   - Verify total tests 10-28 (within enforced limit per `x-story-finalizer/references/risk_based_testing_guide.md`)

2. **All Priority ≥15 scenarios tested:**
   - Load manual testing comment from Pass 1 (Format v1.0)
   - Extract Priority ≥15 scenarios (money, security, core flows)
   - Verify all critical scenarios from manual testing have automated tests
   - Check Priority scores in test task Risk Priority Matrix
   - Confirm no Priority ≥15 scenario skipped

3. **E2E cover all Story AC:**
   - Compare E2E tests with Story AC (Given-When-Then)
   - Each Priority ≥15 Main Scenario has E2E test
   - Priority ≥15 Edge Cases covered
   - Priority ≥15 Error Handling covered

4. **Tests focus on business logic:**
   - No tests for frameworks/libraries
   - No duplicate test coverage (each test adds unique value)
   - Trivial code skipped (simple CRUD, getters/setters)

5. **Infrastructure updated:**
   - Package files updated (package.json, requirements.txt)
   - Dockerfile/docker-compose updated if needed
   - README.md updated with setup
   - tests/README.md updated with test commands

### Phase 3: Verdict and Story Closure

**Apply final verdict:**

#### Verdict: Pass (All Checks Passed)

**Actions:**

1. **Update Linear:**
   - Mark Story status as "Done"
   - Add review summary comment with verification results

2. **Update kanban_board.md (minimal cleanup):**
   - Story header already in "### Done (Last 5 tasks)" section (tasks were moved there by x-task-reviewer)
   - If Story header still exists in "### In Progress" (without tasks): remove it
   - Epic header preserved in Done section with Story and all Done tasks
   - No additional movement needed (tasks already moved by x-task-reviewer)

#### Verdict: Fail (Issues Found)

**Actions:**

1. **Create fix tasks:**
   - Document all issues found
   - Create tasks for each category of issues (tests, infrastructure, etc.)
   - Parent tasks to Story

2. **Story remains current state**

3. **kanban_board.md unchanged**

4. **After fix tasks Done:** Re-run x-story-reviewer Pass 2

---

## Reference

### Pass 1 Definition of Done

**✅ Containers Verified (Phase 3 Step 0):**
- [ ] tests/README.md + docker-compose*.yml read
- [ ] Container freshness checked (docker inspect vs git log)
- [ ] Rebuilt if outdated: docker-compose up --build -d
- [ ] Services verified Up

**✅ Regression Check Complete (Phase 3):**
- [ ] tests/README.md read (if exists) - test commands identified
- [ ] All existing project tests executed (npm test / pytest / go test / etc.)
- [ ] Test output captured (total, passed, failed, skipped)
- [ ] Verification result:
  - ✅ Zero failures → Proceeded to Phase 4 (Manual Testing)
  - ❌ Failures detected → Regression comment added to Story, fix task created, Pass 1 stopped

**✅ Manual Functional Testing Complete (Phase 4):**
- [ ] Temporary test script `scripts/tmp_[story_id].sh` created with shebang + variables
- [ ] Script executable (`chmod +x`)
- [ ] Endpoints identified (port from docker-compose ps, routes from impl tasks)
- [ ] All Story AC tested using:
  - API: curl commands (appended to script, executed via `./scripts/tmp_[story_id].sh`)
  - UI: Puppeteer automated browser testing
- [ ] Test results documented for each AC (PASS/FAIL with evidence)
- [ ] Edge cases discovered and documented
- [ ] Error handling verified (4xx/5xx responses, error messages)
- [ ] Integration testing performed (component flows, service interactions)

**✅ Linear Comment Created (Format v1.0):**
- [ ] Comment header: "## 🧪 Manual Testing Results"
- [ ] Format Version: 1.0 specified
- [ ] All required sections present:
  - Acceptance Criteria (Given-When-Then)
  - Test Results by AC (AC number, status PASS/FAIL, method, result)
  - Edge Cases Discovered (description, input, expected, actual, status)
  - Error Handling Verified (HTTP code, scenario, error message, verified ✅/⚠️)
  - Integration Testing (component flows with ✅/❌ status)

**✅ Code Quality Analysis Complete:**
- [ ] All implementation tasks scanned for DRY/KISS/YAGNI violations
- [ ] Architecture issues identified (layer violations, pattern adherence)
- [ ] Guide pattern compliance verified

**✅ Test Task Existence Checked (Path A only):**
- [ ] All Story tasks loaded (via parentId = Story.id)
- [ ] Searched for task with label "tests"
- [ ] **If test task EXISTS:**
  - Test task status checked (Done / In Progress / To Review / Todo)
  - **If Done:** Skipped to Pass 2 (see Pass 2 Workflow)
  - **If NOT Done:** Reported to user with current status, exited without creating new task
- [ ] **If test task does NOT exist:** Proceeded to x-story-finalizer invocation

**✅ Verdict Determined (Pass 1):**
- [ ] **Path A** (All AC PASSED + no issues):
  - x-story-finalizer invoked AUTOMATICALLY (no user confirmation, ONLY if no test task exists)
  - After completion: test task created in kanban_board.md
- [ ] **Path B** (Issues found): ONE refactoring task created (all issues together)

### Pass 2 Definition of Done

**✅ Test Verification Complete:**
- [ ] All tests pass (E2E 2-5, Integration 3-8, Unit 5-15, total 10-28)
- [ ] Test limits verified (within 10-28 range)
- [ ] All Priority ≥15 scenarios from manual testing tested
- [ ] E2E tests cover all Story AC from Pass 1 manual testing
- [ ] Tests focus on business logic (not framework code)

**✅ Infrastructure Updated:**
- [ ] package.json dependencies updated (if new test libraries added)
- [ ] Dockerfile updated (if test setup changed)
- [ ] docker-compose.yml or docker-compose.test.yml updated
- [ ] README.md updated (if project setup changed)
- [ ] tests/README.md updated (test commands, setup instructions)

**✅ Verdict Applied (Pass 2):**
- [ ] **Pass:**
  - Story status updated to "Done" in Linear
  - kanban_board.md minimal cleanup:
    * Story header already in "### Done (Last 5 tasks)" section (tasks moved there by x-task-reviewer)
    * If Story header still exists in "### In Progress" (empty, no tasks): removed
    * Epic header preserved in Done section with Story and all Done tasks
- [ ] **Fail:** Fix tasks created, Story remains current status, kanban_board.md unchanged

### Best Practices

1. **Pass 1: Test real functionality** - Use curl/puppeteer, not code review alone
2. **Document all findings** - Add Linear comment with manual test results (Format v1.0)
3. **Collect ALL issues** - Single refactoring task, not multiple
4. **E2E first** - Use Skill tool to invoke x-story-finalizer, which builds tests from manual testing (Risk-Based Testing)
5. **Pass 2: Verify Priority ≥15 scenarios** - Tests must cover critical paths (money, security, core flows)
6. **Refactoring cycle** - x-story-reviewer → refactor → x-story-reviewer until clean

### Comparison with Other Reviews

| Aspect | x-story-verifier | x-task-reviewer | x-story-reviewer Pass 1 | x-story-reviewer Pass 2 |
|--------|-------------------|-----------------|-------------------------|-------------------------|
| **When** | BEFORE work | AFTER each task | AFTER impl tasks | AFTER test task |
| **Scope** | Story structure | Single task | Entire Story | Tests |
| **Checks** | Plan validity | Task code | Manual testing + code quality | Priority ≥15 scenarios + test limits |
| **Can fail** | Yes → Backlog | Yes → To Rework | Yes → refactoring task | Yes → fix tasks |
| **Output** | Story → Todo | Task → Done/Rework | test task OR refactoring task | Story → Done |

### Example Usage

**Pass 1 (after impl tasks Done):**
```
Review Story US004
```
→ Manual testing → Create test task OR refactoring task

**Pass 2 (after test task Done, manual invocation):**
```
Review Story US004
```
→ Verify tests → Story Done

---

**Version:** 4.0.0 (Restructured for clarity and removed duplication)
**Last Updated:** 2025-11-12

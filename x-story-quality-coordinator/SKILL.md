---
name: x-story-quality-coordinator
description: Reviews completed Stories with Early Exit. Pass 1: code quality → regression → manual testing (fail fast). Pass 2: verify tests → Done. Ensures quality before completion. Auto-discovers team ID.
---

# Story Review Skill

Review completed User Stories through manual functional testing and code quality analysis.

## Overview

### Two-Pass Approach

**Pass 1: After Implementation Tasks Done** (Early Exit Pattern)
- **Step 1:** Code quality analysis (DRY/KISS/YAGNI/Architecture) - FAIL FAST
- **Step 2:** Regression check (existing tests pass) - FAIL FAST
- **Step 3:** Manual functional testing against Story AC - FAIL FAST
- **Verdict:** Create test task (via x-test-coordinator) OR refactoring/fix task

**Pass 2: After Test Task Done**
- Verify tests cover all Priority ≥15 scenarios
- Check test limits (10-28 total: 2-5 E2E, 3-8 Integration, 5-15 Unit)
- Mark Story as Done

### When to Use This Skill

**Pass 1 Trigger:**
- All implementation tasks status = Done
- Test task does NOT exist OR test task NOT Done

**Pass 2 Trigger:**
- Test task status = Done
- Invoked by x-story-coordinator automatically via Skill tool when test task Done

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
x-story-quality-coordinator Pass 1 (manual functional testing + code analysis)
         ↓
    [Path A: No issues]
         ↓
x-test-coordinator (creates test task with 11 sections)
         ↓
x-test-executor (Fix Tests → New Tests → Infrastructure → Docs → Cleanup)
         ↓
x-task-reviewer (reviews test task)
         ↓
Test task Done
         ↓
x-story-quality-coordinator Pass 2 (verify tests → Story Done)

    [Path B: Issues found]
         ↓
Create refactoring task → Execute → x-story-quality-coordinator Pass 1 again
```

**Critical:** Pass 2 is automatically invoked by x-story-coordinator when test task status = Done. Can also be invoked manually by user for re-verification.

### Usage Examples

**Automatic invocation (recommended):**
```
# Pass 1 - invoked by x-story-coordinator when all impl tasks Done
Skill(skill: "x-story-quality-coordinator", storyId: "US004")

# Pass 2 - invoked by x-story-coordinator when test task Done
Skill(skill: "x-story-quality-coordinator", storyId: "US004")
```

**Manual invocation with explicit pass parameter:**
```
# Force Pass 1 (manual testing + create test task)
Skill(skill: "x-story-quality-coordinator", storyId: "US004", pass: 1)

# Force Pass 2 (verify tests + mark Story Done)
Skill(skill: "x-story-quality-coordinator", storyId: "US004", pass: 2)
```

**Pass determination logic:**
1. If `pass` parameter provided → use explicit value (1 or 2)
2. If `pass` NOT provided → auto-determine based on test task status:
   - Test task missing OR NOT Done → Pass 1
   - Test task Done → Pass 2

**When to use explicit pass:**
- Re-run Pass 1 after fixing issues (without waiting for x-story-coordinator)
- Re-run Pass 2 for re-verification (after fixing test issues)
- Debugging/testing specific pass in isolation

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
3. **Load Story and Tasks metadata:**
   - Fetch Story metadata (ID, title, status, labels - NO description yet)
   - Fetch child Tasks metadata (ID, title, status, labels - NO descriptions yet)
   - Count Done implementation tasks
   - Rationale: Phase 2 is preparation/coordination. FULL descriptions loaded in Phase 3 when analysis begins
4. **Identify modified files:**
   - List all files modified across implementation tasks (from git diff or Task descriptions)
   - Note: Files content loaded in Phase 3 when analysis begins

### Phase 3: Code Quality Analysis (Pass 1 only)

**FAIL FAST: Check code quality BEFORE running any tests.**

**Delegate to x-code-quality-checker (L3 Worker):**

Invoke via Skill tool:
```
Skill(skill: "x-code-quality-checker", storyId: Story.id)
```

**Worker responsibilities:**
- Input: Story ID
- Output: JSON verdict ("PASS" | "ISSUES_FOUND") + Linear comment ID
- Details: See [x-code-quality-checker/SKILL.md](../x-code-quality-checker/SKILL.md)

### Phase 3 Verdict: Early Exit Decision

**Parse x-code-quality-checker result:**

#### Verdict: PASS (verdict = "PASS")
**Worker reported:**
- No HIGH or MEDIUM severity issues
- Code quality acceptable

**Actions:**
- Worker already added Linear comment with analysis results
- **Proceed to Phase 4 (Regression Check)**

#### Verdict: FAIL (verdict = "ISSUES_FOUND")
**Worker reported:**
- HIGH or MEDIUM severity issues found (DRY/KISS/YAGNI/Architecture/Guide violations)
- Detailed issue list in worker's Linear comment

**Actions:**
1. **Create refactoring task:**
   - Title: "Refactoring: Fix code quality issues (Story [STORY_ID])"
   - Description: Copy issues from x-code-quality-checker result
   - Label: "refactoring"
   - Parent: Story.id
   - Status: Backlog
2. **STOP Pass 1** - Do NOT proceed to Phase 4 (Regression) or Phase 5 (Manual Testing)
3. **Exit:** Refactoring task created, Story remains current state until refactor Done

**Purpose:** Fail Fast - No point running tests if code quality fundamentally flawed.

### Phase 4: Regression Check (Pass 1 only)

**PREREQUISITE: Phase 3 Code Quality passed.**

**Delegate to x-regression-checker (L3 Worker):**

Invoke via Skill tool:
```
Skill(skill: "x-regression-checker", storyId: Story.id)
```

**Worker responsibilities:**
- Input: Story ID
- Output: JSON verdict ("PASS" | "FAIL") + Linear comment ID
- Details: See [x-regression-checker/SKILL.md](../x-regression-checker/SKILL.md)

### Phase 4 Verdict: Early Exit Decision

**Parse x-regression-checker result:**

#### Verdict: PASS (verdict = "PASS")
**Worker reported:**
- All existing tests pass (failed = 0)
- No regression detected

**Actions:**
- Worker already added Linear comment with test results
- **Proceed to Phase 5 (Manual Functional Testing)**

#### Verdict: FAIL (verdict = "FAIL")
**Worker reported:**
- Test failures detected (failed > 0)
- Implementation tasks broke existing tests
- Failed test names in worker result

**Actions:**
1. **Create regression fix task:**
   - Title: "Fix regression: [X] tests failing (Story [STORY_ID])"
   - Description: Copy failed test names from x-regression-checker result
   - Label: "bug"
   - Parent: Story.id
   - Status: Backlog
2. **STOP Pass 1** - Do NOT proceed to Phase 5 (Manual Testing)
3. **Exit:** Regression fix task created, Story remains current state until fix Done

**Purpose:** Catch regressions early before investing time in manual testing new functionality.

### Phase 5: Manual Functional Testing (Pass 1 only)

**PREREQUISITE: Phase 4 Regression Check passed.**

**Delegate to x-manual-tester (L3 Worker):**

Invoke via Skill tool:
```
Skill(skill: "x-manual-tester", storyId: Story.id)
```

**Worker responsibilities:**
- Input: Story ID
- Output: JSON verdict ("PASS" | "FAIL") + Linear comment ID (Format v1.0) + temporary script path
- Details: See [x-manual-tester/SKILL.md](../x-manual-tester/SKILL.md)

### Phase 5 Verdict: Early Exit Decision

**Parse x-manual-tester result:**

#### Verdict: PASS (verdict = "PASS")
**Worker reported:**
- All Story AC work correctly (manual testing passed)
- Integration between tasks works
- Edge cases handled correctly
- Error handling verified

**Actions:**
- Worker already added Linear comment (Format v1.0) with structured test results
- Temporary testing script created at path from worker result
- **Proceed to Phase 6 (Verdict and Next Steps)**

#### Verdict: FAIL (verdict = "FAIL")
**Worker reported:**
- Story AC failed OR functional bugs found
- Details in worker result (failed AC, bugs, integration issues)
- Structured results documented in Linear comment

**Actions:**
1. **Create bug fix task:**
   - Title: "Fix bugs: [X/Y] AC failed (Story [STORY_ID])"
   - Description: Copy failed AC and bug details from x-manual-tester result
   - Label: "bug"
   - Parent: Story.id
   - Status: Backlog
2. **STOP Pass 1** - Do NOT proceed to Phase 6 (Verdict)
3. **Exit:** Bug fix task created, Story remains current state until fix Done

**Purpose:** Verify actual functionality works before creating test task.

### Phase 6: Verdict and Next Steps

**PREREQUISITE: All Phase 3-4-5 passed (Code Quality → Regression → Manual Testing).**

**Determine path based on overall Pass 1 results:**

#### Path A: All Quality Gates Passed

**Criteria:**
- ✅ **Phase 3:** Code Quality passed (no critical DRY/KISS/YAGNI/Architecture violations)
- ✅ **Phase 4:** Regression passed (all existing tests pass)
- ✅ **Phase 5:** Manual testing passed (all Story AC verified)
- ✅ Integration between tasks works correctly

**Actions:**

1. **Check for existing test task:**
   - Load all Story tasks (via parentId = Story.id)
   - Search for task with label "tests"
   - **If test task exists:**
     * Check test task status:
       - **Done** → Report: "Test task [TASK-ID] Done. Pass 1 complete. x-story-coordinator will automatically invoke Pass 2."
       - **In Progress / To Review / Todo** → Report to user: "Test task [TASK-ID] already exists (status: [STATUS]). Wait for completion before running x-story-quality-coordinator Pass 1 again."
       - **Exit:** Do NOT create new test task, Pass 1 stops here
   - **If test task does NOT exist:** Proceed to step 2

2. **Create test task (ONLY if no test task exists):**
   - Add Linear comment: "✅ All AC passed, no code quality issues"
   - **AUTOMATIC invocation (no user confirmation):** Invoke x-test-coordinator (Skill tool) → WAIT completion → test task created
   - Story remains current state until test task Done

3. **Next steps after x-test-coordinator completes:**
   - Test task created in Linear and kanban_board.md
   - Execute test task via x-test-executor (6 steps):
     * Step 1: Fix Existing Tests (Section 8)
     * Step 2: Implement New Tests E2E→Integration→Unit (Sections 3-5, Priority ≥15)
     * Step 3: Update Infrastructure (Section 9: package.json, Dockerfile, compose)
     * Step 4: Update Documentation (Section 10: tests/README.md, CHANGELOG.md)
     * Step 5: Cleanup Legacy Code (Section 11: workarounds, backward compat)
     * Step 6: Final Verification (all tests pass, 10-28 total)
   - Review test task via x-task-reviewer
   - When test task Done → x-story-coordinator automatically invokes x-story-quality-coordinator Pass 2

**Note:** Path B (Issues Found) is NO LONGER needed at this stage. All issues are caught and handled by Early Exit Pattern in Phase 3/4/5:
- **Phase 3 FAIL** → Refactoring task created → STOP
- **Phase 4 FAIL** → Regression fix task created → STOP
- **Phase 5 FAIL** → Bug fix task created → STOP

If we reached Phase 6, it means all quality gates passed. Phase 6 only creates test task.

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
   - Verify total tests 10-28 (within enforced limit per `x-test-coordinator/references/risk_based_testing_guide.md`)

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

4. **After fix tasks Done:** x-story-coordinator automatically re-invokes x-story-quality-coordinator Pass 2

---

## Reference

### Story Status Responsibility Matrix

**x-story-quality-coordinator responsibility**: Manages **1 of 4** Story status transitions (Final approval phase).

| Story Status Transition | Responsible Skill | When |
|-------------------------|-------------------|------|
| Backlog → Todo | x-story-validator | After auto-fix and approval |
| Todo → In Progress | x-story-coordinator | First task execution starts |
| In Progress → To Review | x-story-coordinator | All tasks Done |
| **To Review → Done** | **x-story-quality-coordinator Pass 2** | **All tests verified, Priority ≥15 covered** |

**Why this matters**:
- x-story-quality-coordinator ONLY updates status in Pass 2 (Phase 3: Mark Story Done)
- x-story-quality-coordinator does NOT handle other transitions (Backlog → Todo, Todo → In Progress, In Progress → To Review)
- Clear ownership prevents duplicate updates from multiple skills
- x-story-quality-coordinator Pass 1 does NOT update Story status - it creates test/refactor tasks only

### L2→L2 Delegation: Invoked by x-story-coordinator

**Pattern:** Level 2 orchestrator ← Level 2 orchestrator delegation (see SKILL_ARCHITECTURE_GUIDE.md L2→L2 Rules)

| Delegation | When | Domain Separation | Rationale |
|------------|------|-------------------|-----------|
| **x-story-coordinator → x-story-quality-coordinator Pass 1** | After all implementation tasks Done | Task execution → Story quality validation | x-story-coordinator delegates quality verification (Code Quality, Regression, Manual Testing, Early Exit Pattern) |
| **x-story-coordinator → x-story-quality-coordinator Pass 2** | After test task Done | Task execution → Final approval | x-story-coordinator delegates final Story approval (test verification, Priority ≥15 coverage, Story → Done) |

**Why this skill is L2 (orchestrator, not L3 worker):**
- Pass 1 Phase 3: Executes code quality analysis directly (Grep for DRY/KISS/YAGNI, Read files)
- Pass 1 Phase 4: Executes regression testing directly (Bash test commands)
- Pass 1 Phase 5: Executes manual testing directly (curl/puppeteer, Linear comments)
- Pass 1 Phase 6: **Delegates to x-test-coordinator** via Skill tool (test task creation)
- Orchestrates quality validation flow with Early Exit Pattern (fail fast at each phase)

**Compliance with L2→L2 Rules:**
- ✅ Rule 1: Explicit Skill tool invocation (invoked by x-story-coordinator via `Skill(skill: "x-story-quality-coordinator")`)
- ✅ Rule 2: Sequential flow (Pass 1 → task execution → Pass 2, no parallel calls)
- ✅ Rule 3: Domain separation (quality validation vs task execution)
- ✅ Rule 4: DAG only (never calls back to x-story-coordinator, only creates tasks for it to execute)
- ✅ Rule 5: Documented in both SKILL.md files

**Self-Healing Pipeline Integration:**
- Pass 1 creates fix/refactor/test tasks in Backlog → x-story-coordinator loops back to Phase 3
- Pass 2 creates fix tasks if tests fail → x-story-coordinator loops back to Phase 3
- Enables automatic error recovery without manual intervention

### Pass 1 Definition of Done

**✅ Code Quality Analysis Complete (Phase 3):**
- [ ] x-code-quality-checker invoked via Skill tool
- [ ] Worker result received: JSON verdict ("PASS" | "ISSUES_FOUND")
- [ ] Worker added Linear comment with analysis results
- [ ] Verification result:
  - ✅ verdict = "PASS" → Proceeded to Phase 4 (Regression Check)
  - ❌ verdict = "ISSUES_FOUND" → Refactoring task created, Pass 1 stopped

**✅ Regression Check Complete (Phase 4):**
- [ ] x-regression-checker invoked via Skill tool
- [ ] Worker result received: JSON verdict ("PASS" | "FAIL")
- [ ] Worker added Linear comment with test execution summary
- [ ] Verification result:
  - ✅ verdict = "PASS" (failed = 0) → Proceeded to Phase 5 (Manual Testing)
  - ❌ verdict = "FAIL" (failed > 0) → Regression fix task created, Pass 1 stopped

**✅ Manual Functional Testing Complete (Phase 5):**
- [ ] x-manual-tester invoked via Skill tool
- [ ] Worker result received: JSON verdict ("PASS" | "FAIL")
- [ ] Worker created temporary script at path from result (scripts/tmp_[story_id].sh)
- [ ] Worker added Linear comment (Format v1.0) with structured test results
- [ ] Verification result:
  - ✅ verdict = "PASS" → Proceeded to Phase 6 (Verdict and Next Steps)
  - ❌ verdict = "FAIL" → Bug fix task created, Pass 1 stopped

**✅ Test Task Existence Checked (Phase 6 only):**
- [ ] All Story tasks loaded (via parentId = Story.id)
- [ ] Searched for task with label "tests"
- [ ] **If test task EXISTS:**
  - Test task status checked (Done / In Progress / To Review / Todo)
  - **If Done:** Skipped to Pass 2 (see Pass 2 Workflow)
  - **If NOT Done:** Reported to user with current status, exited without creating new task
- [ ] **If test task does NOT exist:** Proceeded to x-test-coordinator invocation

**✅ Verdict Determined (Phase 6):**
- [ ] **All Phase 3-4-5 passed** (Code Quality → Regression → Manual Testing)
- [ ] x-test-coordinator invoked AUTOMATICALLY (no user confirmation, ONLY if no test task exists)
- [ ] After completion: test task created in kanban_board.md with status Backlog

**Note:** Issues (code quality/regression/functional bugs) caught by Early Exit Pattern in Phase 3/4/5, NOT in Phase 6.

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

1. **Early Exit Pattern** - Fail fast at each phase (Code Quality → Regression → Manual Testing)
2. **Phase 3: Code Quality first** - No point running tests if code quality fundamentally flawed
3. **Phase 4: Regression before new features** - Catch broken tests early
4. **Phase 5: Test real functionality** - Use curl/puppeteer, document results (Format v1.0)
5. **Phase 6: E2E first** - Use Skill tool to invoke x-test-coordinator (Risk-Based Testing)
6. **Pass 2: Verify Priority ≥15 scenarios** - Tests must cover critical paths (money, security, core flows)
7. **Refactoring cycle** - Issues caught in Phase 3/4/5 → Fix → Re-run Pass 1 until clean

### Comparison with Other Reviews

| Aspect | x-story-validator | x-task-reviewer | x-story-quality-coordinator Pass 1 | x-story-quality-coordinator Pass 2 |
|--------|-------------------|-----------------|-------------------------|-------------------------|
| **When** | BEFORE work | AFTER each task | AFTER impl tasks | AFTER test task |
| **Scope** | Story structure | Single task | Entire Story (3 phases) | Tests |
| **Checks** | Plan validity | Task code | Code quality → Regression → Manual testing (Early Exit) | Priority ≥15 scenarios + test limits |
| **Can fail** | Yes → Backlog | Yes → To Rework | Yes at any phase → fix/refactor task (STOP) | Yes → fix tasks |
| **Output** | Story → Todo | Task → Done/Rework | test task (if all phases pass) OR fix/refactor task (if any phase fails) | Story → Done |

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

**Version:** 7.1.0
**Last Updated:** 2025-11-14

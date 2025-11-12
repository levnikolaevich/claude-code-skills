---
name: x-test-executor
description: Execute Story Finalizer test tasks from x-story-finalizer (11 sections). Risk-Based Testing (2-5 E2E, 3-8 Integration, 5-15 Unit, Priority ≥15). Includes Fix Existing Tests, Infrastructure Updates, Documentation Updates, Legacy Code Cleanup. Transitions Todo → In Progress → To Review.
---

# Story Finalizer Test Task Execution Skill

Execute approved Story Finalizer test tasks (Todo → In Progress → To Review) created by x-story-finalizer with comprehensive 11-section structure.

## When to Use This Skill

This skill should be used when executing Story Finalizer test task (status = Todo, created by x-story-finalizer) with 11 sections:
- **Section 8:** Fix Existing Tests (update tests affected by logic changes)
- **Section 3:** E2E Tests (2-5 max, Priority ≥15 user flows from manual testing)
- **Section 4:** Integration Tests (3-8 max, Priority ≥15 layer interactions)
- **Section 5:** Unit Tests (5-15 max, Priority ≥15 complex business logic)
- **Section 9:** Infrastructure Changes (package.json, Dockerfile, compose)
- **Section 10:** Documentation Updates (README, tests/README, CHANGELOG)
- **Section 11:** Legacy Code Cleanup (workarounds, backward compat, deprecated patterns)

**Note:** For implementation tasks (without test logic), use **x-task-executor** skill instead.

⚠️ **CRITICAL RULE - Single Task Updates:**
- ✅ Update status for ONLY the selected task (the one passed as parameter)
- ❌ NEVER update status for multiple tasks at once
- ❌ NEVER update status for all test tasks

## How It Works

### Phase 1: Discovery (Automated)

Auto-discovers project configuration:
- **Team ID:** Reads `docs/tasks/readme.md`, `docs/tasks/kanban_board.md` → Linear Configuration
- **Project Docs:** Reads `CLAUDE.md` → Links to `docs/core/`, `docs/guides/`
- **Tracker:** Linear MCP integration

### Phase 2: Preparation

**Steps:**
1. **Select task:**
   - If task ID provided → Fetch specific task
   - If no ID → List "Todo" tasks and ask user to choose
2. **Read task and parent story FULLY:**
   - Read task description COMPLETELY (no truncation) - verify 11 sections present
   - If task has parentId → Read parent User Story COMPLETELY (no truncation)
   - Understand acceptance criteria, context, test strategy from BOTH
3. **Create TodoWrite** todos with full workflow:
   - Update ONLY the selected task's status to "In Progress" (Linear via update_issue with task ID)
   - Update kanban_board.md (Todo → In Progress) for ONLY the selected task
   - **Step 1:** Fix Existing Tests (Section 8)
   - **Step 2:** Implement New Tests E2E→Integration→Unit (Sections 3-5, Priority ≥15)
   - **Step 3:** Update Infrastructure (Section 9)
   - **Step 4:** Update Documentation (Section 10)
   - **Step 5:** Cleanup Legacy Code (Section 11)
   - **Step 6:** Final Verification (all tests pass, 10-28 total)
   - Quality gates: type checking, linting, all existing tests pass, all new tests pass
   - Update task description with completed checkboxes (replace `- [ ]` with `- [x]`)
   - Add test summary comment
   - Update ONLY the selected task's status to "To Review" (Linear via update_issue with task ID)
   - Update kanban_board.md (In Progress → To Review) for ONLY the selected task
4. **Study Project Test Infrastructure:**
   Before implementation, understand testing setup:
   - Read tests/README.md (commands, setup, test requirements)
   - Review test configs (jest.config.js/pytest.ini - framework version)
   - Study existing tests (browse tests/ structure and patterns)
   - Verify test limits (2-5 E2E, 3-8 Integration, 5-15 Unit, 10-28 total)
   - Add to TodoWrite: verify test commands work
5. **Execute first todo:** Update status to "In Progress" in Linear
6. **Execute second todo:** Update kanban_board.md to reflect status change

### Phase 3: Story Finalizer Task Implementation (11 Sections)

**6-Step Workflow Following Task Structure:**

**Step 1: Fix Existing Tests (Section 8)**
- Load Section 8 "Existing Tests to Fix/Update" from task description
- For each affected test file:
  - Understand why it fails (changed behavior, new API contract, updated mocks)
  - Apply fix according to task description (update setup, assertions, mocked dependencies)
  - Verify test passes
- Run all existing tests suite
- **CRITICAL:** All existing tests MUST pass before proceeding to Step 2

**Step 2: Implement New Tests (Sections 3-5, E2E-first Risk-Based Testing, Priority ≥15)**

**Note:** Risk assessment completed by x-story-finalizer. Task contains exact scenarios with Priority scores.

2.1. **E2E Tests (2-5 max) - FIRST:**
   - **Task contains exact scenarios** from manual testing (curl/puppeteer results)
   - Follow task's Section 3 "E2E Tests" step-by-step
   - Implement scenarios that were manually verified (Happy path + critical edge cases + error scenarios)

2.2. **Integration Tests (3-8 max) - SECOND:**
   - **Task identifies layer interactions** from E2E flows with Priority ≥15
   - Follow task's Section 4 "Integration Tests"
   - Test layer interactions, database queries, transactions NOT fully covered by E2E

2.3. **Unit Tests (5-15 max) - THIRD:**
   - **Task identifies complex business logic** with Priority ≥15
   - Follow task's Section 5 "Unit Tests"
   - Test financial calculations, security logic, complex algorithms NOT covered by E2E
   - **SKIP:** Simple CRUD, framework code, trivial conditionals, getters/setters

**Reference:** See `x-story-finalizer/references/risk_based_testing_guide.md` for complete Risk-Based Testing methodology, test limits (2-5/3-8/5-15, total 10-28 max), and test selection criteria.

**Step 3: Update Infrastructure (Section 9)**
- Load Section 9 "Infrastructure Changes" from task description
- Update package.json (test dependencies with exact versions)
- Update Dockerfile (test environment setup)
- Update docker-compose.yml (test services, environment variables)
- Update test configs (jest.config.js, vitest.config.ts, pytest.ini, etc.)
- Verify: docker-compose up, npm install succeed

**Step 4: Update Documentation (Section 10)**
- Load Section 10 "Documentation Updates" from task description
- Update tests/README.md:
  - New test commands (npm test, npm run test:e2e, etc.)
  - Test structure changes (if new patterns used)
  - Test data setup/teardown instructions
  - Troubleshooting section
- Update README.md (main):
  - Feature documentation (what was tested and how)
  - Setup instructions (if new dependencies added)
  - Testing section (how to run tests for this feature)
- Update CHANGELOG.md:
  - Document test coverage (X E2E, Y Integration, Z Unit)
  - Note Priority ≥15 scenarios covered
- Update other docs (API docs, architecture, deployment guide as needed)

**Step 5: Cleanup Legacy Code (Section 11)**
- Load Section 11 "Legacy Code Cleanup" from task description
- Remove workarounds/hacks (with justification from task)
- Remove backward compatibility code (if safe per task analysis)
- Remove deprecated patterns (replace with new patterns from this Story)
- Remove dead code (unused functions, commented-out blocks)
- **Verify:** All tests still pass after cleanup

**Step 6: Final Verification**
- All existing tests pass (from Step 1)
- All new tests pass (from Step 2)
- Infrastructure works (from Step 3)
- Documentation complete (from Step 4)
- Legacy code removed safely (from Step 5)

### Phase 4: Quality & Handoff

**Quality gates (all must pass):**
1. **Type checking:** No type errors
2. **Linting:** Code formatting correct
3. **All existing tests pass:** Tests from Step 1 (Fix Existing Tests) all green
4. **All new tests pass:** E2E (2-5) → Integration (3-8) → Unit (5-15) (no failures)
5. **Test limits:** Total tests 10-28 (within enforced range)
6. **Priority ≥15 scenarios:** All critical scenarios from manual testing tested
7. **Infrastructure works:** docker-compose up, npm install succeed
8. **Documentation complete:** tests/README.md, README.md, CHANGELOG.md updated
9. **Legacy code removed safely:** All tests still pass after cleanup

**Linear update:**
1. Update task description: Replace all `- [ ]` with `- [x]` to mark checkboxes completed (via `update_issue`)
2. Add test summary comment:
   - Existing tests fixed: X tests
   - New tests implemented: E2E Y, Integration Z, Unit W (total N)
   - Infrastructure updated: package.json, Dockerfile, compose
   - Documentation updated: README, tests/README, CHANGELOG
   - Legacy cleanup: M items removed
   - Priority ≥15 scenarios: All covered
3. Move task: "In Progress" → "To Review"
4. Update kanban_board.md (In Progress → To Review)

---

## Definition of Done

Before completing work, verify ALL checkpoints:

**✅ Story Finalizer Task Implementation Complete (11 Sections, 6 Steps):**
- [ ] **Step 1:** Existing tests fixed (Section 8: all affected tests updated and passing)
- [ ] **Step 2:** New tests implemented (Sections 3-5):
  - E2E tests (2-5 tests, Priority ≥15 scenarios from manual testing)
  - Integration tests (3-8 tests, Priority ≥15 layer interactions NOT covered by E2E)
  - Unit tests (5-15 tests, Priority ≥15 complex business logic: financial, security, algorithms)
  - Total test count within 10-28 limit (enforced)
  - No test duplication: Each test adds unique business value
- [ ] **Step 3:** Infrastructure updated (Section 9: package.json, Dockerfile, compose, test configs)
- [ ] **Step 4:** Documentation updated (Section 10: tests/README.md, README.md, CHANGELOG.md)
- [ ] **Step 5:** Legacy code removed (Section 11: workarounds, backward compat, deprecated patterns)
- [ ] **Step 6:** Final verification (all tests pass, infra works, docs complete)

**✅ Risk-Based Testing Compliance:**
- [ ] All Priority ≥15 scenarios from manual testing tested
- [ ] Priority <15 scenarios skipped (manual testing sufficient)
- [ ] "Test OUR code, not frameworks" - Only business logic tested (no Express, React, Prisma framework tests)
- [ ] Trivial code skipped (simple CRUD, getters/setters, framework code)

**✅ Quality Gates Passed:**
- [ ] Type checking: No type errors
- [ ] Linting: Code formatting compliant
- [ ] **All existing tests pass:** Tests from Section 8 (Fix Existing Tests) all green
- [ ] **All new tests pass:** E2E (2-5) + Integration (3-8) + Unit (5-15) = 10-28 total (no failures)
- [ ] Test execution speed: Unit <5s, Integration <30s, E2E <2min total
- [ ] No flaky tests (tests pass consistently)
- [ ] Infrastructure works: docker-compose up, npm install succeed
- [ ] Legacy code removed safely: All tests still pass after cleanup

**✅ Documentation Updated (Section 10):**
- [ ] Inline comments in test files (WHY this test needed, business value tested)
- [ ] tests/README.md updated:
  - New test commands added (npm test, npm run test:e2e, etc.)
  - Test structure changes documented
  - Test data setup/teardown instructions
  - Troubleshooting section
- [ ] README.md (main) updated:
  - Feature documentation (what was tested and how)
  - Setup instructions (if new dependencies added)
  - Testing section (how to run tests for this feature)
- [ ] CHANGELOG.md updated:
  - Test coverage documented (X E2E, Y Integration, Z Unit)
  - Priority ≥15 scenarios noted

**✅ CRITICAL: Single Task Update Verified:**
- [ ] Verified via Linear: ONLY the selected task (input task ID) status was updated
- [ ] Verified via Linear: NO other tasks in the Story were updated
- [ ] Verified via kanban_board.md: ONLY one task line moved between sections

**✅ Linear Updated:**
- [ ] Task description updated: All checkboxes marked [x] (replaced `- [ ]` with `- [x]` via update_issue)
- [ ] Test summary comment added to Linear:
  - "**Existing Tests Fixed:** X tests (Section 8)"
  - "**New Tests:** E2E Y tests (scenarios: list), Integration Z tests (interactions: list), Unit W tests (logic: list)"
  - "**Total:** N tests (within 10-28 limit)"
  - "**Priority ≥15 scenarios:** All covered"
  - "**Infrastructure:** package.json, Dockerfile, compose updated (Section 9)"
  - "**Documentation:** README, tests/README, CHANGELOG updated (Section 10)"
  - "**Legacy Cleanup:** M items removed (Section 11)"
- [ ] Task status changed: "In Progress" → "To Review"
- [ ] kanban_board.md updated (In Progress → To Review)

**✅ Handoff Ready:**
- [ ] Chat output prefix used: ⚙️ [EXECUTOR] for all messages
- [ ] Final message: "Story Finalizer task complete. 6 steps executed (Fix Tests + New Tests + Infrastructure + Documentation + Legacy Cleanup + Verification). All quality gates passed. Ready for review."

**Output:** Story Finalizer test task ready for x-task-reviewer (status "To Review")

---

## Example Usage

**Direct invocation:**
```
Execute test task API-99
```

**For Story:**
```
Implement tests for Story US001
```

## Best Practices

1. **Fix Existing Tests First (Step 1):** All existing tests must pass before implementing new tests
2. **E2E First (Step 2):** Implement E2E tests first (from manual testing Priority ≥15), then Integration, then Unit
3. **Follow task description:** All 11 sections contain specific instructions from x-story-finalizer analysis
4. **Test limits enforced:** 2-5 E2E, 3-8 Integration, 5-15 Unit, total 10-28 max
5. **Priority-based:** Only Priority ≥15 scenarios (money, security, core flows)
6. **Test OUR code:** Don't test frameworks or external libraries
7. **Skip trivial code:** No tests for simple CRUD, framework code, getters/setters (E2E covers them)
8. **Fast feedback:** Unit tests must be fast (<5s), Integration moderate (<30s), E2E acceptable (<2min)
9. **Infrastructure updates (Step 3):** Use exact versions from task, verify docker-compose up works
10. **Documentation completeness (Step 4):** Update ALL docs (tests/README, README, CHANGELOG)
11. **Safe cleanup (Step 5):** Verify all tests still pass after removing legacy code
12. **No flaky tests:** All tests deterministic and stable
13. **Chat output prefix:** Always use ⚙️ [EXECUTOR] prefix for user visibility when orchestrated

---

**Version:** 4.0.0 (BREAKING: Story Finalizer 11-section workflow)
**Last Updated:** 2025-11-08

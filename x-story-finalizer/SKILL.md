---
name: x-story-finalizer
description: Create final Story task after manual testing passes. Analyzes Story, all implementation tasks, and test results to generate comprehensive test task with 11 sections - E2E/Integration/Unit tests (Risk-Based), test fixes, infrastructure updates, documentation, and legacy cleanup. Invoked by x-story-reviewer Pass 1.
---

# Story Finalizer Task Creator

Creates final Story task with comprehensive test coverage (Unit/Integration/E2E) PLUS existing test fixes, infrastructure updates, documentation, and legacy cleanup based on REAL manual testing results.

## When to Use This Skill

This skill should be used when:
- **Invoked by x-story-reviewer Pass 1** after manual functional testing PASSED
- **Invocation method:** Use Skill tool with command: `Skill(command: "x-story-finalizer")`
- All implementation tasks in Story are Done
- Manual testing results documented in Linear comment
- Create final Story task covering: tests, test fixes, infrastructure, documentation, legacy cleanup

**Prerequisites:**
- All implementation Tasks in Story status = Done
- x-story-reviewer Pass 1 completed manual testing
- Manual test results in Linear comment (created by x-story-reviewer Phase 3 step 4)

## When NOT to Use

Do NOT use if:
- Manual testing NOT completed → Wait for x-story-reviewer Pass 1
- Manual test results NOT in Linear comment → x-story-reviewer must document first
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
1. Fetch **Story** from Linear (must have label "user-story")
2. Extract **Story.id** (UUID) from loaded Story object
   - ⚠️ **Critical:** Use Story.id (UUID), NOT short ID (e.g., "API-97")
   - Linear API requires UUID for parentId filter in list_issues and for parentId when creating child task
3. Load **all Linear comments** for this Story
4. Find **manual test results comment** with structured format:
   - Search for comment starting with `## 🧪 Manual Testing Results`
   - Verify `**Format Version:** 1.0` is present in header
   - Extract Story ID from header to confirm match
   - If not found → ERROR: "Manual testing results not found. Run x-story-reviewer Pass 1 first."
5. Parse structured sections using regex patterns:
   - **Acceptance Criteria section** (`^### Acceptance Criteria`):
     - Extract each AC with Given-When-Then format
     - Provides context for what functionality was tested
   - **Test Results by AC section** (`^### Test Results by AC`):
     - For each AC: extract status (✅ PASS / ❌ FAIL), method (curl/puppeteer), actual result
     - PASSED AC → basis for E2E tests
     - FAILED AC → flag as implementation issue
   - **Edge Cases Discovered section** (`^### Edge Cases Discovered`):
     - Parse numbered list: input, expected, actual, status
     - Each edge case → additional Unit or Integration test
   - **Error Handling Verified section** (`^### Error Handling Verified`):
     - Parse markdown table: HTTP code, scenario, error message
     - Each verified error → error handling test case
   - **Integration Testing section** (`^### Integration Testing`):
     - Extract component flow descriptions (API → Service → Repository)
     - Integration flow → Integration test suite
6. Map parsed data to test design structure:
   - Each PASSED AC + its method → 1 E2E test (copy curl/puppeteer code as test base)
   - Each edge case with PASS → Unit test
   - Each verified error code → Error handling test
   - Integration flow → Integration test covering component interactions

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

**Process:** Locate Linear comment with "## 🧪 Manual Testing Results" header → Verify Format Version 1.0 → Extract structured sections (Acceptance Criteria, Test Results by AC, Edge Cases, Error Handling, Integration Testing) using regex → Validate (at least 1 PASSED AC, AC count matches Story, completeness check) → Map parsed data to test design structure

**Error Handling:** Missing comment → ERROR (run x-story-reviewer Pass 1 first), Missing format version → WARNING (try legacy parsing), Required section missing → ERROR (re-run x-story-reviewer), No PASSED AC → ERROR (fix implementation)

### Phase 4: Risk-Based Test Planning (Automated)

**Reference:** See `references/risk_based_testing_guide.md` for detailed methodology

**Note:** This Phase applies Risk-Based Testing methodology from `references/risk_based_testing_guide.md`. See guide for complete Business Impact/Probability scoring tables, test selection examples, and anti-patterns.

**E2E-First Approach: Prioritize by business risk, not coverage metrics**

**Step 1: Risk Assessment of Manual Test Results**

For each scenario from Phase 2 Step 1 (manual testing), calculate Risk Priority:

```
Priority = Business Impact (1-5) × Probability of Failure (1-5)
```

**Decision Criteria:**
- Priority ≥15 → **MUST test**
- Priority 9-14 → **SHOULD test** if not already covered
- Priority ≤8 → **SKIP** (manual testing sufficient)

*See `references/risk_based_testing_guide.md` for complete Business Impact/Probability scoring tables.*

**Step 2: E2E Test Selection (2-5 tests max)**

**Minimum Viable Testing Philosophy: Start with 2 E2E tests per endpoint, add more ONLY with critical justification**

1. **BASELINE (ALWAYS - 2 E2E tests per endpoint):**
   - **Positive scenario:** Happy path validating main AC (from manual testing PASSED)
   - **Negative scenario:** Critical error handling (validation failure, auth error, not found)

2. **Determine E2E type:**
   - API: Use HTTP client (requests, axios, fetch) with full request from manual test results
   - UI: Use browser automation (Playwright, Selenium) with full interaction flow

3. **ADDITIONAL E2E (3-5) - ONLY if Priority ≥15 AND justification provided:**
   - Critical edge case from manual testing (Priority ≥15)
   - Critical error scenario from manual testing (Priority ≥15)
   - (RARE) Second endpoint if Story implements multiple endpoints

4. **Critical Justification Check (for tests 3-5):**
   - ✅ **Tests OUR business logic?** (not framework/library/database)
   - ✅ **Priority ≥15?** (money, security, data integrity)
   - ✅ **Not already covered by 2 baseline E2E?**
   - ✅ **Unique business value?** (not duplicate coverage)
   - ❌ If ANY answer is NO → SKIP this test

5. **Document exact steps** from manual test results:
   - Copy curl commands or puppeteer code as test base
   - Use actual inputs/outputs from manual testing

**Anti-Duplication Rule:** If 2 E2E tests cover same flow, keep only highest Priority

**Anti-Framework Rule:** If test validates framework behavior (Express routing, Prisma query, React hooks) → SKIP

**Step 3: Unit Test Selection (0-15 tests max)**

**Default: 0 Unit tests** (2 E2E tests cover simple logic already)

**Add Unit test ONLY for complex business logic with Priority ≥15 AND each test requires justification:**

1. **ONLY test complex business logic** (Priority ≥15):
   - **Financial calculations:** Tax computation with country-specific rules, currency conversion with rates, discount calculation with business rules
   - **Security algorithms:** Password strength validation (custom rules), permission matrix calculation, token generation with custom logic
   - **Complex business algorithms:** Scoring/ranking with multiple factors, matching algorithm with weights, data transformation with business rules

2. **MANDATORY SKIP - DO NOT create unit tests for:**
   - ❌ Simple CRUD operations (already covered by E2E)
   - ❌ Framework code (Express middleware, React hooks, FastAPI dependencies)
   - ❌ Library functions (bcrypt hashing, jsonwebtoken signing, axios requests)
   - ❌ Database queries (Prisma findMany, TypeORM query builder, SQL joins)
   - ❌ Getters/setters or simple property access
   - ❌ Trivial conditionals (`if (user) return user.name`, `status === 'active'`)
   - ❌ Pass-through functions (wrappers without logic)
   - ❌ Performance/load testing (throughput, latency, stress tests, scalability)

3. **Critical Justification Check (for EACH unit test):**
   - ✅ **Tests OUR complex business logic?** (not library/framework/database)
   - ✅ **Priority ≥15?** (financial/security/critical algorithm)
   - ✅ **Not already covered by 2 E2E tests?** (E2E doesn't exercise all branches)
   - ✅ **Unique business scenario?** (not duplicate of other unit test)
   - ❌ If ANY answer is NO → SKIP this unit test

4. **One test per unique business scenario:**
   - Happy path for complex function
   - Edge cases discovered in manual testing (Priority ≥15 only)
   - Error conditions with Business Impact ≥4

5. **List dependencies to mock:**
   - External services, databases, filesystem

**Anti-Duplication Rule:** If E2E test already exercises this logic with all branches, SKIP unit test

**Anti-Framework Rule:** If test validates bcrypt/jwt/axios/Prisma behavior → SKIP (test library, not our code)

**Step 4: Integration Test Selection (0-8 tests max)**

**Default: 0 Integration tests** (2 E2E tests cover full stack already)

**Add Integration test ONLY if E2E doesn't cover interaction completely AND Priority ≥15:**

1. **Identify layer interactions** from E2E flows (Priority ≥15):
   - API → Service → Repository → DB
   - Service → External API (payment, email)
   - Service → Queue → Background worker

2. **Plan integration points:**
   - Real dependencies: DB, filesystem, internal services
   - Mock dependencies: External APIs, payment, email

3. **Add Integration test ONLY for interactions NOT fully covered by 2 E2E:**
   - Transaction rollback on error (E2E tests happy path only)
   - Concurrent request handling (E2E tests single request)
   - External API error scenarios (500, timeout) if Priority ≥15

4. **MANDATORY SKIP - DO NOT create integration tests for:**
   - ❌ Simple pass-through calls (E2E already validates end-to-end)
   - ❌ Testing framework integrations (Prisma client, TypeORM repository, Express app)
   - ❌ Testing database query execution (database engine behavior)
   - ❌ Testing library integrations (axios interceptors, Redis client)
   - ❌ Performance/load testing (separate performance test suite with dedicated tools)

5. **Critical Justification Check (for EACH integration test):**
   - ✅ **Tests OUR integration logic?** (not framework/library integration)
   - ✅ **Priority ≥15?** (critical interaction failure)
   - ✅ **Not already covered by 2 E2E tests?** (E2E doesn't test this interaction path)
   - ✅ **Unique interaction scenario?** (not duplicate)
   - ❌ If ANY answer is NO → SKIP this integration test

**Anti-Duplication Rule:** If E2E test covers integration point end-to-end, SKIP separate integration test

**Anti-Framework Rule:** If test validates Prisma/TypeORM/Express integration → SKIP (test framework, not our code)

**Step 5: Validation and Auto-Trimming**

1. **Check test limits (HARD LIMITS):**
   - E2E: 2-5 ✓ (baseline 2, additional 0-3)
   - Integration: 0-8 ✓ (default 0, add only if justified)
   - Unit: 0-15 ✓ (default 0, add only for complex business logic)
   - **Total: 2-28 tests** ✓
   - **REALISTIC GOAL: 2-7 tests per Story** (not 10-28!)

2. **Auto-trim if exceeding realistic goal (>7 tests):**
   - Keep 2 baseline E2E tests (positive + negative) - ALWAYS
   - Sort remaining tests by Priority (descending)
   - Keep top Priority tests until reaching 7 total
   - Document trimmed tests: "Scenario X (Priority Y) skipped - covered by manual testing"

3. **Ensure no duplication:**
   - Each test validates unique business value
   - No overlap between E2E/Integration/Unit
   - If 2 tests cover same scenario → keep only higher Priority

4. **Verify Priority ≥15 scenarios covered:**
   - All PASSED AC from manual testing → covered by 2 baseline E2E
   - All Priority ≥15 edge cases → Unit or Integration tests (if not covered by E2E)

5. **Document skipped scenarios:**
   - List scenarios with Priority ≤14 (manual testing sufficient)
   - List trimmed scenarios (Priority <15 or duplicates)
   - Explain why 2-7 tests acceptable (focus on business risk, not coverage %)

6. **Final justification check:**
   - For EACH test beyond 2 baseline E2E: documented justification why it tests OUR business logic
   - If any test lacks justification → REMOVE from plan

### Phase 5: Generation and Impact Analysis (Automated)

Generates complete story finalizer task per `test_task_template.md` with 11 sections.

**Step 1: Analyze Existing Tests** (for Section 8)

1. Scan test files in project directory (from Phase 2 Step 0 data)
2. Identify tests covering changed code paths:
   - Read each implementation Task's "Affected Components" section
   - Search test files for imports/references to affected components
   - Check test names matching affected modules/functions
3. Determine which tests might fail due to logic changes:
   - Component behavior changed → tests with assertions on old behavior
   - API contract changed → tests with old request/response format
   - Function signature changed → tests calling with old parameters
4. Document for each affected test:
   - Test file path
   - Reason for failure (link to Task that changed behavior)
   - Required fix (update setup/assertions/mocks)

**Step 2: Analyze Infrastructure** (for Section 9)

1. Check if new test dependencies needed:
   - From Story Test Strategy: new test framework features?
   - From Risk Priority Matrix: need browser automation (Playwright)?
   - From integration tests: need test database client?
2. Scan Dockerfile/docker-compose for test environment setup:
   - Check if test services exist (test DB, mock servers)
   - Verify test environment variables defined
3. Check test configuration files:
   - jest.config.js, vitest.config.ts, pytest.ini presence
   - Coverage thresholds defined
   - Test scripts in package.json
4. Document required changes:
   - package.json: new devDependencies with versions
   - Dockerfile/compose: test service setup
   - Config files: new settings needed

**Step 3: Analyze Documentation** (for Section 10)

1. Check tests/README.md:
   - Does it document test commands for this feature?
   - Does it explain test structure (if new patterns used)?
2. Check README.md (main):
   - Does feature documentation need updates?
   - Are setup instructions current (new dependencies)?
3. Check CHANGELOG.md:
   - Document test coverage changes
4. Document updates needed:
   - File → section → specific update required → reason

**Step 3.5: Analyze Configuration Management** (for Section 10)

1. Identify configuration values introduced in Story:
   - Scan Implementation Tasks for magic numbers (timeouts, limits, thresholds)
   - Check for new API endpoints or URLs
   - Look for feature flags or environment-specific settings
2. Check configuration documentation:
   - README.md: Are new environment variables documented?
   - Config files: Are default values and valid ranges documented?
   - .env.example: Are new variables listed with descriptions?
3. Document configuration updates needed:
   - README.md → Environment Variables section → Add new vars with WHY explanations
   - Config files → Add comments explaining value choices
   - .env.example → Add entries with default values and valid ranges

**Step 4: Analyze Legacy Code** (for Section 11)

1. Scan changed modules for legacy markers:
   - Search for TODO/HACK/FIXME comments in affected files
   - Look for "deprecated" comments or docstrings
2. Check for backward compatibility code:
   - Old API versions in affected endpoints
   - Feature flags for old behavior
   - Compatibility shims/adapters
3. Identify deprecated patterns in affected areas:
   - Old patterns replaced by this Story's implementation
   - Dead code paths no longer reachable
4. Document cleanup items:
   - File → legacy item → justification for safe removal → verification method

**Step 5: Generate Complete Story Finalizer Task** (11 sections)

Generates complete task per `test_task_template.md`:

1. **Context:** Story goal + implemented features + manual test results summary
2. **Risk Priority Matrix:** Table with all scenarios, Business Impact, Probability, Priority, Test Type decision
3. **E2E Tests (2-5 max):** Baseline 2 (positive/negative) + additional 0-3 with Priority ≥15
   - Each scenario with Priority score
   - Exact steps documented (from curl/puppeteer results)
   - Expected outcomes (verified during manual testing)
   - Justification for each test beyond baseline 2 (why it tests OUR business logic)
4. **Integration Tests (0-8 max):** ONLY if E2E doesn't cover interaction AND Priority ≥15
   - Integration points with risk assessment
   - Real vs mocked dependencies
   - Scenarios NOT fully covered by 2 baseline E2E
   - Justification for each test (why it tests OUR integration logic)
5. **Unit Tests (0-15 max):** ONLY complex business logic with Priority ≥15
   - Functions requiring unit tests (financial, security, complex algorithms)
   - Edge cases from manual testing (Priority ≥15 only)
   - Mocked dependencies
   - Justification for each test (why it tests OUR business logic, not library/framework)
   - Skipped scenarios (already covered by 2 baseline E2E)
6. **Critical Path Coverage:** What MUST be tested vs what can be skipped
7. **Definition of Done:** All tests pass, all Priority ≥15 scenarios tested, **realistic goal: 2-7 tests** (max 28), no flaky tests, each test beyond baseline 2 has documented justification
8. **Existing Tests to Fix/Update:** From Step 1 analysis (affected tests + why + fixes needed)
9. **Infrastructure Changes:** From Step 2 analysis (packages, Docker, configs)
10. **Documentation Updates:** From Step 3 analysis (tests/README, main README, CHANGELOG, etc.)
11. **Legacy Code Cleanup:** From Step 4 analysis (workarounds, backward compat, deprecated patterns, dead code)

Shows preview for review.

### Phase 6: Confirmation & Creation

1. User reviews generated story finalizer task
2. Type "confirm" to proceed
3. Creates Linear Issue with:
   - Title: "Story Finalizer: [Story Title]"
   - Description: Complete finalizer task markdown (11 sections)
   - **parentId: Story.id** (UUID of final task's parent Story)
   - project: Epic (inherited from Story)
   - Labels: ["tests"]
4. Update kanban_board.md:
   - Add final test task under Story in appropriate section (usually "### Backlog" or "### Todo")
   - Update Epic Story Counters table (Last Task, Next Task)
5. Returns Linear issue URL

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

**✅ Object Created in Linear:**
- [ ] Linear Task Issue created successfully
- [ ] Title: "Story Finalizer: [Story Title]"
- [ ] parentId set to Story ID (final task of Story)
- [ ] Label "tests" added
- [ ] Epic inherited from Story

**✅ Tracking Updated:**
- [ ] kanban_board.md updated:
  - Final test task added under Story in appropriate section
  - Epic Story Counters table updated (Last Task, Next Task)
- [ ] Linear Issue URL returned to user

**✅ User Confirmation:**
- [ ] User reviewed generated story finalizer task before creation
- [ ] User typed "confirm" to proceed with creation

**Output:** Linear Issue URL + confirmation message ("Created story finalizer task for Story US00X")

---

## Example Usage

**Context:**
- x-story-reviewer Pass 1 completed manual testing
- Manual test results in Linear comment (3 AC PASSED, 2 edge cases discovered, error handling verified)

**Invocation (by x-story-reviewer via Skill tool):**
```
Skill tool, command: "x-story-finalizer", Story ID: US001
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
7. Confirmation → Creates final Task with parentId=US001, label "tests"

## Reference Files

- **risk_based_testing_guide.md:** Risk Priority Matrix, test limits, decision tree, anti-patterns
- **test_task_template.md:** Story finalizer task structure (11 sections: tests + fixes + infrastructure + docs + cleanup)
- **../x-epic-creator/references/linear_integration.md:** Linear API reference

## Best Practices

**Minimum Viable Testing Philosophy:** Start with 2 E2E tests per endpoint (positive + negative). Add more tests ONLY with critical justification. **Realistic goal: 2-7 tests per Story** (not 10-28). Each test beyond baseline 2 MUST justify: "Why does this test OUR business logic (not framework/library/database)?"

**Risk-Based Testing:** Prioritize by Business Impact × Probability (not coverage metrics). Test limits: 2-5 E2E (baseline 2 + additional 0-3), 0-8 Integration (default 0), 0-15 Unit (default 0). E2E-first from ACTUAL manual testing results. Priority ≥15 scenarios covered by tests, Priority ≤14 covered by manual testing.

**Anti-Duplication:** Each test validates unique business value. If 2 baseline E2E cover it, SKIP unit test. Test OUR code only (not frameworks/libraries/database queries). Focus on complex business logic ONLY (financial calculations, security algorithms, complex business rules). MANDATORY SKIP: CRUD, getters/setters, trivial conditionals, framework code, library functions, database queries.

**Auto-Trim:** If test plan exceeds 7 tests → auto-trim to 7 by Priority. Keep 2 baseline E2E always, trim lowest Priority tests. Document trimmed scenarios: "Covered by manual testing".

---

**Version:** 4.0.0
**Last Updated:** 2025-11-11

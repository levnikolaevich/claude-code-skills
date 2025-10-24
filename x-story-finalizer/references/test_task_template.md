# Tests for Story: [Story Title]

**User Story:** [USXXX Story Name](link) *(parent task - this is the FINAL task of Story)*
**Epic:** [Epic N - Epic Name](link)

---

## Context

### Story Goal
[Story statement from parent: As a... I want... So that...]

### Implemented Features
List of completed implementation tasks in this Story:
- [API-XX: Task Name](link) - What was implemented
- [API-YY: Task Name](link) - What was implemented

### What to Test
All business logic implemented across Story Tasks:
- Components/modules added or modified
- Integration points established
- Business flows enabled

---

## Risk Priority Matrix

**Reference:** See `risk_based_testing_guide.md` for detailed methodology

**Priority Formula:** Priority = Business Impact (1-5) × Probability of Failure (1-5)

| Scenario | Business Impact | Probability | Priority | Test Type | Notes |
|----------|----------------|-------------|----------|-----------|-------|
| [Scenario from manual testing] | [1-5] | [1-5] | [1-25] | E2E/Integration/Unit/SKIP | [Reason for decision] |
| [Scenario from manual testing] | [1-5] | [1-5] | [1-25] | E2E/Integration/Unit/SKIP | [Reason for decision] |

**Test Limits:** 2-5 E2E, 3-8 Integration, 5-15 Unit per Story (10-28 total max)

**Principles:**
- ✅ Prioritize by business risk (money, security, data corruption) over coverage metrics
- ✅ Test OUR code only (not frameworks/libraries/external systems)
- ✅ Anti-Duplication: If E2E covers logic, SKIP unit test
- ✅ Fast feedback: Unit (ms) → Integration (seconds) → E2E (tens of seconds)
- ✅ Focus on critical paths (Priority ≥15), not blanket coverage

**Decision Criteria:**
- Priority ≥15 → MUST test
- Priority 9-14 → SHOULD test if not already covered
- Priority ≤8 → SKIP (manual testing sufficient)

---

## E2E Tests (2-5 max)

Test complete user journeys through the system. **ONLY Priority ≥15 scenarios from manual testing.**

**Type:** [API E2E / UI E2E] *(depending on application type)*

### [Critical Scenario 1]: [User Journey Name] (Priority [XX])

**From Manual Testing:** [Link to AC or edge case in manual test results]

**Business Impact:** [1-5] - [Why critical: money/security/core flow]
**Probability of Failure:** [1-5] - [Why risky: complexity/external API/new tech]
**Priority:** [Business Impact × Probability] = [Result]

**Test Flow (copied from manual testing):**
1. **Setup:** [Initial state/preconditions from manual testing]
2. **Step 1:** [User action from curl/puppeteer] → **Verify:** [Expected result verified manually]
3. **Step 2:** [User action] → **Verify:** [Expected result]
4. **Step 3:** [User action] → **Verify:** [Final outcome]
5. **Cleanup:** [Teardown actions]

**Test:**
- [ ] `test_e2e_[scenario_name]` - Full journey from start to finish

**Anti-Duplication Check:**
- ✅ This E2E test is necessary because: [Unique business value not covered by other tests]

### [Critical Scenario 2]: [User Journey Name] (Priority [XX])

**From Manual Testing:** [Link to AC or edge case]

**Business Impact:** [1-5]
**Probability of Failure:** [1-5]
**Priority:** [Result]

**Test Flow:**
1. **Setup:** [Initial state]
2. **Actions & Verifications:** [Step-by-step user journey]
3. **Cleanup:** [Teardown]

**Test:**
- [ ] `test_e2e_[scenario_name]` - Description

**Anti-Duplication Check:**
- ✅ This E2E test is necessary because: [Reason]

### Standards
- [ ] Maximum 5 E2E tests per Story
- [ ] All scenarios Priority ≥15
- [ ] E2E tests run in < 2 minutes total
- [ ] Test against stable environment (staging/test)
- [ ] Based on ACTUAL manual testing results (not theoretical scenarios)
- [ ] Clean up test data after execution

---

## Integration Tests (3-8 max)

Test OUR business logic with REAL internal dependencies. **ONLY Priority ≥15 interactions NOT fully covered by E2E.**

### [Integration Point 1]: [Layer Interaction] (Priority [XX])

**Scope:** [Layer A] → [Layer B] → [Layer C] (e.g., API → Service → Repository → DB)

**Why Integration Test Needed:**
- E2E test covers happy path, but need to verify: [Transaction rollback / Error handling / Concurrency]
- Business Impact: [1-5] - [Reason]
- Probability: [1-5] - [Reason]
- Priority: [Result]

**Tests:**
- [ ] `test_[flow]_integration` - Verifies complete data flow through layers
  - **Given:** [Setup: real DB with test data]
  - **When:** [Action: call Layer A]
  - **Then:** [Verify: data correctly flows and persists in DB]

**Use Real:**
- Database (test instance)
- Filesystem (temp directory)
- Internal services

**Use Mocks:**
- External API calls
- Email/SMS services
- Payment gateways

**Anti-Duplication Check:**
- ✅ This integration test adds value because: [E2E doesn't test error scenario / E2E doesn't test concurrent requests]

### [Integration Point 2]: [Description] (Priority [XX])

**Scope:** [Description of integration]

**Why Integration Test Needed:**
- [Reason E2E insufficient]
- Priority: [Result]

**Tests:**
- [ ] `test_[integration_scenario]` - What interaction this verifies

**Anti-Duplication Check:**
- ✅ Adds value because: [Reason]

### Standards
- [ ] Maximum 8 integration tests per Story
- [ ] All scenarios Priority ≥15
- [ ] Use test database (not production)
- [ ] Clean up after each test (rollback/truncate)
- [ ] All integration tests run in < 30 seconds total
- [ ] Skip if E2E already validates end-to-end

---

## Unit Tests (5-15 max)

Test individual components in isolation with all dependencies mocked. **ONLY complex business logic with Priority ≥15.**

**SKIP unit tests for:**
- ❌ Simple CRUD operations (already covered by E2E)
- ❌ Framework code (Express middleware, React hooks)
- ❌ Getters/setters
- ❌ Trivial conditionals (`if (user) return user.name`)
- ❌ Performance/load testing (throughput, latency, stress tests, scalability)

### [Component/Module Name 1]: [Complex Business Logic Function] (Priority [XX])

**File:** `path/to/component`

**Why Unit Test Needed:**
- Function: [Financial calculation / Security logic / Complex algorithm]
- Business Impact: [1-5] - [Money/Security/Data]
- Probability: [1-5] - [Complexity/Edge cases]
- Priority: [Result]

**Business scenarios to test:**
- [ ] `test_[function]_happy_path` - Main business scenario
- [ ] `test_[function]_edge_case_[discovered_in_manual_testing]` - Edge case from manual testing (Priority ≥9)
- [ ] `test_[function]_error_handling_[business_impact_4_or_5]` - Error with high business impact

**Mocks needed:**
- [Dependency 1]: Mock behavior
- [Dependency 2]: Mock behavior

**Anti-Duplication Check:**
- ✅ E2E doesn't fully exercise: [Edge case X / Error condition Y]

### [Component/Module Name 2]: [Another Complex Function] (Priority [XX])

**File:** `path/to/component`

**Why Unit Test Needed:**
- [Reason - complexity/business impact]
- Priority: [Result]

**Business scenarios to test:**
- [ ] `test_[scenario]` - Description of what this test verifies and WHY (business value)

**Mocks needed:**
- [Dependency]: Mock behavior

**Anti-Duplication Check:**
- ✅ Not covered by E2E because: [Reason]

### Standards
- [ ] Maximum 15 unit tests per Story
- [ ] All tests run in < 5 seconds total
- [ ] No external dependencies (DB, filesystem, network)
- [ ] Each test independent (can run in any order)
- [ ] Only test complex business logic (Priority ≥15)
- [ ] Skip if E2E already exercises all branches

## Critical Path Coverage

**Focus:** All Priority ≥15 scenarios tested, NOT blanket coverage percentage

**What MUST be tested (Priority ≥15):**
- [ ] All Acceptance Criteria from Story (verified in manual testing)
- [ ] Money-related scenarios (payments, refunds, pricing calculations)
- [ ] Security-critical flows (authentication, authorization, data access)
- [ ] Data integrity scenarios (transactions, rollbacks, concurrent updates)
- [ ] Core business flows (user cannot complete primary use case)
- [ ] High-risk edge cases discovered in manual testing (Priority ≥15)

**What SHOULD be tested (Priority 9-14) if not covered by E2E:**
- [ ] Medium-risk edge cases from manual testing
- [ ] Secondary business flows
- [ ] Error scenarios with Business Impact 3-4

**What to SKIP (Priority ≤8):**
- ❌ Simple CRUD operations (E2E covers these)
- ❌ Framework code (Express, React, Prisma)
- ❌ Third-party libraries (not our code)
- ❌ Trivial getters/setters
- ❌ Cosmetic bugs (color, spacing)
- ❌ Minor UX issues (button state)
- ❌ Scenarios already validated by manual testing with low business impact
- ❌ Performance/load testing (requires separate infrastructure and specialized tools)

**Coverage Expectations:**
- Coverage % is a metric, NOT a goal
- 60% coverage with all Priority ≥15 scenarios tested → **ACCEPTABLE**
- 90% coverage but payment flow not tested → **UNACCEPTABLE**

**Acceptance Criteria:**
- [ ] **Given** All Priority ≥15 scenarios identified **When** tests executed **Then** all scenarios PASS
- [ ] **Given** Test limits (2-5 E2E, 3-8 Integration, 5-15 Unit) **When** validation **Then** within limits (10-28 total)
- [ ] **Given** Tests duplicate logic **When** review **Then** consolidate or remove duplication
- [ ] **Given** Scenario has Priority ≤8 **When** review **Then** skip test (manual testing sufficient)

---

## Definition of Done

- [ ] All E2E tests implemented and passing (2-5 max, all Priority ≥15)
- [ ] All integration tests implemented and passing (3-8 max, all Priority ≥15)
- [ ] All unit tests implemented and passing (5-15 max, all Priority ≥15)
- [ ] **Total tests: 10-28** (within enforced limit)
- [ ] All Priority ≥15 scenarios from manual testing covered
- [ ] No flaky tests (all tests pass consistently on multiple runs)
- [ ] Test execution time acceptable (Unit <5s, Integration <30s, E2E <2min)
- [ ] All tests validate OUR code (not frameworks/libraries)
- [ ] Anti-duplication verified: each test adds unique business value
- [ ] Skipped scenarios documented with Priority justification (Priority ≤8)
- [ ] Documentation updated (tests/README.md if needed)

---

## Existing Tests to Fix/Update

**Tests affected by changes:**

Before adding new tests, update existing tests that might have broken due to logic changes in this Story.

### [Test File/Suite 1]: [Test Name or Path]

**File:** `path/to/test/file`

**Why Affected:**
- [Explain how Story implementation changed behavior tested by this test]
- [E.g., "Changed validation logic in API endpoint requires updated mock responses"]

**Required Fixes:**
- [ ] Update test setup/fixtures
- [ ] Update expected values/assertions
- [ ] Update mocked dependencies
- [ ] Verify test passes after fix

### [Test File/Suite 2]: [Test Name or Path]

**File:** `path/to/test/file`

**Why Affected:**
- [Reason this existing test needs updates]

**Required Fixes:**
- [ ] [Specific fix needed]

### Standards
- [ ] All existing tests identified and reviewed
- [ ] All affected tests fixed BEFORE adding new tests
- [ ] Entire existing test suite passes
- [ ] No tests temporarily disabled/skipped without justification
- [ ] Changes documented in commit message

---

## Infrastructure Changes

**Package Updates:**

### Testing Dependencies

**Packages to Add/Update:**
- `[package-name]@[version]` - [Why needed: new test framework feature / testing library for new component]
- `[package-name]@[version]` - [Why needed]

**package.json changes:**
```json
{
  "devDependencies": {
    "[package-name]": "[version]"
  },
  "scripts": {
    "[test-script]": "[command]"
  }
}
```

### Docker/Compose Updates

**Dockerfile changes (if needed):**
- [ ] Add test dependencies layer
- [ ] Update base image for test environment
- [ ] Add environment variables for testing

**docker-compose.yml changes (if needed):**
- [ ] Add test database service
- [ ] Add test environment configuration
- [ ] Add test volumes/networks

### Test Configuration

**Configuration files to update:**
- [ ] `jest.config.js` / `vitest.config.ts` / `pytest.ini` - [What to configure]
- [ ] `.env.test` - [Environment variables for testing]
- [ ] Test database setup scripts
- [ ] CI/CD pipeline configuration

### Standards
- [ ] All package versions specified (no `^` or `~` for test deps)
- [ ] Packages compatible with existing stack
- [ ] Docker changes tested locally
- [ ] Test configuration committed to repository

---

## Documentation Updates

**Files requiring documentation updates:**

### tests/README.md

**Updates needed:**
- [ ] Document new test commands (`npm test`, `npm run test:e2e`, etc.)
- [ ] Explain test structure changes (if any)
- [ ] Document test data setup/teardown
- [ ] Add troubleshooting section for common test failures
- [ ] Update test coverage expectations

### README.md (Main)

**Updates needed:**
- [ ] Feature documentation (what was tested and how)
- [ ] Setup instructions (if new dependencies added)
- [ ] Testing section (how to run tests for this feature)
- [ ] Known limitations (if any scenarios skipped with Priority ≤8)

### CHANGELOG.md

**Entry to add:**
```markdown
## [Version] - 2025-11-03

### Tested
- [Feature/Story tested]
- Test coverage: [X] E2E, [Y] Integration, [Z] Unit tests
- All Priority ≥15 scenarios covered
```

### Other Documentation

**Additional docs to update (if applicable):**
- [ ] API documentation (if endpoints tested)
- [ ] Architecture documentation (if test patterns changed)
- [ ] Deployment guide (if test infrastructure changed)

### Standards
- [ ] All documentation in English
- [ ] Code examples tested and working
- [ ] Links to relevant files/resources
- [ ] No outdated information remains

---

## Legacy Code Cleanup

**Костыли/Hacks to Remove:**

### [File/Module 1]: [Legacy Code Item]

**File:** `path/to/file`

**What to Remove:**
```
// Lines or code blocks to remove
[old code here]
```

**Why Safe to Remove:**
- [Justification: functionality now covered by new implementation]
- [Verification: tests confirm new code provides same behavior]
- [Risk assessment: Low - deprecated since [date/version]]

**Verification:**
- [ ] All tests pass after removal
- [ ] No references remain in codebase (grep check)
- [ ] Feature functionality preserved

### [File/Module 2]: [Backward Compatibility Code]

**File:** `path/to/file`

**What to Remove:**
- [Backward compatibility shims no longer needed]
- [Deprecated patterns replaced by new approach]

**Why Safe to Remove:**
- [Reason: all clients migrated to new API]
- [Verification: usage analytics show zero calls]

**Verification:**
- [ ] Tests confirm removal safe
- [ ] Documentation updated (no references to old pattern)

### Deprecated Patterns

**Patterns to Replace:**

**Old Pattern:**
```
[Example of old pattern in codebase]
```

**New Pattern (implemented in this Story):**
```
[Example of new pattern]
```

**Files Using Old Pattern:**
- [ ] `path/to/file1` - Replace with new pattern
- [ ] `path/to/file2` - Replace with new pattern

**Verification:**
- [ ] All instances found (grep/search)
- [ ] All replaced with new pattern
- [ ] Tests updated to use new pattern
- [ ] Old pattern documented as deprecated (if can't remove immediately)

### Dead Code

**Code to Remove:**
- [ ] Unused functions/classes: [List]
- [ ] Commented-out code blocks: [Where]
- [ ] Unreachable code paths: [Where]

**Verification Method:**
- [ ] Static analysis (unused imports, unused variables)
- [ ] Test coverage (uncovered code blocks)
- [ ] Code review (manual inspection)

### Standards
- [ ] All removals justified with clear reasoning
- [ ] Tests confirm functionality preserved
- [ ] No references remain (grep verification)
- [ ] Removals documented in commit message
- [ ] High-risk removals discussed with team before execution

---

**Template Version:** 3.0.0 (Added sections 8-11: Test Fixes + Infrastructure + Documentation + Cleanup)
**Last Updated:** 2025-11-03

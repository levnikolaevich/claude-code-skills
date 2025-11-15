# Story Review Checklist (14 Points)

Complete checklist for validating User Story after all tasks are Done.

## A. Goal Achievement (CRITICAL)

### 1. Story Statement Fulfilled

**Check:**
- [ ] "As a [role]" - Does role get needed functionality?
- [ ] "I want [capability]" - Is capability fully implemented?
- [ ] "So that [value]" - Is business value delivered?

**Method:**
- Code review of implemented functionality
- Run E2E tests covering Story goal
- Validate user can achieve stated goal

**Red Flags:**
- Story goal partially implemented
- Business value not delivered
- Role cannot use functionality as intended

---

### 2. All Story AC Satisfied

**Check:**
- [ ] Main Scenarios: All Given-When-Then scenarios work
- [ ] Edge Cases: All boundary conditions handled
- [ ] Error Handling: All error scenarios handled correctly

**Method:**
- Compare Story AC (from Story description) with E2E tests
- Verify each Given-When-Then has corresponding E2E test
- Run all E2E tests - all must pass

**Red Flags:**
- Story AC missing E2E test coverage
- E2E tests fail
- Edge cases not handled

---

## B. Integration Quality (CRITICAL)

### 3. Tasks Integrated Correctly

**Check:**
- [ ] API → Service → Repository integration works
- [ ] Contracts between layers honored (types, parameters match)
- [ ] Data flow correct (no data loss, no corruption)
- [ ] External dependencies integrated (APIs, databases)

**Method:**
- Code review of integration points
- Run Integration tests - all must pass
- Check types match between layers

**Red Flags:**
- Type mismatches (API sends `string`, Service expects `number`)
- Missing integration (API doesn't call Service)
- Integration tests fail

**Example Problem:**
```
Task 1 Done: API endpoint accepts user_id: string ✅
Task 2 Done: Service expects userId: number ✅
Problem: API calls Service with string → Runtime error ❌
```

---

### 4. No Gaps Between Tasks

**Check:**
- [ ] All components are used (no orphaned methods)
- [ ] All necessary calls present (no missing calls)
- [ ] Component dependencies satisfied

**Method:**
- Grep for unused functions/classes in Story files
- Code review for missing calls
- Check all Affected Components from tasks are integrated

**Red Flags:**
- Unused methods (created but never called)
- Missing calls (Service method exists but API doesn't call it)
- Dead code

**Example Problem:**
```
Task 1 Done: sendEmail() function created ✅
Task 2 Done: saveUser() function created ✅
Problem: API endpoint calls saveUser() but NOT sendEmail() → Email not sent ❌
```

---

## C. Overall Code Quality

### 5. Patterns Consistent

**Check:**
- [ ] All tasks use same approaches (async/await vs callbacks)
- [ ] No code duplication between tasks (DRY at Story level)
- [ ] Error handling consistent across tasks
- [ ] Architecture coherent
- [ ] Configuration management consistent (no hardcoded values, no magic numbers)

**Method:**
- Grep for similar code patterns across Story files
- Code review for duplication
- Check error handling patterns match

**Red Flags:**
- Task 1 uses async/await, Task 2 uses callbacks
- Same validation logic duplicated in 3 tasks
- Inconsistent error handling (Task 1 throws, Task 2 returns null)
- Magic numbers or hardcoded URLs in code (should be in config)

---

### 6. Following guides/

**Check:**
- [ ] Story implemented per project patterns (from guides/)
- [ ] Technical Notes from Story executed
- [ ] Architectural patterns followed

**Method:**
- Compare implementation with guides/ referenced in Story
- Check Technical Notes section of Story
- Verify patterns match guide examples

**Red Flags:**
- Story says "Use Repository Pattern" but implementation uses direct DB calls
- Technical Notes mention caching but no cache implemented

---

## D. Testing & Coverage (CRITICAL)

### 7. All Story Tests Pass

**Check:**
- [ ] Unit tests (70%) pass
- [ ] Integration tests (20%) pass
- [ ] E2E tests (10%) pass
- [ ] No flaky tests (all deterministic)
- [ ] Tests focus on business logic (not frameworks/libraries/getters)
- [ ] No test duplication - Each behavior tested once at pyramid level

**Method:**
- Run all tests for Story files: `npm test` / `pytest` / `go test`
- Check test output - 0 failures

**Red Flags:**
- Any test fails
- Flaky tests (pass sometimes, fail sometimes)
- Tests skipped

---

### 8. Coverage Story ≥80%

**Check:**
- [ ] Overall coverage across all Story files ≥80%
- [ ] Integration layer covered (not just unit level)
- [ ] Critical paths covered

**Method:**
- Run coverage report for Story files
- Check overall percentage
- Review uncovered lines (should be non-critical)

**Red Flags:**
- Coverage <80%
- Critical business logic uncovered
- Integration points uncovered

**Example:**
```
Task 1 coverage: 90% ✅
Task 2 coverage: 85% ✅
Task 3 coverage: 80% ✅
But: Story coverage: 65% ❌ (integration layer uncovered)
```

---

### 9. Test Limits and Priority Scenarios

**Check:**
- [ ] Test count within limits: 2-5 E2E, 3-8 Integration, 5-15 Unit (10-28 total)
- [ ] All Priority ≥15 scenarios from manual testing tested
- [ ] No duplicate test coverage (each test adds unique business value)
- [ ] Trivial code skipped (simple CRUD, framework code, getters/setters)

**Method:**
- Count tests by type for Story
- Verify total tests 10-28
- Check Risk Priority Matrix in test task - ensure all Priority ≥15 scenarios have tests
- Verify no tests for frameworks, libraries, or trivial logic

**Red Flags:**
- Total tests exceed 28 (maintenance burden)
- Priority ≥15 scenarios not tested (critical paths uncovered)
- Tests for framework code or trivial logic (waste of time)
- Duplicate coverage (same scenario tested at multiple levels)

---

### 10. E2E Cover All Story AC

**Check:**
- [ ] Each Main Scenario from Story AC has E2E test
- [ ] Edge Cases from Story AC covered by E2E
- [ ] Error Handling from Story AC covered by E2E

**Method:**
- List all Story AC (Given-When-Then scenarios)
- List all E2E tests
- Match AC to E2E tests (1:1 mapping for main scenarios)

**Red Flags:**
- Story AC without corresponding E2E test
- E2E test doesn't match Story AC wording
- Critical AC not covered

**Example Problem:**
```
Story AC: "Given user submits form, When submit, Then data saved AND email sent"
E2E test: "test_user_can_save_data" ✅ (covers save)
Missing: E2E test for email sent ❌
```

---

## E. Guides & Infrastructure (NEW)

### 11. Guides Correct

**Check:**
- [ ] All guides/ created in Story are correct
- [ ] Guide template followed (from guide-creator)
- [ ] Patterns documented accurately
- [ ] Anti-patterns documented
- [ ] Examples correct

**Method:**
- Identify guides/ created/modified in Story tasks
- Review each guide structure matches guide_template.md
- Verify patterns are actually used in codebase
- Check examples are correct and runnable

**Red Flags:**
- Guide template not followed
- Pattern documented but not used in code
- Incorrect examples
- Anti-patterns missing

**Skipped if:** No guides created in Story

---

### 12. Infrastructure Updated

**Check when packages added:**

**Package managers:**
- [ ] package.json updated (Node.js)
- [ ] requirements.txt updated (Python)
- [ ] go.mod updated (Go)
- [ ] Cargo.toml updated (Rust)
- [ ] Gemfile updated (Ruby)

**Docker:**
- [ ] Dockerfile updated if package needs system dependencies
  - Example: `RUN apt-get install -y libpq-dev` for PostgreSQL Python driver
- [ ] docker-compose.yml updated if package needs services
  - Example: Redis, Postgres, MongoDB services added

**Documentation:**
- [ ] README.md updated with setup instructions
  - Installation steps
  - New environment variables
  - New service dependencies

**Method:**
- Check if packages were added in Story tasks (search for "npm install", "pip install", etc.)
- If yes, verify infrastructure files updated
- Run docker build to verify Dockerfile still works
- Run docker-compose up to verify services start

**Red Flags:**
- Package added but package.json not committed
- Package needs system library but Dockerfile not updated
- Package needs Redis but docker-compose.yml not updated
- README missing setup instructions for new package

**Example Problems:**
```
Problem 1:
- Task adds `pg` package (PostgreSQL driver)
- package.json updated ✅
- Dockerfile NOT updated ❌ (missing: RUN apt-get install -y libpq-dev)
- Result: Docker build fails

Problem 2:
- Task adds Redis caching
- package.json updated ✅
- docker-compose.yml NOT updated ❌ (missing Redis service)
- Result: App can't connect to Redis

Problem 3:
- Task adds complex package
- package.json updated ✅
- README NOT updated ❌ (missing setup instructions)
- Result: Other developers can't run project
```

**Skipped if:** No packages added in Story

---

## F. Completeness

### 13. All Tasks Done

**Check:**
- [ ] No tasks in Todo
- [ ] No tasks in In Progress
- [ ] No tasks in To Review
- [ ] No tasks in To Rework
- [ ] All tasks in Done status

**Method:**
- Linear query: `parentId=Story ID, status≠Done`
- Result should be empty

**Red Flags:**
- Any task not Done
- Tasks forgotten

---

### 14. Documentation Complete

**Check:**
- [ ] STRUCTURE.md updated (all new components documented)
- [ ] ARCHITECTURE.md updated (all architectural changes documented)
- [ ] guides/ current (if created in Story)
- [ ] tests/README.md current (if test approach changed)
- [ ] README.md updated (if setup changed)

**Method:**
- Check files modified in Story tasks
- Verify documentation sections updated
- Cross-reference with Affected Components from tasks

**Red Flags:**
- New component not in STRUCTURE.md
- Architectural change not in ARCHITECTURE.md
- Outdated documentation

---

## Summary Checklist

Quick checklist for x-story-quality-coordinator Pass 1:

- [ ] 1. Story statement fulfilled
- [ ] 2. All Story AC satisfied
- [ ] 3. Tasks integrated correctly
- [ ] 4. No gaps between tasks
- [ ] 5. Patterns consistent
- [ ] 6. Following guides/
- [ ] 7. All tests pass
- [ ] 8. Priority ≥15 scenarios tested
- [ ] 9. Test limits (10-28 total)
- [ ] 10. E2E cover all AC
- [ ] 11. Guides correct
- [ ] 12. Infrastructure updated
- [ ] 13. All tasks Done
- [ ] 14. Documentation complete

**Pass:** All 14 checks ✓ → Story Done
**Fail:** Any check ✗ → Create fix tasks

---

**Version:** 1.3.0 (Configuration management check)
**Last Updated:** 2025-11-07

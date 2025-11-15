---
name: ln-42-regression-checker
description: Runs existing test suite to verify no regressions. Auto-detects framework (pytest/jest/vitest), reports results. Worker skill - does NOT create tasks or change statuses.
---

# Regression Checker Skill

Run existing test suite to verify no regressions introduced by implementation changes.

## When to Use This Skill

This skill should be used when:
- Need to verify existing tests still pass after code changes
- Part of Story Review (Phase 4 Step 2 or Step 5 in ln-30-story-executor)
- Before manual testing (ensure baseline stability)
- After refactoring (verify no functionality broken)

**Note:** This is an atomic worker skill with single responsibility - it ONLY runs tests and reports results. It does NOT create fix tasks, change Story/Task statuses, or make workflow decisions.

## Workflow

### Phase 1: Discovery

Auto-discovers project configuration and test location.

**Steps:**
1. Read project root directory
2. Detect test framework:
   - Check for `pytest.ini`, `pyproject.toml` → pytest (Python)
   - Check for `jest.config.js`, `package.json` → jest (JavaScript)
   - Check for `vitest.config.js` → vitest (JavaScript)
   - Check for `go.mod` + `*_test.go` → go test (Go)
3. Locate test directories:
   - `tests/` (Python)
   - `test/` or `__tests__/` (JavaScript)
   - `*_test.go` files (Go)

**Output:**
- Test framework detected (pytest/jest/vitest/go test)
- Test directory paths
- Total test files count

### Phase 2: Run Tests

Execute test suite using detected framework.

**Steps:**
1. Construct test command based on framework:
   - pytest: `pytest tests/ -v --tb=short`
   - jest: `npm test -- --verbose`
   - vitest: `npm run test`
   - go test: `go test ./... -v`
2. Execute command via Bash tool
3. Capture stdout/stderr
4. Parse test results

**Timeout:** 5 minutes maximum (prevent hanging tests)

**Output:**
- Test execution stdout/stderr
- Exit code (0 = pass, non-zero = fail)
- Execution time

### Phase 3: Parse Results

Parse test output to extract structured results.

**Steps:**
1. Parse output based on framework:
   - **pytest:** Extract from `= X passed, Y failed =` line
   - **jest:** Extract from `Tests: X failed, Y passed`
   - **vitest:** Extract from JSON reporter
   - **go test:** Extract from `PASS/FAIL` lines
2. Extract failed test names with file:line references
3. Calculate summary statistics

**Output:**
- Total tests count
- Passed tests count
- Failed tests count
- Failed test names (array)
- Execution time

### Phase 4: Report Results

Report results to Linear and return JSON verdict.

**Steps:**
1. Determine verdict:
   - `PASS`: All tests passed (failed_count = 0)
   - `FAIL`: At least one test failed (failed_count > 0)
2. Format Linear comment:
   ```markdown
   ## 🧪 Regression Check Results

   **Verdict:** ✅ PASS | ❌ FAIL
   **Framework:** [pytest/jest/vitest/go test]
   **Total Tests:** X
   **Passed:** Y
   **Failed:** Z
   **Execution Time:** 12.5s

   ### Failed Tests (if any)
   - `tests/auth/test_login.py::test_expired_token`
   - `tests/api/test_rate_limit.py::test_burst_limit`
   ```
3. Add comment to Story in Linear via MCP
4. Return JSON verdict

**Output:**
- Linear comment ID
- JSON verdict (see Output Specification below)

## Input/Output Specification

### Input

**Required:**
- Story ID (optional, for Linear comment context)

**Optional:**
- Test path override (default: auto-detect)
- Framework override (default: auto-detect)

### Output Format

Returns JSON object:

```json
{
  "verdict": "PASS" | "FAIL",
  "framework": "pytest" | "jest" | "vitest" | "go test",
  "total_tests": 127,
  "passed": 125,
  "failed": 2,
  "failed_tests": [
    "tests/auth/test_login.py::test_expired_token",
    "tests/api/test_rate_limit.py::test_burst_limit"
  ],
  "execution_time": "12.5s",
  "linear_comment_id": "abc123"
}
```

**Fields:**
- `verdict`: "PASS" if all tests passed, "FAIL" if any failed
- `framework`: Detected test framework
- `total_tests`: Total number of tests executed
- `passed`: Number of tests that passed
- `failed`: Number of tests that failed
- `failed_tests`: Array of failed test identifiers (file::test format)
- `execution_time`: Total execution time in seconds
- `linear_comment_id`: ID of Linear comment with results

## Technical Details

### Framework Detection

**pytest (Python):**
- Look for: `pytest.ini`, `pyproject.toml`, `tests/` directory
- Run command: `pytest tests/ -v --tb=short`
- Parse output: `= X passed, Y failed in Z.Zs =`

**jest (JavaScript/TypeScript):**
- Look for: `jest.config.js`, `package.json` with "test" script
- Run command: `npm test -- --verbose`
- Parse output: `Tests: X failed, Y passed, Z total`

**vitest (JavaScript/TypeScript):**
- Look for: `vitest.config.js`, `package.json` with "test" script using vitest
- Run command: `npm run test`
- Parse output: `Test Files  X failed | Y passed`

**go test (Go):**
- Look for: `go.mod`, `*_test.go` files
- Run command: `go test ./... -v`
- Parse output: `PASS/FAIL` lines per package

### Error Handling

**If no tests found:**
- Return verdict: "PASS" (no tests to fail)
- Add Linear comment: "⚠️ No tests found in project"

**If test execution fails (non-test errors):**
- Return verdict: "FAIL"
- Include error message in Linear comment
- failed_tests array contains error description

**If timeout (>5 minutes):**
- Kill test process
- Return verdict: "FAIL"
- Add Linear comment: "❌ Test execution timeout (>5 min)"

### NOT Responsible For

This skill does NOT:
- Create fix tasks in Linear (ln-30-story-executor creates tasks)
- Change Story or Task statuses (ln-30-story-executor manages statuses)
- Make workflow decisions (ln-30-story-executor decides next step)
- Re-run tests on failure (single execution only)

**Rationale:** Single Responsibility Principle - this skill ONLY runs tests and reports results. All workflow logic belongs to ln-30-story-executor orchestrator.

## Definition of Done

Before completing work, verify ALL checkpoints:

**✅ Tests Executed (Phase 1-2):**
- [ ] Test framework auto-detected (pytest/jest/vitest/go test)
- [ ] Test directory located
- [ ] Test command constructed correctly
- [ ] Tests executed with 5-minute timeout
- [ ] Stdout/stderr captured

**✅ Results Parsed (Phase 3):**
- [ ] Total tests count extracted
- [ ] Passed tests count extracted
- [ ] Failed tests count extracted
- [ ] Failed test names extracted with file:line references
- [ ] Execution time calculated

**✅ Results Reported (Phase 4):**
- [ ] Verdict determined (PASS/FAIL)
- [ ] Linear comment formatted correctly
- [ ] Comment added to Story in Linear
- [ ] JSON verdict returned with all required fields

**✅ Error Handling Applied:**
- [ ] No tests found → PASS with warning comment
- [ ] Test execution error → FAIL with error details
- [ ] Timeout (>5 min) → FAIL with timeout message

**Output:**
- JSON verdict with test results
- Linear comment with formatted results
- No side effects (no tasks created, no statuses changed)

---

**Version:** 1.0.0
**Last Updated:** 2025-11-13

---
name: x-manual-tester
description: Performs manual testing of Story AC via curl (API) or puppeteer (UI). Documents results in Linear with structured format. Creates reusable scripts. Worker skill - does NOT change statuses.
---

# Manual Tester Skill

Perform manual functional testing of Story Acceptance Criteria to verify implementation meets requirements.

## When to Use This Skill

This skill should be used when:
- Need to verify Story implementation before writing automated tests
- Part of Story Review (Phase 4 Step 3 in x-story-coordinator)
- After regression tests pass (baseline stable)
- Before creating test task (manual testing informs test scenarios)

**Note:** This is an atomic worker skill with single responsibility - it ONLY performs manual testing and documents results. It does NOT create fix tasks, change Story/Task statuses, or make workflow decisions.

## Workflow

### Phase 1: Setup & Load

Setup test environment and load Story Acceptance Criteria.

**Sub-steps:**

**1.1 Setup Environment**
- Detect Story type from description/labels (API or UI)
- For API: Check health endpoint `curl http://localhost:8000/health`
- For UI: Launch puppeteer browser, navigate to base URL
- If not running → return ERROR ("Application not running")

**1.2 Load Acceptance Criteria**
- Load Story via `mcp__linear-server__get_issue(id=Story.id)`
- Parse Story description to extract AC section
- Parse AC into structured list: `Given ... When ... Then ...` format (3-5 AC expected)
- Each AC gets unique ID (AC1, AC2, AC3, etc.)
- If AC not found/malformed → return ERROR ("AC section missing or malformed")

**Output:**
- Story type detected (API/UI)
- Application status verified (RUNNING)
- Base URL determined
- Array of AC objects: `[{id: "AC1", given: "...", when: "...", then: "..."}]`
- Total AC count (3-5 expected)

### Phase 2: Test Execution

Execute comprehensive testing: Acceptance Criteria, Edge Cases, Error Handling, Integration Points.

**Sub-steps:**

**2.1 Test Acceptance Criteria**
- For each AC:
  - API: Execute curl commands (e.g., `curl -X POST http://localhost:8000/api/login ...`)
  - UI: Execute puppeteer commands (e.g., `await page.fill('[name="email"]', ...)`)
  - Capture actual result
  - Compare with expected result (from "Then" clause)
  - Record verdict: PASS or FAIL
  - If FAIL: Record details (actual vs expected)
- Output: Array of AC results `[{ac_id: "AC1", result: "PASS", details: "..."}]`

**2.2 Test Edge Cases**
- Parse Story "Edge Cases" section (if exists)
- Infer additional edge cases from AC (invalid credentials, boundary values, etc.)
- Execute 3-5 edge case tests
- Record results (PASS/FAIL)
- Output: Array of edge case results `[{case: "Invalid credentials", result: "FAIL", details: "..."}]`

**2.3 Test Error Handling**
- Test error scenarios: 400s, 500s, validation errors
- For API: Send requests designed to trigger each error
- For UI: Perform actions that should show error messages
- Verify: Correct HTTP status (API), user-friendly messages (UI), no stack traces exposed
- Record results (PASS/FAIL)
- Output: Array of error results `[{scenario: "401 Unauthorized", result: "PASS", details: "..."}]`

**2.4 Test Integration Points**
- Parse Story "Implementation Tasks" for integration points
- Identify 2-3 critical integrations (Database, External APIs, Auth, File uploads, Email)
- Test each: Verify data flows, check error handling
- Record results (PASS/FAIL)
- Output: Array of integration results `[{integration: "Database persistence", result: "PASS", details: "..."}]`

**Output:**
- Comprehensive test results across all categories (AC, edge cases, errors, integration)

### Phase 3: Document Results

Document results in Linear and create reusable testing script.

**Steps:**
1. Aggregate results from Phase 2 sub-steps (2.1-2.4: AC, edge cases, errors, integration)
2. Determine overall verdict:
   - `PASS`: All AC passed + no critical failures in edge cases/errors/integration
   - `FAIL`: At least one AC failed OR critical failure in edge cases/errors/integration
3. Format Linear comment (Format v1.0 - see references/test_result_format_v1.md)
4. Add comment to Story via `mcp__linear-server__create_comment(issueId, body)`
5. Create temporary testing script:
   - Path: `scripts/tmp_[story_id].sh`
   - Content: Executable bash script with all test commands
   - Purpose: Re-run tests after refactoring without typing commands again
6. Return JSON verdict

**Output:**
- Linear comment ID
- Temp script path
- JSON verdict (see Output Specification below)

## Input/Output Specification

### Input

**Required:**
- Story ID (e.g., "US001" or "API-42")

**Optional:**
- Base URL override (default: auto-detect from .env or localhost)
- Story type override (default: auto-detect from Story content)

### Output Format

Returns JSON object:

```json
{
  "verdict": "PASS" | "FAIL",
  "story_type": "API" | "UI",
  "story_id": "US001",
  "main_scenarios": [
    {
      "ac_id": "AC1",
      "result": "PASS",
      "details": "Response 200, token valid, expires in 3600s"
    },
    {
      "ac_id": "AC2",
      "result": "FAIL",
      "details": "Expected 200 with redirect, got 401 Unauthorized"
    }
  ],
  "edge_cases": [
    {
      "case": "Invalid credentials",
      "result": "PASS",
      "details": "Response 401, correct error message"
    }
  ],
  "error_handling": [
    {
      "scenario": "401 Unauthorized",
      "result": "PASS",
      "details": "Correct status code + user-friendly message"
    }
  ],
  "integration": [
    {
      "integration": "Database persistence",
      "result": "PASS",
      "details": "User record saved with correct fields"
    }
  ],
  "linear_comment_id": "abc123",
  "temp_script_path": "scripts/tmp_US001.sh"
}
```

**Fields:**
- `verdict`: "PASS" if all AC passed + no critical failures, else "FAIL"
- `story_type`: Detected Story type (API or UI)
- `story_id`: Story identifier
- `main_scenarios`: Array of AC test results (Phase 3)
- `edge_cases`: Array of edge case test results (Phase 4)
- `error_handling`: Array of error handling test results (Phase 5)
- `integration`: Array of integration test results (Phase 6)
- `linear_comment_id`: ID of Linear comment with formatted results
- `temp_script_path`: Path to temporary testing script for re-running tests

## Testing Patterns

### API Testing with curl

**Pattern 1: Simple GET request**
```bash
curl -X GET http://localhost:8000/api/users/123 \
  -H "Authorization: Bearer $TOKEN" \
  -w "\\nHTTP Status: %{http_code}\\n"
```

**Pattern 2: POST with JSON body**
```bash
curl -X POST http://localhost:8000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "test123"}' \
  -w "\\nHTTP Status: %{http_code}\\n"
```

**Pattern 3: PUT with authentication**
```bash
curl -X PUT http://localhost:8000/api/users/123 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Updated Name"}' \
  -w "\\nHTTP Status: %{http_code}\\n"
```

**Pattern 4: DELETE request**
```bash
curl -X DELETE http://localhost:8000/api/users/123 \
  -H "Authorization: Bearer $TOKEN" \
  -w "\\nHTTP Status: %{http_code}\\n"
```

### UI Testing with puppeteer

**Pattern 1: Form submission**
```javascript
await page.goto('http://localhost:3000/login');
await page.fill('[name="email"]', 'user@example.com');
await page.fill('[name="password"]', 'test123');
await page.click('button[type="submit"]');
await page.waitForURL('**/dashboard');
```

**Pattern 2: Navigation and assertion**
```javascript
await page.goto('http://localhost:3000/users');
const heading = await page.textContent('h1');
expect(heading).toBe('User List');
```

**Pattern 3: Element interaction**
```javascript
await page.click('button[data-testid="add-user"]');
await page.waitForSelector('form[data-testid="user-form"]');
```

**Pattern 4: Screenshot capture (on failure)**
```javascript
try {
  await page.click('button.non-existent');
} catch (error) {
  await page.screenshot({ path: 'screenshots/failure.png' });
  throw error;
}
```

## Technical Details

### Story Type Detection

**API Story indicators:**
- Description contains: "API endpoint", "REST API", "HTTP"
- Labels: "api", "backend", "endpoint"
- AC mentions HTTP methods: GET, POST, PUT, DELETE
- Implementation tasks mention "controller", "router", "endpoint"

**UI Story indicators:**
- Description contains: "UI", "frontend", "page", "component"
- Labels: "ui", "frontend", "react", "vue"
- AC mentions UI elements: "button", "form", "modal", "page"
- Implementation tasks mention "component", "view", "UI"

**Ambiguous Stories:**
- If both API and UI indicators present → default to API (test backend first)
- User can override via Story type parameter

### Temporary Testing Script Format

Created at `scripts/tmp_[story_id].sh`:

```bash
#!/bin/bash
# Temporary manual testing script for Story US001
# Created: 2025-11-13
# Purpose: Reusable tests - run after refactoring instead of typing commands again
# Deleted by: x-test-executor Step 6 (after E2E/Integration/Unit tests implemented)

BASE_URL="http://localhost:8000"
TOKEN="your_auth_token_here"

echo "Testing AC1: User login"
curl -X POST $BASE_URL/api/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "test123"}' \
  -w "\\nHTTP Status: %{http_code}\\n"

echo "Testing AC2: Get user profile"
curl -X GET $BASE_URL/api/users/me \
  -H "Authorization: Bearer $TOKEN" \
  -w "\\nHTTP Status: %{http_code}\\n"

# Edge case: Invalid credentials
echo "Edge case: Invalid credentials"
curl -X POST $BASE_URL/api/login \
  -H "Content-Type: application/json" \
  -d '{"email": "wrong@example.com", "password": "wrong"}' \
  -w "\\nHTTP Status: %{http_code}\\n"
```

**Permissions:** Make executable with `chmod +x scripts/tmp_[story_id].sh`

**Lifecycle:**
- Created: x-manual-tester Phase 7
- Used: Re-run after refactoring/fixes
- Deleted: x-test-executor Step 6 (after automated tests implemented)

### Linear Comment Format (v1.0)

See `references/test_result_format_v1.md` for complete specification.

**Structure:**
```markdown
## 🎯 Manual Testing Results

**Verdict:** ✅ PASS | ❌ FAIL
**Story Type:** API | UI
**Tested:** 2025-11-13 14:30 UTC

### Main Scenarios (Acceptance Criteria)

**AC1:** Given authenticated user, When POST /api/login, Then return 200 with token
- Result: ✅ PASS
- Details: Response 200, token valid, expires in 3600s

**AC2:** Given valid token, When GET /api/users/me, Then return user profile
- Result: ❌ FAIL
- Details: Expected 200 with user data, got 401 Unauthorized

### Edge Cases

- **Invalid credentials:** ✅ PASS - Response 401, correct error message
- **Empty email field:** ✅ PASS - Response 422, validation error shown

### Error Handling

- **401 Unauthorized:** ✅ PASS - Correct status + user-friendly message
- **500 Server Error:** ❌ FAIL - Stack trace exposed to user

### Integration Points

- **Database persistence:** ✅ PASS - User record saved correctly
- **Token generation:** ✅ PASS - JWT token valid and properly signed

### Temporary Testing Script

Reusable testing script created at: `scripts/tmp_US001.sh`
Run with: `./scripts/tmp_US001.sh`
```

### Error Handling

**If application not running:**
- Return verdict: "ERROR"
- Add Linear comment: "⚠️ Cannot test - application not running. Start server first."
- temp_script_path: null

**If AC section missing/malformed:**
- Return verdict: "ERROR"
- Add Linear comment: "⚠️ Cannot test - Acceptance Criteria section missing or malformed in Story"
- temp_script_path: null

**If puppeteer fails (UI testing):**
- Take screenshot on failure
- Add screenshot path to Linear comment
- Continue testing other AC (don't abort entire test suite)

### NOT Responsible For

This skill does NOT:
- Create fix tasks in Linear (x-story-coordinator creates tasks)
- Change Story or Task statuses (x-story-coordinator manages statuses)
- Make workflow decisions (x-story-coordinator decides next step)
- Run automated tests (that's x-regression-checker or x-test-executor)
- Create test task (that's x-test-coordinator)

**Rationale:** Single Responsibility Principle - this skill ONLY performs manual testing and documents results. All workflow logic belongs to x-story-coordinator orchestrator.

## Definition of Done

Before completing work, verify ALL checkpoints:

**Phase 1: Setup & Load**
- [ ] Story type detected (API/UI), base URL determined
- [ ] Application verified (health check for API, browser start for UI)
- [ ] Story loaded from Linear, Acceptance Criteria section parsed
- [ ] 3-5 AC in Given-When-Then format extracted, each assigned unique ID

**Phase 2: Test Execution**
- [ ] All AC tested (curl for API, puppeteer for UI), actual results saved in `details`
- [ ] Edge cases (3-5) and error handling scenarios (400/500 and other key codes) verified
- [ ] Integration points (2-3) covered with data/processing checks
- [ ] On puppeteer failures: capture screenshot, add path to Linear, continue other scenarios

**Phase 3: Document Results**
- [ ] Final verdict determined (`PASS`/`FAIL`/`ERROR`), Linear comment added in Format v1.0
- [ ] Temporary script created at `scripts/tmp_[story_id].sh` (POSIX script; run via Git Bash/WSL on Windows)
- [ ] Script marked executable (chmod +x), path returned in final JSON
- [ ] JSON result returned with fields: verdict, linear_comment_id, temp_script_path, details

**Error Handling**
- [ ] If application not running → verdict `ERROR`, comment with instruction "Start server"
- [ ] If AC section missing/malformed → verdict `ERROR`, comment with recommendation to fix Story
- [ ] On puppeteer crashes → save screenshot, add path to comment, continue testing

**Output**
- JSON verdict with detailed results
- Linear comment (Format v1.0)
- Temporary script for re-running tests
- No side effects (tasks/statuses untouched)
---

**Version:** 2.0.0 (Simplified workflow from 7 phases to 3 by grouping related testing steps: Phase 1 Setup & Load (1-2), Phase 2 Test Execution (3-6 sub-steps: AC, edge cases, errors, integration), Phase 3 Document Results (7))
**Last Updated:** 2025-11-14

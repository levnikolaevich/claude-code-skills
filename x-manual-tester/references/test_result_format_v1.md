# Test Result Format v1.0

This document specifies the structured format for manual testing results in Linear comments.

## Purpose

**Why standardized format:**
- **Consistency:** All manual testing results follow same structure
- **Parseability:** x-test-coordinator can parse results to generate test task
- **Readability:** Clear structure for reviewers
- **Traceability:** Links testing results to AC

## Format Specification

### Header Section

```markdown
## 🎯 Manual Testing Results

**Verdict:** ✅ PASS | ❌ FAIL
**Story Type:** API | UI
**Tested:** 2025-11-13 14:30 UTC
**Tester:** x-manual-tester v1.0.0
```

**Fields:**
- `Verdict`: Overall verdict (PASS if all AC passed + no critical failures)
- `Story Type`: Detected Story type (API or UI)
- `Tested`: ISO 8601 timestamp of test execution
- `Tester`: Skill name and version for traceability

---

### Main Scenarios Section

```markdown
### Main Scenarios (Acceptance Criteria)

**AC1:** Given authenticated user, When POST /api/login, Then return 200 with token
- Result: ✅ PASS
- Details: Response 200, token valid, expires in 3600s

**AC2:** Given valid token, When GET /api/users/me, Then return user profile
- Result: ❌ FAIL
- Details: Expected 200 with user data, got 401 Unauthorized

**AC3:** Given admin role, When DELETE /api/users/123, Then user deleted and 204 returned
- Result: ✅ PASS
- Details: User deleted from database, response 204 No Content
```

**Structure:**
- Each AC has:
  - **Title:** Full AC statement (Given-When-Then)
  - **Result:** ✅ PASS or ❌ FAIL
  - **Details:** Actual outcome vs expected

**Critical Rule:** ALL AC must be tested. If AC untested → Verdict must be ERROR.

---

### Edge Cases Section

```markdown
### Edge Cases

- **Invalid credentials:** ✅ PASS - Response 401, correct error message
- **Empty email field:** ✅ PASS - Response 422, validation error shown
- **SQL injection attempt:** ✅ PASS - Input sanitized, no SQL error
- **Concurrent login requests:** ❌ FAIL - Race condition: duplicate sessions created
- **Token expired:** ✅ PASS - Response 401, redirect to login
```

**Structure:**
- Bullet list of edge case scenarios
- Each item: `- **Case name:** Result - Details`
- Minimum 3 edge cases, maximum 5

**Result Icons:**
- ✅ PASS - Expected behavior
- ❌ FAIL - Unexpected behavior
- ⚠️ WARN - Works but suboptimal (e.g., slow response)

---

### Error Handling Section

```markdown
### Error Handling

- **400 Bad Request:** ✅ PASS - Correct status, validation errors in response
- **401 Unauthorized:** ✅ PASS - Correct status + user-friendly message "Please log in"
- **403 Forbidden:** ✅ PASS - Correct status + message "Insufficient permissions"
- **404 Not Found:** ✅ PASS - Correct status + message "User not found"
- **422 Unprocessable:** ✅ PASS - Correct status + field-specific errors
- **500 Server Error:** ❌ FAIL - Stack trace exposed to user (security issue)
```

**Structure:**
- Test standard HTTP error codes
- Verify:
  1. **Correct status code** (API)
  2. **User-friendly message** (no technical jargon, no stack traces)
  3. **Proper handling** (error doesn't crash app)

**Security Critical:**
- ❌ FAIL if stack traces exposed
- ❌ FAIL if sensitive data in error messages
- ❌ FAIL if error crashes application

---

### Integration Points Section

```markdown
### Integration Points

- **Database persistence:** ✅ PASS - User record saved with correct fields (id, email, name, created_at)
- **Token generation:** ✅ PASS - JWT token valid, properly signed, expires in 3600s
- **Email service:** ⚠️ WARN - Welcome email sent but delayed 5 seconds (acceptable for v1)
- **External API:** ✅ PASS - Third-party service called correctly, response parsed
```

**Structure:**
- List critical integration points from implementation tasks
- Verify:
  1. **Data flows correctly** (database CRUD, API calls)
  2. **Error handling** (integration failures handled gracefully)
  3. **Performance** (acceptable response times)

**Minimum:** 2 integration points tested

---

### Temporary Testing Script Section

```markdown
### Temporary Testing Script

Reusable testing script created at: `scripts/tmp_US001.sh`

**Run with:**
```bash
chmod +x scripts/tmp_US001.sh
./scripts/tmp_US001.sh
```

**Purpose:** Re-run manual tests after refactoring/fixes without typing commands again.

**Lifecycle:** Deleted by x-test-executor Step 6 after E2E/Integration/Unit tests implemented.
```

**Structure:**
- Path to temp script
- Execution instructions
- Purpose explanation
- Lifecycle note

---

## Complete Example

```markdown
## 🎯 Manual Testing Results

**Verdict:** ❌ FAIL
**Story Type:** API
**Tested:** 2025-11-13 14:30 UTC
**Tester:** x-manual-tester v1.0.0

### Main Scenarios (Acceptance Criteria)

**AC1:** Given authenticated user, When POST /api/login, Then return 200 with token
- Result: ✅ PASS
- Details: Response 200, token valid, expires in 3600s

**AC2:** Given valid token, When GET /api/users/me, Then return user profile
- Result: ❌ FAIL
- Details: Expected 200 with user data, got 401 Unauthorized

**AC3:** Given admin role, When DELETE /api/users/123, Then user deleted and 204 returned
- Result: ✅ PASS
- Details: User deleted from database, response 204 No Content

### Edge Cases

- **Invalid credentials:** ✅ PASS - Response 401, correct error message
- **Empty email field:** ✅ PASS - Response 422, validation error shown
- **SQL injection attempt:** ✅ PASS - Input sanitized, no SQL error
- **Token expired:** ✅ PASS - Response 401, redirect to login

### Error Handling

- **400 Bad Request:** ✅ PASS - Correct status, validation errors in response
- **401 Unauthorized:** ✅ PASS - Correct status + user-friendly message
- **404 Not Found:** ✅ PASS - Correct status + message "User not found"
- **500 Server Error:** ❌ FAIL - Stack trace exposed to user (security issue)

### Integration Points

- **Database persistence:** ✅ PASS - User record saved correctly
- **Token generation:** ✅ PASS - JWT token valid and properly signed
- **Email service:** ⚠️ WARN - Welcome email sent but delayed 5 seconds

### Temporary Testing Script

Reusable testing script created at: `scripts/tmp_US001.sh`

**Run with:**
```bash
chmod +x scripts/tmp_US001.sh
./scripts/tmp_US001.sh
```

**Purpose:** Re-run manual tests after refactoring/fixes without typing commands again.

**Lifecycle:** Deleted by x-test-executor Step 6 after E2E/Integration/Unit tests implemented.
```

---

## Parsing Rules for x-test-coordinator

When x-test-coordinator reads this comment to generate test task:

**Extract AC results:**
- Parse each `**AC[N]:**` block
- Extract result (PASS/FAIL)
- If FAIL → Priority = HIGH for test coverage

**Extract edge cases:**
- Parse bullet list under "### Edge Cases"
- Extract case name and result
- If FAIL → Include in test task Edge Cases section

**Extract error handling:**
- Parse bullet list under "### Error Handling"
- Extract scenario and result
- If FAIL → Include in test task Error Handling section

**Extract integration:**
- Parse bullet list under "### Integration Points"
- Extract integration name and result
- If FAIL → Include in test task Integration section

**Risk-Based Testing:**
- Calculate Priority for each scenario: Business Impact × Probability
- Select scenarios with Priority ≥15 for automated testing
- Ensure all FAILED scenarios are covered in test task

---

## Version History

### v1.0.0 (2025-11-13)
- Initial format specification
- Structured sections: Main Scenarios, Edge Cases, Error Handling, Integration, Temp Script
- Icons for visual clarity (✅/❌/⚠️)
- Parsing rules for x-test-coordinator

---

**Version:** 1.0.0
**Last Updated:** 2025-11-13

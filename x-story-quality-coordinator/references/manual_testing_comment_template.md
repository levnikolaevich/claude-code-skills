# Manual Testing Results Comment Template

## Purpose

This template defines the standardized format for Linear comments created by x-manual-tester (invoked by x-story-quality-coordinator Pass 1). The structured format ensures reliable parsing by x-test-coordinator for E2E-first test design.

## Format Version

**Current Version:** 1.0
**Last Updated:** 2025-10-31

## Template Structure

```markdown
## 🧪 Manual Testing Results

**Format Version:** 1.0
**Story ID:** [Story identifier, e.g., US042]
**Tested By:** x-manual-tester
**Date:** [YYYY-MM-DD]
**Status:** [✅ PASSED (X/Y AC) | ❌ FAILED (X/Y AC)]

---

### Acceptance Criteria (from Story)

**AC1:** [AC title/description]
- **Given:** [Precondition]
- **When:** [Action]
- **Then:** [Expected outcome]

**AC2:** [AC title/description]
- **Given:** [Precondition]
- **When:** [Action]
- **Then:** [Expected outcome]

[Repeat for each AC in Story]

---

### Test Results by AC

**AC1: [AC title]**
- [✅ PASS | ❌ FAIL] **Status:** [PASS|FAIL]
- **Method:** [Full curl command OR puppeteer code]
- **Result:** [Actual HTTP status, response body, or UI state]
- **Notes:** [Any relevant observations]

**AC2: [AC title]**
- [✅ PASS | ❌ FAIL] **Status:** [PASS|FAIL]
- **Method:** [Full curl command OR puppeteer code]
- **Result:** [Actual response or behavior]
- **Notes:** [Any relevant observations]

[Repeat for each AC]

---

### Edge Cases Discovered

1. **[Edge case description]**
   - **Input:** [Specific input that triggers edge case]
   - **Expected:** [Expected behavior]
   - **Actual:** [Actual behavior observed]
   - [✅ PASS | ❌ FAIL] **Status:** [PASS|FAIL]

2. **[Edge case description]**
   - **Input:** [Specific input]
   - **Expected:** [Expected behavior]
   - **Actual:** [Actual behavior]
   - [✅ PASS | ❌ FAIL] **Status:** [PASS|FAIL]

[Continue numbering for all discovered edge cases]

---

### Error Handling Verified

| HTTP Code | Scenario | Error Message | Verified |
|-----------|----------|---------------|----------|
| [Code] | [What triggers this error] | [Exact error message returned] | [✅ | ❌ | ⚠️ Not tested] |
| [Code] | [Scenario] | [Error message] | [✅ | ❌] |

[Add all HTTP error codes tested: 400, 401, 403, 404, 429, 500, etc.]

---

### Integration Testing

**[Component A] → [Component B] → [Component C] Flow:**
- [✅ | ❌] [Description of integration point 1]
- [✅ | ❌] [Description of integration point 2]
- [✅ | ❌] [Description of integration point 3]

**Transaction Handling:**
- [✅ | ❌] [Transaction behavior description]
- [✅ | ❌] [Rollback behavior if applicable]

**Performance/Concurrency (if applicable):**
- [✅ | ❌] [Any performance observations]

---

### Summary

**Overall Result:** [✅ ALL ACCEPTANCE CRITERIA PASSED | ❌ X/Y ACCEPTANCE CRITERIA FAILED]

**Coverage:**
- [X/Y] AC verified [✅ | ❌]
- [X] edge cases tested [✅]
- [X/Y] error scenarios verified [✅ | ⚠️]
- Integration flow validated [✅ | ❌]

**Recommendation:** [Proceed to test task creation via x-test-coordinator | Create refactoring task for issues found]

---

### Risk Assessment for Test Planning

**Purpose:** Provide Priority scores for x-test-coordinator to select tests based on business risk

| Scenario | Type | Business Impact (1-5) | Probability (1-5) | Priority | Reason |
|----------|------|----------------------|-------------------|----------|--------|
| [AC1: AC title] | AC | [1-5] | [1-5] | [Result] | [Why this impact/probability] |
| [AC2: AC title] | AC | [1-5] | [1-5] | [Result] | [Why this impact/probability] |
| [Edge Case 1: description] | Edge Case | [1-5] | [1-5] | [Result] | [Why this impact/probability] |
| [Edge Case 2: description] | Edge Case | [1-5] | [1-5] | [Result] | [Why this impact/probability] |
| [Error: HTTP 400 scenario] | Error Handling | [1-5] | [1-5] | [Result] | [Why this impact/probability] |
| [Error: HTTP 401 scenario] | Error Handling | [1-5] | [1-5] | [Result] | [Why this impact/probability] |

**Priority Calculation:** Priority = Business Impact (1-5) × Probability (1-5)

**Decision Criteria:**
- Priority ≥15 → MUST test (x-test-coordinator will create automated tests)
- Priority 9-14 → SHOULD test if not already covered
- Priority ≤8 → SKIP (manual testing sufficient)

**Reference:** See `x-test-coordinator/references/risk_based_testing_guide.md` for complete Business Impact/Probability scoring tables and methodology.

**Total Scenarios:** [X scenarios], **Priority ≥15:** [Y scenarios] (will be tested)
```

## Usage Instructions

### For x-manual-tester (Phase 5 Step 1)

1. **Copy template structure** (do NOT include this instruction section)
2. **Fill required fields:**
   - Story ID from Linear
   - Current date in YYYY-MM-DD format
   - Status calculated from AC pass/fail count
3. **Extract AC from Story description:**
   - Copy Given-When-Then exactly as written in Story
   - Maintain numbering (AC1, AC2, AC3...)
4. **Document test results for EACH AC:**
   - Include full curl command or puppeteer code used
   - Copy exact HTTP status codes and response bodies
   - Note any deviations from expected behavior
5. **List ALL edge cases discovered** during testing:
   - Enumerate sequentially (1, 2, 3...)
   - Provide concrete input/expected/actual values
6. **Create error handling table:**
   - Test all error codes mentioned in Story Technical Notes
   - Include 400, 401, 404, 500 at minimum
   - Mark ⚠️ for codes not testable without setup
7. **Verify integration flow:**
   - Trace request through all architectural layers
   - Note any transaction/rollback behavior
8. **Write summary:**
   - Count passed AC vs total AC
   - Recommend next action (x-test-coordinator or refactoring task)

### For x-test-coordinator (Phase 2 Step 1)

**Parsing strategy:**

1. **Find comment with marker:**
   - Search for `## 🧪 Manual Testing Results`
   - Verify `**Format Version:** 1.0` present

2. **Extract sections using regex:**
   - `^### Acceptance Criteria` → parse AC with Given-When-Then
   - `^### Test Results by AC` → extract status, method, results per AC
   - `^### Edge Cases Discovered` → parse numbered list items
   - `^### Error Handling Verified` → parse markdown table
   - `^### Integration Testing` → extract component flows

3. **Map to test design:**
   - Each PASSED AC → 1 E2E test (copy method from "Method:" field)
   - Each edge case → Unit or Integration test
   - Each verified error code → Error handling test
   - Integration flow → Integration test suite

4. **Handle parsing errors:**
   - Missing Format Version → warn user, try legacy parsing
   - Missing required section → error with clear message
   - Cannot parse AC → request Story description fix

## Examples

### Example 1: API Endpoint Testing

```markdown
## 🧪 Manual Testing Results

**Format Version:** 1.0
**Story ID:** US042
**Tested By:** x-manual-tester
**Date:** 2025-10-31
**Status:** ✅ PASSED (3/3 AC)

---

### Acceptance Criteria (from Story)

**AC1:** User can login with valid credentials
- **Given:** Valid email and password
- **When:** User submits login form
- **Then:** Returns 200 OK with JWT token

**AC2:** Invalid credentials are rejected
- **Given:** Invalid email or password
- **When:** User submits login form
- **Then:** Returns 401 Unauthorized with error message

**AC3:** Rate limiting prevents brute force
- **Given:** More than 5 failed login attempts within 1 minute
- **When:** User submits 6th attempt
- **Then:** Returns 429 Too Many Requests

---

### Test Results by AC

**AC1: User can login with valid credentials**
- ✅ **Status:** PASS
- **Method:** `curl -X POST http://localhost:8000/api/auth/login -H "Content-Type: application/json" -d '{"email":"test@example.com","password":"SecurePass123"}'`
- **Result:** 200 OK, JWT token received: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- **Notes:** Token validated successfully, expires in 1 hour

**AC2: Invalid credentials are rejected**
- ✅ **Status:** PASS
- **Method:** `curl -X POST http://localhost:8000/api/auth/login -H "Content-Type: application/json" -d '{"email":"test@example.com","password":"WrongPassword"}'`
- **Result:** 401 Unauthorized, `{"error":"Invalid credentials"}`
- **Notes:** Error message does not reveal if email or password is wrong (good security practice)

**AC3: Rate limiting prevents brute force**
- ✅ **Status:** PASS
- **Method:** Bash loop: `for i in {1..6}; do curl -X POST http://localhost:8000/api/auth/login -d '{"email":"test@example.com","password":"wrong"}'; done`
- **Result:** First 5 attempts → 401, 6th attempt → 429 with `{"error":"Too many requests, try again in 52 seconds"}`
- **Notes:** Rate limit counter resets correctly after 1 minute

---

### Edge Cases Discovered

1. **Empty email field**
   - **Input:** `{"email":"","password":"test123"}`
   - **Expected:** 400 Bad Request
   - **Actual:** 400 Bad Request with `{"error":"Email is required"}`
   - ✅ **Status:** PASS

2. **SQL injection attempt**
   - **Input:** `{"email":"'; DROP TABLE users;--","password":"test"}`
   - **Expected:** Properly escaped, 401 Invalid credentials
   - **Actual:** 401 Invalid credentials, SQL not executed (verified in logs)
   - ✅ **Status:** PASS

3. **Unicode characters in password**
   - **Input:** Password: `Test🔒Пароль123`
   - **Expected:** Works correctly
   - **Actual:** Login successful, password stored and validated with UTF-8 encoding
   - ✅ **Status:** PASS

4. **Very long password (1000 chars)**
   - **Input:** Password with 1000 'a' characters
   - **Expected:** 400 Bad Request (max length validation)
   - **Actual:** 400 Bad Request with `{"error":"Password too long (max 128 characters)"}`
   - ✅ **Status:** PASS

---

### Error Handling Verified

| HTTP Code | Scenario | Error Message | Verified |
|-----------|----------|---------------|----------|
| 400 | Missing email field | "Email is required" | ✅ |
| 400 | Invalid email format | "Invalid email format" | ✅ |
| 400 | Missing password field | "Password is required" | ✅ |
| 400 | Password too long | "Password too long (max 128 characters)" | ✅ |
| 401 | Wrong email | "Invalid credentials" | ✅ |
| 401 | Wrong password | "Invalid credentials" | ✅ |
| 429 | Rate limit exceeded | "Too many requests, try again in X seconds" | ✅ |
| 500 | Database connection error | "Internal server error" | ⚠️ Not tested (requires DB failure simulation) |

---

### Integration Testing

**API → Service → Repository → Database Flow:**
- ✅ API endpoint receives request and validates JSON schema
- ✅ Service layer calls UserRepository.findByEmail()
- ✅ Repository queries PostgreSQL users table
- ✅ Password comparison using bcrypt.compare() works correctly
- ✅ JWT token generated and signed with SECRET_KEY
- ✅ Response formatted according to API spec

**Transaction Handling:**
- ✅ Failed login attempt logged in audit_log table (INSERT)
- ✅ Rate limit counter incremented in Redis
- ✅ No database locks observed during concurrent login attempts

---

### Summary

**Overall Result:** ✅ **ALL ACCEPTANCE CRITERIA PASSED**

**Coverage:**
- 3/3 AC verified ✅
- 4 edge cases tested ✅
- 7/8 error scenarios verified (1 requires failure injection) ✅
- Integration flow validated ✅

**Recommendation:** Proceed to test task creation via x-test-coordinator
```

### Example 2: UI Testing with Puppeteer

```markdown
## 🧪 Manual Testing Results

**Format Version:** 1.0
**Story ID:** US045
**Tested By:** x-manual-tester
**Date:** 2025-10-31
**Status:** ✅ PASSED (2/2 AC)

---

### Acceptance Criteria (from Story)

**AC1:** User can see product list on homepage
- **Given:** User navigates to homepage
- **When:** Page loads
- **Then:** Product grid displays with images, names, and prices

**AC2:** User can filter products by category
- **Given:** User is on homepage with products displayed
- **When:** User clicks category filter
- **Then:** Only products from selected category are shown

---

### Test Results by AC

**AC1: User can see product list on homepage**
- ✅ **Status:** PASS
- **Method:**
```javascript
const page = await browser.newPage();
await page.goto('http://localhost:3000');
await page.waitForSelector('.product-grid');
const products = await page.$$('.product-card');
console.log(`Found ${products.length} products`);
```
- **Result:** 12 products displayed, all with images, names, and prices visible
- **Notes:** Images load correctly, no broken thumbnails

**AC2: User can filter products by category**
- ✅ **Status:** PASS
- **Method:**
```javascript
await page.click('[data-category="electronics"]');
await page.waitForTimeout(500); // Wait for filter animation
const filteredProducts = await page.$$('.product-card[data-category="electronics"]');
console.log(`Filtered to ${filteredProducts.length} electronics`);
```
- **Result:** Filter works, showing only 5 electronics products. Other categories hidden.
- **Notes:** Filter animation smooth, no flickering

---

### Edge Cases Discovered

1. **Empty category returns "No products" message**
   - **Input:** Click category "Books" (which has 0 products)
   - **Expected:** Show "No products found" message
   - **Actual:** Message displayed correctly with suggestion to clear filters
   - ✅ **Status:** PASS

2. **Multiple rapid filter clicks**
   - **Input:** Click different category filters rapidly 5 times
   - **Expected:** UI remains stable, shows final selection
   - **Actual:** No race conditions, final filter applied correctly
   - ✅ **Status:** PASS

---

### Error Handling Verified

| HTTP Code | Scenario | Error Message | Verified |
|-----------|----------|---------------|----------|
| 404 | Navigate to /products/invalid-id | "Product not found" page | ✅ |
| 500 | API returns error | "Failed to load products" toast | ⚠️ Not tested (requires API mock failure) |

---

### Integration Testing

**Frontend → API → Backend Flow:**
- ✅ React component fetches from /api/products on mount
- ✅ API returns JSON with product array
- ✅ Product images loaded from CDN correctly
- ✅ Category filter sends query param ?category=electronics
- ✅ React state updates trigger re-render without full page reload

---

### Summary

**Overall Result:** ✅ **ALL ACCEPTANCE CRITERIA PASSED**

**Coverage:**
- 2/2 AC verified ✅
- 2 edge cases tested ✅
- 1/2 error scenarios verified ✅
- Integration flow validated ✅

**Recommendation:** Proceed to test task creation via x-test-coordinator
```

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.1 | 2025-10-31 | Added Risk Assessment section with Priority Matrix (Business Impact × Probability) for x-test-coordinator |
| 1.0 | 2025-10-31 | Initial structured format with AC, Test Results, Edge Cases, Errors, Integration |

## References

- x-story-quality-coordinator SKILL.md Phase 5 Step 3
- x-test-coordinator SKILL.md Phase 2 Step 1
- Story Template (story_template_universal.md) for AC format

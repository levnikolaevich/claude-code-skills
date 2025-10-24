# Risk-Based Testing Guide

## Purpose

This guide replaces the traditional Test Pyramid (70/20/10 ratio) with a **Value-Based Testing Framework** that prioritizes business risk and practical test limits. The goal is to write tests that matter, not to chase coverage metrics.

**Problem solved:** Traditional Test Pyramid approach generates excessive tests (~200 per Story) by mechanically testing every conditional branch. This creates maintenance burden without proportional business value.

**Solution:** Risk-Based Testing with clear prioritization criteria and enforced limits (10-28 tests max per Story).

## Core Philosophy

### Kent Beck's Principle

> "Write tests. Not too many. Mostly integration."

### Key Insights

1. **Test business value, not code coverage** - 80% coverage means nothing if critical payment flow isn't tested
2. **Manual testing has value** - Not every scenario needs automated test duplication
3. **Each test has maintenance cost** - More tests = more refactoring overhead
4. **Integration tests catch real bugs** - Unit tests catch edge cases in isolation
5. **E2E tests validate user value** - Only E2E proves the feature actually works end-to-end

## Risk Priority Matrix

### Calculation Formula

```
Priority = Business Impact (1-5) × Probability of Failure (1-5)
```

**Result ranges:**
- **Priority ≥15 (15-25):** MUST test - critical scenarios
- **Priority 9-14:** SHOULD test if not already covered
- **Priority ≤8 (1-8):** SKIP - manual testing sufficient

### Business Impact Scoring (1-5)

| Score | Impact Level | Examples |
|-------|--------------|----------|
| **5** | **Critical** | Money loss, security breach, data corruption, legal liability |
| **4** | **High** | Core business flow breaks (cannot complete purchase, cannot login) |
| **3** | **Medium** | Feature partially broken (search works but pagination fails) |
| **2** | **Low** | Minor UX issue (button disabled state wrong, tooltip missing) |
| **1** | **Trivial** | Cosmetic bug (color slightly off, spacing issue) |

### Probability of Failure Scoring (1-5)

| Score | Probability | Indicators |
|-------|-------------|------------|
| **5** | **Very High (>50%)** | Complex algorithm, external API, new technology, no existing tests |
| **4** | **High (25-50%)** | Multiple dependencies, concurrency, state management |
| **3** | **Medium (10-25%)** | Standard CRUD, framework defaults, well-tested patterns |
| **2** | **Low (5-10%)** | Simple logic, established library, copy-paste from working code |
| **1** | **Very Low (<5%)** | Trivial assignment, framework-generated code |

### Priority Matrix Table

|   | Probability 1 | Probability 2 | Probability 3 | Probability 4 | Probability 5 |
|---|---------------|---------------|---------------|---------------|---------------|
| **Impact 5** | 5 (SKIP) | 10 (SHOULD) | **15 (MUST)** | **20 (MUST)** | **25 (MUST)** |
| **Impact 4** | 4 (SKIP) | 8 (SKIP) | 12 (SHOULD) | **16 (MUST)** | **20 (MUST)** |
| **Impact 3** | 3 (SKIP) | 6 (SKIP) | 9 (SHOULD) | 12 (SHOULD) | **15 (MUST)** |
| **Impact 2** | 2 (SKIP) | 4 (SKIP) | 6 (SKIP) | 8 (SKIP) | 10 (SHOULD) |
| **Impact 1** | 1 (SKIP) | 2 (SKIP) | 3 (SKIP) | 4 (SKIP) | 5 (SKIP) |

## Test Type Decision Tree

### Step 1: Calculate Risk Priority

Use Risk Priority Matrix above.

### Step 2: Select Test Type

```
IF Priority ≥15 → Proceed to Step 3
ELSE IF Priority 9-14 → Check Anti-Duplication (Step 4), then Step 3
ELSE Priority ≤8 → SKIP (manual testing sufficient)
```

### Step 3: Choose Test Level

**E2E Test (2-5 max per Story):**
- User completes critical business flow from UI to database
- **Examples:**
  - User registers → receives email → confirms → can login
  - User adds product → proceeds to checkout → pays → sees confirmation
  - User uploads file → sees progress → file appears in list

**Integration Test (3-8 max per Story):**
- Multiple components interact with real dependencies (database, Redis, external service)
- **Examples:**
  - API endpoint → Service → Repository → PostgreSQL (real DB)
  - Service calls external payment API with test credentials
  - Webhook receiver → queue → background worker

**Unit Test (5-15 max per Story):**
- **ONLY for business logic with high complexity:**
  - Financial calculations (tax, discount, currency conversion)
  - Security logic (password validation, permission checks)
  - Complex algorithms (sorting, filtering, scoring)
- **DO NOT unit test:**
  - Simple CRUD operations already covered by E2E
  - Framework code (Express middleware, React hooks)
  - Getters/setters
  - Trivial conditionals (`if (user) return user.name`)
  - Performance/load testing (benchmarks, stress tests, scalability validation)

### Step 4: Anti-Duplication Check

Before writing ANY test, verify:

1. **Is this scenario already covered by E2E?**
   - E2E tests payment flow → SKIP unit test for `calculateTotal()`
   - E2E tests login → SKIP unit test for `validateEmail()`

2. **Is this testing framework code?**
   - Testing Express `app.use()` → SKIP
   - Testing React `useState` → SKIP
   - Testing Prisma `findMany()` → SKIP

3. **Does this add unique business value?**
   - E2E tests happy path → Unit test for edge case (negative price) → KEEP
   - Integration test already validates DB transaction → SKIP duplicate unit test

4. **Is this a one-line function?**
   - `getFullName() { return firstName + lastName }` → SKIP (E2E covers it)

## Test Limits Per Story

### Enforced Maximums

| Test Type | Minimum | Maximum | Purpose |
|-----------|---------|---------|---------|
| **E2E** | 2 | 5 | Validate critical user flows work end-to-end |
| **Integration** | 3 | 8 | Verify component interactions with real dependencies |
| **Unit** | 5 | 15 | Test complex business logic in isolation |
| **TOTAL** | 10 | 28 | Practical maintainability limit |

### Rationale for Limits

**Why maximum 5 E2E?**
- E2E tests are slow (10-60 seconds each)
- Each Story typically has 2-4 Acceptance Criteria
- 1-2 E2E per AC is sufficient
- Edge cases covered by Integration/Unit tests

**Why maximum 8 Integration?**
- Integration tests validate layer interactions
- Typical Story has 3-5 integration points (API → Service → DB)
- 1-2 tests per integration point + error scenarios

**Why maximum 15 Unit?**
- Only test complex business logic
- Typical Story has 2-4 complex functions
- 3-5 tests per function (happy path + edge cases)

**Why total maximum 28?**
- Industry data: Stories with >30 tests rarely have proportional bug prevention
- Maintenance cost grows quadratically beyond this point
- Focus on quality over quantity

## Common Over-Testing Anti-Patterns

### Anti-Pattern 1: "Every if/else needs a test"

**Bad:**
```javascript
// Function with 10 if/else branches
function processOrder(order) {
  if (!order) return null;           // Test 1
  if (!order.items) return null;      // Test 2
  if (order.items.length === 0) return null; // Test 3
  // ... 7 more conditionals
}
```
**Problem:** 10 unit tests for trivial validation logic already covered by E2E test that calls `processOrder()`.

**Good:**
- 1 E2E test: User submits valid order → success
- 1 E2E test: User submits invalid order → error message
- 1 Unit test: Complex tax calculation inside `processOrder()` (if exists)

**Total: 3 tests instead of 12**

### Anti-Pattern 2: "Testing framework code"

**Bad:**
```javascript
// Testing Express middleware
test('CORS middleware sets headers', () => {
  // Testing Express, not OUR code
});

// Testing React hook
test('useState updates component', () => {
  // Testing React, not OUR code
});
```

**Good:**
- Trust framework tests (Express/React have thousands of tests)
- Test OUR business logic that USES framework

### Anti-Pattern 3: "Duplicating E2E coverage with Unit tests"

**Bad:**
```javascript
// E2E already tests: POST /api/orders → creates order in DB
test('E2E: User can create order', ...);          // E2E
test('Unit: createOrder() inserts to database', ...); // Duplicate!
test('Unit: createOrder() returns order object', ...); // Duplicate!
```

**Good:**
```javascript
// E2E tests full flow
test('E2E: User can create order', ...);

// Unit tests ONLY complex calculation NOT fully exercised by E2E
test('Unit: Bulk discount applied when quantity > 100', ...);
```

### Anti-Pattern 4: "Aiming for 80% coverage"

**Bad mindset:**
- "We have 75% coverage, need 5 more tests to hit 80%"
- Writes tests for trivial getters/setters to inflate coverage

**Good mindset:**
- "Payment flow is critical (Priority 25) but only has 1 E2E test"
- "We have 60% coverage but all critical paths tested - DONE"

## Practical Examples

### Example 1: User Login Story

**Acceptance Criteria:**
1. User can login with valid credentials → JWT token returned
2. Invalid credentials rejected → 401 error
3. Rate limiting after 5 failed attempts → 429 error

**Risk Assessment:**

| Scenario | Business Impact | Probability | Priority | Test Type |
|----------|-----------------|-------------|----------|-----------|
| Valid login works | 4 (core flow) | 3 (standard auth) | **12** | E2E |
| Invalid credentials rejected | 5 (security) | 3 | **15** | E2E |
| Rate limiting works | 5 (security, brute force) | 4 (concurrency) | **20** | E2E |
| SQL injection attempt blocked | 5 (security breach) | 2 (Prisma escapes) | 10 | Integration |
| JWT token format valid | 4 (breaks API calls) | 2 (library tested) | 8 | SKIP |
| Password hashing uses bcrypt | 5 (security) | 1 (copy-paste code) | 5 | SKIP |

**Test Plan:**

**E2E Tests (3):**
1. User enters valid email/password → 200 OK + JWT token → token works for API call
2. User enters invalid password → 401 Unauthorized → clear error message
3. User fails login 5 times → 6th attempt returns 429 Too Many Requests

**Integration Tests (2):**
1. Login endpoint with SQL injection payload → properly escaped → 401 (not 500)
2. Rate limiter increments Redis counter correctly for concurrent requests

**Unit Tests (1):**
1. `validatePasswordStrength()` - complex regex validation with 5 edge cases

**Total: 6 tests (within 10-28 limit)**

**Avoided tests (with rationale):**
- ❌ Unit test `hashPassword()` - trivial bcrypt call, Priority 5
- ❌ Unit test `generateJWT()` - library function, tested by library
- ❌ Unit test `validateEmail()` format - covered by E2E test that rejects invalid email
- ❌ Integration test JWT token decoding - covered by E2E test that uses token

### Example 2: Product Search Story

**Acceptance Criteria:**
1. User can search products by name → results displayed
2. User can filter by category → filtered results
3. Empty search returns all products

**Risk Assessment:**

| Scenario | Business Impact | Probability | Priority | Test Type |
|----------|-----------------|-------------|----------|-----------|
| Search returns correct results | 4 (core feature) | 3 (SQL query) | **12** | E2E |
| Category filter works | 3 (partial feature) | 3 | 9 | E2E |
| Empty search shows all | 2 (minor UX) | 2 | 4 | SKIP |
| Pagination works | 3 (UX issue if breaks) | 4 (off-by-one errors) | 12 | E2E |
| Search handles special chars | 3 (breaks search) | 4 (SQL injection risk) | 12 | Integration |
| Results sorted by relevance | 2 (minor UX) | 3 | 6 | SKIP |

**Test Plan:**

**E2E Tests (3):**
1. User types "laptop" → sees products with "laptop" in name
2. User selects "Electronics" category → only electronics shown
3. User navigates to page 2 → correct products shown (pagination)

**Integration Tests (4):**
1. Search with special characters (`%`, `_`, `'`) → properly escaped
2. Search with Unicode (emoji, Cyrillic) → works correctly
3. Search with 1000-character string → returns 400 Bad Request
4. API returns 500 error → frontend shows "Search unavailable" message

**Unit Tests (0):**
- No complex business logic to test in isolation

**Total: 7 tests (within 10-28 limit)**

**Avoided tests (with rationale):**
- ❌ E2E empty search - Priority 4 (manual testing sufficient)
- ❌ Unit test `buildSearchQuery()` - covered by E2E that executes query
- ❌ Unit test sorting - Priority 6 (nice-to-have, not critical)
- ❌ Integration test database `LIKE` query - testing PostgreSQL, not our code

### Example 3: Payment Processing Story

**Acceptance Criteria:**
1. User can pay with credit card → order confirmed
2. Failed payment shows error message
3. Payment amount matches cart total

**Risk Assessment:**

| Scenario | Business Impact | Probability | Priority | Test Type |
|----------|-----------------|-------------|----------|-----------|
| Successful payment flow | 5 (money) | 3 (Stripe API) | **15** | E2E |
| Failed payment handled | 5 (money) | 4 (network issues) | **20** | E2E |
| Amount calculation correct | 5 (money) | 4 (complex math) | **20** | Unit |
| Currency conversion | 5 (money) | 5 (API + math) | **25** | Integration |
| Refund processing | 5 (money) | 3 | **15** | E2E |
| Duplicate payment prevented | 5 (money) | 4 (race condition) | **20** | Integration |
| Transaction rollback on error | 5 (data corruption) | 4 (distributed transaction) | **20** | Integration |

**Test Plan:**

**E2E Tests (3):**
1. User adds items → proceeds to checkout → enters card → payment succeeds → order created in DB
2. User enters invalid card → Stripe rejects → error shown → order NOT created
3. User initiates refund → refund processed → money returned → order status updated

**Integration Tests (5):**
1. Stripe API returns 500 error → transaction rolled back → user sees error → no charge
2. User submits payment twice (double-click) → only 1 charge created (idempotency)
3. Currency conversion EUR → USD → correct amount sent to Stripe (with real exchange rate API)
4. Payment succeeds but order creation fails → Stripe charge refunded automatically
5. Webhook receives payment confirmation → order status updated correctly

**Unit Tests (5):**
1. `calculateTotal()` with items + tax + shipping → correct amount
2. `calculateTotal()` with discount code (percentage) → correct amount
3. `calculateTotal()` with discount code (fixed amount) → correct amount
4. `calculateTotal()` with free shipping threshold → correct amount
5. `convertCurrency()` with edge case (very small amount) → rounds correctly

**Total: 13 tests (within 10-28 limit)**

**Why more tests for payment?** Every scenario has Priority ≥15 because Business Impact = 5 (money).

## Industry Best Practices

### Google Testing Philosophy

**From Google Testing Blog:**
- "Code coverage is a metric, not a goal"
- "Write tests for behavior, not implementation"
- "Prefer integration tests over unit tests for most code"

### Kent Beck's "Test Desiderata"

12 properties of good tests (prioritized):
1. **Isolated** - test failure pinpoints problem
2. **Fast** - runs in milliseconds
3. **Readable** - test name explains what's tested
4. **Behavioral** - tests what code does, not how

### Martin Fowler's Test Pyramid (2010)

**Original concept:**
- More unit tests than integration tests
- More integration tests than E2E tests

**Modern interpretation (2020s):**
- **Testing Trophy** (Kent C. Dodds): Focus on integration tests
- Unit tests for complex logic only
- E2E tests for critical user flows only

### Netflix Testing Strategy

**From Netflix Tech Blog:**
- "Manual exploratory testing finds most UI bugs"
- "Automated E2E tests only for critical paths (signup, playback, billing)"
- "Integration tests with real dependencies catch 70% of production bugs"
- "Unit tests for algorithms, not CRUD"

## When to Break the Rules

### Scenario 1: Regulatory Compliance

**Financial/Healthcare applications:**
- May need >28 tests for audit trail
- Document WHY each test exists (regulation reference)

### Scenario 2: Bug-Prone Legacy Code

**If Story modifies legacy code with history of bugs:**
- Increase Unit test limit to 20
- Add characterization tests

### Scenario 3: Public API

**If Story creates API consumed by 3rd parties:**
- Increase Integration test limit to 12
- Test all error codes (400, 401, 403, 404, 429, 500)

### Scenario 4: Security-Critical Features

**Authentication, authorization, encryption:**
- All scenarios Priority ≥15
- May reach 28 test maximum legitimately

## Migration from Test Pyramid

### Before (Test Pyramid - v8.x)

```markdown
**Test Strategy:**
- 70% Unit tests (each if/else → separate test)
- 20% Integration tests
- 10% E2E tests
- Target: 80% code coverage
```

**Result:** 120 unit tests + 20 integration + 8 E2E = 148 tests total

### After (Risk-Based Testing - v9.0)

```markdown
**Test Strategy:**
- E2E: 2-5 tests (critical user flows)
- Integration: 3-8 tests (component interactions)
- Unit: 5-15 tests (complex business logic only)
- Target: All Priority ≥15 scenarios tested
```

**Result:** 5 E2E + 8 Integration + 12 Unit = 25 tests total

**Difference:** 148 tests → 25 tests (83% reduction) while maintaining business risk coverage

## Quick Reference

### Decision Flowchart

```
1. Calculate Risk Priority (Impact × Probability)
   ↓
2. Priority ≥15?
   YES → Proceed to Step 3
   NO → Check if Priority 9-14
        YES → Anti-Duplication Check → Proceed to Step 3
        NO (≤8) → SKIP
   ↓
3. Select Test Type:
   - User flow? → E2E (max 5)
   - Multi-component + real dependencies? → Integration (max 8)
   - Complex algorithm? → Unit (max 15)
   ↓
4. Anti-Duplication Check:
   - Already covered by E2E? → SKIP
   - Testing framework? → SKIP
   - Adds unique value? → KEEP
   ↓
5. Write test
   ↓
6. Verify total ≤28 per Story
```

### Red Flags (Stop and Reconsider)

❌ **"I need to test every branch for coverage"** → Focus on business risk, not coverage
❌ **"This E2E already tests it, but I'll add unit test anyway"** → Duplication
❌ **"Need to test Express middleware behavior"** → Testing framework
❌ **"Story has 45 tests"** → Exceeds limit, prioritize
❌ **"Testing getter/setter"** → Trivial code, E2E covers it

### Green Lights (Good Test)

✅ **"Payment calculation has 5 edge cases, Priority 25"** → Unit test
✅ **"User must complete checkout, Priority 20"** → E2E test
✅ **"Database transaction rollback, Priority 20"** → Integration test
✅ **"Story has 15 tests, all Priority ≥15"** → Within limit and justified

## References

- Kent Beck, "Test Desiderata" (2018)
- Martin Fowler, "Practical Test Pyramid" (2018)
- Kent C. Dodds, "The Testing Trophy" (2020)
- Google Testing Blog, "Code Coverage Best Practices" (2020)
- Netflix Tech Blog, "Testing Strategy at Scale" (2021)
- Michael Feathers, "Working Effectively with Legacy Code" (2004)
- OWASP Testing Guide v4.2 (2023)

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-10-31 | Initial Risk-Based Testing framework to replace Test Pyramid |

**Version:** 1.0
**Last Updated:** 2025-10-31

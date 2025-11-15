# Risk-Based Testing - Practical Examples

This file contains detailed examples of applying Minimum Viable Testing philosophy to real Stories.

**Purpose:** Learning and reference (not loaded during skill execution).

**When to use:** Study these examples to understand how to trim test plans from excessive coverage-driven testing to minimal risk-based testing.

---

## Example 1: User Login Story (Minimal Approach)

**Acceptance Criteria:**
1. User can login with valid credentials → JWT token returned
2. Invalid credentials rejected → 401 error
3. Rate limiting after 5 failed attempts → 429 error

**Risk Assessment:**

| Scenario | Business Impact | Probability | Priority | Test Type |
|----------|-----------------|-------------|----------|-----------|
| Valid login works | 4 (core flow) | 3 (standard auth) | **12** | E2E (baseline) |
| Invalid credentials rejected | 5 (security) | 3 | **15** | E2E (baseline) |
| Rate limiting works | 5 (security, brute force) | 4 (concurrency) | **20** | SKIP - E2E negative covers auth error |
| SQL injection attempt blocked | 5 (security breach) | 2 (Prisma escapes) | 10 | SKIP - framework behavior |
| JWT token format valid | 4 (breaks API calls) | 2 (library tested) | 8 | SKIP - library behavior |
| Password hashing uses bcrypt | 5 (security) | 1 (copy-paste code) | 5 | SKIP - library behavior |
| Custom password strength rules | 5 (security policy) | 4 (complex regex) | **20** | Unit (OUR logic) |

**Test Plan (Minimum Viable Testing):**

**E2E Tests (2 baseline):**
1. **Positive:** User enters valid email/password → 200 OK + JWT token → token works for protected API call
2. **Negative:** User enters invalid password → 401 Unauthorized → clear error message shown

**Integration Tests (0):**
- None needed - 2 baseline E2E tests cover full stack (endpoint → service → database)

**Unit Tests (1 - OUR business logic only):**
1. `validatePasswordStrength()` - OUR custom regex (12+ chars, special symbols, numbers) with 5 edge cases

**Total: 3 tests (within realistic goal 2-7)**

**What changed from 6 → 3 tests:**
- ❌ E2E rate limiting test - REMOVED (Priority 20 but tests Redis library, not OUR logic)
- ❌ Integration SQL injection test - REMOVED (testing Prisma escaping, not OUR code)
- ❌ Integration rate limiter test - REMOVED (testing Redis counter, not OUR code)

**Why 3 tests sufficient:**
- 2 baseline E2E cover all Acceptance Criteria (valid login + error handling)
- 1 Unit test covers OUR custom password policy (not library behavior)
- Rate limiting, SQL escaping, JWT generation = framework/library behavior (trust the library)

**Avoided tests (with rationale):**
- ❌ Unit test `hashPassword()` - bcrypt library behavior, Priority 5
- ❌ Unit test `generateJWT()` - jsonwebtoken library behavior, Priority 8
- ❌ Unit test `validateEmail()` format - covered by E2E negative test
- ❌ Integration test JWT token decoding - jsonwebtoken library behavior
- ❌ Integration test rate limiting - Redis library behavior
- ❌ Integration test SQL injection - Prisma library behavior

---

## Example 2: Product Search Story (Minimal Approach)

**Acceptance Criteria:**
1. User can search products by name → results displayed
2. User can filter by category → filtered results
3. Empty search returns all products

**Risk Assessment:**

| Scenario | Business Impact | Probability | Priority | Test Type |
|----------|-----------------|-------------|----------|-----------|
| Search returns correct results | 4 (core feature) | 3 (SQL query) | **12** | E2E (baseline positive) |
| Invalid search returns empty | 3 (UX feedback) | 3 | 9 | E2E (baseline negative) |
| Category filter works | 3 (partial feature) | 3 | 9 | SKIP - covered by positive E2E |
| Empty search shows all | 2 (minor UX) | 2 | 4 | SKIP - Priority too low |
| Pagination works | 3 (UX issue if breaks) | 4 (off-by-one errors) | 12 | SKIP - UI pagination, not business logic |
| Search handles special chars | 3 (breaks search) | 4 (SQL injection risk) | 12 | SKIP - Prisma/PostgreSQL behavior |
| Results sorted by relevance | 2 (minor UX) | 3 | 6 | SKIP - Priority too low |
| Unicode search | 3 (breaks for non-EN) | 4 | 12 | SKIP - database engine behavior |

**Test Plan (Minimum Viable Testing):**

**E2E Tests (2 baseline):**
1. **Positive:** User types "laptop" in search → sees products with "laptop" in name/description
2. **Negative:** User types "nonexistent999" → sees "No results found" message

**Integration Tests (0):**
- None needed - special character escaping is Prisma/PostgreSQL behavior, not OUR logic

**Unit Tests (0):**
- No complex business logic - simple database search query

**Total: 2 tests (minimum baseline)**

**What changed from 7 → 2 tests:**
- ❌ E2E pagination test - REMOVED (UI pagination library, not OUR business logic)
- ❌ Integration special chars test - REMOVED (Prisma query builder escaping, not OUR code)
- ❌ Integration Unicode test - REMOVED (PostgreSQL LIKE operator, not OUR code)
- ❌ Integration 1000-char string test - REMOVED (input validation middleware, not search logic)
- ❌ Integration 500 error test - REMOVED (error handling middleware, not search logic)

**Why 2 tests sufficient:**
- 2 baseline E2E cover both Acceptance Criteria (successful search + no results case)
- No complex business logic to isolate - just database query (trust Prisma + PostgreSQL)
- Pagination, special characters, Unicode, error handling = framework/library/database behavior

**Avoided tests (with rationale):**
- ❌ E2E empty search - Priority 4 (manual testing sufficient)
- ❌ E2E category filter - covered by baseline positive test (can search + filter simultaneously)
- ❌ E2E pagination - testing UI pagination library, not OUR code
- ❌ Unit test `buildSearchQuery()` - covered by E2E that executes query
- ❌ Unit test sorting - Priority 6 (nice-to-have, not critical)
- ❌ Integration test database `LIKE` query - testing PostgreSQL, not OUR code
- ❌ Integration test special character escaping - testing Prisma, not OUR code

---

## Example 3: Payment Processing Story (Minimal Approach)

**Acceptance Criteria:**
1. User can pay with credit card → order confirmed
2. Failed payment shows error message
3. Payment amount matches cart total

**Risk Assessment:**

| Scenario | Business Impact | Probability | Priority | Test Type |
|----------|-----------------|-------------|----------|-----------|
| Successful payment flow | 5 (money) | 3 (Stripe API) | **15** | E2E (baseline positive) |
| Failed payment handled | 5 (money) | 4 (network issues) | **20** | E2E (baseline negative) |
| Amount calculation correct | 5 (money) | 4 (complex math) | **20** | Unit (OUR calculation logic) |
| Tax calculation by region | 5 (money) | 5 (complex rules) | **25** | Unit (OUR tax rules) |
| Discount calculation | 5 (money) | 4 (business rules) | **20** | Unit (OUR discount logic) |
| Currency conversion | 5 (money) | 5 (API + math) | **25** | SKIP - E2E covers, no complex OUR logic |
| Refund processing | 5 (money) | 3 | **15** | SKIP - E2E positive covers payment flow |
| Duplicate payment prevented | 5 (money) | 4 (race condition) | **20** | SKIP - Stripe API idempotency, not OUR code |
| Transaction rollback on error | 5 (data corruption) | 4 (distributed transaction) | **20** | SKIP - database transaction manager, not OUR code |
| Stripe API 500 error | 5 (money) | 3 | **15** | SKIP - E2E negative covers error handling |
| Webhook processing | 5 (money) | 3 | **15** | SKIP - Stripe webhook mechanism, not complex OUR logic |

**Test Plan (Minimum Viable Testing):**

**E2E Tests (2 baseline):**
1. **Positive:** User adds items to cart → proceeds to checkout → enters valid card → payment succeeds → order created in DB
2. **Negative:** User enters invalid card → Stripe rejects → error message shown → order NOT created

**Integration Tests (0):**
- None needed - currency conversion uses external API (trust API), transaction rollback is database behavior, Stripe idempotency is Stripe behavior

**Unit Tests (3 - OUR complex business logic only):**
1. `calculateTotal()` - OUR calculation: items total + tax (by region) + shipping - discount → correct amount (5 edge cases)
2. `calculateTax()` - OUR tax rules: different rates by country/state, special product categories (5 edge cases)
3. `applyDiscount()` - OUR discount logic: percentage discount, fixed amount discount, minimum order threshold (5 edge cases)

**Total: 5 tests (within realistic goal 2-7)**

**What changed from 13 → 5 tests:**
- ❌ E2E refund test - REMOVED (Stripe API refund mechanism, covered by positive E2E)
- ❌ Integration Stripe 500 error test - REMOVED (covered by baseline negative E2E)
- ❌ Integration duplicate payment test - REMOVED (Stripe idempotency keys, not OUR code)
- ❌ Integration currency conversion test - REMOVED (external API behavior, not complex OUR logic)
- ❌ Integration transaction rollback test - REMOVED (database transaction manager, not OUR code)
- ❌ Integration webhook test - REMOVED (Stripe webhook mechanism, not complex OUR logic)
- ❌ Unit test `convertCurrency()` - REMOVED (external API call, no complex OUR calculation)
- ❌ Unit test shipping calculation - MERGED into `calculateTotal()` (part of same calculation)

**Why 5 tests sufficient:**
- 2 baseline E2E cover all Acceptance Criteria (successful payment + failed payment)
- 3 Unit tests cover OUR complex financial calculations (money = Priority 25)
- Currency conversion, transaction rollback, Stripe idempotency, webhooks = external services/framework behavior (trust them)

**Avoided tests (with rationale):**
- ❌ Integration test currency conversion - external API behavior, not OUR math
- ❌ Integration test transaction rollback - database transaction manager behavior
- ❌ Integration test Stripe idempotency - Stripe API feature, not OUR code
- ❌ Integration test Stripe 500 error - covered by baseline E2E negative test
- ❌ Integration test webhook - Stripe mechanism, not complex OUR logic
- ❌ E2E refund test - Stripe API refund, not different from payment flow
- ❌ Unit test free shipping threshold - part of `calculateTotal()` unit test

---

**Version:** 1.0.0
**Last Updated:** 2025-11-14

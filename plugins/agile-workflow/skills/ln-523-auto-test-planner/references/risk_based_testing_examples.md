# Risk-Based Testing - Practical Examples

<!-- SCOPE: Risk-Based Testing practical examples ONLY. Contains Story-to-test mapping examples. -->
<!-- DO NOT add here: Testing rules → risk_based_testing_guide.md, test planning logic → ln-523-auto-test-planner SKILL.md -->

This file contains detailed examples of applying Minimum Viable Testing philosophy to real Stories.

**Purpose:** Learning and reference (not loaded during skill execution).

**When to use:** Study these examples to understand how to trim test plans from excessive coverage-driven testing to minimal risk-based testing.

---

## Example 1: User Login Story (Minimal Approach)

**Acceptance Criteria:**
1. User can login with valid credentials -> JWT token returned
2. Invalid credentials rejected -> 401 error
3. Rate limiting after 5 failed attempts -> 429 error

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
1. **Positive:** User enters valid email/password -> 200 OK + JWT token -> token works for protected API call
2. **Negative:** User enters invalid password -> 401 Unauthorized -> clear error message shown

**Integration Tests (0):**
- None needed - 2 baseline E2E tests cover full stack (endpoint -> service -> database)

**Unit Tests (1 - OUR business logic only):**
1. `validatePasswordStrength()` - OUR custom regex (12+ chars, special symbols, numbers) with 5 edge cases

**Total: 3 tests (all Priority ≥15, pass Usefulness Criteria)**

---

## Example 2: Product Search Story (Minimal Approach)

**Acceptance Criteria:**
1. User can search products by name -> results displayed
2. User can filter by category -> filtered results
3. Empty search returns all products

**Test Plan (Minimum Viable Testing):**

**E2E Tests (2 baseline):**
1. **Positive:** User types "laptop" in search -> sees products with "laptop" in name/description
2. **Negative:** User types "nonexistent999" -> sees "No results found" message

**Integration Tests (0):**
- None needed - special character escaping is Prisma/PostgreSQL behavior, not OUR logic

**Unit Tests (0):**
- No complex business logic - simple database search query

**Total: 2 tests (minimum baseline)**

---

## Example 3: Payment Processing Story (Minimal Approach)

**Acceptance Criteria:**
1. User can pay with credit card -> order confirmed
2. Failed payment shows error message
3. Payment amount matches cart total

**Test Plan (Minimum Viable Testing):**

**E2E Tests (2 baseline):**
1. **Positive:** User adds items to cart -> proceeds to checkout -> enters valid card -> payment succeeds -> order created in DB
2. **Negative:** User enters invalid card -> Stripe rejects -> error message shown -> order NOT created

**Integration Tests (0):**
- None needed - currency conversion uses external API (trust API), transaction rollback is database behavior

**Unit Tests (3 - OUR complex business logic only):**
1. `calculateTotal()` - OUR calculation: items total + tax (by region) + shipping - discount -> correct amount (5 edge cases)
2. `calculateTax()` - OUR tax rules: different rates by country/state, special product categories (5 edge cases)
3. `applyDiscount()` - OUR discount logic: percentage discount, fixed amount discount, minimum order threshold (5 edge cases)

**Total: 5 tests (all Priority ≥15, pass Usefulness Criteria)**

---

**Version:** 1.0.0
**Last Updated:** 2025-11-14

# Risk-Based Testing Guide

<!-- SCOPE: Risk-Based Testing philosophy and usefulness criteria ONLY. Contains prioritization rules, Test Usefulness Criteria, Kent Beck principle. -->
<!-- DO NOT add here: Examples → risk_based_testing_examples.md, test planning logic → ln-523-auto-test-planner SKILL.md -->

## Purpose

This guide replaces the traditional Test Pyramid (70/20/10 ratio) with a **Value-Based Testing Framework** that prioritizes business risk and test usefulness. The goal is to write tests that matter, not to chase coverage metrics or numerical targets.

**Problem solved:** Traditional Test Pyramid approach generates excessive tests by mechanically testing every conditional branch. This creates maintenance burden without proportional business value.

**Solution:** Risk-Based Testing with clear prioritization criteria (Priority ≥15) and Test Usefulness Criteria.

## Core Philosophy

### Kent Beck's Principle

> "Write tests. Not too many. Mostly integration."

### Key Insights

1. **Test business value, not code coverage** - 80% coverage means nothing if critical payment flow isn't tested
2. **Manual testing has value** - Not every scenario needs automated test duplication
3. **Each test has maintenance cost** - More tests = more refactoring overhead
4. **Integration tests catch real bugs** - Unit tests catch edge cases in isolation
5. **E2E tests validate user value** - Only E2E proves the feature actually works end-to-end

## Minimum Viable Testing Philosophy

### Start Minimal, Justify Additions

**Baseline for every Story:**
- **E2E tests** per endpoint: Positive scenario (happy path) + Negative scenario (critical error)
- **Integration tests** only when E2E doesn't cover interaction
- **Unit tests** only for complex business logic with Priority ≥15

**Each test beyond baseline must pass Test Usefulness Criteria** (see section below).

**Additional tests ONLY with critical justification:**
- Each requires documented answer to "Why does this test OUR business logic (not framework/library/database)?"
- Priority ≥15 required for all additional tests
- Each must pass all 6 Usefulness Criteria

### Critical Justification Questions

Before adding ANY test beyond baseline E2E, answer:

1. **Does this test OUR business logic?**
   - YES: Tax calculation with country-specific rules (OUR algorithm)
   - NO: bcrypt hashing (library behavior)
   - NO: Prisma query execution (framework behavior)
   - NO: PostgreSQL LIKE operator (database behavior)

2. **Is this already covered by baseline E2E tests?**
   - NO: E2E doesn't exercise all branches of complex calculation
   - YES: E2E test validates full flow end-to-end

3. **Priority >=15?**
   - YES: Money, security, data integrity
   - NO: Skip, manual testing sufficient

4. **Unique business value?**
   - YES: Tests different scenario than existing tests
   - NO: Duplicate coverage

**If ANY answer is NO -> SKIP this test**

## Risk Priority Matrix

### Calculation Formula

```
Priority = Business Impact (1-5) x Probability of Failure (1-5)
```

**Result ranges:**
- **Priority >=15 (15-25):** MUST test - critical scenarios
- **Priority 9-14:** SHOULD test if not already covered
- **Priority <=8 (1-8):** SKIP - manual testing sufficient

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
IF Priority >=15 -> Proceed to Step 3
ELSE IF Priority 9-14 -> Check Anti-Duplication (Step 4), then Step 3
ELSE Priority <=8 -> SKIP (manual testing sufficient)
```

### Step 3: Choose Test Level

**E2E Test:**
- **BASELINE (ALWAYS):** Positive scenario (happy path) + Negative scenario (critical error) per endpoint
- **ADDITIONAL:** ONLY if Priority ≥15 AND passes Usefulness Criteria
  - Critical edge case from manual testing
  - Second endpoint (if Story implements multiple endpoints)
- **Examples:**
  - User registers -> receives email -> confirms -> can login
  - User adds product -> proceeds to checkout -> pays -> sees confirmation
  - User uploads file -> sees progress -> file appears in list

**Integration Test:**
- **DEFAULT: 0 Integration tests** (E2E covers full stack by default)
- **ADD ONLY if:** E2E doesn't cover interaction completely AND Priority >=15 AND justified
- **Examples:**
  - Transaction rollback on error (E2E tests happy path only)
  - Concurrent request handling (E2E tests single request)
  - External API error scenarios (500, timeout) with Priority >=15
- **MANDATORY SKIP:**
  - Simple pass-through calls (E2E already validates end-to-end)
  - Testing framework integrations (Prisma client, TypeORM repository, Express app)
  - Testing database query execution (database engine behavior)

**Unit Test:**
- **DEFAULT: 0 Unit tests** (E2E covers simple logic by default)
- **ADD ONLY for complex business logic with Priority >=15:**
  - Financial calculations (tax, discount, currency conversion) **WITH COMPLEX RULES**
  - Security algorithms (password strength, permission matrix) **WITH CUSTOM LOGIC**
  - Complex business algorithms (scoring, matching, ranking) **WITH MULTIPLE FACTORS**
- **MANDATORY SKIP - DO NOT create unit tests for:**
  - Simple CRUD operations (already covered by E2E)
  - Framework code (Express middleware, React hooks, FastAPI dependencies)
  - Library functions (bcrypt hashing, jsonwebtoken signing, axios requests)
  - Database queries (Prisma findMany, TypeORM query builder, SQL joins)
  - Getters/setters or simple property access
  - Trivial conditionals (`if (user) return user.name`, `status === 'active'`)
  - Pass-through functions (wrappers without logic)
  - Performance/load/stress testing (benchmarks, stress tests, scalability, throughput)

### Step 4: Anti-Duplication Check

Before writing ANY test, verify:

1. **Is this scenario already covered by E2E?**
   - E2E tests payment flow -> SKIP unit test for `calculateTotal()`
   - E2E tests login -> SKIP unit test for `validateEmail()`

2. **Is this testing framework code?**
   - Testing Express `app.use()` -> SKIP
   - Testing React `useState` -> SKIP
   - Testing Prisma `findMany()` -> SKIP

3. **Does this add unique business value?**
   - E2E tests happy path -> Unit test for edge case (negative price) -> KEEP
   - Integration test already validates DB transaction -> SKIP duplicate unit test

4. **Is this a one-line function?**
   - `getFullName() { return firstName + lastName }` -> SKIP (E2E covers it)

## Test Usefulness Criteria

Every test beyond baseline E2E MUST pass ALL 6 criteria. If ANY criterion fails → SKIP the test.

| # | Criterion | Question | Fail → Action | Source |
|---|-----------|----------|---------------|--------|
| 1 | **Risk Priority ≥15** | Business Impact × Probability ≥15? | SKIP — manual testing sufficient | Risk-Based Testing |
| 2 | **Confidence ROI** | Does this test give meaningful confidence relative to its maintenance cost? | SKIP — cost exceeds value | Kent Dodds, "Write tests. Not too many." |
| 3 | **Behavioral** | Tests observable behavior, not implementation details? | REWRITE — decouple from internals | Kent Beck, Test Desiderata |
| 4 | **Predictive** | Passing test = confidence it works in production? | SKIP — false confidence | Kent Beck, Test Desiderata |
| 5 | **Specific** | When test fails, is the cause immediately obvious? | SPLIT — one assertion per concern | Kent Beck, Test Desiderata |
| 6 | **Non-Duplicative** | Adds unique business value not covered by existing tests? | SKIP — duplicate coverage | Anti-Duplication Check |

**No numerical targets.** Test count is driven by risk assessment, not volume goals. A Story with 1 E2E test covering Priority ≥15 is better than a Story with 20 tests covering framework behavior.

## Common Over-Testing Anti-Patterns

### Anti-Pattern 1: "Every if/else needs a test"

**Bad:** 10 unit tests for trivial validation logic already covered by E2E test.

**Good:**
- 1 E2E test: User submits valid order -> success
- 1 E2E test: User submits invalid order -> error message
- 1 Unit test: Complex tax calculation inside `processOrder()` (if exists)

**Total: 3 tests instead of 12**

### Anti-Pattern 2: "Testing framework code"

Trust framework tests (Express/React have thousands of tests). Test OUR business logic that USES framework.

### Anti-Pattern 3: "Duplicating E2E coverage with Unit tests"

E2E tests full flow. Unit tests ONLY complex calculation NOT fully exercised by E2E.

### Anti-Pattern 4: "Aiming for 80% coverage"

Focus on business risk, not coverage metrics.

### Anti-Pattern 5-7: Testing framework/database/library

Trust the framework/database/library. Test OUR business logic.

### Anti-Pattern 8: "Performance/Load Testing in Story Task"

Performance testing belongs in separate DevOps Epic with k6/JMeter/Locust.

### Anti-Pattern 9: "Default Value Blindness"

Testing with default configuration values (default ports, default timeouts, default limits). Code appears to work but actually ignores configuration — fallback defaults mask the bug.

**Bad:** `timeout=30000` in test when code does `config.timeout || 30000` — test passes even if config is never read.

**Good:** Use non-default values in ALL tests: non-standard ports (9999 not 8080), non-default timeouts (7500 not 30000), non-default limits (3 not 20). If test still passes, code actually reads config.

## Test Strictness Rules

### Assertion Hierarchy (Strictest First)

| Priority | Type | When to Use |
|----------|------|-------------|
| 1 | Exact equality | Default - known expected value |
| 2 | Snapshot/golden file | Complex deterministic output |
| 3 | Partial match | Only when justified (dynamic data) |

### Golden Rule

> "If you know the expected value, assert the exact value."

### Forbidden Patterns

**NEVER** use loose assertions to "make test pass":
- Truthy check when exact value is known
- Substring match instead of exact string
- "Contains element" instead of exact array comparison
- Partial object match when full structure is deterministic

### Non-Default Configuration Values

> "If a value is configurable, test with a non-default value."

ALL configurable parameters (API ports, timeouts, limits, pagination, base URLs, feature flags) MUST use non-default values in tests. This verifies code reads configuration rather than relying on hardcoded fallbacks (`value || DEFAULT`).

## When New Tests Fail

**Principle:** Test = specification. If test fails, first assume **CODE IS WRONG**.

### Anti-Pattern: Adjusting test to match result

**BAD:** Test fails -> change assertion to match actual output

**GOOD:** Test fails -> investigate why code returns wrong value

## Quick Reference

### Decision Flowchart (Minimum Viable Testing)

```
1. Start with baseline E2E tests (positive + negative per endpoint) - ALWAYS
   |
2. For each additional test, calculate Risk Priority (Impact x Probability)
   |
3. Priority >=15?
   NO (<=14) -> SKIP (manual testing sufficient)
   YES -> Proceed to Step 4
   |
4. Test Usefulness Criteria (ALL 6 must pass):
   Risk Priority ≥15? Confidence ROI? Behavioral?
   Predictive? Specific? Non-Duplicative?
   ANY FAIL? -> SKIP
   ALL PASS? -> Proceed to Step 5
   |
5. Select Test Type:
   - User flow? -> E2E (with justification)
   - E2E doesn't cover interaction? -> Integration (with justification)
   - Complex OUR algorithm? -> Unit (with justification)
```

### Red Flags (Stop and Reconsider)

- "I need to test every branch for coverage" -> Focus on business risk
- "This E2E already tests it, but I'll add unit test anyway" -> Duplication
- "Need to test Express middleware behavior" -> Testing framework
- "Need to test Prisma query execution" -> Testing database/ORM
- "Story has tests without justification" -> Verify each passes Usefulness Criteria

### Green Lights (Good Test)

- "E2E: positive + negative for main endpoint" -> Baseline (ALWAYS)
- "Tax calculation with country-specific rules, Priority 25" -> Unit test (OUR complex logic, passes all 6 criteria)
- "Every test has documented justification and passes Usefulness Criteria" -> Quality over quantity

## References

- Kent Beck, "Test Desiderata" (2018) — 12 properties of valuable tests (https://testdesiderata.com/)
- Kent C. Dodds, "Write tests. Not too many. Mostly integration." (2019) — Confidence ROI framework
- Google Testing Blog, "How Much Testing is Enough?" (2021) — No numerical targets, qualitative framework
- Martin Fowler, "Practical Test Pyramid" (2018)
- web.dev, "Pyramid or Crab? Find a testing strategy that fits" (2024) — Strategy fits architecture, not textbook

---

**Version:** 2.1.0
**Last Updated:** 2026-01-15

---
name: ln-635-test-isolation-auditor
description: "Audits whether test results can be trusted: flakiness, isolation, real external dependencies, time/random/order dependency, and shared state. Use when auditing test trustworthiness."
allowed-tools: Read, Grep, Glob, Bash
license: MIT
model: claude-haiku-4-5
---

> **Paths:** File paths (`references/`, `../ln-*`) are relative to this skill directory.

# Trustworthiness Auditor (L3 Worker)

**Type:** L3 Worker

Specialized worker auditing whether automated test results are deterministic, isolated, and trustworthy.

## Purpose & Scope

- Audit **Test Trustworthiness** (Category 5: Medium Priority)
- Check determinism, isolation, and dependency control
- Detect flaky tests, time/random/order dependency, shared state, and real external dependencies
- Emit `REWRITE_FOR_DETERMINISM` or `DELETE_IF_LOW_VALUE`
- Calculate compliance score (X/10)

## Inputs

**MANDATORY READ:** Load `references/audit_worker_core_contract.md`.

Receives `contextStore` with: `tech_stack`, `testFilesMetadata`, `codebase_root`, `output_dir`.

## Workflow

Detection policy: use two-layer detection (candidate scan, then context verification); load `references/two_layer_detection.md` only when the verification method is ambiguous.

1) **Parse Context:** Extract tech stack, trustworthiness checklist, test file list, output_dir from contextStore
2) **Check Isolation (Layer 1):** Check isolation for 6 categories (APIs, DB, FS, Time, Random, Network)
2b) **Context Analysis (Layer 2 -- MANDATORY):** For each isolation violation, ask:
   - Is this an **integration test**? (real dependencies are intentional) -> **do NOT flag**. Only flag isolation issues in **unit tests**
   - Is in-memory DB configured via test config (not visible in grep)? -> **skip**
   - Is this a test helper that sets up mocks for other tests? -> **skip**
3) **Check Determinism:** Check for flaky tests, time-dependent assertions, order-dependent tests, shared mutable state
4) **Evaluate trust action:** Use `REWRITE_FOR_DETERMINISM` by default; use `DELETE_IF_LOW_VALUE` only when the test is both untrustworthy and low-value according to obvious local evidence
5) **Collect Findings:** Record each violation with severity, location (file:line), effort estimate (S/M/L), action, recommendation
6) **Calculate Score:** Count violations by severity, calculate compliance score (X/10)
7) **Write Report:** Build full markdown report in memory per `references/templates/audit_worker_report_template.md`, write to `{output_dir}/ln-635--global.md` in single Write call
8) **Return Summary:** Return minimal summary to coordinator (see Output Format)

## Audit Rules: Test Isolation

### 1. External APIs

**Good:** Mocked (jest.mock, sinon, nock)
**Bad:** Real HTTP calls to external APIs

**Detection:**
- Grep for `axios.get`, `fetch(`, `http.request` without mocks
- Check if test makes actual network calls

**Severity:** **HIGH**

**Recommendation:** Ensure external API calls are controlled (mock, stub, or test server). Tool choice depends on project stack. **Exception:** Integration tests are EXPECTED to use real dependencies -- do NOT flag

**Effort:** M

### 2. Database

**Good:** In-memory DB (sqlite :memory:) or mocked
**Bad:** Real database (PostgreSQL, MySQL)

**Detection:**
- Check DB connection strings (localhost:5432, real DB URL)
- Grep for `beforeAll(async () => { await db.connect() })` without `:memory:`

**Severity:** **MEDIUM**

**Recommendation:** Ensure DB state is controlled and isolated between test runs. **Exception:** Integration tests with in-memory DB via config -> skip

**Effort:** M-L

### 3. File System

**Good:** Mocked (mock-fs, vol)
**Bad:** Real file reads/writes

**Detection:**
- Grep for `fs.readFile`, `fs.writeFile` without mocks
- Check if test creates/deletes real files

**Severity:** **MEDIUM**

**Recommendation:** Ensure file system operations are isolated (mock, temp directory, or cleanup). Tool choice depends on project stack

**Effort:** S-M

### 4. Time/Date

**Good:** Mocked (jest.useFakeTimers, sinon.useFakeTimers)
**Bad:** `new Date()`, `Date.now()` without mocks

**Detection:**
- Grep for `new Date()` in test files without `useFakeTimers`

**Severity:** **MEDIUM**

**Recommendation:** Ensure time-dependent logic uses controlled clock (fake timers, injected clock, or time provider). Tool choice depends on project stack

**Effort:** S

### 5. Random

**Good:** Seeded random (Math.seedrandom, fixed seed)
**Bad:** `Math.random()` without seed

**Detection:**
- Grep for `Math.random()` without seed setup

**Severity:** **LOW**

**Recommendation:** Use seeded random for deterministic tests

**Effort:** S

### 6. Network

**Good:** Mocked (supertest for Express, no real ports)
**Bad:** Real network requests (`localhost:3000`, binding to port)

**Detection:**
- Grep for `app.listen(3000)` in tests
- Check for real HTTP requests

**Severity:** **MEDIUM**

**Recommendation:** Use `supertest` (no real port)

**Effort:** M

## Audit Rules: Determinism

### 1. Flaky Tests

**What:** Tests that pass/fail randomly

**Detection:**
- Run tests multiple times, check for inconsistent results
- Grep for `setTimeout`, `setInterval` without proper awaits
- Check for race conditions (async operations not awaited)

**Severity:** **HIGH**

**Recommendation:** Fix race conditions, use proper async/await

**Effort:** M-L

### 2. Time-Dependent Assertions

**What:** Assertions on current time (`expect(timestamp).toBeCloseTo(Date.now())`)

**Detection:**
- Grep for `Date.now()`, `new Date()` in assertions

**Severity:** **MEDIUM**

**Recommendation:** Mock time

**Effort:** S

### 3. Order-Dependent Tests

**What:** Tests that fail when run in different order

**Detection:**
- Run tests in random order, check for failures
- Grep for shared mutable state between tests

**Severity:** **MEDIUM**

**Recommendation:** Isolate tests, reset state in beforeEach

**Effort:** M

### 4. Shared Mutable State

**What:** Global variables modified across tests

**Detection:**
- Grep for `let globalVar` at module level
- Check for state shared between tests

**Severity:** **MEDIUM**

**Recommendation:** Use `beforeEach` to reset state

**Effort:** S-M

## Audit Rules: Trustworthiness Drag

### 1. Overlarge Test With Shared Setup (>100 lines)

**What:** Test with >100 lines, testing too many scenarios

**Detection:**
- Count lines per test
- If >100 lines -> Giant

**Severity:** **MEDIUM**

**Recommendation:** Split into focused tests (one scenario per test)

**Effort:** S-M

### 2. Slow Poke (>5 seconds)

**What:** Test taking >5 seconds to run

**Detection:**
- Measure test duration
- If >5s -> Slow Poke

**Severity:** **MEDIUM**

**Recommendation:** Control external deps with test doubles or in-memory services selected from the project stack; parallelize only after isolation is verified

**Effort:** M

### 3. Conjoined Twins (Unit test without controlled dependencies)

**What:** Test labeled "Unit" but not mocking dependencies

**Detection:**
- Check if test name includes "Unit"
- Verify all dependencies are mocked
- If no mocks -> actually Integration test

**Severity:** **LOW**

**Recommendation:** Either mock dependencies OR rename to Integration test

**Effort:** S

### 4. Default Value Blindness (Tests with default config)

**What:** Tests with default config values only. Use the non-default config rule from `references/risk_based_testing_guide.md`; load `references/risk_based_testing_methodology.md` only when examples are needed.

**Detection:**
- Grep for common defaults in test setup: `:8080`, `:3000`, `30000`, `limit: 20`, `offset: 0`
- Check if test config values match framework/library defaults
- Look for `|| DEFAULT` patterns in source code with matching test values

**Severity:** **HIGH**

**Effort:** S

## Scoring Algorithm

**MANDATORY READ:** Load `references/audit_scoring.md`.

**Severity mapping:**
- Flaky tests, External API not controlled, Default Value Blindness -> HIGH
- Real database, File system, Time/Date, Network, Overlarge shared setup, Slow Poke -> MEDIUM
- Random without seed, Order-dependent, Conjoined Twins -> LOW

## Output Format

**MANDATORY READ:** Load `references/templates/audit_worker_report_template.md`.

Write JSON summary per `references/audit_summary_contract.md`. In managed mode the caller passes both `runId` and `summaryArtifactPath`; in standalone mode the worker generates its own run-scoped artifact path per shared contract.

Write report to `{output_dir}/ln-635--global.md` with `category: "Test Trustworthiness"` and checks: api_isolation, db_isolation, fs_isolation, time_isolation, random_isolation, network_isolation, flaky_tests, order_dependency, shared_state, default_value_blindness.

Return summary per `references/audit_summary_contract.md`.

When `summaryArtifactPath` is absent, write the standalone runtime summary under `.hex-skills/runtime-artifacts/runs/{run_id}/evaluation-worker/{worker}--{identifier}.json` and optionally echo the same summary in structured output.
```
Report written: .hex-skills/runtime-artifacts/runs/{run_id}/audit-report/ln-635--global.md
Score: X.X/10 | Issues: N (C:N H:N M:N L:N)
```

**Note:** Findings are flattened into single array. Use `principle` field prefix (Isolation / Determinism / Dependency Control) to identify issue category. Each finding includes `action: "REWRITE_FOR_DETERMINISM"` or `action: "DELETE_IF_LOW_VALUE"`.

## Critical Rules

Apply the already-loaded `references/audit_worker_core_contract.md`.

- **Do not auto-fix:** Report only
- **Effort realism:** S = <1h, M = 1-4h, L = >4h
- **Flat findings:** Merge isolation + determinism + dependency-control findings into single findings array, use `principle` prefix to distinguish
- **Context-aware:** Supertest with real Express app is acceptable for integration tests
- **Unique angle:** Only audit whether test results can be trusted. Do not evaluate product behavior, E2E journey value, portfolio value, missing coverage, oracle strength, manual evidence, or structure.
- **Action required:** Every finding uses `REWRITE_FOR_DETERMINISM` unless evidence shows the test is also low-value enough to use `DELETE_IF_LOW_VALUE`.

**Monitor (2.1.98+):** For repeated test runs expected >30s each, use `Monitor`. Fallback: `Bash(run_in_background=true)`.

## Definition of Done

Apply the already-loaded `references/audit_worker_core_contract.md`.

- [ ] contextStore parsed successfully (including output_dir)
- [ ] All 3 audit groups completed:
  - Isolation (6 categories: APIs, DB, FS, Time, Random, Network)
  - Determinism (4 checks: flaky, time-dependent, order-dependent, shared state)
  - Dependency control (overlarge shared setup, slow tests, conjoined dependencies, default-value blindness)
- [ ] Findings collected with severity, location, effort, action, recommendation
- [ ] Score calculated using penalty algorithm
- [ ] Report written to `{output_dir}/ln-635--global.md` (atomic single Write call)
- [ ] Summary written per contract

---
**Version:** 3.0.0
**Last Updated:** 2025-12-23

---
name: ln-631-test-business-logic-auditor
description: "Detects tests validating framework/library behavior instead of project code. Use when auditing test business logic focus."
allowed-tools: Read, Grep, Glob, Bash
license: MIT
---

> **Paths:** File paths (`shared/`, `references/`, `../ln-*`) are relative to skills repo root. If not found at CWD, locate this SKILL.md directory and go up one level for repo root. If `shared/` is missing, fetch files via WebFetch from `https://raw.githubusercontent.com/levnikolaevich/claude-code-skills/master/skills/{path}`.

# Business Logic Focus Auditor (L3 Worker)

**Type:** L3 Worker

Specialized worker auditing tests for Business Logic Focus (Category 1).

## Purpose & Scope

- Audit **Business Logic Focus** (Category 1: High Priority)
- Detect tests validating framework/library behavior (NOT our code)
- Calculate compliance score (X/10)

## Inputs

**MANDATORY READ:** Load `shared/references/audit_worker_core_contract.md`.

Receives `contextStore` with: `tech_stack`, `testFilesMetadata`, `codebase_root`, `output_dir`.

## Workflow

**MANDATORY READ:** Load `shared/references/two_layer_detection.md` for detection methodology.

1) **Parse Context:** Extract tech stack, framework detection patterns, test file list, output_dir from contextStore
2) **Scan Codebase (Layer 1):** Scan test files for framework/library tests (see Audit Rules below)
2b) **Context Analysis (Layer 2 -- MANDATORY):** For each candidate, read test code and ask:
   - Does this test custom code that *wraps* a framework primitive (e.g., custom hook using useState)? -> **KEEP** (testing integration, not framework)
   - Does this test ONLY call framework API with no custom logic? -> flag for removal
   - Is this a test helper/utility that imports libraries for mocking setup? -> **skip** (not a test of framework behavior)
3) **Collect Findings:** Record each violation with severity, location (file:line), effort estimate (S/M/L), recommendation
4) **Calculate Score:** Count violations by severity, calculate compliance score (X/10)
5) **Write Report:** Build full markdown report in memory per `shared/templates/audit_worker_report_template.md`, write to `{output_dir}/ln-631--global.md` in single Write call
6) **Return Summary:** Return minimal summary to coordinator (see Output Format)

## Audit Rules

### 1. Framework Tests Detection

**What:** Tests validating framework behavior (Express, Fastify, Koa) instead of OUR business logic

**Detection Patterns:**
- `(express|fastify|koa).(use|get|post|put|delete|patch)`
- Test names: "middleware is called", "route handler works", "Express app listens"

**Severity:** **MEDIUM**

**Recommendation:** Consider removing IF test only validates framework behavior. If testing integration of custom code with framework -> KEEP

**Effort:** S (delete test file or test block)

### 2. ORM/Database Library Tests

**What:** Tests validating Prisma/Mongoose/Sequelize/TypeORM behavior

**Detection Patterns:**
- `(prisma|mongoose|sequelize|typeorm).(find|findMany|create|update|delete|upsert)`
- Test names: "Prisma findMany returns array", "Mongoose save works"

**Severity:** **MEDIUM**

**Recommendation:** Consider removing IF test only validates ORM behavior. If testing custom query logic or repository patterns -> KEEP

**Effort:** S

### 3. Crypto/Hashing Library Tests

**What:** Tests validating bcrypt/argon2 hashing behavior

**Detection Patterns:**
- `(bcrypt|argon2).(hash|compare|verify|hashSync)`
- Test names: "bcrypt hashes password", "argon2 compares correctly"

**Severity:** **MEDIUM**

**Recommendation:** Consider removing IF test only validates library behavior. If testing custom password policy or hashing wrapper -> KEEP

**Effort:** S

### 4. JWT/Token Library Tests

**What:** Tests validating JWT signing/verification

**Detection Patterns:**
- `(jwt|jsonwebtoken).(sign|verify|decode)`
- Test names: "JWT signs token", "JWT verifies signature"

**Severity:** **MEDIUM**

**Recommendation:** Consider removing IF test only validates JWT library. If testing custom token payload, claims logic, or auth flow -> KEEP

**Effort:** S

### 5. HTTP Client Library Tests

**What:** Tests validating axios/fetch/got behavior

**Detection Patterns:**
- `(axios|fetch|got|request).(get|post|put|delete|patch)`
- Test names: "axios makes GET request", "fetch returns data"

**Severity:** **MEDIUM**

**Recommendation:** Consider removing IF test only validates HTTP client behavior. If testing custom API wrapper, retry logic, or error mapping -> KEEP

**Effort:** S

### 6. React Hooks/Framework Tests

**What:** Tests validating React hooks behavior (useState, useEffect, etc.)

**Detection Patterns:**
- `(useState|useEffect|useContext|useReducer|useMemo|useCallback)`
- Test names: "useState updates state", "useEffect runs on mount"

**Severity:** **LOW** (acceptable if testing OUR custom hook logic)

**Recommendation:** REVIEW -- if testing framework behavior -> DELETE; if testing custom hook -> KEEP

**Effort:** S-M

## Scoring Algorithm

**MANDATORY READ:** Load `shared/references/audit_worker_core_contract.md` and `shared/references/audit_scoring.md`.

## Output Format

**MANDATORY READ:** Load `shared/references/audit_worker_core_contract.md` and `shared/templates/audit_worker_report_template.md`.

Write JSON summary per `shared/references/audit_summary_contract.md`. In managed mode the caller passes both `runId` and `summaryArtifactPath`; in standalone mode the worker generates its own run-scoped artifact path per shared contract.

Write report to `{output_dir}/ln-631--global.md` with `category: "Business Logic Focus"` and checks: framework_tests, orm_tests, crypto_tests, jwt_tests, http_client_tests, react_hooks_tests.

Return summary per `shared/references/audit_summary_contract.md`.

When `summaryArtifactPath` is absent, write the standalone runtime summary under `.hex-skills/runtime-artifacts/runs/{run_id}/audit-worker/{worker}--{identifier}.json` and optionally echo the same summary in structured output.
```
Report written: .hex-skills/runtime-artifacts/runs/{run_id}/audit-report/ln-631--global.md
Score: X.X/10 | Issues: N (C:N H:N M:N L:N)
```

## Critical Rules

**MANDATORY READ:** Load `shared/references/audit_worker_core_contract.md`.

- **Do not auto-fix:** Report only
- **Framework-specific patterns:** Match detection patterns to project's actual tech stack
- **Effort realism:** S = <1h, M = 1-4h, L = >4h
- **Context-aware:** Custom wrappers around libraries (e.g., custom hook using useState) are OUR code -- do not flag
- **Exclude test helpers:** Do not flag shared test utilities that import libraries for mocking setup

## Definition of Done

**MANDATORY READ:** Load `shared/references/audit_worker_core_contract.md`.

- [ ] contextStore parsed successfully (including output_dir)
- [ ] All 6 checks completed (framework, ORM, crypto, JWT, HTTP client, React hooks)
- [ ] Findings collected with severity, location, effort, recommendation
- [ ] Score calculated using penalty algorithm
- [ ] Report written to `{output_dir}/ln-631--global.md` (atomic single Write call)
- [ ] Summary written per contract

## Reference Files

- **Audit output schema:** `shared/references/audit_output_schema.md`

---
**Version:** 3.0.0
**Last Updated:** 2025-12-23

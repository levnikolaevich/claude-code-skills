---
name: ln-632-test-e2e-priority-auditor
description: "Audits E2E coverage for critical user-visible journeys and wasteful E2E tests. Use when reviewing E2E journey value."
allowed-tools: Read, Grep, Glob, Bash
license: MIT
---

> **Paths:** File paths (`references/`, `../ln-*`) are relative to this skill directory.

# E2E Journey Auditor (L3 Worker)

**Type:** L3 Worker

Specialized worker auditing whether E2E tests prove critical user-visible journeys.

## Purpose & Scope

- Audit **E2E Journey Coverage** (Category 2: High Priority)
- Validate E2E coverage for critical paths (Money/Security/Data Priority >=20)
- Validate E2E coverage for core user journeys (Priority 15-19)
- Identify wasteful E2E tests (Usefulness Score <15)
- Emit `ADD_MISSING_E2E`, `DELETE_LOW_VALUE_E2E`, or `DOWNGRADE_E2E`
- Calculate compliance score (X/10)

## Inputs

**MANDATORY READ:** Load `references/audit_worker_core_contract.md`.

Receives `contextStore` with: `tech_stack`, `testFilesMetadata`, `codebase_root`, `output_dir`.

## Workflow

Detection policy: use two-layer detection (candidate scan, then context verification); load `references/two_layer_detection.md` only when the verification method is ambiguous.

1) **Parse Context:** Extract tech stack, critical paths, user journeys, test file list, output_dir from contextStore
2) **Identify Critical Paths (Layer 1):** Scan codebase for critical paths (Money, Security, Data)
2b) **Context Analysis (Layer 2 -- MANDATORY):** For each candidate critical path, ask:
   - Is this a helper function called from an already-E2E-tested path? -> **downgrade to MEDIUM**
   - Is this already covered by integration test with real assertions? -> **downgrade to LOW**
   - Is keyword match a false positive (e.g., `calculateDiscount()` is pure math, already unit-tested)? -> **skip**
3) **Identify Core Journeys:** Identify core user journeys (multi-step flows)
4) **Check Critical Path Coverage:** Check E2E coverage for critical paths (Priority >=20)
5) **Check Journey Coverage:** Check E2E coverage for user journeys (Priority 15-19)
6) **Validate E2E Tests:** Validate existing E2E tests (Usefulness Score >=15)
7) **Collect Findings:** Record each violation with severity, location (file:line), effort estimate (S/M/L), recommendation
8) **Calculate Score:** Count violations by severity, calculate compliance score (X/10)
9) **Write Report:** Build full markdown report in memory per `references/templates/audit_worker_report_template.md`, write to `{output_dir}/ln-632--global.md` in single Write call
10) **Return Summary:** Return minimal summary to coordinator (see Output Format)

## Audit Rules

### 1. Critical Path E2E Coverage

**Rule:** Every critical path MUST have E2E test

**Critical Paths (Priority >=20):**
- **Money** (Priority 25): Payment processing, refunds, discounts, tax calculation
- **Security** (Priority 25): Login, auth, password reset, token refresh, permissions
- **Data Export** (Priority 20): Reports, CSV generation, data migration

**Detection:**
1. Scan codebase for critical keywords: `payment`, `refund`, `login`, `auth`, `export`
2. Extract critical functions/endpoints
3. Check if E2E test exists for each critical path
4. Missing E2E for Priority >=20 -> CRITICAL severity

**Severity:**
- **CRITICAL:** No E2E for Priority 25 (Money, Security)
- **HIGH:** No E2E for Priority 20 (Data Export)
- **Downgrade when:** Function is helper called from already-E2E-tested path -> MEDIUM. Already covered by integration test -> LOW

**Recommendation:** `ADD_MISSING_E2E` for user-visible critical paths that lack end-to-end coverage

**Effort:** M

### 2. Core User Journey E2E Coverage

**Rule:** Multi-step critical flows MUST have E2E test

**Core Journeys (Priority 15-19):**
- Registration -> Email verification -> First login (Priority 16)
- Product search -> Add to cart -> Checkout (Priority 18)
- File upload -> Processing -> Download result (Priority 15)

**Detection:**
1. Identify multi-step flows in routes/controllers
2. Check if end-to-end journey test exists
3. Missing E2E for Priority >=15 -> HIGH severity

**Severity:**
- **HIGH:** Missing E2E for core user journey (Priority >=15)
- **MEDIUM:** Incomplete journey coverage (only partial steps tested)

**Recommendation:** `ADD_MISSING_E2E` for missing critical user journeys

**Effort:** M-L

### 3. E2E Test Usefulness Validation

**Rule:** Every E2E test MUST justify Priority >=15

**Check:**
For each E2E test, calculate Usefulness Score = Impact x Probability
- If Score <15 -> Flag as "Potentially wasteful E2E"
- Recommendation: `DOWNGRADE_E2E` when lower-level tests prove the same behavior with less cost, or `DELETE_LOW_VALUE_E2E` when the journey has no product risk

**Example:**
- E2E test for "API returns 200 OK" -> Impact 2, Probability 1 -> Score 2 -> **WASTEFUL**
- E2E test for "Payment with discount calculates correctly" -> Impact 5, Probability 5 -> Score 25 -> **VALUABLE**

**Severity:**
- **MEDIUM:** E2E test with Usefulness Score <15
- **LOW:** E2E test with Score 10-14 (review needed)

**Recommendation:** `DOWNGRADE_E2E` to integration/unit or `DELETE_LOW_VALUE_E2E`

**Effort:** S

## Scoring Algorithm

**MANDATORY READ:** Load `references/audit_scoring.md`.

**Severity mapping:**
- Missing E2E for Priority 25 (Money, Security) -> CRITICAL
- Missing E2E for Priority 20 (Data Export) -> HIGH
- Missing E2E for Priority 15-19 (Core Journeys) -> HIGH
- Wasteful E2E (Score <15) -> MEDIUM
- Incomplete journey coverage -> LOW

## Output Format

**MANDATORY READ:** Load `references/templates/audit_worker_report_template.md`.

Write JSON summary per `references/audit_summary_contract.md`. In managed mode the caller passes both `runId` and `summaryArtifactPath`; in standalone mode the worker generates its own run-scoped artifact path per shared contract.

Write report to `{output_dir}/ln-632--global.md` with `category: "E2E Journey Coverage"` and checks: critical_path_coverage, user_journey_coverage, e2e_usefulness_validation. Findings must include `action` as `ADD_MISSING_E2E`, `DELETE_LOW_VALUE_E2E`, or `DOWNGRADE_E2E`.

Return summary per `references/audit_summary_contract.md`.

When `summaryArtifactPath` is absent, write the standalone runtime summary under `.hex-skills/runtime-artifacts/runs/{run_id}/evaluation-worker/{worker}--{identifier}.json` and optionally echo the same summary in structured output.
```
Report written: .hex-skills/runtime-artifacts/runs/{run_id}/audit-report/ln-632--global.md
Score: X.X/10 | Issues: N (C:N H:N M:N L:N)
```

## Critical Rules

Apply the already-loaded `references/audit_worker_core_contract.md`.

- **Do not auto-fix:** Report only
- **Unique angle:** Only evaluate end-to-end user-visible journey value. Do not inspect unit-test product behavior, oracle strength, structure, or manual scripts.
- **Risk-based only:** Prioritize by business impact (Money > Security > Data), not by code coverage percentage
- **Effort realism:** S = <1h, M = 1-4h, L = >4h
- **Usefulness Score threshold:** Only flag E2E tests with Score <15 as wasteful
- **No pyramid enforcement:** Do not recommend E2E/Integration/Unit ratios -- focus on critical path coverage

## Definition of Done

Apply the already-loaded `references/audit_worker_core_contract.md`.

- [ ] contextStore parsed successfully (including output_dir)
- [ ] Critical paths identified (Money, Security, Data) with Priority scores
- [ ] All 3 checks completed (critical path coverage, user journey coverage, E2E usefulness validation)
- [ ] Findings collected with severity, location, effort, recommendation, and action
- [ ] Score calculated using penalty algorithm
- [ ] Report written to `{output_dir}/ln-632--global.md` (atomic single Write call)
- [ ] Summary written per contract

## Reference Files

- **Audit output schema:** `references/audit_output_schema.md`

---
**Version:** 3.0.0
**Last Updated:** 2025-12-23

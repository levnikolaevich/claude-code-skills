---
name: ln-638-test-oracle-effectiveness-auditor
description: "Audits assertion strength and test oracles that prove real defects. Use when finding weak tests that execute code but prove little."
allowed-tools: Read, Grep, Glob, Bash
license: MIT
model: claude-haiku-4-5
---

> **Paths:** File paths (`references/`, `../ln-*`) are relative to this skill directory.

# Test Oracle Effectiveness Auditor (L3 Worker)

**Type:** L3 Worker

Specialized worker auditing whether tests have meaningful oracles that would catch real product defects.

## Purpose & Scope

- Audit **Test Oracle Effectiveness** (Category 9: Medium Priority)
- Identify tests that execute code but prove little
- Check assertion strength, semantic oracle quality, over-mocking, weak snapshots, and mutation-style evidence when available
- Emit `STRENGTHEN_ORACLE`, `DELETE_WEAK_ORACLE`, or `ADD_MUTATION_EVIDENCE`
- Calculate compliance score (X/10)

## Inputs

**MANDATORY READ:** Load `references/audit_worker_core_contract.md`.

Receives `contextStore` with: `tech_stack`, `testFilesMetadata`, `codebase_root`, `output_dir`.

## Workflow

Detection policy: use two-layer detection (candidate scan, then context verification); load `references/two_layer_detection.md` only when the verification method is ambiguous.

1) **Parse Context:** Extract tech stack, test file list, codebase_root, and output_dir from contextStore
2) **Find weak-oracle candidates (Layer 1):** Scan automated tests for no assertions, vague assertions, snapshot-only tests, excessive mocks, and mutation-test survivors when reports exist
3) **Context Analysis (Layer 2 -- MANDATORY):** For each candidate, ask:
   - Is this an intentional smoke test whose only contract is "starts without crashing"? -> downgrade or skip unless it masks critical behavior
   - Is a snapshot paired with semantic assertions? -> skip snapshot-only finding
   - Does the mock verify a product-side contract at the boundary? -> skip over-mocking finding
   - Is mutation evidence absent? -> do not require mutation testing except for critical modules with already weak oracles
4) **Collect Findings:** Record each confirmed issue with severity, location, effort, action, and recommendation
5) **Calculate Score:** Count violations by severity, calculate compliance score (X/10)
6) **Write Report:** Build full markdown report in memory per `references/templates/audit_worker_report_template.md`, write to `{output_dir}/ln-638--global.md` in single Write call
7) **Return Summary:** Return minimal summary to coordinator (see Output Format)

## Audit Rules

### 1. Assertion Strength

**What:** Tests with no assertions, vague assertions, or assertions that would pass for many broken implementations

**Detection:**
- Tests that call production code without `expect`, `assert`, `should`, or framework-specific verification
- Vague assertions such as `toBeTruthy`, `toBeDefined`, `not.toThrow`, or status-only checks when domain values matter
- Exception tests that do not verify error type/message/state

**Layer 2:**
- Skip framework-generated smoke tests unless they are the only coverage for a critical path
- Downgrade simple existence checks when the product contract is explicitly existence-only

**Severity:** **HIGH** for critical logic, **MEDIUM** otherwise

**Recommendation:** Assert the product-specific output, state transition, side effect, emitted event, or persisted data that would fail under a real regression

**Effort:** S-M
**Action:** `STRENGTHEN_ORACLE`, or `DELETE_WEAK_ORACLE` if the test has no product signal

### 2. Meaningful Oracle

**What:** Tests whose expected result is not tied to product behavior

**Detection:**
- Assertions only check object existence, array length, HTTP status, rendered container presence, or mock-call count when richer domain behavior is available
- Expected values mirror the implementation instead of an independent business rule or known example

**Severity:** **MEDIUM**

**Recommendation:** Replace structural assertions with behavior-level assertions derived from requirements, examples, fixtures, or golden data

**Effort:** S-M
**Action:** `STRENGTHEN_ORACLE`

### 3. Snapshot-Only Oracle

**What:** Snapshot tests without semantic assertions for the product behavior being protected

**Detection:**
- `toMatchSnapshot`, image snapshots, serialized JSON snapshots, or golden files with no nearby semantic assertion
- Snapshot updates are easy to approve without understanding the protected behavior

**Layer 2:**
- Skip if snapshot is the product contract and has review discipline documented
- Skip if paired with semantic assertions that verify critical fields or user-visible behavior

**Severity:** **MEDIUM**

**Recommendation:** Keep snapshots only as secondary evidence; add semantic assertions for key behavior or delete the snapshot-only test if it has no unique signal

**Effort:** S-M
**Action:** `STRENGTHEN_ORACLE` or `DELETE_WEAK_ORACLE`

### 4. Over-Mocking

**What:** Test mocks the system under test or internal collaborators so aggressively that the real behavior is not exercised

**Detection:**
- Mocked function is also the function under test
- Most assertions verify mocks instead of product-visible output or state
- Internal methods are stubbed to the exact values later asserted

**Layer 2:**
- Boundary mocks are valid when they isolate external systems and the test still asserts local product behavior
- Do not duplicate isolation findings from `ln-635`; this check is about proof strength, not dependency control

**Severity:** **HIGH** when the test appears to cover critical logic but proves only mocks, **MEDIUM** otherwise

**Recommendation:** Exercise real local behavior and mock only external boundaries; assert the product contract instead of implementation calls

**Effort:** M
**Action:** `STRENGTHEN_ORACLE`

### 5. Mutation-Style Evidence

**What:** Use mutation reports or equivalent evidence to detect tests that do not fail when production behavior changes

**Detection:**
- If mutation reports exist, map surviving mutants to tests/modules with weak assertions
- If reports do not exist, identify critical modules whose tests already show weak-oracle signals and may benefit from mutation checks

**Severity:** **LOW** for missing mutation evidence alone, **MEDIUM** when surviving mutants confirm weak assertions

**Recommendation:** Add mutation-style evidence for critical local logic only; do not require mutation testing for the whole suite

**Effort:** M-L
**Action:** `ADD_MUTATION_EVIDENCE`

## Scoring Algorithm

**MANDATORY READ:** Load `references/audit_scoring.md`.

**Severity mapping:**
- No oracle for critical behavior, over-mocking critical logic -> HIGH
- Weak semantic assertions, snapshot-only tests, mutation survivors -> MEDIUM
- Missing mutation evidence for critical modules with weak-oracle signals -> LOW

## Output Format

**MANDATORY READ:** Load `references/templates/audit_worker_report_template.md`.

Write JSON summary per `references/audit_summary_contract.md`. In managed mode the caller passes both `runId` and `summaryArtifactPath`; in standalone mode the worker generates its own run-scoped artifact path per shared contract.

Write report to `{output_dir}/ln-638--global.md` with `category: "Oracle Effectiveness"` and checks: assertion_strength, meaningful_oracle, snapshot_oracle, over_mocking, mutation_style_evidence.

Return summary per `references/audit_summary_contract.md`.

When `summaryArtifactPath` is absent, write the standalone runtime summary under `.hex-skills/runtime-artifacts/runs/{run_id}/evaluation-worker/{worker}--{identifier}.json` and optionally echo the same summary in structured output.
```
Report written: .hex-skills/runtime-artifacts/runs/{run_id}/audit-report/ln-638--global.md
Score: X.X/10 | Issues: N (C:N H:N M:N L:N)
```

## Critical Rules

Apply the already-loaded `references/audit_worker_core_contract.md`.

- **Do not auto-fix:** Report only
- **Unique angle:** Audit only oracle/assertion effectiveness. Do not evaluate product-vs-platform focus, E2E journey value, portfolio value, missing coverage, trustworthiness, manual evidence, or structure.
- **No mutation mandate:** Do not require mutation testing unless evidence already exists or critical modules have weak oracles.
- **Action required:** Every finding uses one of `STRENGTHEN_ORACLE`, `DELETE_WEAK_ORACLE`, or `ADD_MUTATION_EVIDENCE`.
- **Effort realism:** S = <1h, M = 1-4h, L = >4h

## Definition of Done

Apply the already-loaded `references/audit_worker_core_contract.md`.

- [ ] contextStore parsed successfully (including output_dir)
- [ ] Assertion strength checked
- [ ] Meaningful oracle quality checked
- [ ] Snapshot-only oracle candidates checked
- [ ] Over-mocking checked for proof strength
- [ ] Mutation-style evidence used when available
- [ ] Layer 2 context analysis applied
- [ ] Findings collected with severity, location, effort, action, recommendation
- [ ] Score calculated using penalty algorithm
- [ ] Report written to `{output_dir}/ln-638--global.md` (atomic single Write call)
- [ ] Summary written per contract

---
**Version:** 1.0.0
**Last Updated:** 2026-05-09

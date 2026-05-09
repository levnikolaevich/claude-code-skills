---
name: ln-633-test-value-auditor
description: "Scores each test by portfolio value and returns KEEP/DELETE/MERGE/REWRITE. Use when pruning test-suite cost."
allowed-tools: Read, Grep, Glob, Bash
license: MIT
---

> **Paths:** File paths (`references/`, `../ln-*`) are relative to this skill directory.

# Portfolio Value Auditor (L3 Worker)

**Type:** L3 Worker

Specialized worker calculating portfolio value and maintenance cost for each test.

## Purpose & Scope

- Audit **Portfolio Value** (Category 3: Critical Priority)
- Calculate Value Score = Impact x Probability, then adjust by uniqueness, regression history, and maintenance cost
- Make canonical `KEEP`, `DELETE`, `MERGE`, or `REWRITE` decisions
- Calculate compliance score (X/10)

## Inputs

**MANDATORY READ:** Load `references/audit_worker_core_contract.md`.

Receives `contextStore` with: `tech_stack`, `testFilesMetadata`, `codebase_root`, `output_dir`.

## Workflow

Detection policy: use two-layer detection (candidate scan, then context verification); load `references/two_layer_detection.md` only when the verification method is ambiguous.

1) **Parse Context:** Extract tech stack, Impact/Probability matrices, test file list, output_dir from contextStore
2) **Calculate Scores (Layer 1):** For each test: calculate Value Score = Impact x Probability, then annotate duplicate coverage, known regression guard, and maintenance cost
2b) **Context Analysis (Layer 2 -- MANDATORY):** Before finalizing `DELETE` or `MERGE` decisions, ask:
   - Is this a regression guard for a known past bug? -> **KEEP** regardless of Score
   - Does this test cover a critical business rule (payment, auth) even if Score<10? -> **REWRITE**, not DELETE, if assertions are weak
   - Is this the only test covering an edge case in a critical flow? -> **KEEP**
   - Does another test prove the same behavior with clearer assertions or lower cost? -> **MERGE**
3) **Classify Decisions:** KEEP, DELETE, MERGE, or REWRITE
4) **Collect Findings:** Record each REVIEW/REMOVE decision with severity, location (file:line), effort estimate (S/M/L), recommendation
5) **Calculate Score:** Count violations by severity, calculate compliance score (X/10)
6) **Write Report:** Build full markdown report in memory per `references/templates/audit_worker_report_template.md`, write to `{output_dir}/ln-633--global.md` in single Write call
7) **Return Summary:** Return minimal summary to coordinator (see Output Format)

## Usefulness Score Calculation

### Formula

```
Usefulness Score = Business Impact (1-5) x Failure Probability (1-5)
```

### Impact Scoring (1-5)

| Score | Impact | Examples |
|-------|--------|----------|
| **5** | **Critical** | Money loss, security breach, data corruption |
| **4** | **High** | Core flow breaks (checkout, login, registration) |
| **3** | **Medium** | Feature partially broken, degraded UX |
| **2** | **Low** | Minor UX issue, cosmetic bug |
| **1** | **Trivial** | Cosmetic issue, no user impact |

### Probability Scoring (1-5)

| Score | Probability | Indicators |
|-------|-------------|------------|
| **5** | **Very High** | Complex algorithm, new technology, many dependencies |
| **4** | **High** | Multiple dependencies, concurrency, edge cases |
| **3** | **Medium** | Standard CRUD, framework defaults, established patterns |
| **2** | **Low** | Simple logic, well-established library, trivial operation |
| **1** | **Very Low** | Trivial assignment, framework-generated, impossible to break |

### Decision Thresholds

| Score Range | Decision | Action |
|-------------|----------|--------|
| **>=15** | **KEEP** | Test is valuable, maintain it |
| **10-14** | **REWRITE** | Keep only if assertions can prove unique product risk |
| **<10** | **DELETE** | Delete test, not worth maintenance cost. **Exception:** regression guards for known bugs -> KEEP |

## Scoring Examples

### Example 1: Payment Processing Test

```
Test: "processPayment calculates discount correctly"
Impact: 5 (Critical -- money calculation)
Probability: 4 (High -- complex algorithm, multiple payment gateways)
Usefulness Score = 5 x 4 = 20
Decision: KEEP
```

### Example 2: Email Validation Test

```
Test: "validateEmail returns true for valid email"
Impact: 2 (Low -- minor UX issue if broken)
Probability: 2 (Low -- simple regex, well-tested library)
Usefulness Score = 2 x 2 = 4
Decision: DELETE (likely already covered by E2E registration test)
```

### Example 3: Login Flow Test

```
Test: "login with valid credentials returns JWT"
Impact: 4 (High -- core flow)
Probability: 3 (Medium -- standard auth flow)
Usefulness Score = 4 x 3 = 12
Decision: REWRITE (if E2E covers the flow, merge/delete duplicate assertions; otherwise focus assertions on auth behavior)
```

## Audit Rules

### 1. Calculate Score for Each Test

**Process:**
- Read test file, extract test name/description
- Analyze code under test (CUT)
- Determine Impact (1-5)
- Determine Probability (1-5)
- Calculate Usefulness Score

### 2. Classify Decisions

**KEEP:**
- High-value tests (money, security, data integrity)
- Core flows (checkout, login)
- Complex algorithms

**MERGE:**
- Duplicated tests proving the same behavior
- Fragmented assertions that should be one scenario
- Repeated setup with only cosmetic assertion differences

**REWRITE:**
- Medium-value tests with weak assertions
- Tests that need clearer product-risk oracle

**DELETE:**
- Low-value tests (cosmetic, trivial)
- Duplicates of E2E tests

### 3. Identify Patterns

**Common low-value tests:**
- Testing trivial getters/setters
- Testing constant values
- Testing type annotations
- Duplicate setup/assertion variants
- Tests whose maintenance cost exceeds confidence value

## Scoring Algorithm

**MANDATORY READ:** Load `references/audit_scoring.md`.

**Severity mapping by Value Score:**
- Score <5 -> CRITICAL (test wastes significant maintenance effort)
- Score 5-9 -> HIGH (test likely wasteful)
- Score 10-14 -> MEDIUM (review needed)
- Score >=15 -> no issue (KEEP)

## Output Format

**MANDATORY READ:** Load `references/templates/audit_worker_report_template.md`.

Write JSON summary per `references/audit_summary_contract.md`. In managed mode the caller passes both `runId` and `summaryArtifactPath`; in standalone mode the worker generates its own run-scoped artifact path per shared contract.

Write report to `{output_dir}/ln-633--global.md` with `category: "Portfolio Value"` and checks: value_score, delete_candidates, merge_candidates, rewrite_candidates. Findings must include canonical `action` as `KEEP`, `DELETE`, `MERGE`, or `REWRITE`.

Return summary per `references/audit_summary_contract.md`.

When `summaryArtifactPath` is absent, write the standalone runtime summary under `.hex-skills/runtime-artifacts/runs/{run_id}/evaluation-worker/{worker}--{identifier}.json` and optionally echo the same summary in structured output.
```
Report written: .hex-skills/runtime-artifacts/runs/{run_id}/audit-report/ln-633--global.md
Score: X.X/10 | Issues: N (C:N H:N M:N L:N)
```

**Note:** Tests with `KEEP` decisions are summarized as retained evidence, not findings. Findings contain only `DELETE`, `MERGE`, and `REWRITE` decisions.

## Critical Rules

Apply the already-loaded `references/audit_worker_core_contract.md`.

- **Do not auto-fix:** Report only
- **Unique angle:** Own the final portfolio-value decision. Do not duplicate platform-behavior detection, critical coverage discovery, isolation, oracle-strength, or structure checks.
- **Effort realism:** S = <1h, M = 1-4h, L = >4h
- **Score objectivity:** Base Impact and Probability on code analysis, not assumptions
- **KEEP tests not reported:** Only DELETE, MERGE, and REWRITE decisions appear in findings
- **Cross-reference E2E:** REVIEW decisions depend on whether E2E already covers the scenario

## Definition of Done

Apply the already-loaded `references/audit_worker_core_contract.md`.

- [ ] contextStore parsed successfully (including output_dir)
- [ ] Value Score calculated for each test (Impact x Probability plus uniqueness, regression, and maintenance context)
- [ ] Decisions classified: KEEP, DELETE, MERGE, REWRITE
- [ ] Findings collected with severity, location, effort, recommendation, and action
- [ ] Score calculated using penalty algorithm
- [ ] Report written to `{output_dir}/ln-633--global.md` (atomic single Write call)
- [ ] Summary written per contract

## Reference Files

- **Audit output schema:** `references/audit_output_schema.md`

---
**Version:** 3.0.0
**Last Updated:** 2025-12-23

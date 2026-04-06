---
name: ln-633-test-value-auditor
description: "Scores each test by Impact x Probability, returns KEEP/REVIEW/REMOVE decisions. Use when auditing test value and pruning low-value tests."
allowed-tools: Read, Grep, Glob, Bash
license: MIT
---

> **Paths:** File paths (`shared/`, `references/`, `../ln-*`) are relative to skills repo root. If not found at CWD, locate this SKILL.md directory and go up one level for repo root. If `shared/` is missing, fetch files via WebFetch from `https://raw.githubusercontent.com/levnikolaevich/claude-code-skills/master/skills/{path}`.

# Risk-Based Value Auditor (L3 Worker)

**Type:** L3 Worker

Specialized worker calculating Usefulness Score for each test.

## Purpose & Scope

- Audit **Risk-Based Value** (Category 3: Critical Priority)
- Calculate Usefulness Score = Impact x Probability
- Make KEEP/REVIEW/REMOVE decisions
- Calculate compliance score (X/10)

## Inputs

**MANDATORY READ:** Load `shared/references/audit_worker_core_contract.md`.

Receives `contextStore` with: `tech_stack`, `testFilesMetadata`, `codebase_root`, `output_dir`.

## Workflow

**MANDATORY READ:** Load `shared/references/two_layer_detection.md` for detection methodology.

1) **Parse Context:** Extract tech stack, Impact/Probability matrices, test file list, output_dir from contextStore
2) **Calculate Scores (Layer 1):** For each test: calculate Usefulness Score = Impact x Probability
2b) **Context Analysis (Layer 2 -- MANDATORY):** Before finalizing REMOVE decisions, ask:
   - Is this a regression guard for a known past bug? -> **KEEP** regardless of Score
   - Does this test cover a critical business rule (payment, auth) even if Score<10? -> **REVIEW**, not REMOVE
   - Is this the only test covering an edge case in a critical flow? -> **KEEP**
3) **Classify Decisions:** KEEP (>=15), REVIEW (10-14), REMOVE (<10)
4) **Collect Findings:** Record each REVIEW/REMOVE decision with severity, location (file:line), effort estimate (S/M/L), recommendation
5) **Calculate Score:** Count violations by severity, calculate compliance score (X/10)
6) **Write Report:** Build full markdown report in memory per `shared/templates/audit_worker_report_template.md`, write to `{output_dir}/ln-633--global.md` in single Write call
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
| **10-14** | **REVIEW** | Consider if E2E already covers this |
| **<10** | **REMOVE** | Delete test, not worth maintenance cost. **Exception:** regression guards for known bugs -> KEEP. Tests covering critical business rules (payment, auth) -> REVIEW |

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
Decision: REMOVE (likely already covered by E2E registration test)
```

### Example 3: Login Flow Test

```
Test: "login with valid credentials returns JWT"
Impact: 4 (High -- core flow)
Probability: 3 (Medium -- standard auth flow)
Usefulness Score = 4 x 3 = 12
Decision: REVIEW (if E2E covers, remove; else keep)
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

**KEEP (>=15):**
- High-value tests (money, security, data integrity)
- Core flows (checkout, login)
- Complex algorithms

**REVIEW (10-14):**
- Medium-value tests
- Question: "Is this already covered by E2E?"
- If yes -> REMOVE; if no -> KEEP

**REMOVE (<10):**
- Low-value tests (cosmetic, trivial)
- Framework/library tests
- Duplicates of E2E tests

### 3. Identify Patterns

**Common low-value tests (<10):**
- Testing framework behavior
- Testing trivial getters/setters
- Testing constant values
- Testing type annotations

## Scoring Algorithm

**MANDATORY READ:** Load `shared/references/audit_worker_core_contract.md` and `shared/references/audit_scoring.md`.

**Severity mapping by Usefulness Score:**
- Score <5 -> CRITICAL (test wastes significant maintenance effort)
- Score 5-9 -> HIGH (test likely wasteful)
- Score 10-14 -> MEDIUM (review needed)
- Score >=15 -> no issue (KEEP)

## Output Format

**MANDATORY READ:** Load `shared/references/audit_worker_core_contract.md` and `shared/templates/audit_worker_report_template.md`.

Write JSON summary per `shared/references/audit_summary_contract.md`. In managed mode the caller passes both `runId` and `summaryArtifactPath`; in standalone mode the worker generates its own run-scoped artifact path per shared contract.

Write report to `{output_dir}/ln-633--global.md` with `category: "Risk-Based Value"` and checks: usefulness_score, remove_candidates, review_candidates.

Return summary per `shared/references/audit_summary_contract.md`.

When `summaryArtifactPath` is absent, write the standalone runtime summary under `.hex-skills/runtime-artifacts/runs/{run_id}/audit-worker/{worker}--{identifier}.json` and optionally echo the same summary in structured output.
```
Report written: .hex-skills/runtime-artifacts/runs/{run_id}/audit-report/ln-633--global.md
Score: X.X/10 | Issues: N (C:N H:N M:N L:N)
```

**Note:** Tests with Usefulness Score >=15 (KEEP) are NOT included in findings -- only issues are reported.

## Critical Rules

**MANDATORY READ:** Load `shared/references/audit_worker_core_contract.md`.

- **Do not auto-fix:** Report only
- **Effort realism:** S = <1h, M = 1-4h, L = >4h
- **Score objectivity:** Base Impact and Probability on code analysis, not assumptions
- **KEEP tests not reported:** Only REVIEW and REMOVE decisions appear in findings
- **Cross-reference E2E:** REVIEW decisions depend on whether E2E already covers the scenario

## Definition of Done

**MANDATORY READ:** Load `shared/references/audit_worker_core_contract.md`.

- [ ] contextStore parsed successfully (including output_dir)
- [ ] Usefulness Score calculated for each test (Impact x Probability)
- [ ] Decisions classified: KEEP (>=15), REVIEW (10-14), REMOVE (<10)
- [ ] Findings collected with severity, location, effort, recommendation
- [ ] Score calculated using penalty algorithm
- [ ] Report written to `{output_dir}/ln-633--global.md` (atomic single Write call)
- [ ] Summary written per contract

## Reference Files

- **Audit output schema:** `shared/references/audit_output_schema.md`

---
**Version:** 3.0.0
**Last Updated:** 2025-12-23

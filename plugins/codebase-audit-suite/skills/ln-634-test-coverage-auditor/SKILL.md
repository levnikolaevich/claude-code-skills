---
name: ln-634-test-coverage-auditor
description: "Identifies missing tests for unique critical local logic: money, auth, permissions, data integrity, algorithms, and domain rules. Use when auditing critical logic coverage gaps."
allowed-tools: Read, Grep, Glob, Bash, mcp__hex-graph__audit_workspace, mcp__hex-line__read_file, mcp__hex-line__grep_search, mcp__hex-line__outline
license: MIT
model: claude-haiku-4-5
---

> **Paths:** File paths (`references/`, `../ln-*`) are relative to this skill directory.

# Critical Logic Coverage Auditor (L3 Worker)

**Type:** L3 Worker

Specialized worker identifying missing tests for unique critical local logic.

## Purpose & Scope

- Audit **Critical Logic Coverage** (Category 4: High Priority)
- Identify untested unique local logic only
- Classify by category (Money, Auth/Permissions, Data Integrity, Algorithms, Domain Rules)
- Emit `ADD_MISSING` findings for missing high-value tests
- Do not recommend tests just to increase coverage percentage
- Calculate compliance score (X/10)

## Inputs

**MANDATORY READ:** Load `references/audit_worker_core_contract.md`.
Tool policy: follow host AGENTS.md MCP preferences; load `references/mcp_tool_preferences.md` and `references/mcp_integration_patterns.md` only when host policy is absent or MCP behavior is unclear.

Receives `contextStore` with: `tech_stack`, `testFilesMetadata`, `codebase_root`, `output_dir`.

**Domain-aware:** Supports `domain_mode` + `current_domain` (see `audit_output_schema.md#domain-aware-worker-output`).

Use `hex-graph` first when hotspots materially improve coverage-gap discovery. Use `hex-line` first for local code and test reads when available. If MCP is unavailable, unsupported, or not indexed, continue with built-in `Read/Grep/Glob/Bash` and state the fallback in the report.

## Workflow

Detection policy: use two-layer detection (candidate scan, then context verification); load `references/two_layer_detection.md` only when the verification method is ambiguous.

1) **Parse context** -- extract fields, determine `scan_path` (domain-aware if specified)
     ELSE:
       scan_path = codebase_root
       domain_name = null
     ```

2) **Identify critical local logic in scan_path** (not entire codebase)
   - Scan production code in `scan_path` for money/auth/permission/data/algorithm/domain-rule keywords
   - All Grep/Glob patterns use `scan_path` (not codebase_root)
   - Example: `Grep(pattern="payment|refund|discount", path=scan_path)`

3) **Check test coverage for each critical path (Layer 1)**
   - Search ALL test files for coverage (tests may be in different location than production code)
   - Match by function name, module name, or test description
3b) **Context Analysis (Layer 2 -- MANDATORY):** For each gap candidate, ask:
   - Is this function already covered by E2E/integration test? -> **downgrade to LOW**
   - Is this a helper function with <10 lines called from tested code? -> **skip**
   - Is keyword match a false positive (e.g., `paymentIcon()` is UI, not payment logic)? -> **skip**

4) **Collect missing tests**
   - Tag each finding with `domain: domain_name` (if domain-aware)
   - Set `action: "ADD_MISSING"` for every confirmed finding

5) **Calculate Score:** Count violations by severity, calculate compliance score (X/10)

6) **Write Report:** Build full markdown report in memory per `references/templates/audit_worker_report_template.md`, write to `{output_dir}/ln-634--{identifier}.md` (or `{output_dir}/ln-634--{identifier}.md` if domain-aware) in single Write call

7) **Return Summary:** Return minimal summary to coordinator (see Output Format)

## Critical Local Logic Classification

### 1. Money Flows (Priority 20+)

**What:** Any code handling financial transactions

**Examples:**
- Payment processing (`/payment`, `processPayment()`)
- Discounts/promotions (`calculateDiscount()`, `applyPromoCode()`)
- Tax calculations (`calculateTax()`, `getTaxRate()`)
- Refunds (`processRefund()`, `/refund`)
- Invoices/billing (`generateInvoice()`, `createBill()`)
- Currency conversion (`convertCurrency()`)

**Min Priority:** 20

**Why Critical:** Money loss, fraud, legal compliance

### 2. Auth & Permissions (Priority 20+)

**What:** Local authentication, authorization, permission, and security decisions

**Examples:**
- Login/logout (`/login`, `authenticate()`)
- Token refresh (`/refresh-token`, `refreshAccessToken()`)
- Password reset (`/forgot-password`, `resetPassword()`)
- Permissions/RBAC (`checkPermission()`, `hasRole()`)
- Encryption/hashing (custom crypto orchestration or policy, NOT library behavior such as bcrypt/argon2)
- API key validation (`validateApiKey()`)

**Min Priority:** 20

**Why Critical:** Security breach, data leak, unauthorized access

### 3. Data Integrity (Priority 15+)

**What:** CRUD operations, transactions, validation

**Examples:**
- Critical CRUD (`createUser()`, `deleteOrder()`, `updateProduct()`)
- Database transactions (`withTransaction()`)
- Data validation (custom validators, NOT framework defaults)
- Data migrations (`runMigration()`)
- Unique constraints (`checkDuplicateEmail()`)

**Min Priority:** 15

**Why Critical:** Data corruption, lost data, inconsistent state

### 4. Algorithms & Domain Rules (Priority 15+)

**What:** Local calculations, branching rules, state transitions, and algorithms that encode project-specific behavior

**Examples:**
- Ranking/scoring algorithms
- Eligibility rules
- Domain state transitions
- Custom validation rules beyond framework defaults
- Import/export transformations

**Min Priority:** 15

**Why Critical:** Wrong product behavior, bad decisions, corrupted business state

## Audit Rules

### 1. Identify Critical Local Logic

**Process:**
- Scan codebase for money-related keywords: `payment`, `refund`, `discount`, `tax`, `price`, `currency`
- Scan for auth/permission keywords: `auth`, `login`, `password`, `token`, `permission`, `role`, `policy`
- Scan for data keywords: `transaction`, `validation`, `migration`, `constraint`
- Scan for algorithms/domain rules: `score`, `rank`, `eligibility`, `state`, `workflow`, `rule`
- Exclude framework defaults, generated behavior, and library primitives; `ln-631` owns product-vs-platform test focus for existing tests

### 2. Check Test Coverage

**For each critical path:**
- Search test files for matching test name/description
- If NO test found -> add to missing tests list
- If test found but inadequate (only positive, no edge cases) -> add to gaps list

### 3. Categorize Gaps

**Severity by Priority:**
- **CRITICAL:** Priority 20+ (Money, Security)
- **HIGH:** Priority 15-19 (Data, Core Flows)
- **MEDIUM:** Priority 10-14 (Important but not critical)
- **Downgrade when:** Function already covered by E2E test -> LOW. Helper with <10 lines called from tested code -> skip

### 4. Provide Justification

**For each missing test:**
- Explain WHY it's critical (money loss, security breach, etc.)
- Suggest test type (E2E, Integration, Unit)
- Set action to `ADD_MISSING`
- Estimate effort (S/M/L)

## Scoring Algorithm

**MANDATORY READ:** Load `references/audit_scoring.md`.

**Severity mapping by Priority:**
- Priority 20+ (Money, Security) missing test -> CRITICAL
- Priority 15-19 (Data Integrity, Core Flows) missing test -> HIGH
- Priority 10-14 (Important) missing test -> MEDIUM
- Priority <10 (Nice-to-have) -> LOW

## Output Format

**MANDATORY READ:** Load `references/templates/audit_worker_report_template.md`.

Write JSON summary per `references/audit_summary_contract.md`. In managed mode the caller passes both `runId` and `summaryArtifactPath`; in standalone mode the worker generates its own run-scoped artifact path per shared contract.

Write report to `{output_dir}/ln-634--{identifier}.md` (global) or `{output_dir}/ln-634--{identifier}.md` (domain-aware) with `category: "Critical Logic Coverage"` and checks: money_logic_coverage, auth_permission_coverage, data_integrity_coverage, algorithm_domain_rule_coverage.

Return summary per `references/audit_summary_contract.md`.

When `summaryArtifactPath` is absent, write the standalone runtime summary under `.hex-skills/runtime-artifacts/runs/{run_id}/evaluation-worker/{worker}--{identifier}.json` and optionally echo the same summary in structured output.
```
Report written: .hex-skills/runtime-artifacts/runs/{run_id}/audit-report/ln-634--{identifier}.md
Score: X.X/10 | Issues: N (C:N H:N M:N L:N)
```

## Critical Rules

Apply the already-loaded `references/audit_worker_core_contract.md`.

- **Domain-aware scanning:** If `domain_mode="domain-aware"`, scan ONLY `scan_path` production code (not entire codebase)
- **Tag findings:** Include `domain` field in each finding when domain-aware
- **Test search scope:** Search ALL test files for coverage (tests may be in different location than production code)
- **Match by name:** Use function name, module name, or test description to match tests to production code
- **Do not auto-fix:** Report only
- **Unique angle:** Only find missing tests for unique local critical logic. Do not evaluate existing low-value tests, E2E journey priority, trustworthiness, oracle strength, manual evidence, or structure.
- **No coverage-percent work:** Do not recommend tests merely to improve line/branch coverage metrics.
- **Action required:** Every finding uses `action: "ADD_MISSING"`.

## Definition of Done

Apply the already-loaded `references/audit_worker_core_contract.md`.

- [ ] contextStore parsed successfully (including output_dir, domain_mode, current_domain)
- [ ] scan_path determined (domain path or codebase root)
- [ ] Critical local logic identified in scan_path (Money, Auth/Permissions, Data Integrity, Algorithms, Domain Rules)
- [ ] Test coverage checked for each critical local logic path
- [ ] Missing tests collected with severity, priority, justification, domain, and `ADD_MISSING` action
- [ ] Score calculated using penalty algorithm
- [ ] Report written to `{output_dir}/ln-634--{identifier}.md` or `ln-634--{identifier}.md` (atomic single Write call)
- [ ] Summary written per contract

## Reference Files

- **Audit output schema:** `references/audit_output_schema.md`

---
**Version:** 3.0.0
**Last Updated:** 2025-12-23

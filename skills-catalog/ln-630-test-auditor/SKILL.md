---
name: ln-630-test-auditor
description: "Coordinates test suite audit across business logic, E2E coverage, value, isolation, manual quality, and structure. Use when auditing entire test suite."
allowed-tools: Read, Grep, Glob, Bash, mcp__Ref, mcp__context7, Skill, mcp__hex-graph__index_project
license: MIT
---

> **Paths:** File paths (`shared/`, `references/`, `../ln-*`) are relative to skills repo root. If not found at CWD, locate this SKILL.md directory and go up one level for repo root. If `shared/` is missing, fetch files via WebFetch from `https://raw.githubusercontent.com/levnikolaevich/claude-code-skills/master/skills/{path}`.

# Test Suite Auditor (L2 Coordinator)

**Type:** L2 Coordinator

Coordinates comprehensive test suite audit across 8 quality categories using 7 specialized workers. Discovers both automated tests (`*.test.*`, `*.spec.*`) and manual tests (`tests/manual/**/*.sh`).

## Purpose & Scope

- **L2 Coordinator** that delegates to L3 specialized audit workers
- Audits all tests against 8 quality categories (via 7 workers)
- Calculates **Usefulness Score** for each test (Keep/Remove/Refactor)
- Identifies missing tests for critical business logic
- Detects anti-patterns and isolation issues
- Aggregates results into unified report
- Write report to `docs/project/test_audit.md` (file-based, no task creation)
- Manual invocation by user; not part of Story pipeline

**MANDATORY READ:** Load `shared/references/audit_runtime_contract.md`, `shared/references/audit_summary_contract.md`, `shared/references/audit_coordinator_aggregation.md`, and `shared/references/audit_coordinator_domain_mode.md`.

## Runtime Contract

Use `shared/scripts/audit-runtime/cli.mjs` as orchestration SSOT.

Runtime phase map:
1. `PHASE_0_CONFIG`
2. `PHASE_1_DISCOVERY`
3. `PHASE_2_RESEARCH`
4. `PHASE_3_DOMAIN_DISCOVERY`
5. `PHASE_4_DELEGATE`
6. `PHASE_5_AGGREGATE`
7. `PHASE_6_WRITE_REPORT`
8. `PHASE_7_RESULTS_LOG`
9. `PHASE_8_CLEANUP`
10. `PHASE_9_SELF_CHECK`
11. `DONE`
12. `PAUSED`

Run-scoped worker artifacts:
- reports: `.hex-skills/runtime-artifacts/runs/{run_id}/audit-report/`
- summaries: `.hex-skills/runtime-artifacts/runs/{run_id}/audit-worker/`
- public report: `docs/project/test_audit.md`
- public trend log: `docs/project/.audit/results_log.md`

## Worker Invocation (MANDATORY)

| Phase | Worker | Context | Condition |
|-------|--------|---------|-----------|
| 4 | ln-631, ln-632, ln-633, ln-635, ln-636, ln-637 | Agent -> shared contextStore + filtered `testFilesMetadata` + `summaryArtifactPath` | always |
| 4 | ln-634 | Agent -> per-domain context + `summaryArtifactPath` | `domain_mode="domain-aware"` |
| 4 | ln-634 | Agent -> shared contextStore + `summaryArtifactPath` | `domain_mode="global"` |

**TodoWrite format (mandatory):**
```
- Resolve runtime config and phase order (pending)
- Discover test inventory and graph availability (pending)
- Research test best practices (pending)
- Detect domains and prepare runtime artifact dirs (pending)
- Invoke global test workers with summaryArtifactPath (pending)
- Invoke coverage worker with summaryArtifactPath [conditional] (pending)
- Aggregate JSON worker summaries and report evidence (pending)
- Write consolidated report (pending)
- Append results log (pending)
- Cleanup runtime artifacts (pending)
- Run self-check and complete runtime (pending)
```

## Core Philosophy

> "Write tests. Not too many. Mostly integration." -- Kent Beck
> "Test based on risk, not coverage." -- ISO 29119

**Key Principles:**
1. **Test business logic, not frameworks** -- bcrypt/Prisma/Express already tested
2. **No performance/load/stress tests** -- Tests infrastructure, not code correctness (use k6/JMeter separately)
3. **Risk-based prioritization** -- Priority >=15 or remove
4. **E2E for critical paths only** -- Money/Security/Data (Priority >=20)
5. **Usefulness over quantity** -- One useful test > 10 useless tests
6. **Every test must justify existence** -- Impact x Probability >=15

## Workflow

### Phase 1: Discovery (Automated)

**Inputs:** Codebase root directory

**Actions:**
1. Find all test files using Glob:
   - `**/*.test.*` (Jest, Vitest)
   - `**/*.spec.*` (Mocha, Jasmine)
   - `**/__tests__/**/*` (Jest convention)
   - `tests/manual/**/*.sh` (manual bash test scripts)
2. Parse test file structure (test names, assertions count)
3. Tag each file with `type: "automated"|"manual"`
4. For manual tests: detect `has_expected_dir` (sibling `expected/` exists), `suite_dir`, `harness_sourced` (sources test_harness.sh)
5. Auto-discover Team ID from [docs/tasks/kanban_board.md](../../docs/tasks/kanban_board.md)
6. **Index codebase graph (if available):** IF `hex-graph` MCP server is available:
   - `index_project(path=codebase_root)` -- builds/refreshes code graph
   - Add `graph_indexed: true` to contextStore for workers (ln-634 uses audit_workspace for critical path identification)

**Output:** `testFilesMetadata` -- list of test files with basic stats and `type` field

### Phase 2: Research Best Practices (ONCE)

**Goal:** Gather testing best practices context ONCE, share with all workers

**Actions:**
1. Use MCP Ref/Context7 to research testing best practices for detected tech stack
2. Load [../shared/references/risk_based_testing_guide.md](../shared/references/risk_based_testing_guide.md)
3. Build `contextStore` with:
   - Testing philosophy (E2E primary, Unit supplementary)
   - Usefulness Score formulas (Impact x Probability)
   - Anti-patterns catalog
   - Framework detection patterns
   - Manual test quality criteria (harness adoption, golden files, fail-fast, config sourcing)

**Add output_dir to contextStore:**
```json
{
  "output_dir": ".hex-skills/runtime-artifacts/runs/{run_id}/audit-report"
}
```

Coordinator also computes one `summaryArtifactPath` per worker invocation under `.hex-skills/runtime-artifacts/runs/{run_id}/audit-worker/`.

**Output:** `contextStore` -- shared context for all workers

**Key Benefit:** Context gathered ONCE -> passed to all workers -> token-efficient

### Phase 3: Domain Discovery

```bash
mkdir -p {output_dir}   # plus sibling audit-worker summary directory
```

**MANDATORY READ:** Load `shared/references/audit_coordinator_domain_mode.md`.

Detect `domain_mode` and `all_domains` with the shared pattern. This coordinator keeps one local rule: shared folders remain visible in coverage analysis, but do not inflate business-domain coverage percentages.

### Phase 4: Delegate to Workers

**MANDATORY READ:** Load `shared/references/task_delegation_pattern.md` and `shared/references/audit_worker_core_contract.md`.

#### Global Workers (PARALLEL)

**Global workers** scan entire test suite (not domain-aware):

Managed summary artifact pattern: `.hex-skills/runtime-artifacts/runs/{parent_run_id}/audit-worker/{worker}--{identifier}.json`.

| # | Worker | Category | What It Audits |
|---|--------|----------|----------------|
| 1 | [ln-631-test-business-logic-auditor](../ln-631-test-business-logic-auditor/) | Business Logic Focus | Framework/Library tests (Prisma, Express, bcrypt, JWT, axios, React hooks) -> REMOVE |
| 2 | [ln-632-test-e2e-priority-auditor](../ln-632-test-e2e-priority-auditor/) | E2E Priority | E2E baseline (2/endpoint), Pyramid validation, Missing E2E tests |
| 3 | [ln-633-test-value-auditor](../ln-633-test-value-auditor/) | Risk-Based Value | Usefulness Score = Impact x Probability<br>Decisions: >=15 KEEP, 10-14 REVIEW, <10 REMOVE |
| 5 | [ln-635-test-isolation-auditor](../ln-635-test-isolation-auditor/) | Isolation + Anti-Patterns | Isolation (6 categories), Determinism, Anti-Patterns (7 types) |
| 6 | [ln-636-manual-test-auditor](../ln-636-manual-test-auditor/) | Manual Test Quality | Harness adoption, golden files, fail-fast, config sourcing, template compliance, idempotency |
| 7 | [ln-637-test-structure-auditor](../ln-637-test-structure-auditor/) | Test Structure | Directory layout, test-to-source mapping, flat directory growth signals, co-location consistency |

**Type-filtered delegation:** Coordinator splits `testFilesMetadata` by `type` before passing to workers:
- ln-631..635 receive `testFilesMetadata.filter(f => f.type == "automated")` only
- ln-636 receives `testFilesMetadata.filter(f => f.type == "manual")` only
- ln-637 receives ALL `testFilesMetadata` (both types -- structure analysis requires full picture)

**Invocation (6 workers in PARALLEL):**
```javascript
// filteredByType: automated for ln-631..635, manual for ln-636, ALL for ln-637
FOR EACH worker IN [ln-631, ln-632, ln-633, ln-635, ln-636, ln-637]:
  identifier = "global"
  childRunId = parent_run_id + "--" + worker + "--" + identifier
  childSummaryArtifactPath = ".hex-skills/runtime-artifacts/runs/" + parent_run_id + "/audit-worker/" + worker + "--" + identifier + ".json"
  node shared/scripts/audit-worker-runtime/cli.mjs start --skill {worker} --identifier {identifier} --manifest-file .hex-skills/audit/{worker}--{identifier}_manifest.json --run-id {childRunId} --summary-artifact-path {childSummaryArtifactPath}
  node shared/scripts/audit-runtime/cli.mjs checkpoint --run-id {parent_run_id} --phase PHASE_4_DELEGATE --payload '{"child_run":{"worker":"{worker}","identifier":"{identifier}","run_id":"{childRunId}","summary_artifact_path":"{childSummaryArtifactPath}"}}'
  Skill(skill: "{worker}", args: "--run-id {childRunId} --summary-artifact-path {childSummaryArtifactPath}")
  node shared/scripts/audit-runtime/cli.mjs record-worker-result --run-id {parent_run_id} --payload-file {childSummaryArtifactPath}
```

#### Domain-Aware Worker (PARALLEL per domain)

**Domain-aware worker** runs once per domain:

| # | Worker | Category | What It Audits |
|---|--------|----------|----------------|
| 4 | [ln-634-test-coverage-auditor](../ln-634-test-coverage-auditor/) | Coverage Gaps | Missing tests for critical paths per domain (Money 20+, Security 20+, Data 15+, Core Flows 15+) |

**Invocation:**
```javascript
IF domain_mode == "domain-aware":
  FOR EACH domain IN all_domains:
    identifier = domain.name
    childRunId = parent_run_id + "--ln-634--" + identifier
    childSummaryArtifactPath = ".hex-skills/runtime-artifacts/runs/" + parent_run_id + "/audit-worker/ln-634--" + identifier + ".json"
    node shared/scripts/audit-worker-runtime/cli.mjs start --skill ln-634 --identifier {identifier} --manifest-file .hex-skills/audit/ln-634--{identifier}_manifest.json --run-id {childRunId} --summary-artifact-path {childSummaryArtifactPath}
    node shared/scripts/audit-runtime/cli.mjs checkpoint --run-id {parent_run_id} --phase PHASE_4_DELEGATE --payload '{"child_run":{"worker":"ln-634","identifier":"{identifier}","run_id":"{childRunId}","summary_artifact_path":"{childSummaryArtifactPath}"}}'
    Skill(skill: "ln-634-test-coverage-auditor", args: "--run-id {childRunId} --summary-artifact-path {childSummaryArtifactPath}")
    node shared/scripts/audit-runtime/cli.mjs record-worker-result --run-id {parent_run_id} --payload-file {childSummaryArtifactPath}
ELSE:
  identifier = "global"
  childRunId = parent_run_id + "--ln-634--" + identifier
  childSummaryArtifactPath = ".hex-skills/runtime-artifacts/runs/" + parent_run_id + "/audit-worker/ln-634--" + identifier + ".json"
  node shared/scripts/audit-worker-runtime/cli.mjs start --skill ln-634 --identifier {identifier} --manifest-file .hex-skills/audit/ln-634--{identifier}_manifest.json --run-id {childRunId} --summary-artifact-path {childSummaryArtifactPath}
  node shared/scripts/audit-runtime/cli.mjs checkpoint --run-id {parent_run_id} --phase PHASE_4_DELEGATE --payload '{"child_run":{"worker":"ln-634","identifier":"{identifier}","run_id":"{childRunId}","summary_artifact_path":"{childSummaryArtifactPath}"}}'
  Skill(skill: "ln-634-test-coverage-auditor", args: "--run-id {childRunId} --summary-artifact-path {childSummaryArtifactPath}")
  node shared/scripts/audit-runtime/cli.mjs record-worker-result --run-id {parent_run_id} --payload-file {childSummaryArtifactPath}
```

**Parallelism strategy:**
- Global workers: All 6 global workers run in PARALLEL
- Domain-aware worker: All N domain-aware invocations run in PARALLEL
- Example: 3 domains -> 6 global + 3 ln-634 invocations in single message

**Domain-aware workers** add optional fields: `domain`, `scan_path`

### Phase 5: Aggregate Results (File-Based)

**MANDATORY READ:** Load `shared/references/audit_coordinator_aggregation.md` and `shared/references/context_validation.md`.

Use the shared aggregation pattern for runtime artifact checks, JSON summary parsing, severity rollups, file reads, and final report assembly.

Local rules for this coordinator:
- Categories 1-3, 5-7 stay global in the final report.
- Category 4 (Coverage Gaps) is grouped per domain when `domain_mode="domain-aware"`.
- Overall score = average of 7 worker scores.

**Context Validation (Post-Filter):**

Apply Rules 1, 5 + test-specific filters to merged findings:
```
FOR EACH finding WHERE severity IN (HIGH, MEDIUM):
  # Rule 1: ADR/Planned Override
  IF finding matches ADR -> advisory "[Planned: ADR-XXX]"

  # Rule 5: Locality/Single-Consumer
  IF "extract shared helper" suggestion AND consumer_count == 1 -> advisory

  # Test-specific: Custom wrapper detection
  IF "framework test" finding (ln-631) AND test imports custom wrapper class:
    -> advisory (tests custom logic, not framework)

  # Test-specific: Setup/fixture code
  IF "The Liar" finding (ln-635) AND file is conftest/fixture/setup:
    -> advisory (setup code, no assertions expected)

  # Test-specific: Parameterized test
  IF "The Giant" finding (ln-635) AND test is parameterized/data-driven:
    -> severity -= 1 (size from data, not complexity)

Downgraded findings -> "Advisory Findings" section in report.
Recalculate scores excluding advisory findings from penalty.
```

**Exempt:** Coverage gap CRITICAL findings (ln-634), risk-value scores (ln-633).

## Output Format

```markdown
## Test Suite Audit Report - [DATE]

### Executive Summary
[2-3 sentences: test suite health, major issues, key recommendations]

### Severity Summary

| Severity | Count |
|----------|-------|
| Critical | X |
| High | X |
| Medium | X |
| Low | X |
| **Total** | **X** |

### Compliance Score

| Category | Score | Notes |
|----------|-------|-------|
| Business Logic Focus | X/10 | X framework tests found |
| E2E Critical Coverage | X/10 | X critical paths missing E2E |
| Risk-Based Value | X/10 | X low-value tests |
| Coverage Gaps | X/10 | X critical paths untested |
| Isolation & Anti-Patterns | X/10 | X isolation + anti-pattern issues |
| Manual Test Quality | X/10 | X manual test quality issues |
| Test Structure | X/10 | X layout/organization issues |
| **Overall** | **X/10** | Average of 7 categories |

### Domain Coverage Summary (NEW - if domain_mode="domain-aware")

| Domain | Critical Paths | Tested | Coverage % | Gaps |
|--------|---------------|--------|------------|------|
| users | 8 | 6 | 75% | 2 |
| orders | 12 | 8 | 67% | 4 |
| payments | 6 | 5 | 83% | 1 |
| **Total** | **26** | **19** | **73%** | **7** |

### Audit Findings

| Severity | Location | Issue | Principle | Recommendation | Effort |
|----------|----------|-------|-----------|----------------|--------|
| **CRITICAL** | routes/payment.ts:45 | Missing E2E for payment processing (Priority 25) | E2E Critical Coverage / Money Flow | Add E2E: successful payment + discount edge cases | M |
| **HIGH** | auth.test.ts:45-52 | Test 'bcrypt hashes password' validates library behavior | Business Logic Focus / Crypto Testing | Delete -- bcrypt already tested by maintainers | S |
| **HIGH** | db.test.ts:78-85 | Test 'Prisma findMany returns array' validates ORM | Business Logic Focus / ORM Testing | Delete -- Prisma already tested | S |
| **HIGH** | user.test.ts:45 | Anti-pattern 'The Liar' -- no assertions | Anti-Patterns / The Liar | Add specific assertions or delete test | S |
| **MEDIUM** | utils.test.ts:23-27 | Test 'validateEmail' has Usefulness Score 4 | Risk-Based Value / Low Priority | Delete -- likely covered by E2E registration | S |
| **MEDIUM** | order.test.ts:200-350 | Anti-pattern 'The Giant' -- 150 lines | Anti-Patterns / The Giant | Split into focused tests | M |
| **LOW** | payment.test.ts | Anti-pattern 'Happy Path Only' -- no error tests | Anti-Patterns / Happy Path | Add negative tests | M |

### Coverage Gaps by Domain (if domain_mode="domain-aware")

#### Domain: users (src/users/)

| Severity | Category | Missing Test | Location | Priority | Effort |
|----------|----------|--------------|----------|----------|--------|
| CRITICAL | Money | E2E: processRefund() | services/user.ts:120 | 20 | M |
| HIGH | Security | Unit: validatePermissions() | middleware/auth.ts:45 | 18 | S |

#### Domain: orders (src/orders/)

| Severity | Category | Missing Test | Location | Priority | Effort |
|----------|----------|--------------|----------|----------|--------|
| CRITICAL | Money | E2E: applyDiscount() | services/order.ts:45 | 25 | M |
| HIGH | Data | Integration: orderTransaction() | repositories/order.ts:78 | 16 | M |
```

## Worker Architecture

Each worker:
- Receives `contextStore` with testing best practices
- Receives `testFilesMetadata` with test file list (tagged with `type: "automated"|"manual"`)
- Workers 1-5 (ln-631..ln-635) focus on automated tests; worker 6 (ln-636) focuses on manual tests; worker 7 (ln-637) analyzes all test files for structure
- Loads full test file contents when analyzing
- Returns structured JSON with category findings
- Operates independently (failure in one doesn't block others)

**Token Efficiency:**
- Coordinator: metadata only (~1000 tokens)
- Workers: full test file contents when needed (~5000-10000 tokens each)
- Context gathered ONCE, shared with all workers

## Critical Rules

- **Two-stage delegation:** Global workers (6) + Domain-aware worker (ln-634 x N domains)
- **Domain discovery:** Auto-detect domains from folder structure; fallback to global mode if <2 domains
- **Parallel execution:** All workers (global + domain-aware) run in PARALLEL
- **Domain-grouped output:** Coverage Gaps findings grouped by domain (if domain_mode="domain-aware")
- **Delete > Archive:** Remove useless tests, don't comment out
- **E2E baseline:** Every endpoint needs 2 E2E (positive + negative)
- **Justify each test:** If can't explain Priority >=15, remove it
- **Trust frameworks:** Don't test Express/Prisma/bcrypt behavior
- **No performance/load tests:** Flag and REMOVE tests measuring throughput/latency/memory (DevOps Epic territory)
- **Code is truth:** If test contradicts code behavior, update test
- **Language preservation:** Report in project's language (EN/RU)

## Phase 6: Append Results Log

Before appending the results log, record the coordinator runtime summary:

```bash
node shared/scripts/audit-runtime/cli.mjs record-summary --run-id {parent_run_id} --payload '{"schema_version":"1.0.0","summary_kind":"audit-coordinator","run_id":"{parent_run_id}","identifier":"{runtime_identifier}","producer_skill":"ln-630","produced_at":"{iso_timestamp}","payload":{"status":"completed","final_result":"AUDIT_COMPLETE","report_path":"docs/project/test_audit.md","worker_count":{active_worker_count},"issues_total":{issues_total},"severity_counts":{"critical":{critical_count},"high":{high_count},"medium":{medium_count},"low":{low_count}},"warnings":[]}}'
```

**MANDATORY READ:** Load `shared/references/results_log_pattern.md`

Append one row to `docs/project/.audit/results_log.md` with: Skill=`ln-630`, Metric=`overall_score`, Scale=`0-10`, Score from Phase 5 aggregation. Calculate Delta vs previous `ln-630` row. Create file with header if missing. Rolling window: max 50 entries.

## Phase 7: Cleanup Worker Files

```bash
rm -rf {output_dir}
```

Delete the run-scoped runtime artifact directory (`.hex-skills/runtime-artifacts/runs/{run_id}/`) after consolidation. The consolidated report and results log already preserve the required audit outputs.

## Definition of Done

- [ ] All test files discovered via Glob (automated + manual)
- [ ] Manual test files tagged with `type: "manual"` in testFilesMetadata
- [ ] Context gathered from testing best practices (MCP Ref/Context7)
- [ ] Domain discovery completed (domain_mode determined)
- [ ] contextStore built with test metadata + domain info
- [ ] Global workers (6) invoked in PARALLEL (ln-631, ln-632, ln-633, ln-635, ln-636, ln-637)
- [ ] Domain-aware worker (ln-634) invoked per domain in PARALLEL
- [ ] All workers completed successfully (or reported errors)
- [ ] Results aggregated with domain grouping (if domain_mode="domain-aware")
- [ ] Domain Coverage Summary built (if domain_mode="domain-aware")
- [ ] Compliance scores calculated (8 categories)
- [ ] Keep/Remove/Refactor decisions for each test
- [ ] Missing tests identified with Priority (grouped by domain if applicable)
- [ ] Anti-patterns catalogued
- [ ] Report written to `docs/project/test_audit.md`
- [ ] Results log row appended to `docs/project/.audit/results_log.md`
- [ ] Worker output directory cleaned up after consolidation
- [ ] Summary returned to user

## Phase 8: Meta-Analysis

**MANDATORY READ:** Load `shared/references/meta_analysis_protocol.md`

Skill type: `review-coordinator` (workers only). Run after all phases complete. Output to chat using the `review-coordinator -- workers only` format.

## Reference Files

- **Orchestrator lifecycle:** `shared/references/orchestrator_pattern.md`
- **Risk-based testing methodology:** `shared/references/risk_based_testing_guide.md`
- **Task delegation pattern:** `shared/references/task_delegation_pattern.md`
- **Domain mode pattern:** `shared/references/audit_coordinator_domain_mode.md`
- **Aggregation pattern:** `shared/references/audit_coordinator_aggregation.md`
- **MANDATORY READ:** `shared/references/research_tool_fallback.md`

## Related Skills

- **Workers:**
  - [ln-631-test-business-logic-auditor](../ln-631-test-business-logic-auditor/) -- Framework tests detection
  - [ln-632-test-e2e-priority-auditor](../ln-632-test-e2e-priority-auditor/) -- E2E baseline validation
  - [ln-633-test-value-auditor](../ln-633-test-value-auditor/) -- Usefulness Score calculation
  - [ln-634-test-coverage-auditor](../ln-634-test-coverage-auditor/) -- Coverage gaps identification
  - [ln-635-test-isolation-auditor](../ln-635-test-isolation-auditor/) -- Isolation + Anti-Patterns
  - [ln-636-manual-test-auditor](../ln-636-manual-test-auditor/) -- Manual Test Quality
  - [ln-637-test-structure-auditor](../ln-637-test-structure-auditor/) -- Test Structure

- **Reference:**
  - [../shared/references/risk_based_testing_guide.md](../shared/references/risk_based_testing_guide.md) -- Risk-Based Testing Guide

---
**Version:** 4.0.0
**Last Updated:** 2025-12-23

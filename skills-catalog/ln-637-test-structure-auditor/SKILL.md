---
name: ln-637-test-structure-auditor
description: "Checks test file organization, directory layout, test-to-source mapping, domain grouping, co-location. Use when auditing test structure."
allowed-tools: Read, Grep, Glob, Bash
license: MIT
model: claude-sonnet-4-6
---

> **Paths:** File paths (`shared/`, `references/`, `../ln-*`) are relative to skills repo root. If not found at CWD, locate this SKILL.md directory and go up one level for repo root. If `shared/` is missing, fetch files via WebFetch from `https://raw.githubusercontent.com/levnikolaevich/claude-code-skills/master/skills/{path}`.

# Test Structure Auditor (L3 Worker)

**Type:** L3 Worker

Specialized worker auditing test file organization and directory structure for maintainability as the test suite grows.

## Purpose & Scope

- Audit **Test Structure** (Category 8: Medium Priority)
- Detect layout pattern (flat / mirrored / co-located / hybrid)
- Flag flat directories exceeding growth thresholds with domain grouping recommendations
- Verify test-to-source mapping consistency and orphaned tests
- Calculate compliance score (X/10)

## Inputs

**MANDATORY READ:** Load `shared/references/audit_worker_core_contract.md`.

Receives `contextStore` with: `tech_stack`, `testFilesMetadata` (ALL types -- both automated and manual), `codebase_root`, `output_dir`, `domain_mode`, `all_domains`.

**Note:** Unlike other workers that receive type-filtered metadata, this worker receives ALL test files because directory structure analysis requires the full picture of where both automated and manual tests are placed.

## Workflow

**MANDATORY READ:** Load `shared/references/two_layer_detection.md` for detection methodology.

1) **Parse Context:** Extract test file list, output_dir, codebase_root, domain info from contextStore
2) **Map Source Structure:** Glob source directories (`src/`, `app/`, `lib/`) to build source domain/module tree
3) **Map Test Structure:** Group test files by parent directory, count files per directory, classify locations
4) **Scan Checks (Layer 1):** Run 5 audit checks (see Audit Rules) using Glob/Grep patterns
5) **Context Analysis (Layer 2 -- MANDATORY):** For each candidate finding, apply Layer 2 filters (see each check)
6) **Collect Findings:** Record violations with severity, location, effort, recommendation
7) **Calculate Score:** Count violations by severity, calculate compliance score (X/10)
8) **Write Report:** Build full markdown report in memory per `shared/templates/audit_worker_report_template.md`, write to `{output_dir}/ln-637--global.md` in single Write call
9) **Return Summary:** Return minimal summary to coordinator (see Output Format)

## Audit Rules

### 1. Layout Pattern Detection

**What:** Detect which test organization pattern the project uses and check for unintentional mixing

**Detection:**
- Classify each test file location:
  - **Co-located:** test file in same directory as source file (e.g., `src/users/users.test.ts`)
  - **Mirrored:** test file in parallel hierarchy (e.g., `tests/users/users.test.ts` mirrors `src/users/`)
  - **Centralized-flat:** all tests in single directory (e.g., `tests/` or `__tests__/`)
  - **Manual:** files in `tests/manual/` (informational, not flagged)
- Calculate distribution percentages across patterns
- If >70% files follow one pattern -> that is the dominant pattern
- If no pattern reaches 70% -> hybrid

**Layer 2:**
- Hybrid is acceptable if different test TYPES use different patterns (e.g., unit tests co-located + integration tests in `tests/automated/integration/`). Check if deviation correlates with test type
- Projects with <5 test files -> skip (too small to establish pattern)

**Severity:** **MEDIUM** if hybrid without clear type-based rule (>30% of same-type tests deviate from dominant pattern)

**Recommendation:** Standardize test placement -- choose one pattern per test type and document in testing guidelines

**Effort:** L

### 2. Test-to-Source Mapping

**What:** Detect orphaned test files (source file deleted but test remains) and mismatched paths

**Detection:**
- For each test file, extract the implied source module:
  - `users.test.ts` -> `users.ts` or `users/index.ts`
  - `test_payments.py` -> `payments.py`
- Check if the implied source file exists in the expected location
- If source file not found -> orphaned test candidate

**Layer 2:**
- Skip integration/e2e tests (test multiple modules, no 1:1 source mapping)
- Skip tests in centralized-flat layout (no path-based mapping expected)
- Skip test files that import from multiple source modules (integration tests by nature)
- Skip utility/helper test files (`test_utils.ts`, `test_helpers.py`)

**Severity:** **MEDIUM** for orphaned tests (dead code), **LOW** for path mismatches

**Recommendation:** Delete orphaned tests or update to match current source structure

**Effort:** S

### 3. Flat Directory Growth

**What:** Detect test directories with excessive file count that would benefit from subdirectory grouping

**Detection:**
- Count test files per directory (excluding `node_modules`, `dist`, `build`)
- Thresholds:
  - 15-20 files in one flat directory -> LOW (approaching limit)
  - \>20 files in one flat directory -> MEDIUM (restructure recommended)
- For MEDIUM findings, suggest domain-based grouping by analyzing file name prefixes:
  - Group by common prefix (e.g., `test_auth_*.py` -> `auth/` subdirectory)
  - Cross-reference with source domain structure if available

**Layer 2:**
- Skip if directory already has subdirectories (partially organized)
- Skip if files use clear naming prefixes that provide sufficient organization without subdirectories
- Skip `tests/manual/` (manual test structure has separate conventions)

**Severity:** **MEDIUM** (>20 files), **LOW** (15-20 files)

**Recommendation:** Group tests into subdirectories by domain/feature. Suggest specific grouping based on file name analysis:
```
# Before (flat):
tests/test_auth_login.py, tests/test_auth_tokens.py, tests/test_users_crud.py, ...

# After (grouped):
tests/auth/test_login.py, tests/auth/test_tokens.py, tests/users/test_crud.py, ...
```

**Effort:** M

### 4. Domain Grouping Alignment

**What:** Check whether test directory grouping mirrors source domain structure

**Detection:**
- Compare source domain directories (from `all_domains` or scanned `src/`) with test directory names
- For each source domain, check if a corresponding test group exists:
  - Mirrored layout: `tests/{domain}/` directory exists
  - Co-located: test files exist in `src/{domain}/`
- Flag source domains with zero corresponding test groups

**Layer 2:**
- Skip if project has no clear domain structure (`domain_mode="global"` or <2 source domains)
- Skip shared/common/utils domains (cross-cutting, may not need dedicated test group)
- Skip if project uses centralized-flat layout (no grouping expected)

**Severity:** **MEDIUM** for domains with >5 source files but no test group, **LOW** otherwise

**Recommendation:** Create test directory/group for domain to maintain structural alignment

**Effort:** M

### 5. Co-location Consistency

**What:** Detect which co-location pattern the project uses and flag inconsistencies

**Detection:**
- Count test files placed next to source files vs. in dedicated test directories
- Calculate ratio: co-located / (co-located + centralized)
- If ratio 0.0-0.2 -> centralized pattern
- If ratio 0.8-1.0 -> co-located pattern
- If ratio 0.2-0.8 -> mixed (potential inconsistency)
- For mixed: identify which modules deviate from the dominant pattern

**Layer 2:**
- Mixed is acceptable if different test types use different placement:
  - Unit tests co-located + integration/e2e tests centralized -> valid hybrid
  - Check test file naming/location correlation with type
- Projects with <5 test files -> skip

**Severity:** **MEDIUM** if >20% of same-type tests deviate from dominant placement pattern

**Recommendation:** Consolidate test placement -- move deviating tests to follow the project's dominant pattern

**Effort:** M-L

## Scoring Algorithm

**MANDATORY READ:** Load `shared/references/audit_worker_core_contract.md` and `shared/references/audit_scoring.md`.

**Severity mapping:**
- Orphaned tests, Excessive flat directory (>20), Inconsistent layout, Inconsistent co-location -> MEDIUM
- Approaching flat directory limit (15-20), Missing domain test group (small domain), Path mismatch -> LOW

## Output Format

**MANDATORY READ:** Load `shared/references/audit_worker_core_contract.md` and `shared/templates/audit_worker_report_template.md`.

Write JSON summary per `shared/references/audit_summary_contract.md`. In managed mode the caller passes both `runId` and `summaryArtifactPath`; in standalone mode the worker generates its own run-scoped artifact path per shared contract.

Write report to `{output_dir}/ln-637--global.md` with `category: "Test Structure"` and checks: layout_pattern, test_source_mapping, flat_dir_growth, domain_grouping, colocation_consistency.

Return summary per `shared/references/audit_summary_contract.md`.

When `summaryArtifactPath` is absent, write the standalone runtime summary under `.hex-skills/runtime-artifacts/runs/{run_id}/audit-worker/{worker}--{identifier}.json` and optionally echo the same summary in structured output.
```
Report written: .hex-skills/runtime-artifacts/runs/{run_id}/audit-report/ln-637--global.md
Score: X.X/10 | Issues: N (C:N H:N M:N L:N)
```

## Critical Rules

**MANDATORY READ:** Load `shared/references/audit_worker_core_contract.md`.

- **Do not auto-fix:** Report only, suggest restructuring
- **Effort realism:** S = <1h, M = 1-4h, L = >4h
- **Skip when trivial:** If <5 test files total, return score 10/10 with zero findings
- **No naming check:** Test naming consistency (`.test.` vs `.spec.`) is out of scope -- do not duplicate
- **Both types:** Analyze both automated and manual test file locations for complete layout picture
- **Concrete suggestions:** For flat directory growth findings, always suggest specific subdirectory grouping based on file name prefix analysis

## Definition of Done

**MANDATORY READ:** Load `shared/references/audit_worker_core_contract.md`.

- [ ] contextStore parsed successfully (including output_dir, domain info)
- [ ] Source structure mapped (domain/module tree)
- [ ] Test structure mapped (files grouped by directory, counts calculated)
- [ ] All 5 checks completed
- [ ] Layer 2 context analysis applied (type-based hybrid, small project exclusions)
- [ ] Layout pattern detected and documented in report
- [ ] Flat directory growth signals identified with specific grouping suggestions
- [ ] Findings collected with severity, location, effort, recommendation
- [ ] Score calculated using penalty algorithm
- [ ] Report written to `{output_dir}/ln-637--global.md` (atomic single Write call)
- [ ] Summary written per contract

---
**Version:** 1.0.0
**Last Updated:** 2026-03-15

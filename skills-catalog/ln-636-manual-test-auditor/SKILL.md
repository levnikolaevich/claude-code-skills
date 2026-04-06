---
name: ln-636-manual-test-auditor
description: "Checks manual test scripts for harness adoption, golden files, fail-fast, config sourcing, idempotency. Use when auditing manual test quality."
allowed-tools: Read, Grep, Glob, Bash
license: MIT
---

> **Paths:** File paths (`shared/`, `references/`, `../ln-*`) are relative to skills repo root. If not found at CWD, locate this SKILL.md directory and go up one level for repo root. If `shared/` is missing, fetch files via WebFetch from `https://raw.githubusercontent.com/levnikolaevich/claude-code-skills/master/skills/{path}`.

# Manual Test Quality Auditor (L3 Worker)

**Type:** L3 Worker

Specialized worker auditing manual test scripts for quality and best-practice compliance.

## Purpose & Scope

- Audit **Manual Test Quality** (Category 7: Medium Priority)
- Evaluate bash test scripts in `tests/manual/` against quality dimensions
- Calculate compliance score (X/10)

## Inputs

**MANDATORY READ:** Load `shared/references/audit_worker_core_contract.md`.

Receives `contextStore` with: `tech_stack`, `testFilesMetadata` (filtered to `type: "manual"`), `codebase_root`, `output_dir`.

Manual test metadata includes: `suite_dir`, `has_expected_dir`, `harness_sourced`.

## Workflow

**MANDATORY READ:** Load `shared/references/two_layer_detection.md` for detection methodology.

1) **Parse Context:** Extract manual test file list, output_dir, codebase_root from contextStore
2) **Discover Infrastructure:** Detect shared infrastructure files:
   - `tests/manual/config.sh` -- shared configuration
   - `tests/manual/test_harness.sh` -- shared test framework (if exists)
   - `tests/manual/test-all.sh` -- master runner
   - `tests/manual/TEMPLATE-*.sh` -- test templates (if exist)
   - `tests/manual/regenerate-golden.sh` -- golden file regeneration (if exists)
3) **Scan Scripts (Layer 1):** For each manual test script, check 7 quality dimensions (see Audit Rules)
3b) **Context Analysis (Layer 2 -- MANDATORY):** For each candidate finding, ask:
   - Is this a setup/utility script (e.g., `00-setup/*.sh`, `tools/*.sh`)? Setup scripts have different requirements -- skip harness/golden checks
   - Is this a master runner (`test-all.sh`)? Master runners orchestrate, not test -- skip all checks except fail-fast
   - Does the project not use a shared harness at all? If no `test_harness.sh` exists, harness adoption check is N/A
4) **Collect Findings:** Record violations with severity, location (file:line), effort, recommendation
5) **Calculate Score:** Count violations by severity, calculate compliance score (X/10)
6) **Write Report:** Build full markdown report in memory per `shared/templates/audit_worker_report_template.md`, write to `{output_dir}/ln-636--global.md` in single Write call
7) **Return Summary:** Return minimal summary to coordinator (see Output Format)

## Audit Rules

### 1. Harness Adoption

**What:** Test script uses shared framework (`run_test`, `init_test_state`) instead of custom assertion logic

**Detection:**
- Grep for `run_test`, `init_test_state` in script
- If absent AND script contains custom test loops/assertions -> custom logic
- If `test_harness.sh` does not exist in project -> skip this check entirely

**Severity:** **HIGH** (custom logic = maintenance burden, inconsistent reporting)

**Recommendation:** Refactor to use shared `run_test` from test_harness.sh

**Effort:** M

### 2. Golden File Completeness

**What:** Test suite has `expected/` directory with reference files matching test scenarios

**Detection:**
- Check if suite directory has `expected/` subdirectory
- Compare: number of test scenarios (grep `run_test` calls) vs number of expected files
- If test uses `diff` against expected files but expected dir is missing -> finding

**Layer 2:** Not all tests need golden files. Tests validating HTTP status codes, timing, or dynamic data may legitimately skip golden comparison -> skip if test has no `diff` or comparison against files

**Severity:** **HIGH** (no golden files = no regression detection for output correctness)

**Recommendation:** Add expected/ directory with reference output files

**Effort:** M

### 3. Config Sourcing

**What:** Script sources shared `config.sh` for consistent configuration

**Detection:**
- Grep for `source.*config.sh` or `. .*config.sh`
- If absent -> script manages its own BASE_URL, tokens, etc.

**Layer 2:** If script is self-contained utility (e.g., `tools/*.sh`) -> skip

**Severity:** **MEDIUM**

**Recommendation:** Add `source "$THIS_DIR/../config.sh"` for shared configuration

**Effort:** S

### 4. Fail-Fast Compliance

**What:** Script uses `set -e` and returns exit code 1 on failure

**Detection:**
- Grep for `set -e` (or `set -eo pipefail`)
- Check that failure paths lead to non-zero exit (not swallowed by `|| true` everywhere)

**Severity:** **HIGH** (silent failures mask broken tests)

**Recommendation:** Add `set -e` at script start, ensure test failures propagate

**Effort:** S

### 5. Template Compliance

**What:** Script follows project test templates (TEMPLATE-api-endpoint.sh, TEMPLATE-document-format.sh)

**Detection:**
- If TEMPLATE files exist in `tests/manual/`, check structural alignment:
  - Header comment block with description, ACs tested, prerequisites
  - Standard variable naming (`THIS_DIR`, `EXPECTED_DIR`)
  - Standard setup pattern (`source config.sh`, `check_jq`, `setup_auth`)
- If NO templates exist in project -> skip this check entirely

**Layer 2:** Older scripts written before templates may diverge. Flag as MEDIUM, not HIGH

**Severity:** **MEDIUM**

**Recommendation:** Align script structure with project TEMPLATE files

**Effort:** M

### 6. Idempotency

**What:** Script can be rerun safely without side effects from previous runs

**Detection:**
- Grep for cleanup patterns: `trap.*EXIT`, `rm -f`, `cleanup` functions
- Check for temp file creation without cleanup
- Check for hardcoded resource names that would conflict on rerun (e.g., creating user with fixed email without checking existence)

**Layer 2:** Scripts that only READ data (GET requests, queries) are inherently idempotent -> skip

**Severity:** **MEDIUM**

**Recommendation:** Add cleanup trap or use unique identifiers per run

**Effort:** S-M

### 7. Documentation

**What:** Test suite directory has README.md explaining purpose and prerequisites

**Detection:**
- Check if suite directory (`NN-feature/`) contains README.md
- If missing -> finding

**Layer 2:** Setup directories (`00-setup/`) and utility directories (`tools/`) may not need README -> skip

**Severity:** **LOW**

**Recommendation:** Add README.md with test purpose, prerequisites, usage

**Effort:** S

## Scoring Algorithm

**MANDATORY READ:** Load `shared/references/audit_worker_core_contract.md` and `shared/references/audit_scoring.md`.

**Severity mapping:**
- Missing harness adoption (when harness exists), No golden files (when expected-based), No fail-fast -> HIGH
- Missing config sourcing, Template divergence, No idempotency -> MEDIUM
- Missing README -> LOW

## Output Format

**MANDATORY READ:** Load `shared/references/audit_worker_core_contract.md` and `shared/templates/audit_worker_report_template.md`.

Write JSON summary per `shared/references/audit_summary_contract.md`. In managed mode the caller passes both `runId` and `summaryArtifactPath`; in standalone mode the worker generates its own run-scoped artifact path per shared contract.

Write report to `{output_dir}/ln-636--global.md` with `category: "Manual Test Quality"` and checks: harness_adoption, golden_file_completeness, config_sourcing, fail_fast_compliance, template_compliance, idempotency, documentation.

Return summary per `shared/references/audit_summary_contract.md`.

When `summaryArtifactPath` is absent, write the standalone runtime summary under `.hex-skills/runtime-artifacts/runs/{run_id}/audit-worker/{worker}--{identifier}.json` and optionally echo the same summary in structured output.
```
Report written: .hex-skills/runtime-artifacts/runs/{run_id}/audit-report/ln-636--global.md
Score: X.X/10 | Issues: N (C:N H:N M:N L:N)
```

## Critical Rules

**MANDATORY READ:** Load `shared/references/audit_worker_core_contract.md`.

- **Do not auto-fix:** Report only
- **Effort realism:** S = <1h, M = 1-4h, L = >4h
- **Skip when empty:** If no `tests/manual/` directory exists, return score 10/10 with zero findings
- **Exclude non-test files:** Skip `config.sh`, `test_harness.sh`, `test-all.sh`, `regenerate-golden.sh`, `TEMPLATE-*.sh`, files in `tools/`, `results/`, `test-runs/`
- **Context-aware:** Setup scripts (`00-setup/`) have relaxed requirements (no golden files, no harness needed)

## Definition of Done

**MANDATORY READ:** Load `shared/references/audit_worker_core_contract.md`.

- [ ] contextStore parsed successfully (including output_dir)
- [ ] Manual test infrastructure discovered (config.sh, harness, templates)
- [ ] All 7 checks completed per test script
- [ ] Layer 2 context analysis applied (setup/utility exclusions)
- [ ] Findings collected with severity, location, effort, recommendation
- [ ] Score calculated using penalty algorithm
- [ ] Report written to `{output_dir}/ln-636--global.md` (atomic single Write call)
- [ ] Summary written per contract

## Reference Files

- **Audit output schema:** `shared/references/audit_output_schema.md`

---
**Version:** 1.0.0
**Last Updated:** 2026-03-13

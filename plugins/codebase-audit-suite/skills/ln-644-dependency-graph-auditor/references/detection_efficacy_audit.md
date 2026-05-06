# Detection Efficacy Audit

Post-incident protocol for analyzing escaped defects — bugs that passed Quality Gate but were found later (manual review, production, subsequent discovery). Invoked manually, not as pipeline step.

## When to Use

- After manual code review finds bugs that Quality Gate missed
- After production incident traced to code that passed gate
- After agent code review finds issues post-gate
- Periodically: compare gate verdicts against actual defect rates

## Inputs

| Input | Required | Description |
|-------|----------|-------------|
| Escaped bugs list | Yes | Each bug: severity, description, file:line, category |
| Gate run context | Yes | Which Story, which gate mode (full/fast-track), quality_score |

## Step 1: Pipeline Coverage Map

Static reference — what each pipeline step CAN and CANNOT detect:

| Pipeline Step | Performed By | Detection Scope | NOT Covered |
|---------------|-------------|----------------|-------------|
| Static Analysis | ruff, mypy, vulture (quality coordinator static analysis phase) | Syntax errors, type mismatches, dead code, unused imports | Algorithm logic, runtime behavior, domain semantics |
| Task Review | task reviewer step 4 | Architecture alignment, conventions, AC, side-effects, destructive ops, algorithm correctness (basic) | Deep performance patterns, domain-specific invariants |
| Code Metrics | code quality checker | Cyclomatic complexity, DRY, KISS, YAGNI, PERF-ALG (O(n^2)), PERF-DB (N+1), unbounded memory, ARCH-*, SEC-* | Data structure semantics, custom algorithm verification |
| MCP Ref Research | code quality checker MCP research levels | Library best practices, optimality, performance config, known pitfalls | Custom algorithm correctness, project-specific invariants |
| Agent Review | quality coordinator agent review phase (registry-configured external agents; Codex by default) | Correctness, security, performance, architecture, best practices | Limited by prompt scope, model reasoning depth, context window |
| Regression Tests | regression checker | Regressions in existing test suite | New untested code paths, missing test scenarios |
| Criteria Validation | quality coordinator criteria validation phase | Story deps, AC-Task coverage, DB creation principle | Code correctness, implementation quality |
| NFR Validation | story quality gate NFR validation phase | Security, performance, maintainability (high-level) | Algorithm-level bugs, data structure correctness |

## Step 2: Bug-to-Step Mapping

For each escaped bug, determine:

```
| Bug ID | Description | Severity | Should-Catch Step | Gap Type |
|--------|-------------|----------|-------------------|----------|
| {id}   | {desc}      | {sev}    | {step from map}   | {a/b/c}  |
```

**Gap types:**
- **(a) Implementation gap** — step covers this category but missed it (e.g., code quality checker lists "unbounded memory" but didn't flag specific instance)
- **(b) Scope gap** — step is close but category isn't in its explicit scope (e.g., task reviewer checks "error handling" but not "algorithm iteration semantics")
- **(c) No step exists** — no pipeline step covers this bug category at all

## Step 3: Gap Taxonomy

Aggregate Step 2 results:

```
| Bug Category | Coverage | Gap Type | Steps Involved |
|-------------|----------|----------|----------------|
| {category}  | Full / Partial / None | a/b/c or -- | {steps} |
```

Categories to evaluate (extend as needed):
- Syntax/Types, Architecture, Regression, Algorithm Logic, Performance Patterns, Data Structure Semantics, Domain-Specific Invariants, Resource Bounds, Encapsulation, Concurrency/Timing

## Step 4: Recommendations

For each gap with Partial or None coverage:

```
| # | Recommendation | Type | Target | Specific Change |
|---|---------------|------|--------|-----------------|
| 1 | {what to do}  | enhance_existing / add_to_existing / new_step | {skill + phase} | {concrete check} |
```

**Recommendation types:**
- **enhance_existing** — step already checks this category, improve detection (e.g., add pattern to code quality checker)
- **add_to_existing** — step doesn't check this category, add new check (e.g., add Algorithm Correctness to task reviewer)
- **new_step** — no step covers this, need new pipeline component (last resort)

## Step 5: Log Results

Append to `docs/project/architecture_health.md` under `## Escaped Defect Log`:

```
| Date | Story | Bug ID | Severity | Category | Gap Type | Action Taken |
|------|-------|--------|----------|----------|----------|--------------|
```

Classification values for Category: `algorithm_logic | performance_pattern | domain_specific | resource_bounds | encapsulation | data_structure | concurrency`

## Output Format

```
### Detection Efficacy Audit: {Story ID}
- Gate mode: {full/fast-track}, quality_score: {N}
- Escaped bugs: {N} ({critical}/{high}/{medium})

| Bug | Should-Catch | Gap Type | Recommendation |
|-----|-------------|----------|----------------|
| {id}: {short desc} | {step} | {a/b/c} | {action} |

Coverage gaps: {categories with None coverage}
Action items: {numbered list of recommendations}
```

---
**Version:** 1.0.0
**Last Updated:** 2026-03-12

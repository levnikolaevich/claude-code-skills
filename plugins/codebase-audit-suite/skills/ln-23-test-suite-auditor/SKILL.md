---
name: ln-23-test-suite-auditor
description: "Audits whether an existing test suite proves important behavior as a sustainable portfolio. Use when test confidence or lifecycle control is uncertain; not to implement tests or review one delivery."
---

# Test Suite Auditor

**Goal:** Audit the test portfolio as a read-only lifecycle and confidence system. Determine which important failures it detects, which evidence is untrustworthy or obsolete, and which additions, changes, consolidations, retirements, or explicit omissions produce the smallest sustainable portfolio.

**Execution contract:** Treat the ordered checkbox workflow below as this skill's Definition of Done. Work through every item in order, and mark it complete only when its action and required evidence are complete. `N/A`, skipped, unavailable, or delegated items remain incomplete.
Before returning, apply this skill's verdict, decision, and approval rules to every incomplete item and prepend **Checklist: X/Y complete**<br>**Incomplete: None | section/item — reason; outcome impact; exact next action**; list every incomplete item.

## Tool Routing

| Need | Preferred tool | Use it when | Fallback |
|---|---|---|---|
| Source and test inventory | Native file listing, search, manifests, and test configuration | Mapping domains, test types, runners, fixtures, and generated areas | Repository tree plus known test entrypoints |
| Test-to-code relationships | Language server or host-native code intelligence | Mapping units, callers, implementations, routes, and test targets | Naming and path search verified by direct reads |
| Execution and trust | Repository-defined test commands through the shell | Establishing pass/fail state, timing, order dependence, or reproducibility | Inspect CI results and configuration; mark execution unavailable |
| Coverage and missed behavior | Existing coverage tools and reports | Coverage data is configured and comparable to source scope | Static behavior-to-test mapping; never invent percentages |
| Flake and isolation evidence | Repeated, shuffled, parallel, or seed-controlled runs supported by the repository | A test is suspected of order, time, randomness, or shared-state dependence | History, CI logs, and code-path evidence |
| Assertion strength | Test reads, failure output, and configured mutation testing | Determining whether tests fail for meaningful behavioral defects | Counterfactual reasoning tied to specific assertions |
| Framework semantics | Official test-runner or framework documentation | A finding depends on lifecycle, fixtures, retries, isolation, or mocking behavior | Primary-source web research; otherwise mark `UNVERIFIED` |

Run only safe test and diagnostic commands. Do not rewrite snapshots, update golden files, regenerate fixtures, or accept changed output during the audit.

## Evidence Rules

- Coverage indicates execution, not proof. Require an assertion or observable oracle for important behavior.
- A slow test is not low-value when it uniquely protects a critical journey; a fast test is not high-value when it proves framework behavior.
- A flaky failure must be separated from an intermittently failing product dependency or genuinely nondeterministic requirement.
- Deletion recommendations require proof that the test basis is obsolete or that other evidence covers every still-required behavior and failure mode with equal or better trust.
- Merge recommendations require demonstrated duplicate or fragmented coverage and must preserve distinct business and failure scenarios, oracle strength, and failure localization; a larger test is not inherently better.
- Known regression guards and the only proof of a rare critical edge case are not deletion candidates merely because a numeric value heuristic is low.
- A real dependency is not inherently a test defect. Judge whether its version, state, ownership, reset, availability, and failure evidence make the result reproducible.
- Keep portfolio action (`KEEP`, `ADD`, `UPDATE`, `MERGE`, `DELETE`, `NO_TEST`) separate from execution status (`PASS`, `FAIL`, `BLOCKED`, `UNPROVEN`, `QUARANTINED`). `NO_TEST` requires existing proof, another control, or explicit residual-risk acceptance.
- Do not require a new registry by default. Prefer traceability derivable from repository-native test paths, behavioral names, tags, requirements, CI configuration, and review evidence.
- External testing guidance becomes actionable only when it explains a concrete weakness in this suite.

## Checklist

### 1. Map the Portfolio and Baseline

- [ ] Detect test runners, configurations, commands, directories, fixtures, factories, snapshots, golden files, manual scripts, coverage, and mutation tooling.
- [ ] Map source domains and critical entrypoints to unit, integration, contract, end-to-end, and manual test surfaces.
- [ ] Trace requirements, product risks, incidents, public contracts, and changed behavior to tests and results where evidence exists; identify tests with no current test basis and basis elements with no credible proof.
- [ ] Read repository instructions and CI configuration to identify required suites, environment assumptions, retries, sharding, and exclusions.
- [ ] Run the smallest representative suites, then required test gates where feasible; record environment, duration, exit status, failures, skips, and retries.
- [ ] Separate generated, vendored, example, migration-history, and infrastructure fixtures from product tests before evaluating the portfolio.
- [ ] Keep the audit read-only and disclose any caches or test artifacts created by permitted commands.

### 2. Audit Product Value and Coverage

- [ ] Identify uniquely critical local logic: money, authentication, authorization, data integrity, algorithms, domain rules, destructive operations, and irreversible workflows.
- [ ] Trace each critical behavior to at least one test whose oracle would fail for the corresponding defect; name/path matches and line coverage are only discovery evidence.
- [ ] Identify tests that merely re-prove language, framework, database engine, ORM, HTTP client, cryptography, serializer, or library behavior without asserting repository-owned configuration, queries, schemas, adaptation, validation, failure handling, or observable outcomes.
- [ ] Check whether end-to-end tests cross the production-shaped boundaries relevant to the risk and prove the terminal durable or user-visible outcome, not only an intermediate status, page, or mock call.
- [ ] Find critical journeys with no end-to-end proof and expensive end-to-end tests whose behavior is already covered more reliably at a lower level.
- [ ] Inspect error, retry, timeout, authorization, concurrency, migration, compatibility, and recovery behavior where those failures are plausible and costly.
- [ ] Use coverage data to locate unexecuted critical paths, then inspect behavior and assertions before reporting a gap.
- [ ] Classify every material gap and in-scope affected test as `KEEP`, `ADD`, `UPDATE`, `MERGE`, `DELETE`, or `NO_TEST`, justified by impact, plausible failure, uniqueness, trust, and maintenance cost; use `UPDATE` when valuable intent remains but its basis, setup, boundary, assertion, or oracle must change.

### 3. Audit Isolation and Determinism

- [ ] Check shared database, filesystem, environment, process, network, cache, clock, random generator, and global state for leakage between tests.
- [ ] Check setup and teardown on success and failure, unique test data, transaction boundaries, cleanup, and parallel-safe resource ownership.
- [ ] Diagnose suspected flakes with the smallest discriminating matrix available: run alone, in-suite, repeated with a fixed seed, shuffled/reversed, and parallel; preserve the first failing order, seed, worker, and environment.
- [ ] Detect time, timezone, locale, randomness, sleep, scheduler, and race sensitivity; require controllable clocks or seeds where behavior depends on them.
- [ ] For real dependencies and emulators, verify version pinning, readiness, namespace/state reset, failure cleanup, credentials, and CI availability instead of assuming either real or mocked is preferable.
- [ ] Review retries and quarantine rules so they preserve the first failure and reproducibility data rather than converting an initial failure into a silent pass.
- [ ] Require every quarantine to remain visible outside the passing result, with an owner or decision path and a concrete recovery, replacement, or retirement trigger; quarantine is an execution state, not a portfolio action.
- [ ] Distinguish test flakiness from real intermittent product defects using repeated evidence, logs, and the failing path.

### 4. Audit Structure, Maintenance, and Oracles

- [ ] Check whether test layout follows source domains or a clear type-based convention and whether contributors can locate the owning tests.
- [ ] Find orphan tests, disabled suites, duplicate fixtures, fragmented scenario coverage, oversized files, and flat directories that obscure ownership.
- [ ] Identify temporary characterization, migration, compatibility, incident, workaround, and regression tests whose original trigger has ended; require current unique risk evidence or a safe merge or deletion path.
- [ ] Check test names and arrangement for behavioral intent, prerequisites, action, and expected outcome rather than implementation narration.
- [ ] For UI and interaction tests, reject locators coupled to visible or translated copy, styling, layout, position, or incidental structure; require stable repository-owned IDs or dedicated test hooks and keep explicit copy assertions separate from element discovery.
- [ ] Inspect assertions for specificity, negative proof, state and interaction balance, useful failure messages, and resistance to false positives.
- [ ] Flag assertion-free tests, weak truthiness checks, snapshot-only proof, broad exception acceptance, and mocks that bypass the behavior under test.
- [ ] Check that expected values come from an independent contract, example, invariant, or golden artifact rather than reproducing the implementation's calculation inside the test.
- [ ] Check mocks, fakes, emulators, and generated clients for contract drift; require a contract test or another credible comparison with the real boundary where drift could create false confidence.
- [ ] Exercise non-default configuration values where a passing test with defaults could conceal hard-coded ports, limits, timeouts, paths, or feature behavior.
- [ ] Use existing mutation results or a safe targeted counterfactual for critical weak-oracle candidates; do not mandate repository-wide mutation testing.
- [ ] Review manual tests for reproducible setup, fail-fast behavior, explicit expected evidence, idempotency, cleanup, portability, and operator documentation.
- [ ] Check fixture and helper abstraction for readability and honest defaults; hidden behavior in builders must not make important test conditions invisible.
- [ ] Review gate placement and suite cost: required gates protect material release risk, while slower diagnostic or exploratory evidence remains discoverable without blocking routine delivery unnecessarily.

### 5. Validate Findings and Report

- [ ] Research runner or framework semantics only when lifecycle, fixture, isolation, retry, or mocking behavior can change a finding; use official version-matched sources.
- [ ] Reproduce high-severity trust failures where safe, preserving command, seed, order, and environment evidence.
- [ ] Deduplicate findings that share one root cause, such as a global fixture causing multiple flaky suites.
- [ ] Apply a materiality and acceptable-alternative gate to every candidate. Require a concrete critical behavior left unproven, false confidence, delivery risk, or recurring maintenance cost at the suite's evidenced scale. Reject nitpicks, test-style taste, theoretical purity, coverage vanity, generic best practice, and a different but equally trustworthy test design; when several test shapes work, require the risk coverage and oracle rather than one preferred implementation.
- [ ] Put a directly relevant Markdown practice link in every finding's required resolution: prefer current official documentation or a specification, and use reputable primary engineering material only when official sources do not resolve the tradeoff. Open and verify the source; it must support the proposed test mechanism, not merely the defect category. Reject search-result links, generic best-practice articles, and decorative citations.
- [ ] Classify findings as `P0`-`P3` based on critical behavior left unproven, false confidence, delivery blockage, and maintenance drag.
- [ ] Include affected behavior, test location, evidence, missed defect class, portfolio action, why the current compromise is not acceptable, and the smallest credible remediation while allowing equivalent solutions.
- [ ] Report decision-useful portfolio signals when evidence exists: material risks by proof state, action distribution, required-gate results and duration, skips, retries, quarantine, and orphan or obsolete candidates. Reject total test count, pass rate without exclusions, raw coverage, and level ratios as standalone quality targets.
- [ ] Use `BLOCKED` when a required critical suite, environment, or oracle cannot be accessed and no credible static or historical fallback exists; use `FAIL` when evidence shows critical behavior is unproven, a required gate fails, or false confidence remains in an untrustworthy critical surface; use `CONCERNS` only for non-blocking portfolio or maintenance risk, and `PASS` only when required evidence is trustworthy and no critical gap remains.
- [ ] Return the verdict with trusted coverage, critical gaps, untrustworthy surfaces, portfolio actions, limitations, and residual test risk.

## Output Contract

```markdown
# Test Suite Audit

**Verdict:** PASS | CONCERNS | FAIL | BLOCKED

## Portfolio map and baseline
- Runners, suites, and test types
- Commands and environments executed
- Coverage, flake, and mutation evidence available

## Confidence summary
| Area | Status | Evidence |
|---|---|---|
| Critical behavior coverage | PASS / CONCERNS / FAIL | ... |
| Isolation and determinism | PASS / CONCERNS / FAIL | ... |
| Structure and maintenance | PASS / CONCERNS / FAIL | ... |
| Assertion and oracle strength | PASS / CONCERNS / FAIL | ... |
| Lifecycle and portfolio control | PASS / CONCERNS / FAIL | traceability, gates, quarantine, retirement triggers, and net portfolio effect |

## Portfolio decisions
| Test basis or protected risk | Existing evidence or affected test | Action | Gate and result | Replacement evidence or review trigger |
|---|---|---|---|---|
| ... | path / command / NONE | KEEP / ADD / UPDATE / MERGE / DELETE / NO_TEST | required / diagnostic; PASS / FAIL / BLOCKED / UNPROVEN / QUARANTINED | ... |

## Findings and portfolio actions
| Priority | Problem | Evidence and justification | Required resolution |
|---|---|---|---|
| P0 / P1 / P2 / P3 | Concrete confidence or maintenance defect | Test basis, behavior and test location, evidence, missed defect class, material risk, and why the current tradeoff is not acceptable | `KEEP` / `ADD` / `UPDATE` / `MERGE` / `DELETE` / `NO_TEST`, replacement evidence or accepted risk, the smallest sufficient correction, and a verified `[practice reference](URL)` to official or primary engineering guidance; allow equivalent test designs with the same risk coverage and oracle strength |

Use `None` when no candidate survives the evidence, materiality, portfolio-value, and acceptable-alternative gates.

## Portfolio control
Net additions, updates, merges, and deletions; `NO_TEST` decisions; required versus diagnostic gates; skips, retries, quarantine, and review or retirement triggers. Use only evidenced signals that can change a decision.

## Residual risks
Unexecuted suites, unavailable environments, accepted `NO_TEST` exposure, and behavior that remains unproven.
```

---
name: ln-12-delivery-reviewer
description: "Reviews a completed scoped change and its affected runtime and contract paths. Use to find change-caused defects and verify readiness; not for codebase audit, implementation, or repair."
---

# Delivery Reviewer

**Goal:** Review only the requested delivery change and the causal runtime, contract, and data paths needed to prove its business outcome. Judge whether that scope meets acceptance and is safe to release; do not audit unrelated code, repair findings, update trackers, or widen scope.

**Execution contract:** Treat the ordered checkbox workflow below as this skill's Definition of Done. Work through every item in order, and mark it complete only when its action and required evidence are complete. `N/A`, skipped, unavailable, or delegated items remain incomplete.
Before returning, apply this skill's verdict, decision, and approval rules to every incomplete item and prepend **Checklist: X/Y complete**<br>**Incomplete: None | section/item — reason; outcome impact; exact next action**; list every incomplete item.

## Tool Routing

| Need | Preferred tool | Use it when | Fallback |
|---|---|---|---|
| Business scope, requirements, and repository rules | Native file read plus Git | Always establish the business outcome, acceptance boundary, non-goals, branch, comparison base, and working-tree state | User-provided requirements plus explicit limitations |
| Changed behavior | `git diff`, `git status`, and focused file reads | Establishing the exact implementation delta and affected entrypoints | Compare the supplied implementation against its stated baseline |
| Definitions, callers, consumers, and contracts | Language server or host-native code intelligence | Correctness of an affected path depends on unchanged symbols, routes, events, or public surfaces | Targeted search and direct inspection that stops when the affected causal path is proven |
| Build and automated verification | Repository-defined shell commands | The repository exposes build, lint, type, test, migration, or smoke commands | Inspect CI and scripts; mark execution as unverified |
| User-visible behavior | Browser, application client, API client, or runtime logs | Acceptance depends on rendered UI, interaction, protocol response, or observable runtime behavior | Static trace plus an explicit manual-verification requirement |
| External contracts and standards | Official vendor documentation, specifications, advisories, and release notes | A current external fact can change severity or correctness | Web research from primary sources; otherwise mark `UNVERIFIED` |
| Independent review | Native subagents with separate contexts | Every code-bearing review; assign one evidence lens per subagent and run independent passes in parallel | Return `BLOCKED` when required independent coverage has no credible replacement; never claim the panel ran |

The delivery gate is intentionally stricter than plan review: independent code-review coverage cannot be simulated by self-review because acceptance depends on genuinely separate evidence passes.

Use tools to answer specific evidence questions. A failed tool is a limitation, not a product defect. Never convert an unavailable build, advisor, browser, or documentation source into a failing finding without implementation evidence.

## Evidence Rules

| Evidence | Weight |
|---|---|
| Reproduced behavior, failing test, compiler output, or deterministic command | Strongest evidence of current behavior |
| Changed code plus verified caller, consumer, schema, or configuration path | Strong static evidence |
| Acceptance criterion mapped to an implementation and verification result | Required delivery evidence |
| Official external contract matching the used version | Strong evidence for standards and compatibility |
| Pattern match, reviewer intuition, or generic best practice | Lead only until connected to a concrete failure or risk |

A finding must name the affected business behavior, its causal link to the change, evidence, impact, and smallest credible correction. Do not report style preferences or unrelated repository health concerns.

The review unit is the business change, not the repository. Reading unchanged code is permitted only to prove an affected path and never brings unrelated defects into scope. Verify every accepted claim against the implementation, executable behavior, or an authoritative contract.

## Independent Review Panel

Use a Six Thinking Hats-inspired protocol to create genuinely different review questions. This is a code-review adaptation: hats are temporary evidence lenses, not personalities. The lead reviewer holds the Blue role by scoping the review, selecting agents, verifying their claims, resolving conflicts, and issuing the verdict.

### Agent Count and Hats

Scale the panel to the risk and size of the change. For a small, low-risk change that activates no specialist risk trigger, spawn White and Black; add another canonical hat only when it can change the verdict. For ordinary medium-risk work, run White and Black plus one to three canonical or specialist hats selected by distinct evidence questions. Run all five canonical non-Blue hats for high-risk, architectural, cross-service, unfamiliar, or materially ambiguous work. Add up to four specialist hats only when changed code activates their risk triggers. The result is two to nine subagents plus the Blue lead.

| Required hat | Independent review question |
|---|---|
| White — facts | What business behavior changed, what was required, which causal paths are affected, and what scoped evidence is missing or inconsistent? |
| Red — human response | Within the changed experience, what will surprise, confuse, frustrate, or mislead a user, developer, reviewer, or operator? Treat intuition as a hypothesis until reproduced or traced. |
| Black — caution | How can the changed behavior regress, corrupt state, violate a trust boundary, or fail at edges and under partial failure? |
| Yellow — value | What intended value, compatibility, and sound tradeoffs of this change must be preserved, and which apparent problems are false positives or overcorrections? |
| Green — alternatives | Is there a materially simpler, safer, more maintainable, or more testable implementation of the scoped change that avoids demonstrated risk without widening scope? |

| Optional specialist hat | Add when the diff includes | Focus |
|---|---|---|
| Security and privacy | Authentication, authorization, untrusted input, secrets, sensitive data, isolation, or destructive actions | Trace trust boundaries and sensitive-data flow; require concrete guards and recovery evidence for destructive behavior. |
| Data and concurrency | Schemas, migrations, transactions, caches, queues, events, shared state, async work, locks, or ordering | Check atomicity, races, duplicate delivery, producer/consumer names and payloads, runtime registration, and orphan channels. |
| API and compatibility | Public interfaces, protocols, serialization, configuration contracts, SDKs, plugins, or mixed versions | Trace every consumer and confirm that removed signatures, aliases, re-exports, adapters, and compatibility paths match the supported contract. |
| Target architecture and migration | An approved plan or target architecture, replacement, refactor, cutover, deprecation, or compatibility cleanup | Map planned decisions to code; prove the target state is complete; find unexplained deviations, dual paths, old implementations, aliases, shims, re-exports, adapters, flags, and unmigrated callers that preserve superseded architecture. |
| Test, oracle, and business behavior | Critical behavior with weak proof, complex regressions, changed test infrastructure, mocks, snapshots, time, or randomness | Map critical requirements and business invariants to observable outcomes. Treat tests as low-value only when they add no repository-owned confidence; crossing a real dependency is valid when it proves owned boundary behavior. Select E2E, integration, contract, or unit coverage at the narrowest deterministic risk seam. |
| Performance and reliability | Hot paths, I/O, resource ownership, retries, timeouts, load, availability, or distributed coordination | Look for unbounded work, amplification, measurement gaps, resource leaks, retry storms, and unsafe degradation. |
| UI and accessibility | Rendering, interaction, keyboard or screen-reader behavior, responsive layouts, localization, or visual state | Verify keyboard flow, focus behavior, accessible names, reduced-motion preferences, meaningful copy, localization, and rendered behavior. |
| Operations and release | Deployment order, feature controls, environment changes, observability, rollback, recovery, or support procedures | Prove safe rollout and rollback, configuration validation, useful signals, and recovery steps in the intended environment. |

Choose at most four specialists by highest plausible impact, likelihood, and rollback difficulty. Prefer trust-boundary, data-loss, public-contract, and concurrency risks. Do not add two agents with substantially the same evidence question. Record why each specialist was selected or why a triggered perspective was merged into another hat.

### Independence and Prompt Contract

- Give every subagent the same frozen base packet: business change thesis, acceptance criteria, comparison base and head, scope map with changed, causally supporting, and excluded surfaces, non-goals, approved approach, repository instructions, risk classification, and allowed commands.
- Give each subagent exactly one primary hat, its risk questions, the read-only and scope boundaries, and the result schema below. Require a change-causal scope link for every candidate; do not include the lead's provisional findings or any sibling result.
- Allow read, search, diff, language intelligence, official-document research, and non-mutating verification. Forbid tracked-file edits, commits, pushes, deployments, tracker updates, external-state changes, and nested subagents.
- Launch all selected hats in parallel. If concurrency is limited, use waves but keep later prompts blind to earlier results. Wait for every selected hat before synthesis.
- Retry a failed critical hat once only when the retry changes a concrete cause such as missing scope, transient execution, or unavailable input. Treat remaining failures as coverage limitations, never product findings.
- Do not run a debate round by default. If material claims conflict, the Blue lead resolves them with direct evidence or one bounded verification pass focused only on the disputed claim.

Each subagent returns a compact report:

```markdown
**Hat:** name
**Coverage:** paths, symbols, scenarios, and commands inspected

## Candidate findings
- Priority candidate; location; scope link to the change; evidence; causal path and violated contract; impact; confidence; smallest credible correction

## Rejected hypotheses
- Suspected issue and evidence that ruled it out

## Open questions and limitations
- Missing evidence and the exact check needed
```

`No findings` is a valid result. A hat must not manufacture comments to justify its existence.

## Checklist

### 1. Establish the Business and Change Scope

- [ ] Before reviewing code, state the business change thesis: affected actors, problem, intended observable outcome, changed behavior, acceptance criteria, invariants, explicit non-goals, and release boundary; mark unsupported assumptions `UNKNOWN` and use `BLOCKED` when the thesis cannot be established reliably.
- [ ] Read applicable repository instructions and inspect uncommitted work, then resolve the exact comparison base and head, implementation delta, approved plan or target architecture, and allowed transitional compatibility before running verification commands.
- [ ] Build a scope map of changed surfaces, causally affected supporting surfaces, and explicitly excluded surfaces. Read outside the diff only to trace an affected runtime or contract path; do not search unrelated code for possible findings.
- [ ] Classify only change-triggered risk based on trust boundaries, money, destructive actions, data migration, public contracts, concurrency, distributed coordination, and rollback difficulty.
- [ ] Define the evidence required for each acceptance criterion before reading implementation details: behavior, commands, tests, documentation, and operational proof.
- [ ] Freeze the business thesis and scope map in the common subagent packet; select hats only for risks activated by the change and do not expose preliminary conclusions.
- [ ] Keep the review read-only. Allow only host-permitted caches or build artifacts; do not edit tracked files, change status, create tasks, commit, push, or deploy.

### 2. Trace Requirements into the Implementation

- [ ] Map every acceptance criterion to concrete changed code, configuration, data, documentation, and a verification method; mark each `PASS`, `FAIL`, or `UNPROVEN`.
- [ ] Inspect changed files plus only the unchanged definitions, callers, consumers, interfaces, tests, migrations, and runtime registration needed to prove an affected path; reading a supporting surface does not make it finding scope.
- [ ] Verify that the implemented behavior serves the real user or system goal rather than only completing an internal mechanism.
- [ ] Map every material decision and step in an approved plan or target architecture to the implementation; treat omissions as unmet unless explicitly superseded, and accept deviations only when their rationale is evidenced and preserves the goal, constraints, and acceptance criteria.
- [ ] Trace each critical scenario through actor trigger -> entrypoint -> runtime discovery or wiring -> usage context -> observable outcome.
- [ ] Confirm that new components, routes, commands, handlers, jobs, events, or configuration are actually registered and discoverable at runtime.
- [ ] Within changed behavior, check applicable algorithm boundaries, loops, collection semantics, state transitions, duplicate handling, ordering, numeric behavior, and empty or maximum inputs.
- [ ] Check error propagation, partial failure, retries, idempotency, cancellation, timeouts, rollback, and cleanup in every changed side-effect path.
- [ ] Within affected asynchronous paths, check applicable concurrency, shared state, transaction boundaries, race windows, lock ordering, and blocking work.

### 3. Review Safety, Contracts, and Maintainability

- [ ] Within affected paths only, check applicable authentication, authorization, tenant or ownership boundaries, validation, injection, secrets, sensitive data, logging, and destructive-operation guards.
- [ ] When the change introduces or modifies destructive behavior, require evidence for recovery, rollback, blast radius, environment or authorization guards, and preview or dry-run; justify infeasible items and compensating controls.
- [ ] Check public API, event, schema, configuration, serialization, and storage compatibility for changed producers and consumers; match event names, payloads, registration, ordering, and both ends of every changed channel.
- [ ] Verify migrations, backfills, defaults, indexes, deployment ordering, and mixed-version behavior when persisted or distributed state changes.
- [ ] Check resource ownership for files, streams, sessions, connections, processes, subscriptions, and temporary artifacts created, consumed, or transferred by affected paths on success and failure.
- [ ] Check only dependency direction, module boundaries, orchestration, and side-effect ownership crossed or modified by the change; do not turn adjacent architecture into a repository audit.
- [ ] When code is replaced, verify that the old implementation, signatures, aliases, re-exports, shims, adapters, flags, dual-read or dual-write paths, and files are removed and every caller is migrated; retain compatibility only when an evidenced supported contract requires it, with ownership and a bounded removal condition.
- [ ] Check whether changed code introduces duplication, hardcoded operational values, misleading names, or unnecessary abstractions; do not inventory pre-existing instances elsewhere.
- [ ] Challenge only custom machinery introduced or expanded by the change when an existing platform or declared dependency provides the required capability with lower risk.
- [ ] Research only external claims that affect the scoped verdict, using official sources matching the installed or proposed version.

### 4. Verify Tests, Documentation, and Operations

- [ ] Treat a test as low-value only when its oracle adds no repository-owned confidence; do not reject it merely for crossing a language, framework, library, or database boundary. Real-database tests are valid when they prove product-owned queries, schemas, permissions, migrations, transactions, isolation, locking, serialization, or failure handling rather than generic vendor capability.
- [ ] Choose the narrowest test level that crosses the changed risk seam with a trustworthy oracle: prefer reproducible E2E for business-critical journeys, integration or contract tests for owned boundaries, and unit tests for isolated logic or state transitions when a broader test would add less confidence or determinism.
- [ ] Classify every affected test as `KEEP`, `ADD`, `UPDATE`, `DELETE`, or `MERGE`; verify that it would fail for its intended defect and inspect assertions, critical success and failure paths, authorization, boundaries, data integrity, over-mocking, snapshots, flakes, shared state, time, randomness, and order dependence. Recommend `DELETE` only when equal or better trusted coverage preserves its failure modes; recommend `MERGE` only when consolidation removes duplication without obscuring behavior, oracle strength, or failure localization.
- [ ] Discover verification commands in this order: repository docs, tool configuration, package or build manifests, then justified fallback; run the narrowest relevant checks first and record each command's source.
- [ ] Run required build, lint, type, test, migration, and smoke gates with CI-safe options, then attribute failures to the change or baseline instead of treating every repository failure as an in-scope defect.
- [ ] Preserve command, exit status, relevant output, and limitations; a pre-existing failure is a verification limitation unless evidence connects it causally to the change.
- [ ] Verify user-visible behavior with the appropriate runtime or browser tool when acceptance cannot be proven statically; for UI changes exercise keyboard and focus flow, accessible names, reduced motion, responsive states, copy, and localization when applicable.
- [ ] Confirm that affected documentation, API and configuration references, examples, migrations, runbooks, operator steps, and code comments are current, mutually consistent, and non-contradictory with implementation and requirements; comments must explain enduring intent or constraints rather than restate code.
- [ ] Check logs, metrics, traces, health signals, feature controls, deployment order, rollback, and recovery where the change creates operational risk.
- [ ] Distinguish a missing verification environment from a product failure; use `UNPROVEN` and explain the exact evidence still required.

### 5. Challenge and Synthesize

- [ ] Launch each selected hat in a separate context with the common base packet, one primary perspective, read-only tools, and the required result schema.
- [ ] Keep hats blind to one another, run independent work in parallel or blind waves, wait for all results, and record failures or retries.
- [ ] Verify every candidate finding against code, commands, behavior, or authoritative documentation before accepting it; trace symptom -> causal path -> violated contract, inspect only affected sibling paths that share the changed contract, and reject symptom-only corrections.
- [ ] Accept a finding only when evidence shows it was introduced by the diff, made reachable or materially worse by the diff, violates an acceptance criterion on an affected path, or is a required-gate failure caused by the change. Treat every other pre-existing or out-of-scope issue only as a verification limitation when it blocks acceptance; never recommend its repair.
- [ ] Deduplicate overlapping findings and preserve the strongest evidence and widest demonstrated impact.
- [ ] Resolve contradictory claims by tracing the disputed behavior; use a bounded verifier only when direct inspection cannot settle it.
- [ ] Classify findings as `P0` through `P3`: immediate catastrophic risk, release blocker, important non-blocking defect, or minor actionable issue.
- [ ] Use `FAIL` for any evidenced unresolved `P0` or `P1`, unmet acceptance criterion, required failing gate, or demonstrated unsafe high-risk behavior.
- [ ] Use `CONCERNS` only when remaining issues are explicitly non-blocking and the accepted risk is stated. Use `PASS` only when required evidence is complete.
- [ ] Use `BLOCKED` when a required hat, risk-triggered specialist, safety environment, authoritative contract, or other acceptance prerequisite is unavailable without an equivalent credible replacement; report the gap as coverage, not a product defect.
- [ ] Return hat selection and coverage, the acceptance matrix, test actions, verified findings, commands and tools used, limitations, verdict rationale, and residual risks without modifying the delivery.

## Output Contract

```markdown
# Delivery Review

**Verdict:** PASS | CONCERNS | FAIL | BLOCKED

## Scope and evidence
- Business change thesis, non-goals, and acceptance criteria
- Comparison base, head, and exact implementation delta
- Scope map: changed, causally supporting, and explicitly excluded surfaces
- Commands, discovery sources, and runtime checks executed
- External sources and limitations

## Acceptance matrix
| Requirement | Evidence | Verification | Result |
|---|---|---|---|
| ... | ... | ... | PASS / FAIL / UNPROVEN |

## Independent review panel
| Hat | Why selected | Coverage | Result |
|---|---|---|---|
| White / Red / Black / Yellow / Green / specialist | required or triggered risk | inspected surfaces and checks | findings / no findings / failed |

## Findings
### [P0 | P1 | P2 | P3] Finding title
- Location and scope link: file, symbol, route, schema, or runtime surface; changed behavior, affected path, or acceptance criterion
- Evidence: observed behavior, command, code path, or authoritative contract
- Root cause: causal path and violated requirement, invariant, or contract
- Impact: concrete delivery or operational consequence
- Required change: `KEEP` / `ADD` / `UPDATE` / `DELETE` / `MERGE` when a test is affected, plus the smallest sufficient correction

## Verification and test-action summary
Passed, failed, skipped, and unavailable checks with reasons; list every affected test with its `KEEP`, `ADD`, `UPDATE`, `DELETE`, or `MERGE` action.

## Residual risks
Accepted tradeoffs and unavailable evidence within the scoped change; do not include unrelated repository health observations.
```

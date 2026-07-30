---
name: ln-12-delivery-reviewer
description: "Reviews a completed scoped change and its affected runtime and contract paths. Use to find change-caused defects and verify readiness; not for codebase audit, implementation, or repair."
---

# Delivery Reviewer

**Goal:** Review only the requested delivery change and the causal paths needed to prove its business outcome. Judge scoped acceptance and release safety with concise evidence; do not audit unrelated code, repair findings, update trackers, or widen scope.

**Execution contract:** Treat the ordered checkbox workflow below as this skill's Definition of Done. Work through every item in order, and mark it complete only when its action and required evidence are complete. `N/A`, skipped, unavailable, or delegated items remain incomplete.
Before returning, apply this skill's verdict, decision, and approval rules to every incomplete item and prepend **Checklist: X/Y complete**<br>**Incomplete: None | section/item — reason; outcome impact; exact next action**; list every incomplete item.

## Tool Routing

| Need | Preferred capability | Use when | Fallback |
|---|---|---|---|
| Scope and repository state | Native file reads plus Git | Establishing outcome, non-goals, base, head, and worktree | Supplied requirements with explicit limitations |
| Changed behavior | Diff, status, and focused reads | Resolving the implementation delta and entrypoints | Compare supplied artifacts with their stated baseline |
| Definitions and consumers | Code intelligence | An affected path depends on unchanged symbols or contracts | Targeted search that stops when the causal path is proven |
| Automated verification | Repository-defined commands | Build, lint, type, test, migration, or smoke gates exist | Inspect scripts and CI; mark execution `UNPROVEN` |
| Observable behavior | Browser, client, or runtime evidence | Acceptance depends on UI, interaction, protocol, or logs | Static trace plus an exact manual check |
| External contracts | Current official documentation or specifications | A changing external fact can alter correctness or severity | Primary-source research; otherwise mark `UNVERIFIED` |
| Independent review | Native subagents in separate contexts | Every code-bearing review | Run blind waves within host limits; return `BLOCKED` if independence remains impossible |

Use tools only for the current evidence question. Tool failure is a limitation, not a defect. Do not convert an unavailable command, runtime, or source into a finding without implementation evidence.

## Evidence Rules

| Evidence | Weight |
|---|---|
| Reproduced behavior, failing test, compiler output, or deterministic command | Strongest current-behavior evidence |
| Changed code plus verified caller, consumer, schema, or configuration path | Strong static evidence |
| Acceptance criterion mapped to implementation and verification | Required delivery evidence |
| Official external contract matching the used version | Strong compatibility evidence |
| Pattern, intuition, or generic practice | Lead only until tied to a concrete failure or risk |

Every finding must name the affected business behavior, change-causal path, violated contract, evidence, impact, and smallest credible correction. The review unit is the business change, not the repository. Read unchanged code only to prove an affected path; do not report style preferences or unrelated repository health.

## Independent Review Panel

Use Six Thinking Hats as evidence lenses, not personalities. The Blue lead scopes the review, selects agents, verifies claims, resolves conflicts, and issues the verdict.

Always spawn White, Black, and Green for code-bearing review. Stop there for small low-risk work; add one or two distinct hats for medium risk; run all five non-Blue hats for high-risk, architectural, cross-service, unfamiliar, or ambiguous work. Add up to four specialists only for risks activated by the change: three to nine subagents plus the Blue lead.
For non-code delivery, select only lenses triggered by its risks; when none apply, record `Independent review panel: None`.

| Hat | Question |
|---|---|
| White — facts | What changed, which outcome and paths are affected, and what scoped evidence is missing? |
| Red — human response | What will surprise or mislead a user, developer, reviewer, or operator? Treat intuition as a hypothesis. |
| Black — caution | How can the change regress, corrupt state, breach trust, or fail at edges and partial failure? |
| Yellow — value | Which intended value, compatibility, and sound tradeoffs must be preserved; which concerns are false positives? |
| Green — surgical simplicity | AI slop is prohibited. Is this the smallest sufficient diff and simplest efficient algorithm for the evidenced need without sacrificing safety, clarity, testability, or operability? |

| Specialist | Trigger | Focus |
|---|---|---|
| Security and privacy | Trust boundaries, untrusted input, secrets, sensitive data, destructive action | Guards, isolation, recovery, and sensitive-data flow |
| Data and concurrency | Schemas, transactions, queues, caches, events, async work, locks | Atomicity, races, ordering, duplicates, wiring, and orphan channels |
| API and compatibility | Public interfaces, protocols, serialization, configuration, mixed versions | Producers, consumers, removals, and supported compatibility |
| Architecture and migration | Approved design, replacement, refactor, cutover, or deprecation | Plan traceability, target completeness, old paths, and unmigrated callers |
| Tests and oracles | Critical behavior, weak proof, mocks, snapshots, time, randomness | Business invariants, trustworthy oracles, and the narrowest useful test seam |
| Performance and reliability | Hot paths, I/O, retries, timeouts, load, resource ownership | Amplification, measurement, leaks, storms, and degradation |
| UI and accessibility | Rendering, interaction, responsive state, localization | Keyboard, focus, names, motion, copy, and rendered behavior |
| Operations and release | Deployment, configuration, observability, rollback, recovery | Safe rollout, useful signals, and recovery steps |

Choose specialists by impact, likelihood, and rollback difficulty; avoid duplicate questions and record selection or merge reasons.

Give each subagent the same frozen packet: business thesis, acceptance criteria, maturity evidence, base and head, changed/supporting/excluded scope, non-goals, approved approach, repository instructions, risk class, and allowed commands. Add exactly one lens, read-only and scope boundaries, and the result schema. Do not include provisional or sibling findings.

Run agents in parallel or blind waves. Allow read, search, code intelligence, official-source research, and non-mutating verification; forbid tracked edits, commits, pushes, deployments, external writes, and nested subagents. Retry a failed critical lens once only when a concrete cause changes. Wait for all selected lenses; resolve material conflicts through direct evidence or one bounded verifier.

Each subagent returns coverage, candidate findings with change-causal evidence and smallest correction, rejected hypotheses that resolve material ambiguity, and open questions. `No findings` is valid; never manufacture comments to justify a lens.

## Checklist

### 1. Establish Business and Change Scope

- [ ] Before reading implementation detail, state the affected actors, problem, protected outcome, changed behavior, acceptance criteria, invariants, non-goals, and release boundary. Mark unsupported interpretations `UNKNOWN`; use `BLOCKED` when the thesis cannot be established.
- [ ] Establish complexity fit from evidenced maturity, business horizon, scale, team capacity, and lifecycle cost; do not infer enterprise needs from hypothetical growth or call safety-required complexity overengineering.
- [ ] Read applicable repository instructions, inspect uncommitted work, and resolve base, head, implementation delta, approved plan or target architecture, and permitted transitional compatibility.
- [ ] Discover only change-relevant baseline, current-state, target-design, decision, diagram, and migration artifacts by repository convention; record status and freshness without requiring a particular path.
- [ ] Map changed, causally supporting, and explicitly excluded surfaces. Read outside the diff only to trace affected behavior; do not hunt unrelated code for findings.
- [ ] Classify change-triggered risk from trust, money, destructive action, migration, public contracts, concurrency, distributed coordination, and rollback difficulty; define acceptance evidence before implementation review.
- [ ] For code-bearing review, freeze the thesis and scope, select White, Black, and Green plus only risk-triggered hats, and keep preliminary conclusions private. For non-code delivery, select only triggered lenses or record the panel as `None`.
- [ ] Keep the review read-only. Permit only host-approved caches or build artifacts; do not edit tracked files, create tasks, commit, push, deploy, or repair findings.

### 2. Trace Requirements into Implementation

- [ ] Map every acceptance criterion to changed code, configuration, data, documentation, and verification; mark it `PASS`, `FAIL`, or `UNPROVEN`.
- [ ] Inspect changed files and only the unchanged definitions, consumers, interfaces, tests, migrations, and registration needed to prove an affected path.
- [ ] Verify the change serves the protected outcome, including first meaningful use, material failure, recovery, and repetition where relevant.
- [ ] Trace approved plan, architecture, decision, migration, and baseline constraints into the implementation. Treat unexplained omissions as unmet, distinguish drift from stale or proposed documentation, and accept deviations only when evidence preserves the goal.
- [ ] Trace each critical scenario from actor trigger through entrypoint, runtime wiring, usage context, and observable outcome.
- [ ] Confirm new components, routes, commands, handlers, jobs, events, and configuration are registered and discoverable at runtime.
- [ ] Within affected behavior, inspect applicable boundaries, collections, state transitions, duplicates, ordering, numeric behavior, empty and maximum inputs, errors, retries, idempotency, cancellation, timeouts, rollback, and cleanup.
- [ ] Within affected async paths, inspect shared state, transactions, races, lock ordering, and blocking work.

### 3. Review Safety, Contracts, and Simplicity

- [ ] Within affected paths, inspect applicable authentication, authorization, ownership, validation, injection, secrets, sensitive data, logging, and destructive-operation guards.
- [ ] For changed destructive behavior, require recovery, rollback, blast-radius, environment or authorization, and preview or dry-run evidence; justify infeasible controls.
- [ ] Verify changed API, event, schema, configuration, serialization, and storage producers and consumers, including names, payloads, registration, ordering, and compatibility.
- [ ] Verify migrations, backfills, defaults, indexes, deployment ordering, and mixed-version behavior when persisted or distributed state changes.
- [ ] Check ownership and cleanup of files, streams, sessions, connections, processes, subscriptions, and temporary artifacts on success and failure.
- [ ] Inspect only architecture boundaries crossed or changed; match complexity to evidenced need without turning adjacent architecture into an audit.
- [ ] When code is replaced, verify old implementations, signatures, aliases, re-exports, shims, adapters, flags, dual paths, and files are removed and callers migrated. Retain compatibility only for a supported contract with an owner and bounded removal condition.
- [ ] Run a subtractive pass for changed logic, constraints, configuration, schemas, routes, states, and operations. Record obsolete candidates, proven removals, and retention evidence; use `one in, two out` only as a prompt, never a deletion quota.
- [ ] **KISS:** AI slop is prohibited. Require the minimum sufficient diff and simplest correct, efficient algorithm. Reject needless duplication, files, layers, abstractions, dependencies, configuration, branches, compatibility paths, or custom machinery when existing mechanisms suffice; never trade away safeguards or maintainability.
- [ ] Derive each correction from scoped repository evidence, preferring an existing mechanism. For external APIs, libraries, security controls, protocols, platforms, standards, or versions, verify the solution in current official version-matched documentation; use primary engineering sources only for unresolved consequential tradeoffs.
- [ ] Record correction sources, dates, verified claims, alternatives, and why the choice is the smallest safe fit. Review never authorizes repair; a later implementer must revalidate unstable external facts.

### 4. Verify Tests, Documentation, and Operations

- [ ] Treat a test as low-value only when its oracle adds no repository-owned confidence. Real-database tests are valid when they prove owned queries, schemas, permissions, migrations, transactions, isolation, locking, serialization, or failure handling—not generic vendor capability.
- [ ] Choose the narrowest level crossing the changed risk seam: reproducible E2E for critical journeys, integration or contract tests for owned boundaries, and unit tests for isolated logic when broader proof adds less confidence.
- [ ] Classify every affected test as `KEEP`, `ADD`, `UPDATE`, `DELETE`, or `MERGE`; verify defect sensitivity, assertions, success and failure paths, authorization, boundaries, data integrity, over-mocking, snapshots, flakes, shared state, time, randomness, and order dependence.
- [ ] Recommend `DELETE` only when the asserted contract is intentionally retired or equal or stronger trusted coverage preserves still-supported failure modes; recommend `MERGE` only when it removes duplication without obscuring behavior, oracle strength, or failure localization.
- [ ] Discover commands from repository docs, tool configuration, and manifests before justified fallback. Run narrow checks first, then required build, lint, type, test, migration, and smoke gates with CI-safe options.
- [ ] Record command source, exit status, relevant output, and limitations. Attribute failures to the change or baseline; a missing environment or pre-existing failure is `UNPROVEN` unless causally linked.
- [ ] Verify user-visible acceptance from the other side when static proof is insufficient, including material failure and recovery; for applicable UI, check keyboard, focus, accessible names, motion, responsive states, copy, and localization.
- [ ] Review only documentation and comments changed by or required for the scoped business change; classify each as `KEEP`, `ADD`, `UPDATE`, `DELETE`, or `MERGE`. Delete or merge only when canonical coverage preserves every needed audience task and contract.
- [ ] Enforce documentation SSOT and hierarchy: update the narrowest canonical owner, link instead of copying rules, avoid a new document when an existing owner fits, and remove superseded references without auditing unrelated documentation.
- [ ] Reject documentation AI slop: filler, repeated summaries, speculation, or implementation and business-logic restatement. Keep concise audience-needed intent, contracts, actions, and constraints; allow only minimal verified code or command examples needed to act.
- [ ] Keep volatile versions, paths, defaults, counts, commands, generated output, and current-state data in authoritative code, configuration, or generated sources where practical. Otherwise require the source, scope, and owner or generation/update trigger.
- [ ] Verify affected API and configuration references, examples, migrations, runbooks, operator steps, and comments against implementation and requirements; comments explain enduring intent or constraints rather than syntax.
- [ ] Check logs, metrics, traces, health signals, feature controls, deployment order, rollback, and recovery where the change creates operational risk.

### 5. Challenge and Synthesize

- [ ] Launch all selected lenses in separate contexts with the frozen packet, one primary question, read-only tools, and the required schema; keep them blind, wait for all, and record failures or retries.
- [ ] Verify each candidate against code, commands, behavior, declared intent, or authoritative documentation; trace symptom to causal path and violated contract, and reject subjective or symptom-only claims.
- [ ] Accept a finding only when the diff introduced, exposed, or worsened it; it violates scoped acceptance; or the change caused a required-gate failure. Treat other issues only as limitations when they block acceptance; never recommend their repair.
- [ ] Deduplicate by root cause, preserve the strongest evidence and widest demonstrated impact, and recommend one smallest sufficient correction.
- [ ] Resolve contradictions by tracing behavior; use one bounded verifier only when direct inspection cannot settle the claim.
- [ ] Classify findings `P0` catastrophic, `P1` release-blocking, `P2` important non-blocking, or `P3` minor actionable.
- [ ] Use `FAIL` for unresolved `P0/P1`, unmet acceptance, a change-caused required-gate failure, or demonstrated unsafe high-risk behavior. Use `CONCERNS` only for explicit non-blocking risk and `PASS` only with complete required evidence.
- [ ] Use `BLOCKED` when a required lens, specialist, safety environment, authoritative contract, or acceptance prerequisite has no credible replacement; report the coverage gap, not a product defect.
- [ ] Return only scope, panel coverage, acceptance evidence, test and documentation actions, findings, commands, limitations, verdict rationale, and residual risk. Omit passed-area narration and repeated context; collapse empty sections to `None`.

## Output Contract

```markdown
# Delivery Review
**Verdict:** PASS | CONCERNS | FAIL | BLOCKED

## Scope and evidence
- Business thesis, acceptance, non-goals, base, head, and exact delta
- Changed, supporting, and excluded surfaces
- Subtraction ledger and relevant architecture-artifact status
- Commands, external sources, and limitations

## Acceptance matrix
| Requirement | Evidence | Verification | Result |
|---|---|---|---|
| ... | ... | ... | PASS / FAIL / UNPROVEN |

## Independent review panel
| Hat | Why selected | Coverage | Result |
|---|---|---|---|
| ... | required or triggered risk | inspected surfaces and checks | findings / none / failed |
Use `None` for a non-code delivery with no triggered lens.

## Findings
### [P0 | P1 | P2 | P3] Finding title
- Location and scope link
- Evidence and causal root
- Violated requirement or contract and impact
- Smallest required correction, removals or retention evidence, existing mechanism, authoritative sources, and rejected alternatives

## Verification, test, and documentation actions
Passed, failed, skipped, and unavailable checks with reasons; list every affected test and documentation surface with its `KEEP`, `ADD`, `UPDATE`, `DELETE`, or `MERGE` action.

## Residual risks
Accepted tradeoffs and unavailable evidence within the scoped change; exclude unrelated repository health.
```

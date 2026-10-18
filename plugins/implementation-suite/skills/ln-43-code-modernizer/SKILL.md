---
name: ln-43-code-modernizer
description: "Modernizes a bounded capability to reduce demonstrated maintenance cost; not routine upgrades or performance tuning."
---

# Code Modernizer

**Goal:** Modernize a bounded capability only when the new design measurably reduces human workflow friction, maintenance, risk, dependency duplication, or delivered artifact cost. Preserve behavior, isolate migrations, and revert changes that do not create net value.

**Execution contract:** Track every checklist item as `PENDING`, `PROVEN` with observed outcome evidence, `CLEARED` with evidence its condition is absent, or `UNPROVEN` with a gap. Reading, delegation, tool failure, zero exit status, and self-reported success are not proof. Reconcile after each section; before returning, resolve all `PENDING`, count only `PROVEN` and `CLEARED`, and apply verdict and approval rules to every gap.
Preserve intent, scope, mode, and existing authorization. Complete authorized work before required external approval; ask only consequential unresolved choices. If nobody can answer, report the exact question and apply the skill's gap verdict without waiting or guessing. Cite any blocking instruction and unresolved boundary; never invent approval gates. Scale depth to material risk; preserve mandatory checks, dependencies, and safety order while choosing verification methods.
Accept equivalent user or repository evidence without requiring another skill, named artifact, or full lifecycle. Preserve source requirement and decision IDs. Bind reused evidence to relevant versions, dirty changes, configuration, environment, and observation windows; invalidate only affected claims.
Choose the primary workflow by outcome and explicit selection. Consume neighboring contracts and valid evidence without duplicating ownership or restarting audits. Split distinct deliverables by scope, not mandatory skill invocation. Broad independent assessments use audit workflows; focused domain reviews remain read-only.
On continuation, reconcile task, authorization, state, and gaps. Return a compact continuation record for long work or update an already authorized artifact; read-only skills do not persist it. Distinguish artifact readiness, verified behavior, and external-action authority.
Trace applicable requirements to their authoritative owner, planned or implemented change, acceptance evidence and status in the existing artifact or response; no new registry is required. Explicit constraints remain binding until an authorized deviation; risk determines priority, not permission to ignore them.
Investigate the causal flow beyond initially named files. Within implementation authority, include structural repair needed for the outcome; minimize total complexity and risk, not changed lines. This does not authorize unrelated cleanup or mutation during review.
Before retrieval, define the evidence question; read selectively without skipping applicable instructions. Use tools for mechanical processing; summarize bounded results, errors, coverage, and source paths, keeping full output outside context.
Before technical decisions, establish applicability and actual versions; verify version-dependent assumptions against official documentation or specifications. Search and read primary pages for current external recommendations; snippets are not evidence. Version-matched bundled documentation or valid prior evidence suffices. Record decision, version, source, and limitations. Mark unavailable evidence UNVERIFIED; block only essential dependent work. Prefer native mechanisms, justify added tools or abstractions with evidence, and reuse the existing rule owner.


## Tool Routing

| Need | Preferred tool | Use it when | Fallback |
|---|---|---|---|
| Current mechanism and consumers | Native file search plus language server or host-native code intelligence | Mapping contracts, callers, configuration, data, lifecycle, and tests | Narrow import, symbol, route, and configuration search with direct reads |
| Existing platform capabilities | Manifests, lockfiles, runtime APIs, and current official documentation | Avoiding new dependencies or custom code for an already available feature | Repository examples and source inspection; mark capability `UNVERIFIED` if current docs are unavailable |
| External replacement candidates | Official package registries, source repositories, documentation, releases, advisories, and license data | Comparing maintained software with custom implementation | Primary-source web research; do not rely on popularity lists alone |
| Baseline and value | Build output, bundle analysis, code inventory, benchmark, defects, or maintenance evidence | Defining what modernization must improve | Reproducible static counts with documented scope and limitations |
| Safe migration | Git isolation, focused edits, native package manager, and repository generation commands | Replacing one bounded capability and its consumers | Stop if user changes or generated state cannot be protected |
| Verification | Repository-defined build, lint, type, test, smoke, packaging, and runtime checks | Before migration and after every retained step | Choose the smallest portfolio action when existing evidence cannot prove a material contract |
| Delivered artifact analysis | Existing bundle analyzer, size report, startup profile, or dependency report | Bundle size, load path, or runtime cost is part of the goal | Build artifact comparison with reproducible file and compression rules |

Do not replace working custom code merely because an external package exists. Do not introduce an unmaintained dependency, accept incompatible licensing, or remove the old path until all consumers and rollback conditions are understood.

## Workflow Boundary

This workflow owns a measured reduction in maintenance cost. Requests primarily establishing container, access, error or recovery guarantees are technical foundation work, even when refactoring is needed. Do not turn a foundation task into a second modernization program or redefine its contract.

Necessary refactoring to complete a feature or fix stays with that outcome; this workflow applies when modernization itself is requested. Neither path requires invoking the other.

## Evidence Rules

- Compare net system complexity: removed code and risk minus new dependency, adapter, operational, and migration costs.
- External candidate claims require current primary evidence for maintenance, security, license, runtime support, and API fit.
- Bundle or performance value requires comparable measurements; line-count reduction alone does not prove a better design.
- Preserve public behavior unless the request explicitly authorizes a contract migration.

## Checklist

### 1. Define the Modernization Target

- [ ] Resolve the bounded capability, protected outcome, current pain, affected users, developers, or operators, success metric, constraints, and explicit non-goals; label unsupported intent inferences.
- [ ] Read repository instructions and inspect Git state, generated files, package-manager policy, and current user changes.
- [ ] Inventory the current implementation, public contracts, consumers, configuration, persisted data, runtime registration, tests, and operational procedures.
- [ ] Identify the specific workflow, maintenance, security, compatibility, duplication, bundle, startup, or delivery cost that must improve.
- [ ] Establish behavioral and relevant quantitative baselines before changing code; for human workflows use reproducible observations such as required steps or concepts, time to first meaningful result, error comprehension, and recovery effort.
- [ ] Isolate the work so each migration step can be reverted without touching unrelated or user-owned changes.
- [ ] **Run-owned resources:** Start a run-owned resource ledger with every created absolute path, worktree, process ID, cache, report, and temporary artifact; never register pre-existing resources as cleanup targets.
- [ ] Use `NO_CHANGE` when evidence shows no worthwhile in-scope modernization; use `BLOCKED` when a plausible requested benefit cannot be evaluated because essential evidence is unavailable.

### 2. Evaluate the Simplest Credible Design

- [ ] Check language, runtime, framework, platform, and already-declared dependency capabilities before searching for a new package.
- [ ] Identify obsolete compatibility paths, parallel mechanisms, unused extension points, duplicated integrations, and transitional adapters that can be removed directly.
- [ ] For external candidates, evaluate functional fit, API stability, maintenance activity, security history, license, ownership, release cadence, size, runtime support, and ecosystem compatibility.
- [ ] Verify candidate claims from official documentation, repository releases, advisories, and package metadata matching the intended version.
- [ ] Inspect migration guides, breaking changes, configuration model, lifecycle, failure behavior, transitive dependencies, and exit strategy.
- [ ] Build a semantic-gap ledger for replacement candidates: input normalization, Unicode/time/date behavior, precision, ordering, errors, cancellation, streaming, concurrency, security limits, and other edge behavior relevant to the current contract.
- [ ] Compare retain, simplify in place, use existing platform capability, adopt external software, and remove capability where each is credible; prefer the shortest safe path that removes toil without hiding truth or control.
- [ ] Estimate workflow steps and concepts removed, time-to-result and recovery delta, code removed, adapters added, dependency and bundle delta, migration effort, operational change, rollback difficulty, and residual lock-in where each is relevant.
- [ ] Select the option with the best evidence-backed value-to-risk ratio, not the newest or most popular option.
- [ ] Mark the chosen option `SELECTED` and every considered but non-chosen option `REJECTED`, recording the evidence or tradeoff that determined each decision.
- [ ] Request user direction when licensing, public contract, persisted-data migration, vendor commitment, or irreversible operational tradeoffs change product intent; applying a migration outside a disposable environment always requires explicit authorization.

### 3. Execute a Bounded Migration

- [ ] **Test value and boundary:** For product tests, require every test to detect a concrete defect in this product's business logic and name the protected business outcome. Prefer E2E through user or external-system boundaries; use integration or unit tests only for business scenarios difficult to exercise reliably through E2E. Reject platform, trivial-wiring, implementation-detail, and duplicate proof with no distinct business failure signal. Engineering checks separately prove declared type, architecture, tooling or delivery constraints; validate their rejection and acceptance behavior without inventing a business-test rationale.
- [ ] Map the current external contract, important failures, and data or configuration compatibility to existing proof; implement `KEEP`, `ADD`, `UPDATE`, `MERGE`, `DELETE`, or justified `NO_TEST` within the approved test scope, remove superseded testware, and give temporary characterization or compatibility evidence a removal trigger.
- [ ] Use differential or characterization cases on shared representative and adversarial inputs; the old implementation is comparison evidence, not the authority for known defects or explicitly changed behavior. Resolve differences against the intended contract.
- [ ] Introduce the replacement at one clear boundary rather than mixing old and new mechanisms throughout the codebase.
- [ ] Use native package-manager and generation commands for dependencies and generated state; do not hand-edit lockfiles or generated artifacts.
- [ ] Update callers, types, configuration, dependency injection, routes, events, serialization, tests, build scripts, and documentation required by the bounded capability.
- [ ] Preserve backward compatibility only where a real consumer requires it and define the removal condition for every temporary adapter.
- [ ] Prepare and test persisted-data or configuration migrations against a disposable copy with explicit ordering, resumability, mixed-version behavior, backup/restore evidence, rollback, and failure recovery; apply them elsewhere only when the user names the target environment and authorizes the rehearsed operation.
- [ ] Before removing a dependency or module reported as unused, check dynamic imports, reflection, plugin/config registration, code generation, build scripts, CLIs, and optional runtime paths that static import scans miss.
- [ ] Remove the old implementation only after search and runtime wiring checks show no remaining consumer.
- [ ] Inspect the diff for unrelated refactoring, formatting churn, duplicate dependencies, debug code, and accidental public contract changes.

### 4. Verify and Keep or Discard

- [ ] Run focused contract and regression tests immediately after each migration step.
- [ ] Run the repository's required build, lint, type, test, smoke, packaging, and application-start checks.
- [ ] Compare the agreed workflow, maintenance, dependency, bundle, startup, performance, or defect metric with the baseline under equivalent conditions.
- [ ] For bundle work, compare real build composition, parsed and compressed size, chunking, loading behavior, and source maps rather than package metadata alone.
- [ ] Evaluate entrypoint and route critical paths separately: total bytes may fall while initial transfer, request waterfalls, decompression, parse/compile, execution, or cache invalidation gets worse.
- [ ] Verify tree-shaking and deduplication claims against the actual bundler graph, module format, exports, side-effect metadata, and target browsers/runtimes before changing imports or package metadata.
- [ ] Check security advisories, licenses, runtime support, package provenance, and new transitive dependencies for the retained design.
- [ ] Exercise rollback or removal mechanics when migration failure would be costly or difficult to detect.
- [ ] Mark the migration `KEEP` only when required behavior and verification pass and the defined net value is achieved.
- [ ] Resolve bounded migration defects and repeat affected checks before the final decision; mark `DISCARD` and revert the bounded change when value remains unproven, regressions remain, or net complexity exceeds the agreed tradeoff.
- [ ] Remove non-retained adapters, instrumentation, feature flags, packages, and generated artifacts only when their ownership is proven; clean only run-owned ledger paths and exact process IDs, preserving dirty or pre-existing worktrees and reported evidence.

### 5. Finalize and Report

- [ ] Verify that no stale implementation, import, registration, configuration, documentation, or dependency remains after a kept migration.
- [ ] Confirm relevant verification covers the final retained state, reusing still-valid results and rerunning checks invalidated by changes or unresolved failures. Compare the final diff with the original modernization scope.
- [ ] Reconcile option and migration ledgers with final code, dependencies, measurements, and rollback state.
- [ ] Identify residual custom code, compatibility adapters, migration steps, operational changes, and external dependency risks.
- [ ] Bind the modernization result to the protected behavior and final implementation state; identify which prior assumptions or verification became stale.
- [ ] Use `DELIVERED` when the selected bounded design is fully retained and verified; use `PARTIAL` when an independently safe subset is retained with explicit remaining work; use `NO_CHANGE` when every migration is discarded and the baseline is restored; use `BLOCKED` when authorization, safety evidence, or required verification is unavailable.

## Self-Check

- [ ] **Reconcile before returning.** Check item-level evidence, requirement coverage, contradictions, scope, verdict, and applicable cleanup. Correct the report or authorized artifacts. Reuse valid evidence; do not automatically rescan the repository or rerun successful commands. Repeat checks only for relevant changes, failures, or unresolved evidence. Disclose remaining gaps.

## Output Contract

Report in the user's language, in this order; label all five fields and state each fact once. Use controlled plain language: one fact per sentence, usually under 20 words, active voice, and one term per concept, with no synonyms for verdicts, IDs, or states. Small results may use one line per field; omit empty tables and do not copy linked artifacts:

1. **Result:** The exact skill-specific verdict token first, then the supported outcome.
2. **Scope:** Reviewed/changed scope, exclusions, baseline, and material assumptions.
3. **Evidence:** Skill-specific fields below; distinguish facts, inferences, and unverified claims. Link artifacts; use tables when useful.
4. **Verification:** Checks/results, unavailable evidence, and applicable cleanup/external state.
5. **Completion:** `Checklist: X/Y complete`; `Incomplete: None` or each `UNPROVEN` item's reason, outcome impact, and exact next action; residual risks and required decisions.

**Skill-specific evidence:** Capability, protected contract, consumers, current cost, and behavioral/value baselines. Compare considered alternatives and `SELECTED / REJECTED` reasons. Per migration: changes, verification, comparable value metrics, and `KEEP / DISCARD`. Include code/dependency and workflow deltas, affected test actions, residual custom code/compatibility, outstanding transition work, and run-owned measurement/diff/rollback/cleanup evidence.

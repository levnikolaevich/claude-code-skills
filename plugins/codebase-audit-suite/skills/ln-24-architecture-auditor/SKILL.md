---
name: ln-24-architecture-auditor
description: "Audits implemented architecture fitness, boundaries, contracts, dependencies, and configuration ownership. Use for system structure; not for current-state documentation, diagrams, or plan review."
---

# Architecture Auditor

**Goal:** Perform a read-only audit of the architecture the system actually executes. Evaluate whether structure, dependencies, contracts, and cross-component ownership fit current product needs without rewarding pattern names or speculative modernization. Judge where atomicity and resource ownership belong; leave local query, transaction, and data-resource correctness to a persistence-focused review.

**Execution contract:** Treat the ordered checkbox workflow below as this skill's Definition of Done. Work through every item in order, and mark it complete only when its action and required evidence are complete. `N/A`, skipped, unavailable, or delegated items remain incomplete.
Before returning, apply this skill's verdict, decision, and approval rules to every incomplete item and prepend **Checklist: X/Y complete**<br>**Incomplete: None | section/item — reason; outcome impact; exact next action**; list every incomplete item.

## Tool Routing

| Need | Preferred tool | Use it when | Fallback |
|---|---|---|---|
| Physical and declared architecture | Native file listing, manifests, build files, configuration, and architecture documents | Establishing modules, packages, domains, layers, entrypoints, and deployment units | Targeted repository map from known entrypoints |
| Symbols and dependency topology | Language server, compiler metadata, or host-native code intelligence | Tracing imports, calls, implementations, routes, events, and cycles | Narrow search plus direct inspection of definitions and consumers |
| Runtime wiring | Registration code, dependency injection, routing, startup configuration, and safe runtime diagnostics | A component may exist but not be discoverable or connected | Static trace with explicit uncertainty |
| Historical intent | Git history, blame, and decision records | A current exception or parallel mechanism may have a still-valid reason | Current behavior and documented constraints remain authoritative |
| Architectural fitness | Current official framework and platform documentation | A finding depends on supported extension, lifecycle, configuration, or boundary behavior | Primary-source web research; otherwise mark `UNVERIFIED` |
| Quantitative structure | Existing dependency, cycle, complexity, or package-analysis commands | The repository already defines reliable structural analysis | Reproducible static inventory and call-path evidence |

Use diagrams only when they clarify a relationship that prose cannot. Do not generate a diagram as a substitute for evidence, and do not modify code or architecture documents during the audit.

## Evidence Rules

- Executable dependencies, runtime wiring, and public contracts outweigh intended diagrams or folder names.
- A cycle or cross-layer call is a finding only when it creates a concrete change, ownership, testing, deployment, or failure cost.
- Pattern compliance is not a goal by itself; evaluate fitness against product complexity, team workflow, and operational constraints.
- Framework convention and generated wiring require framework-aware verification before being labeled leakage or dead code.
- Modernization is justified only by a present defect or measurable simplification, not novelty.
- Explicit repository boundary rules define intended constraints; documentation explains them; inference from folder names is low-confidence evidence and must not create a violation by itself.
- A prior audit baseline separates new, resolved, and accepted debt. It does not make an active correctness or security risk disappear.
- Shared system-design baseline, current-state, target-design, decision, diagram, and migration artifacts are optional intent evidence. Their absence is not a defect by itself, and their presence never outranks executable behavior for the implemented state.

## Checklist

### 1. Discover the Actual Architecture

- [ ] Read repository instructions, architecture documents, manifests, entrypoints, deployment definitions, and configuration ownership rules.
- [ ] Discover shared architecture artifacts by repository convention, distinguish a system-design baseline from a prior audit baseline, and classify each as current, proposed, accepted, superseded, stale, contradictory, or `UNKNOWN`; do not require any particular artifact path.
- [ ] Map packages, modules, domains, layers, processes, data stores, queues, external systems, and public interfaces in scope.
- [ ] Record ownership and independent build, deploy, scale, and failure boundaries; do not infer a service boundary from a directory or process name alone.
- [ ] Identify the dominant organizing model and any competing models: layer-first, domain-first, service boundaries, plugin boundaries, or framework conventions.
- [ ] Trace representative critical flows from entrypoint through orchestration, domain behavior, persistence or integration, and observable outcome.
- [ ] Compare documented current state, target state, accepted decisions, and active migration phase with executable structure; record drift and authority conflicts without assuming documentation describes what actually runs.
- [ ] Inspect Git state so current work and unrelated user changes are not misclassified as established architecture.
- [ ] Keep the audit read-only and disclose any permitted diagnostic caches or generated analysis artifacts.

### 2. Audit Pattern Fitness and Ownership

- [ ] Identify major patterns from code behavior rather than names and score each on problem fit, completeness, consistency, and current maintenance cost.
- [ ] Check whether abstractions remove real volatility or merely move straightforward code behind interfaces, factories, registries, or generic layers.
- [ ] Check layer direction, domain ownership, orchestration depth, side-effect boundaries, and whether policy remains separated from infrastructure detail.
- [ ] Trace where cross-component transactions, sessions, connections, streams, processes, subscriptions, and background work are owned; report boundary ambiguity without duplicating local lifecycle or transaction-correctness analysis.
- [ ] For each state-changing critical flow, identify the atomicity owner and how partial failure is prevented, retried idempotently, or compensated across stores and messages.
- [ ] Check read-named or pure-looking interfaces for hidden writes, broad side effects, network calls, or lifecycle ownership that violates their contract.
- [ ] Find parallel architectural mechanisms, partially completed migrations, compatibility paths with no consumer, and extension points with no credible variation.
- [ ] Check whether failure handling and retries sit at the layer that owns the operation rather than being duplicated or swallowed across layers.

### 3. Audit Contracts and Dependencies

- [ ] Inspect public API, service, event, command, and persistence boundaries for stable input/output models plus explicit error, nullability, idempotency, and compatibility contracts.
- [ ] Check entity or framework-type leakage, missing boundary models, boolean-mode APIs, excessive parameters, unstable serialization, and inconsistent naming across layers.
- [ ] Build module or package dependency direction using resolved internal edges; account for aliases, re-exports, generated code, reflection, registries, plugins, and runtime loading before declaring an edge absent.
- [ ] Apply configured forbidden/allowed dependency rules first; if rules are only inferred, report the inferred model and confidence instead of presenting it as policy.
- [ ] Identify cycles, forbidden imports, unstable dependency direction, excessive fan-in or fan-out, and isolated islands without treating a metric threshold as a finding until it predicts a concrete cost.
- [ ] Trace cycle and coupling findings to concrete effects on change radius, initialization, testing, deployment, ownership, or failure propagation.
- [ ] Check that producers and consumers agree on event names, schemas, versions, delivery semantics, ordering, and registration.
- [ ] Check physical structure for domain cohesion, framework placement, junk drawers, duplicate module roots, orphan packages, and files whose location hides ownership.
- [ ] Check configuration boundaries for typed settings, composition-root ownership, precedence and override semantics, startup validation, scattered environment reads, secret ownership, and leakage into domain behavior.
- [ ] Verify runtime discovery: routes, handlers, jobs, commands, plugins, middleware, serializers, and dependency bindings must be registered and reachable.

### 4. Evaluate Evolution and Alternatives

- [ ] Identify current architecture pain using repository evidence: repeated change sets, fragile tests, broad blast radius, duplicate mechanisms, release coupling, or incident-prone ownership.
- [ ] If a system-design baseline exists, verify its source and freshness, then compare confirmed constraints with actual behavior.
- [ ] If a prior audit baseline exists, compare new, resolved, and retained findings; continue to report accepted or retained risks when their impact remains material.
- [ ] Research external pattern or framework behavior only when it can confirm a capability, limitation, lifecycle rule, or supported simplification.
- [ ] Compare the current shape with the simplest credible alternative, including migration risk, compatibility, rollback, team impact, and operational cost.
- [ ] Prefer incremental boundary repair when a rewrite or new pattern would create more transitional complexity than it removes.
- [ ] Reject recommendations that require speculative scale, unsupported future variants, or replacement of working conventions without a demonstrated defect.
- [ ] Include a migration sequence only when the recommendation cannot be applied safely as one bounded change.

### 5. Validate Findings and Report

- [ ] Verify structural findings through at least one dependency path, call path, registration path, public contract, or reproducible analysis result.
- [ ] Filter generated code, framework conventions, deliberate adapters, test-only architecture, and documented exceptions before confirming a violation.
- [ ] Apply a materiality and acceptable-alternative gate to every candidate. Require a concrete correctness, security, ownership, deployment, change-amplification, or recurring maintenance impact at the system's evidenced scale. Reject nitpicks, pattern preference, theoretical purity, generic best practice, speculative scale, and a merely different architecture when the current tradeoff is reasonable; when several shapes work, require the boundary outcome or constraint rather than one preferred pattern.
- [ ] Put a directly relevant Markdown practice link in every finding's required resolution: prefer current official documentation or a specification, and use reputable primary engineering material only when official sources do not resolve the tradeoff. Open and verify the source; it must support the proposed architectural mechanism, not merely the defect category. Reject search-result links, generic best-practice articles, and decorative citations.
- [ ] Classify findings as `P0`-`P3` based on correctness, security, change amplification, deployment coupling, and recurring maintenance cost.
- [ ] Include affected boundaries, evidence, concrete consequence, why the current compromise is not acceptable, migration risk, and the smallest safe next step for every finding while allowing equivalent target shapes.
- [ ] Order recommendations by prerequisite and risk reduction, separating immediate correctness fixes from optional evolution.
- [ ] Use `BLOCKED` when required runtime wiring, boundary evidence, or an authoritative contract cannot be verified without a credible fallback; use `FAIL` for an evidenced unresolved correctness or security boundary defect, unsafe ownership ambiguity, or `P0/P1` structural risk; use `CONCERNS` only for material non-blocking change amplification, and `PASS` only when no evidenced architecture defect creates material cost or risk.
- [ ] Return the verdict with the actual architecture map, fitness assessment, findings, limitations, and residual structural risks.

## Output Contract

```markdown
# Architecture Audit

**Verdict:** PASS | CONCERNS | FAIL | BLOCKED

## Actual architecture
- Modules, boundaries, entrypoints, and external systems
- Critical flows and runtime wiring
- Observed current state, intended target state, active transition state, and evidenced drift

## Fitness summary
| Area | Status | Evidence |
|---|---|---|
| Pattern fitness and ownership | PASS / CONCERNS / FAIL | ... |
| Contracts and boundaries | PASS / CONCERNS / FAIL | ... |
| Dependency topology | PASS / CONCERNS / FAIL | ... |
| Physical structure and configuration | PASS / CONCERNS / FAIL | ... |

## Findings
| Priority | Problem | Evidence and justification | Required resolution |
|---|---|---|---|
| P0 / P1 / P2 / P3 | Concrete architectural defect | Boundary and evidence, material consequence at evidenced scale, migration context, and why the current tradeoff is not acceptable | Smallest safe outcome or boundary correction, migration and rollback constraints, and a verified `[practice reference](URL)` to official or primary engineering guidance; allow equivalent valid target shapes |

Use `None` when no candidate survives the evidence, materiality, fitness, and acceptable-alternative gates.

## Evolution order and residual risks
Prerequisite-aware recommendations, accepted exceptions, and blind spots.
```

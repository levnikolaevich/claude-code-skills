---
name: ln-56-architecture-auditor
description: "Audits implemented architecture boundaries, dependencies and ownership; not target design or plan review."
---

# Architecture Auditor

**Goal:** Perform a read-only audit of the architecture the system actually executes. Evaluate whether structure, dependencies, contracts, and cross-component ownership fit current product needs without rewarding pattern names or speculative modernization. Judge where atomicity and resource ownership belong; leave local query, transaction, and data-resource correctness to a persistence-focused review.

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
| Physical and declared architecture | Native file listing, manifests, build files, configuration, and architecture documents | Establishing modules, packages, domains, layers, entrypoints, and deployment units | Targeted repository map from known entrypoints |
| Symbols and dependency topology | Language server, compiler metadata, or host-native code intelligence | Tracing imports, calls, implementations, routes, events, and cycles | Narrow search plus direct inspection of definitions and consumers |
| Runtime wiring | Registration code, dependency injection, routing, startup configuration, and safe runtime diagnostics | A component may exist but not be discoverable or connected | Static trace with explicit uncertainty |
| Historical intent | Git history, blame, and decision records | A current exception or parallel mechanism may have a still-valid reason | Current behavior and documented constraints remain authoritative |
| Architectural fitness | Current official framework and platform documentation | A finding depends on supported extension, lifecycle, configuration, or boundary behavior | Primary-source web research; otherwise mark `UNVERIFIED` |
| Quantitative structure | Existing dependency, cycle, complexity, or package-analysis commands | The repository already defines reliable structural analysis | Reproducible static inventory and call-path evidence |

Use diagrams only when they clarify a relationship that prose cannot. Do not generate a diagram as a substitute for evidence, and do not modify code or architecture documents during the audit.

## Workflow Boundary

This workflow assesses implemented architecture read-only. Architecture decisions retain structural ownership; technical foundation contracts retain their domain ownership. Do not prescribe a universal layering pattern as an audit requirement.

## Evidence Rules

- Executable dependencies and runtime wiring establish implemented structure; accepted boundary rules and public contracts establish obligations. Folder names alone establish neither.
- A proven violation of an accepted boundary is a finding even before an incident; consequences determine priority. Inferred boundaries need concrete change, ownership, testing, deployment, or failure cost, not folder-name assumptions.
- Framework convention and generated wiring require framework-aware verification before being labeled leakage or dead code.
- Modernization is justified only by a present defect or measurable simplification, not novelty.
- A prior audit baseline separates new, resolved, and accepted debt. It does not make an active correctness or security risk disappear.
- Shared system-design baseline, current-state, target-design, decision, diagram, and migration artifacts are optional intent evidence. Their absence is not a defect by itself.

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

- [ ] Identify major patterns from behavior and assess completeness, consistency, maintenance cost, and fit to product complexity, team workflow, and operational constraints; avoid invented numeric scores.
- [ ] Check whether abstractions remove real volatility or merely move straightforward code behind interfaces, factories, registries, or generic layers.
- [ ] Before recommending removal of a suspected redundant mechanism, trace consumers and failure paths; distinguish lost required guarantees from upkeep removed. Present any contract change as a proposal requiring approval, not an equivalent simplification.
- [ ] Check layer direction, domain ownership, orchestration depth, side-effect boundaries, and whether policy remains separated from infrastructure detail.
- [ ] Trace where cross-component transactions, sessions, connections, streams, processes, subscriptions, and background work are owned; report boundary ambiguity without duplicating local lifecycle or transaction-correctness analysis.
- [ ] For each state-changing critical flow, identify the atomicity owner and how partial failure is prevented, retried idempotently, or compensated across stores and messages.
- [ ] Check read-named or pure-looking interfaces for hidden writes, broad side effects, network calls, or lifecycle ownership that violates their contract.
- [ ] Find parallel architectural mechanisms, partially completed migrations, compatibility paths with no consumer, and extension points with no credible variation.
- [ ] Check whether failure handling and retries sit at the layer that owns the operation rather than being duplicated or swallowed across layers.

### 3. Audit Contracts and Dependencies

- [ ] Inspect public API, service, event, command, and persistence boundaries for stable input/output models plus explicit error, nullability, idempotency, and compatibility contracts.
- [ ] Check whether shared entity or framework types, missing boundary models, boolean modes, excessive parameters, unstable serialization, or naming drift create coupling or contract ambiguity; do not demand DTOs where a shared model is an intentional stable contract.
- [ ] Build module or package dependency direction using resolved internal edges; account for aliases, re-exports, generated code, reflection, registries, plugins, and runtime loading before declaring an edge absent.
- [ ] Apply configured forbidden/allowed dependency rules first; if rules are only inferred, report the inferred model and confidence instead of presenting it as policy.
- [ ] Identify forbidden imports, cycles, unstable dependency direction, excessive fan-in/fan-out, and isolated islands; use structural metrics to locate candidates, then apply the consequence check below.
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
- [ ] Reject recommendations justified only by speculative scale, unsupported future variants, or preference for a different working convention.
- [ ] Include a migration sequence only when the recommendation cannot be applied safely as one bounded change.

### 5. Validate Findings and Report

- [ ] Verify structural findings through at least one dependency path, call path, registration path, public contract, or reproducible analysis result.
- [ ] Filter generated code, framework conventions, deliberate adapters, test-only architecture, and documented exceptions before confirming a violation.
- [ ] Apply the materiality gate: require a proven violation of an applicable accepted constraint or concrete correctness, security, ownership, deployment, change amplification, or recurring maintenance impact at evidenced scale. Reject taste, theoretical purity, generic practice, hypothetical scale, and reasonable alternatives; require the outcome or constraint, not a preferred implementation.
- [ ] **External correction evidence:** Ground external corrections in version-matched official contracts, using primary engineering sources for unresolved tradeoffs. Cite the supported mechanism; local evidence suffices for local defects.
- [ ] Link each accepted boundary finding to the violated driver or contract and the smallest independently verifiable remediation scope; distinguish architectural proposals from accepted decisions.
- [ ] Classify findings as `P0`-`P3` based on correctness, security, change amplification, deployment coupling, and recurring maintenance cost.
- [ ] Order recommendations by prerequisite and risk reduction, separating immediate correctness fixes from optional evolution.
- [ ] Use `BLOCKED` when required runtime wiring, boundary evidence, or an authoritative contract cannot be verified without a credible fallback; use `FAIL` for an evidenced unresolved correctness or security boundary defect, unsafe ownership ambiguity, or `P0/P1` structural risk; use `CONCERNS` for non-blocking accepted-constraint violations or material change amplification, and `PASS` only when no applicable accepted constraint is violated and no evidenced architecture defect creates material cost or risk.

## Self-Check

- [ ] **Reconcile before returning.** Check item-level evidence, requirement coverage, contradictions, scope, verdict, and applicable cleanup. Correct the report or authorized artifacts. Reuse valid evidence; do not automatically rescan the repository or rerun successful commands. Repeat checks only for relevant changes, failures, or unresolved evidence. Disclose remaining gaps.

## Output Contract

Report in the user's language, in this order; label all five fields and state each fact once. Use controlled plain language: one fact per sentence, usually under 20 words, active voice, and one term per concept, with no synonyms for verdicts, IDs, or states. Small results may use one line per field; omit empty tables and do not copy linked artifacts:

1. **Result:** The exact skill-specific verdict token first, then the supported outcome.
2. **Scope:** Reviewed/changed scope, exclusions, baseline, and material assumptions.
3. **Evidence:** Skill-specific fields below; distinguish facts, inferences, and unverified claims. Link artifacts; use tables when useful.
4. **Verification:** Checks/results, unavailable evidence, and applicable cleanup/external state.
5. **Completion:** `Checklist: X/Y complete`; `Incomplete: None` or each `UNPROVEN` item's reason, outcome impact, and exact next action; residual risks and required decisions.

**Skill-specific evidence:** Actual modules, boundaries, wiring, dependencies, configuration, and critical flows; distinguish current, target, transition, and drift. Findings need priority, affected boundary, evidence, consequence at current scale, unacceptable tradeoff, migration risk, and smallest safe next step; allow equivalent target shapes. Order evolution by prerequisites and preserve accepted exceptions.

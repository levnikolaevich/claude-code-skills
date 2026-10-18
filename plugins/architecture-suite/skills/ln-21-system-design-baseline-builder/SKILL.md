---
name: ln-21-system-design-baseline-builder
description: "Defines measurable architecture drivers and constraints before system design; edits architecture docs only."
---

# System Design Baseline Builder

**Goal:** Create or update one durable source of truth for the project's architecture-driving requirements and constraints. Change only the approved architecture document; do not design the solution, review a plan, audit implementation, edit product code, or invent missing targets.

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

| Need | Preferred capability | Fallback |
|---|---|---|
| Repository rules and document conventions | Native file reads plus focused search | User-provided convention with an explicit limitation |
| Existing requirements and architecture artifacts | Narrow repository search and direct reads | Conversation evidence marked with its source |
| Current workload or service evidence | Metrics, dashboards, logs, manifests, or checked-in reports | Mark `UNKNOWN`; never manufacture production numbers |
| Current external limits or standards | Official documentation or specifications | Mark the claim `UNVERIFIED` |
| Document mutation | Minimal patch to the approved Markdown artifact | Return `BLOCKED` if no safe writable path is authorized |

Apply external verification to technical assumptions that change a constraint. Do not browse for values that must come from product owners, operators, the repository, or measured workload.

## Workflow Boundary

This workflow owns architecture-driving requirements and measurable quality targets. Project technical rules and recurring agent procedures consume those targets; they do not belong in a second architecture baseline. Do not create project-local skills here.

## Artifact Rules

- Prefer an existing unambiguous architecture-requirements document.
- Otherwise use `docs/architecture/system-design-baseline.md`.
- Read before writing, preserve unrelated content, and update facts in place instead of creating parallel truth.
- Classify applicability separately as `APPLICABLE` or `NOT_APPLICABLE`, with evidence for exclusions.
- Rank each applicable item as `DRIVER`, `SUPPORTING`, or `INFORMATIONAL`.
- Classify evidence separately as `CONFIRMED`, `ASSUMED`, or `UNKNOWN`.
- Separate observed current values, required targets, hard limits, and future evolution triggers.
- Express quality attributes through observable scenarios and response measures; record undecided targets as missing decisions rather than inventing numbers.
- Treat the baseline as versioned project knowledge, not an immutable promise.

## Checklist

### 1. Establish Scope and Destination

- [ ] Resolve the project, business outcome, intended readers, approved documentation scope, and language.
- [ ] Read applicable repository instructions and inspect Git state so unrelated changes remain untouched.
- [ ] Search for existing requirement, architecture, SLO, recovery, security, cost, and ownership documents.
- [ ] Select one canonical artifact: reuse a clear equivalent or choose the default path; explain why no duplicate will be created.
- [ ] Return `BLOCKED` if the destination is ambiguous and choosing one could split project truth.

### 2. Build the Evidence Ledger

- [ ] Collect business goals, actors, journeys, scope, non-goals, and decision horizon with their sources and confidence for the driver analysis; do not create a second context inventory.
- [ ] Record sources for current workload, data volume, service behavior, platform limits, and existing commitments.
- [ ] Separate repository facts from stakeholder choices and estimates.
- [ ] Detect contradictions between documents, code, configuration, and stated requirements; preserve both claims until resolved.
- [ ] Ask only for choices whose absence materially changes architecture; mark all other gaps `UNKNOWN`.

### 3. Define and Prioritize Architecture Drivers

- [ ] **Business and scope:** Record actors, critical journeys, business horizon, scope, non-goals, and externally committed outcomes.
- [ ] **Demand and data scale:** Record current and target users, rates, concurrency, payloads, growth, retention, and forecast horizon where relevant.
- [ ] **User-observable service quality:** Define SLIs and SLOs for availability, latency, throughput, error rate, correctness, or freshness with measurement windows.
- [ ] **Data semantics and recovery:** Define consistency, ordering, idempotency, reconciliation, durability, backup, RTO, RPO, and acceptable data loss at affected boundaries.
- [ ] **Security, privacy, and compliance:** Define trust boundaries, data classification, residency, access, audit, and destructive-action constraints.
- [ ] **Operations and economics:** Define ownership, operational capacity, cost envelope, supported regions, delivery cadence, and platform or vendor constraints.
- [ ] **Evolution:** Record thresholds, business events, or evidence that justify revisiting an assumption, target, or deferred capability.
- [ ] Separate applicability, criticality, and evidence status; do not use `UNKNOWN` to mean unimportant or `NOT_APPLICABLE`.
- [ ] Prioritize the few scenarios most likely to shape architecture and express each as source/stimulus/environment/artifact/response/measure.

- [ ] Distinguish mandatory engineering constraints from preferences and assumptions; retain their authority and acceptance evidence even when they do not change topology.

### 4. Write the Baseline

- [ ] Create or update the artifact with: identity and status; business context; scope and non-goals; critical scenarios; workload and data; quality targets; recovery; consistency; security; cost and operations; constraints; assumptions and unknowns; review triggers.
- [ ] Give material parameters their theme, applicability, criticality, evidence status, value/range, source, owner, as-of date, and review trigger. State shared metadata once with explicit inheritance; use `UNKNOWN` for missing ownership or values.
- [ ] Keep calculations reproducible and label estimates separately from observed measurements.
- [ ] Link shared architecture artifacts only by repository path or document title; never require a particular workflow or tool.
- [ ] Preserve historical context needed to understand changed requirements instead of silently rewriting prior commitments.

### 5. Validate and Report

- [ ] Re-read the written artifact and verify that no unknown was converted into a confident fact.
- [ ] Check that targets are measurable, internally consistent, and proportionate to the evidenced business horizon.
- [ ] Check that every architecture-critical gap has an owner or exact next evidence action.
- [ ] Link architecture drivers to their source product requirements; preserve the product source as owner of functional rules rather than copying a second requirements baseline.
- [ ] Use `READY` only when the baseline is usable for decisions and no material unknown lacks a safe handling rule; use `INCOMPLETE` for a useful artifact with consequential open drivers; use `BLOCKED` when scope, authority, or destination prevents safe creation.

## Self-Check

- [ ] **Reconcile before returning.** Check item-level evidence, requirement coverage, contradictions, scope, verdict, and applicable cleanup. Correct the report or authorized artifacts. Reuse valid evidence; do not automatically rescan the repository or rerun successful commands. Repeat checks only for relevant changes, failures, or unresolved evidence. Disclose remaining gaps.

## Output Contract

Report in the user's language, in this order; label all five fields and state each fact once. Use controlled plain language: one fact per sentence, usually under 20 words, active voice, and one term per concept, with no synonyms for verdicts, IDs, or states. Small results may use one line per field; omit empty tables and do not copy linked artifacts:

1. **Result:** The exact skill-specific verdict token first, then the supported outcome.
2. **Scope:** Reviewed/changed scope, exclusions, baseline, and material assumptions.
3. **Evidence:** Skill-specific fields below; distinguish facts, inferences, and unverified claims. Link artifacts; use tables when useful.
4. **Verification:** Checks/results, unavailable evidence, and applicable cleanup/external state.
5. **Completion:** `Checklist: X/Y complete`; `Incomplete: None` or each `UNPROVEN` item's reason, outcome impact, and exact next action; residual risks and required decisions.

**Skill-specific evidence:** Artifact path, established drivers and prioritized quality scenarios, applicable constraints, and changed sections. The artifact owns the driver register: theme/parameter, applicability, criticality, evidence status, value/measure, source/owner, as-of date, and review trigger. Summarize only decision-changing gaps; do not copy the register into the response.

---
name: ln-31-delivery-plan-builder
description: "Builds dependency-ordered delivery plans from requirements and repository evidence; read-only."
---

# Delivery Plan Builder

**Goal:** Return a decision-complete, proportionate delivery plan for the requested outcome. Keep planning read-only: do not edit files, create tracker items, implement, publish, or deploy.

**Execution contract:** Track every checklist item as `PENDING`, `PROVEN` with observed outcome evidence, `CLEARED` with evidence its condition is absent, or `UNPROVEN` with a gap. Reading, delegation, tool failure, zero exit status, and self-reported success are not proof. Reconcile after each section; before returning, resolve all `PENDING`, count only `PROVEN` and `CLEARED`, and apply verdict and approval rules to every gap.
Preserve intent, scope, mode, and existing authorization. Complete authorized work before required external approval; ask only consequential unresolved choices. If nobody can answer, report the exact question and apply the skill's gap verdict without waiting or guessing. Cite any blocking instruction and unresolved boundary; never invent approval gates. Scale depth to material risk; preserve mandatory checks, dependencies, and safety order while choosing verification methods.
Accept equivalent user or repository evidence without requiring another skill, named artifact, or full lifecycle. Preserve source requirement and decision IDs. Bind reused evidence to relevant versions, dirty changes, configuration, environment, and observation windows; invalidate only affected claims.
Choose the primary workflow by outcome and explicit selection. Consume neighboring contracts and valid evidence without duplicating ownership or restarting audits. Split distinct deliverables by scope, not mandatory skill invocation. Broad independent assessments use audit workflows; focused domain reviews remain read-only.
On continuation, reconcile task, authorization, state, and gaps. Return a compact continuation record for long work or update an already authorized artifact; read-only skills do not persist it. Distinguish artifact readiness, verified behavior, and external-action authority.
Before retrieval, define the evidence question; read selectively without skipping applicable instructions. Use tools for mechanical processing; summarize bounded results, errors, coverage, and source paths, keeping full output outside context.
Before technical decisions, establish applicability and actual versions; verify version-dependent assumptions against official documentation or specifications. Search and read primary pages for current external recommendations; snippets are not evidence. Version-matched bundled documentation or valid prior evidence suffices. Record decision, version, source, and limitations. Mark unavailable evidence UNVERIFIED; block only essential dependent work. Prefer native mechanisms, justify added tools or abstractions with evidence, and reuse the existing rule owner.


## Tool Routing

| Need | Preferred capability | Fallback |
|---|---|---|
| Outcome and constraints | User request, requirements and accepted design decisions | Equivalent conversation or repository evidence; no mandatory upstream skill |
| Implementation ownership | Code intelligence, focused definitions and consumer/configuration reads | Narrow symbol search and direct causal tracing |
| Verification and delivery | Repository test/build/release definitions and environment contracts | Name exact missing prerequisite and feasible evidence action |

## Domain Rules

- Plan complete observable increments rather than arbitrary file batches. Separate planned work, evidence and authorization.
- Prefer existing project conventions and the smallest complete implementation; estimates are ranges with assumptions, not promises.
- A migration plan owns detailed transition semantics when supplied; reference it without inventing a competing sequence.

## Checklist

### 1. Establish the Delivery Contract

- [ ] Resolve the business outcome, acceptance, protected behavior, authorized implementation boundary and non-goals.
- [ ] Inspect repository instructions, relevant Git state, source requirements and accepted/proposed design status.
- [ ] Trace affected entrypoints, owning logic, state, consumers and integrations; identify evidence gaps that could change the plan.
- [ ] Resolve consequential intent, compatibility and external-state choices before presenting a ready plan.

### 2. Choose the Work Units

- [ ] Identify the smallest complete approach, including no change, configuration, deletion or reuse where it satisfies acceptance.
- [ ] Divide necessary work into independently verifiable outcomes with explicit inputs, owning boundaries and completion evidence.
- [ ] Map every material requirement and protected invariant to at least one work unit and acceptance check.
- [ ] Identify dependencies from contracts, data, deployment order and shared state; remove cycles or expose the required decision.
- [ ] Allow parallel work only where interfaces and mutation ownership are independent; do not mandate agent delegation.
- [ ] Specify integration checks between units and the final observable journey; local unit completion alone is insufficient.

### 3. Plan Verification and Recovery

- [ ] **Test value and boundary:** Require every test to detect a concrete defect in this product's business logic and name the protected business outcome. Prefer E2E through user or external-system boundaries; use integration or unit tests only for business scenarios difficult to exercise reliably through E2E. Reject platform, trivial-wiring, implementation-detail, and duplicate proof with no distinct business failure signal.
- [ ] Map material failure and regression risks to the smallest reliable checks, their prerequisites and pass criteria.
- [ ] Reuse valid existing test evidence and strategy; identify needed additions, updates, retirements or justified no-test decisions.
- [ ] Identify migration, feature-flag, compatibility and rollout dependencies with abort and recovery conditions where applicable.
- [ ] State any irreversible step and authorized external boundary; never promise rollback where only roll-forward is viable.
- [ ] Distinguish local implementation, release publication, deployment and product-outcome verification.

### 4. Review Plan Completeness

- [ ] Check requirement coverage, dependency order, integration ownership and absence of hidden consequential decisions.
- [ ] Size effort only when useful, with assumptions and uncertainty; identify the critical path without manufactured precision.
- [ ] Return the plan in the response with source identities and explicit unresolved evidence; do not persist a tracker or document.
- [ ] Identify what requirement or source changes would invalidate each affected work unit or check.

## Verdict

- `READY`: the plan covers acceptance and integration with executable units, credible verification and resolved consequential decisions.
- `INCOMPLETE`: a usable plan has explicit gaps or conflicting dependencies to resolve.
- `BLOCKED`: essential intent, ownership or evidence is unavailable and no bounded plan can be responsibly established.

## Self-Check

- [ ] **Reconcile before returning.** Check item-level evidence, requirement coverage, contradictions, scope, verdict, and applicable cleanup. Correct the report or authorized artifacts. Reuse valid evidence; do not automatically rescan the repository or rerun successful commands. Repeat checks only for relevant changes, failures, or unresolved evidence. Disclose remaining gaps.

## Output Contract

Report in the user's language, in this order; label all five fields and state each fact once. Use controlled plain language: one fact per sentence, usually under 20 words, active voice, and one term per concept, with no synonyms for verdicts, IDs, or states. Small results may use one line per field; omit empty tables and do not copy linked artifacts:

1. **Result:** The exact skill-specific verdict token first, then the supported outcome.
2. **Scope:** Reviewed/changed scope, exclusions, baseline, and material assumptions.
3. **Evidence:** Skill-specific fields below; distinguish facts, inferences, and unverified claims. Link artifacts; use tables when useful.
4. **Verification:** Checks/results, unavailable evidence, and applicable cleanup/external state.
5. **Completion:** `Checklist: X/Y complete`; `Incomplete: None` or each `UNPROVEN` item's reason, outcome impact, and exact next action; residual risks and required decisions.

**Skill-specific evidence:** Outcome and source state; requirement-to-unit-to-verification mapping; dependencies, integration, affected boundaries, recovery, estimates when useful, and exact unresolved prerequisites. When more than a few units depend on each other and the host renders Markdown diagrams, add one Mermaid dependency graph; keep the text complete without it.

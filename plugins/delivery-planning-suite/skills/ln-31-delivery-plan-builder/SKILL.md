---
name: ln-31-delivery-plan-builder
description: "Builds dependency-ordered delivery plans from requirements and repository evidence; read-only."
---

# Delivery Plan Builder

**Goal:** Return a decision-complete, proportionate delivery plan for the requested outcome. Keep planning read-only: do not edit files, create tracker items, implement, publish, or deploy.

**Execution contract:** The checklist defines completion. Track each item internally as `PENDING`, `PROVEN` with evidence, `CLEARED` with evidence its condition is absent, or `UNPROVEN` with a gap; reading, delegation, or tool failure is not proof. Reconcile after each section. Before returning, resolve all `PENDING`, count only `PROVEN` and `CLEARED`, and apply verdict and approval rules to every gap.
Preserve intent, scope, and existing authorization. Continue authorized work; ask only for consequential unresolved choices or required external approval. Scale depth to material risk without skipping checks. Preserve dependency and safety order; otherwise choose an appropriate verification method.
Accept equivalent user or repository evidence; no other skill, named artifact, or complete lifecycle is required. Preserve source requirement and decision IDs. Bind reused evidence to relevant source versions, dirty changes, configuration, and environment; invalidate only affected claims.
On continuation, reconcile task, authorization, current state, and unresolved evidence. For long work, return a compact continuation record or update an already authorized artifact; read-only skills do not persist it. Distinguish artifact readiness, verified behavior, and external-action authority.
Prepare authorized work before required approval. If blocked by an instruction, cite its exact source and unresolved boundary; do not invent approval gates from caution.


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
- `REVISE`: a usable plan has explicit gaps or conflicting dependencies to resolve.
- `BLOCKED`: essential intent, ownership or evidence is unavailable and no bounded plan can be responsibly established.

## Self-Check

- [ ] **Reconcile before returning.** Check item-level evidence, requirement coverage, contradictions, scope, verdict, and applicable cleanup. Correct the report or authorized artifacts. Reuse valid evidence; do not automatically rescan the repository or rerun successful commands. Repeat checks only for relevant changes, failures, or unresolved evidence. Disclose remaining gaps.

## Output Contract

Report in the user's language, in this order; retain all five fields and state each fact once. Small results may use one line per field; omit empty tables and do not copy linked artifacts:

1. **Result:** Skill-specific verdict and supported outcome.
2. **Scope:** Reviewed/changed scope, exclusions, baseline, and material assumptions.
3. **Evidence:** Skill-specific fields below; distinguish facts, inferences, and unverified claims. Link artifacts; use tables when useful.
4. **Verification:** Checks/results, unavailable evidence, and applicable cleanup/external state.
5. **Completion:** `Checklist: X/Y complete`; `Incomplete: None` or each `UNPROVEN` item's reason, outcome impact, and exact next action; residual risks and required decisions.

**Skill-specific evidence:** Outcome and source state; requirement-to-unit-to-verification mapping; dependencies, integration, affected boundaries, recovery, estimates when useful, and exact unresolved prerequisites.

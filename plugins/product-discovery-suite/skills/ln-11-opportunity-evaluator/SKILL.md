---
name: ln-11-opportunity-evaluator
description: "Evaluates new product opportunities through demand, channels and economics before committing to build."
---

# Opportunity Evaluator

**Goal:** Evaluate product opportunities before implementation commitment. Start from observable demand and a reachable acquisition path, eliminate weak candidates early, and recommend one low-cost validation step without manufacturing market precision.

**Execution contract:** The checklist defines completion. Track each item internally as `PENDING`, `PROVEN` with evidence, `CLEARED` with evidence its condition is absent, or `UNPROVEN` with a gap; reading, delegation, or tool failure is not proof. Reconcile after each section. Before returning, resolve all `PENDING`, count only `PROVEN` and `CLEARED`, and apply verdict and approval rules to every gap.
Preserve intent, scope, and existing authorization. Continue authorized work; ask only for consequential unresolved choices or required external approval. Scale depth to material risk without skipping checks. Preserve dependency and safety order; otherwise choose an appropriate verification method.
Accept equivalent user or repository evidence; no other skill, named artifact, or complete lifecycle is required. Preserve source requirement and decision IDs. Bind reused evidence to relevant source versions, dirty changes, configuration, and environment; invalidate only affected claims.
On continuation, reconcile task, authorization, current state, and unresolved evidence. For long work, return a compact continuation record or update an already authorized artifact; read-only skills do not persist it. Distinguish artifact readiness, verified behavior, and external-action authority.
Prepare authorized work before required approval. If blocked by an instruction, cite its exact source and unresolved boundary; do not invent approval gates from caution.


## Tool Routing

| Need | Preferred tool | Use it when | Fallback |
|---|---|---|---|
| Product and constraints | User context plus existing product, analytics, customer, and strategy documents | Establishing audience, assets, channels, economics, and non-goals | State assumptions and request only consequential missing intent |
| Current demand and acquisition | Web research, trend or marketplace data, communities, reviews, ads, directories, and primary customer evidence | Every external market claim that affects elimination or recommendation | Mark the signal unavailable; never infer a number from search-result count |
| Competition and pricing | Competitor product pages, pricing, release history, distribution channels, reviews, and public filings where relevant | Establishing substitutes, willingness-to-pay signals, and credible differentiation | Use qualitative evidence with explicit confidence |
| Feasibility and validation cost | Existing capabilities, public APIs, regulations, platform rules, and current official documentation | Comparing the cheapest credible experiment and major blockers | Label estimates and name the evidence still required |

Keep the evaluation read-only. Do not create project files, roadmaps, Epics, Stories, implementation plans, campaigns, listings, advertisements, or customer outreach.

## Evidence Classes

| Class | Meaning |
|---|---|
| `MEASURED` | Direct analytics, transactions, experiments, or instrumented observations with known method and date |
| `REPORTED` | A primary source reports a value or behavior, but the underlying measurement is not independently available |
| `ESTIMATED` | A stated model based on explicit inputs and assumptions |
| `INFERRED` | A qualitative conclusion from observable proxies |
| `UNKNOWN` | Evidence is unavailable, stale, incomparable, or too weak to support a decision |

Do not turn `REPORTED`, `ESTIMATED`, or `INFERRED` evidence into a measured market size, search volume, conversion rate, revenue, or willingness-to-pay claim. Date every external source and distinguish the event date from the publication date when they differ.
Treat the creator thesis, intended experience, taste, and conviction as owner preferences and strategic-fit inputs, never as demand, acquisition, or willingness-to-pay evidence.

## Checklist

### 1. Frame the Decision

- [ ] Resolve the existing product or capability, target users, creator thesis, intended experience, decision horizon, available assets, geographic or regulatory scope, constraints, and explicit non-goals.
- [ ] Accept user-supplied candidates or generate a bounded set of materially distinct opportunities from product context and current signals; do not create cosmetic variants of one idea.
- [ ] Define what would justify deeper validation: identifiable user and problem, observable demand, reachable channel, credible value exchange, differentiating wedge, and affordable experiment.
- [ ] Separate discovery of a new direction from prioritization of already committed work or implementation planning.
- [ ] Record assumptions that can reverse the recommendation, separate researchable facts from owner preference, and ask one concise question only when different interpretations materially change the candidates or experiment.

### 2. Collect One Evidence Bundle per Candidate

- [ ] Identify who experiences the problem, how they solve it today, what triggers active search or purchase, and what evidence shows the pain is recurring or costly.
- [ ] Find a reachable acquisition channel and its mechanism: query, marketplace category, integration ecosystem, community, partner, outbound audience, or another observable path.
- [ ] Inspect direct competitors, substitutes, do-nothing behavior, pricing, positioning, distribution, review complaints, and evidence of continued investment or abandonment.
- [ ] Examine economic signals without inventing unit economics: price anchors, budget owner, purchase frequency, switching cost, delivery cost, platform fees, and support burden.
- [ ] Identify implementation, data, dependency, regulation, trust, distribution, and operational blockers that affect the cost of a validation experiment.
- [ ] Capture source/date, evidence class, scope, confidence, contradictions, and decision impact. Trace reused statistics and syndicated reports to their origin; correlated copies are one signal, not independent corroboration.
- [ ] Stop researching a candidate once the evidence is sufficient to eliminate it or additional sources cannot change its status.

### 3. Apply Evidence-First Elimination

- [ ] Eliminate a candidate when evidence contradicts a necessary viability condition or shows no feasible validation path within the stated constraints. Missing public data alone defers the candidate to `UNKNOWN` under the rule below.
- [ ] Treat competitor presence as a lead on demand and constraints; verify usage or purchase signals rather than assuming a listing proves demand. Require a concrete wedge against substitutes and doing nothing.
- [ ] Do not use universal thresholds for search volume, competitor count, ARPU, market size, or MVP duration.
- [ ] Preserve candidates with weak public data as `UNKNOWN` rather than labeling them invalid when a cheap primary experiment can resolve the uncertainty.
- [ ] Record the decisive evidence and falsification condition for every eliminated candidate so rejection is reproducible.
- [ ] Only after external viability, ask whether the owner is willing and able to pursue the audience, channel, operating model, and validation effort; do not infer personal interest.

### 4. Compare Survivors and Choose the Next Experiment

- [ ] Compare survivors on evidence strength, problem severity, channel reachability, differentiation, economics, validation cost, strategic fit with the creator thesis and intended experience, and reversibility without collapsing them into a fake composite score.
- [ ] Preserve meaningful disagreements and sensitivity: show which assumption would cause another candidate to become preferable.
- [ ] Select one primary recommendation only when its evidence is materially stronger for the stated goal; otherwise return `INCONCLUSIVE`.
- [ ] Define the cheapest credible validation experiment that tests the weakest decisive assumption through observed behavior rather than stated purchase intent alone.
- [ ] Specify experiment audience, channel, offer or prototype, success and failure evidence, budget or time boundary, safety constraints, and stop rule without pretending to know the result.
- [ ] Prefer reversible tests such as concierge delivery, prototype usage, pricing or preorder intent with appropriate disclosure, channel response, or integration demand before implementation commitment.

### 5. Validate and Report

- [ ] Reconcile consequential external claims with the collected primary-source evidence; refresh only stale, contradicted, or decision-critical unsupported claims, and label weaker evidence explicitly.
- [ ] Separate facts, estimates, inferences, owner preferences, and unresolved unknowns in the final result.
- [ ] Keep the recommended opportunity, falsification condition, and experiment evidence distinct from an approved product requirement or commitment to build.
- [ ] Use `RECOMMEND <candidate>` only when the candidate has a credible demand signal, reachable channel, differentiating path, plausible value exchange, and executable validation experiment.
- [ ] Use `INCONCLUSIVE` when candidates remain plausible but evidence cannot select among them or a cheap experiment is required; use `DO_NOT_PURSUE` only when evidence eliminates every candidate within scope.
- [ ] Use `BLOCKED` when the decision lacks product context, candidate scope, lawful research access, or a safe validation boundary.
- [ ] Reconcile recommended, eliminated, and deferred candidates against their evidence; report the proposed next experiment without creating files or executing it.

## Self-Check

- [ ] **Reconcile before returning.** Check item-level evidence, requirement coverage, contradictions, scope, verdict, and applicable cleanup. Correct the report or authorized artifacts. Reuse valid evidence; do not automatically rescan the repository or rerun successful commands. Repeat checks only for relevant changes, failures, or unresolved evidence. Disclose remaining gaps.

## Output Contract

Report in the user's language, in this order; retain all five fields and state each fact once. Small results may use one line per field; omit empty tables and do not copy linked artifacts:

1. **Result:** Skill-specific verdict and supported outcome.
2. **Scope:** Reviewed/changed scope, exclusions, baseline, and material assumptions.
3. **Evidence:** Skill-specific fields below; distinguish facts, inferences, and unverified claims. Link artifacts; use tables when useful.
4. **Verification:** Checks/results, unavailable evidence, and applicable cleanup/external state.
5. **Completion:** `Checklist: X/Y complete`; `Incomplete: None` or each `UNPROVEN` item's reason, outcome impact, and exact next action; residual risks and required decisions.

**Skill-specific evidence:** Product, audience, candidates, constraints, and creator thesis separated from market evidence. Compare demand, channel, substitutes/wedge, economics, validation cost, source/date/class, and confidence. For eliminated or deferred candidates give decisive evidence or unknown and falsification/resolution condition. State the recommendation or inconclusive rationale and the proposed experiment contract, budget, stop rule, and decision-changing evidence; do not execute outreach or experiments.

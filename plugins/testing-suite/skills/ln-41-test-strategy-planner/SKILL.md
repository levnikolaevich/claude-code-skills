---
name: ln-41-test-strategy-planner
description: "Designs risk-based test portfolio decisions and prioritized scenarios without changing code. Use when requirements need a test strategy; not for auditing or implementing tests."
---

# Test Strategy Planner

**Goal:** Design a read-only, risk-based test portfolio decision for the requested scope. Maximize confidence in important local behavior while preventing test growth that lacks a unique defect signal, and define how affected evidence is retained, changed, consolidated, retired, or deliberately omitted.

**Execution contract:** Treat the ordered checkbox workflow below as this skill's Definition of Done. Work through every item in order, and mark it complete only when its action and required evidence are complete. `N/A`, skipped, unavailable, or delegated items remain incomplete.
Before returning, apply this skill's verdict, decision, and approval rules to every incomplete item and prepend **Checklist: X/Y complete**<br>**Incomplete: None | section/item — reason; outcome impact; exact next action**; list every incomplete item.

## Tool Routing

| Need | Preferred tool | Use it when | Fallback |
|---|---|---|---|
| Requirements and repository rules | Native file reads plus Git | Establishing scope, current work, acceptance criteria, and supported commands | User-provided requirements with explicit limitations |
| Existing test surface | File listing, search, manifests, runner configuration, and CI | Mapping test levels, fixtures, environments, and conventions | Repository tree and known test entrypoints |
| Behavior and boundaries | Language server or host-native code intelligence | Tracing entrypoints, consumers, trust boundaries, persistence, queues, and external contracts | Narrow search followed by direct inspection |
| Existing evidence | Safe repository-defined test and coverage commands | Determining what behavior is already proved and where confidence is weak | Inspect tests and CI; mark execution unavailable |
| Current external failure modes | Official documentation, specifications, advisories, and primary field evidence | An external contract or real user failure can change scenarios or priority | Mark the claim `UNVERIFIED`; do not invent risk |

Keep the run read-only. Do not create tests, fixtures, snapshots, tasks, or documentation, and do not update the reviewed implementation.

## Evidence Rules

- Prefer deterministic end-to-end evidence through the user-observable boundary for material business risks. Choose contract or integration evidence only with a distinct boundary or determinism rationale, and unit evidence only for material isolated local rules when broader proof is less precise or useful.
- Coverage is discovery evidence, not proof. Require an oracle that would fail for the named defect.
- Prioritize by impact, plausible failure, uniqueness, detectability, and recovery cost; do not convert those judgments into universal numeric thresholds.
- Existing tests reduce a gap only when their setup and assertions prove the same behavior and failure mode.
- Framework, language, ORM, serializer, or library behavior is not a product test unless local configuration or integration changes its contract.
- Keep portfolio action separate from execution status. Use `KEEP`, `ADD`, `UPDATE`, `MERGE`, `DELETE`, or `NO_TEST` for the decision and `PASS`, `FAIL`, `BLOCKED`, or `UNPROVEN` only for evidence state.
- `NO_TEST` is an explicit risk decision, not missing work. Name the existing proof, alternative control, or accepted residual risk.
- A persistent test register is optional. Prefer repository-native test names, paths, tags, CI configuration, and task output unless scale or governance requires another maintained artifact.
- External research is actionable only when it adds a concrete failure mode, boundary, or oracle to this plan.

## Checklist

### 1. Establish Scope and Evidence

- [ ] Resolve the feature, requirements, acceptance criteria, actors, explicit non-goals, and protected human or system outcomes; separate the requested mechanism from the result it must enable and return `BLOCKED` if there is no concrete behavior to plan for.
- [ ] Read applicable repository instructions and inspect Git state so current work and unrelated changes are not mistaken for established behavior.
- [ ] Detect languages, frameworks, runners, test directories, fixtures, factories, environments, CI gates, coverage, contract tests, and manual test surfaces.
- [ ] Map existing evidence and every test affected by the requested behavior to each requirement; mark proof `PROVED`, `PARTIAL`, `MISSING`, or `UNAVAILABLE` based on the actual oracle, not test names or proximity.
- [ ] Inspect manual, exploratory, incident, and production evidence when it reveals behavior that automated suites do not cover.
- [ ] Identify environment, data, credentials, services, devices, browsers, and destructive-state constraints before proposing scenarios.
- [ ] Record assumptions and unknowns that can change test level, priority, or feasibility, and ask one concise question only when different interpretations materially change the strategy.

### 2. Build the Risk Map

- [ ] Trace critical flows from actor trigger through entrypoint, runtime wiring, state change, and durable or user-visible outcome.
- [ ] Identify uniquely important local behavior involving money, authentication, authorization, ownership, data integrity, destructive actions, migrations, public contracts, or irreversible workflows.
- [ ] Enumerate plausible defect classes: incorrect success, rejected valid input, accepted invalid input, boundary error, partial failure, duplicate delivery, ordering, timeout, retry, cancellation, race, rollback, recovery, and compatibility drift; state what protected outcome is lost or what concrete harm follows.
- [ ] Separate product risks from implementation details and behavior already guaranteed by a dependency; exclude technically representable states that protect no unique local outcome or decision.
- [ ] Identify privacy-sensitive or regulated test data and require synthetic, minimized, or explicitly approved fixtures.
- [ ] Use current external evidence only when version-sensitive contracts, recurring user failures, abuse patterns, or interoperability risks can change the map.
- [ ] Rank risks qualitatively and explain ties or uncertainty; do not manufacture precision from missing frequency or impact data.

### 3. Decide Portfolio Actions, Levels, and Oracles

- [ ] Assign every material risk and affected test exactly one provisional action: `KEEP` when trusted unique proof remains valid; `ADD` for an unproved material risk; `UPDATE` when valuable intent remains but basis, boundary, setup, or oracle changed; `MERGE` for safely consolidatable proof; `DELETE` for obsolete, duplicate, trivial, or untrustworthy proof; or `NO_TEST` when another control or accepted risk is sufficient.
- [ ] For `DELETE` or `MERGE`, prove that the test basis is obsolete or identify replacement evidence that preserves every still-required material behavior, failure mode, oracle, and useful failure localization; never retain obsolete proof merely because it already exists.
- [ ] Choose unit tests for isolated local rules, contract tests for producer-consumer agreement, integration tests for owned boundaries, and end-to-end tests for production-shaped journeys whose terminal outcome cannot be proved lower.
- [ ] Avoid duplicating the same behavior at every level unless each level detects a distinct failure class.
- [ ] Define one independent oracle per scenario: returned contract, durable state, emitted event, rendered behavior, external effect, invariant, or deterministic artifact.
- [ ] Check that mocks and fakes do not bypass the boundary or failure semantics the scenario claims to prove.
- [ ] For UI or interaction scenarios, require stable repository-owned IDs or dedicated test hooks as locators; visible or translated copy, styling, layout, position, and incidental structure may be asserted only when they are the explicit contract, never used for discovery.
- [ ] Include positive, invalid, boundary, authorization, error, recovery, concurrency, and compatibility cases only where the risk map makes them material.
- [ ] Specify non-default configuration, time, locale, randomness, ordering, or data scale when defaults could conceal hard-coded behavior.
- [ ] Add browser, device, operating-system, runtime, or version cells only when the supported contract or a known risk makes them decision-relevant.
- [ ] Prefer deterministic setup and bounded data; identify where real dependencies, emulators, disposable environments, or production-like topology are necessary.
- [ ] Define the repository gate or diagnostic role, entry prerequisites, and evidence-based completion criteria for each portfolio action; do not use test count or raw coverage as completion.

### 4. Produce a Prioritized Test Matrix

- [ ] For every decision, name the test basis, protected outcome, risk, existing evidence or affected test, portfolio action, level, setup, oracle, expected evidence, environment, gate, and result state when known.
- [ ] Define a review or retirement trigger for evidence whose value depends on a contract, migration, compatibility window, workaround, incident, dependency, or temporary risk; do not invent dates without an owned reason.
- [ ] Order scenarios so safety-critical and high-information checks run before expensive breadth, while preserving prerequisite and state dependencies.
- [ ] Identify which scenarios can run in parallel and which share mutable state, rate limits, accounts, devices, or environment setup.
- [ ] Separate release-gating scenarios from slower diagnostic or exploratory coverage so the plan does not make routine delivery impractical.
- [ ] State exclusions explicitly, including scenarios with no unique protected outcome or defect signal, low-value duplication, framework behavior, infeasible environments, and accepted residual risks.
- [ ] Use `READY` when the strategy is executable and decision-complete, `INCONCLUSIVE` when useful partial planning is possible but material evidence is missing, and `BLOCKED` when requirements or a safety-critical boundary cannot be established.
- [ ] Return the verdict, risk map, decision ledger, net portfolio effect, environment needs, exclusions, limitations, and residual risks.
- [ ] State the smallest next evidence-gathering action for every `INCONCLUSIVE` or `BLOCKED` area.

## Output Contract

```markdown
# Test Strategy

**Verdict:** READY | INCONCLUSIVE | BLOCKED

## Scope and existing evidence
- Requirements, actors, and outcomes
- Existing suites, commands, and environments
- Assumptions and unavailable evidence

## Risk map
| Protected outcome | Behavior | Failure or defect class | Impact | Existing proof | Priority rationale |
|---|---|---|---|---|---|
| ... | ... | ... | ... | PROVED / PARTIAL / MISSING / UNAVAILABLE | ... |

## Portfolio decisions and prioritized scenarios
| Priority | Test basis and protected risk | Existing evidence or affected test | Action | Level, scenario, and environment | Oracle, gate, and result | Review or retirement trigger |
|---:|---|---|---|---|---|---|
| ... | ... | path / command / NONE | KEEP / ADD / UPDATE / MERGE / DELETE / NO_TEST | unit / contract / integration / E2E / manual | independent evidence; required / diagnostic; PASS / FAIL / BLOCKED / UNPROVEN | change that requires reconsideration |

## Portfolio effect
Tests added, updated, merged, and deleted; explain every `NO_TEST` decision and whether the maintained portfolio grows, shrinks, or stays neutral.

## Next evidence-gathering actions
Exact repository, environment, contract, or user decision needed for each `INCONCLUSIVE` or `BLOCKED` area.

## Exclusions and residual risks
Low-value duplication, unavailable environments, accepted gaps, and evidence still required.
```

---
name: ln-11-plan-reviewer
description: "Reviews implementation plans against repository evidence and current authoritative guidance. Use before execution to expose gaps and risks; not for completed delivery review."
---

# Plan Reviewer

**Goal:** Perform a read-only, evidence-first second pass over an implementation plan. Verify the plan; do not execute it. A strong result is decision-complete, grounded in the actual repository, explicit about uncertainty, no more complex than the problem requires, and expressed in the fewest words and execution steps that preserve safety.

**Execution contract:** Treat the ordered checkbox workflow below as this skill's Definition of Done. Before reviewing, create an internal coverage ledger with one `PENDING` row per checkbox, using the heading's ID range in printed order. Change a row only to `PROVEN` with a concrete evidence reference, `CLEARED` with evidence that its conditional trigger is absent, or `UNPROVEN`; reading, mentioning, delegating, skipping, or tool failure is not proof.
At the end of each numbered section, reconcile its ledger rows and resolve every `PENDING`. Before verdict, run exactly one closure pass over the ledger, evidence, and draft: challenge unsupported `PROVEN` or `CLEARED` states, surface every accepted finding, and align matrices, limitations, and verdict. Correct the report or downgrade the verdict; do not rescan the repository, restart the review, or launch another subagent round.
Before returning, derive the count from the ledger with only `PROVEN` and `CLEARED` rows complete, apply this skill's verdict rules to every `UNPROVEN`, allow no `PENDING`, and prepend **Checklist: X/Y complete**<br>**Incomplete: None | ID — reason; outcome impact; exact next action**; list every `UNPROVEN` row.

## Tool Routing

| Need | Preferred tool | Use it when | Fallback |
|---|---|---|---|
| Repository instructions and current state | Native file read plus Git | Always read the active host's applicable repository instructions; use `git status`, `diff`, and history when branch or change context matters | Equivalent host file and shell tools |
| Paths, text, config, docs, and focused code reads | Native file listing, search, outline, and range reads | The question is textual or structural and does not require symbol identity | Narrow the path and pattern before expanding content |
| Symbols, references, callers, implementations, cycles, and blast radius | Language server or host-native code intelligence | A plan changes existing code relationships, public APIs, module boundaries, or architecture | Targeted search plus direct inspection of definitions and consumers |
| Planned edit risk | Code intelligence plus caller and consumer search | The plan names an edit region, route, event, response contract, or existing change surface | Inspect named symbols and adjacent integration points manually |
| Build, test, migration, and script feasibility | Repository-defined commands through the shell | The plan depends on a command, baseline, generated artifact, or existing test surface being available | Inspect scripts and CI configuration; mark execution unverified |
| Correction and external-claim research | Official vendor documentation, specifications, or standards through documentation search or the web | External behavior affects the plan or a material candidate needs its required practice reference | Reputable primary engineering material; otherwise mark the claim or correction `UNVERIFIED` |
| Independent challenge | Native subagents in separate contexts | A plan benefits from execution, fresh-context, or adversarial perspective | Run the selected perspectives once as one bounded self-review batch and report reduced independence |

Use the preferred tool only when it answers the current evidence question. Tool failure is not a domain finding: report reduced confidence and block only when missing evidence prevents a safe decision. Do not use semantic tooling for prose or configuration questions, and do not use web research to rediscover stable local facts.

## Evidence Rules

| Evidence | Authority |
|---|---|
| Repository files, manifests, schemas, generated contracts, and executable behavior | Source of truth for the current project state |
| Official vendor documentation, specifications, RFCs, and security standards | Source of truth for external contracts and current supported behavior |
| Release notes and migration guides matching the project's actual version range | Source of truth for compatibility and upgrade claims |
| Reputable primary engineering material | Supporting evidence when official sources do not address a design tradeoff |
| Community discussion or training knowledge | Leads only; never sufficient for a blocking factual claim |

When sources disagree, prefer the repository for what is installed and implemented, and official documentation for what an external system promises. Repository evidence proves a plan defect; external practice sources justify the correction mechanism and cannot invent a local requirement. State disagreements instead of silently choosing the convenient answer.

## Checklist

### 1. Establish the Review Contract (`CONTRACT-1` through `CONTRACT-9`)

- [ ] Resolve the exact plan, user request, linked requirements, and repository scope. If no concrete plan exists, stop with `BLOCKED` rather than inventing one to review.
- [ ] Read all applicable repository instruction files before interpreting code, documentation, or expected workflow. Identify only change-relevant project policies, standards, and ADRs; distinguish current accepted authority from draft, superseded, stale, or merely descriptive material instead of treating every document as binding.
- [ ] Inspect Git state when it can affect the review: current branch, uncommitted changes, comparison base, and relevant recent history.
- [ ] Separate the literal request and proposed solution from the underlying intent; state the actor, protected outcome, observable definition of done, non-goals, constraints, and assumptions, and label unsupported intent inferences.
- [ ] Calibrate acceptable complexity to evidenced project or product maturity, decision horizon, current scale, team and operational capacity, and business stakes. Treat future growth as a requirement only when a concrete horizon, consumer, load, or constraint supports it.
- [ ] Separate defects in the plan from pre-existing adjacent problems. Treat an existing problem as a plan finding only when the plan introduces or worsens it, depends on a false assumption about it, must resolve it to satisfy the goal, or creates immediate delivery risk; otherwise record it as an out-of-scope observation and do not expand the plan.
- [ ] Distinguish facts discoverable from the repository from choices that require user intent; explore first, and when plausible interpretations would produce materially different plans, ask one concise question that resolves the decision rather than a survey.
- [ ] Classify the review depth. Treat authentication, authorization, money, destructive operations, data migration, public APIs, concurrency, distributed workflows, and irreversible rollout as high-risk.
- [ ] Keep the run read-only. Do not mutate the source plan, implementation, task tracker, branch, or external system; a corrected plan may appear only in the review response. Allow only host-permitted rebuildable diagnostic caches or build artifacts and disclose them when created.

### 2. Ground the Plan in the Repository (`REPO-1` through `REPO-11`)

- [ ] Build a narrow map of the affected modules, entrypoints, configuration, schemas, migrations, tests, documentation, and deployment surfaces.
- [ ] Discover shared architecture and governance artifacts by repository convention and common roles: system-design baseline, current-state map, target design, accepted decisions, engineering policies, diagrams, and migration plan. Treat them as optional evidence, never as required workflow dependencies.
- [ ] Check artifact status, authority, owner, source, as-of date, supersession, and review triggers before applying a constraint. Keep one change-scoped policy and decision ledger of applicable sources and the plan evidence for compliance, explicit approved deviation, or an unresolved gap. Missing artifacts do not block review by themselves; a material unresolved driver does.
- [ ] Verify every existing path, symbol, component, command, environment key, interface, and dependency named by the plan. Mark genuinely new artifacts as new.
- [ ] Read enough implementation context to understand ownership and invariants, not just the files explicitly named by the plan.
- [ ] Use semantic graph queries when a conclusion depends on symbol identity, callers, implementations, module coupling, API consumers, or blast radius.
- [ ] Inspect Git history or blame only when it can reveal a still-relevant constraint or convention; do not treat historical code as proof that the current design is correct.
- [ ] Check the existing test and CI surface so proposed verification commands, fixtures, environments, and acceptance evidence are feasible.
- [ ] Keep an evidence ledger for material claims: claim, source, confidence, and the plan decision it supports or contradicts.
- [ ] Check active branches, plans, migrations, or sibling work for structural overlap: shared contracts, files, schemas, or the same trigger with a conflicting outcome; keyword similarity alone is only a lead.
- [ ] Stop expanding the scan when additional files cannot change a plan decision, finding, or confidence level.

### 3. Research Corrections and Unknown External Claims (`RESEARCH-1` through `RESEARCH-9`)

- [ ] Research a correction only after repository evidence establishes a material candidate gap; prefer an existing repository mechanism and do not browse to invent findings.
- [ ] Extract plan claims that are external or unstable: versions, API signatures, deprecations, standards, security requirements, library capabilities, performance characteristics, and platform limits.
- [ ] Resolve installed versions and enabled features from project manifests, lockfiles, configuration, and generated metadata before searching generic documentation.
- [ ] Before recommending a correction that depends on an external API, library, security control, protocol, platform, standard, or version, verify the supported solution, constraints, deprecations, and security guidance in official documentation matched to the installed or proposed version.
- [ ] For every material candidate that may become a finding, open current official documentation or a specification supporting the correction mechanism; use reputable primary engineering material only when official sources do not resolve the tradeoff. Do not use external guidance to redefine repository-owned business logic established by requirements, code, and tests.
- [ ] Open and inspect any specific document, proposal, issue, or URL that the plan relies on instead of trusting a quotation or paraphrase.
- [ ] Record solution research as compact evidence: topic, source and date, verified claim, candidate corrections, chosen approach, rejected alternatives, confidence, plan impact, and why the choice is the smallest complete fit.
- [ ] Apply the research-to-action gate: if a source does not reveal a specific defect, risk, missing decision, or better-supported alternative, keep it informational and do not inflate the review.
- [ ] If authoritative research is unavailable, label the affected claim `UNVERIFIED`; use `BLOCKED` when implementation safety or a consequential design choice depends on it. Review approval never authorizes execution; require a later implementer to revalidate unstable external facts immediately before editing.

### 4. Review from Every Applicable Perspective (`LENS-1` through `LENS-15`)

- [ ] **Intent and traceability:** Every proposed change and source of complexity maps to the intended outcome, an acceptance criterion, a safety need, or an evidenced constraint; combine work serving the same outcome, and remove speculative or merely ceremonial steps.
- [ ] **Repository fit:** The plan respects actual project structure, conventions, supported stack, existing capabilities, maturity, current scale, team and operational capacity, and current work without overwriting unrelated changes. For each applicable current project policy or ADR in the ledger, trace the affected plan surface to compliance or an explicitly approved and justified deviation; include project-defined logging, error taxonomy and boundary mapping, configuration, observability, security, persistence, testing, and release rules only when the change reaches them.
- [ ] **Architecture, ownership, and traceability:** Layers, modules, orchestration, side effects, dependency direction, and resource ownership remain explicit, coherent, and proportionate. The plan respects confirmed constraints, accepted decisions, target boundaries, and the active migration phase; expose stale or contradictory artifacts instead of silently selecting the convenient one.
- [ ] **Root cause and solution completeness:** Prove that the proposed mechanism resolves the causal need at its owning boundary across every in-scope entrypoint, producer, consumer, runtime registration, state transition, and material failure or recovery path. Reject symptom patches, caller-specific special cases, duplicated side channels, and accidental ordering, timing, or data dependencies. Accept tactical containment only when explicitly requested or required for immediate safety and bounded by an owner, removal condition, and durable follow-up; completeness ends at the causal business scope, not the repository.
- [ ] **Interfaces and data:** Public APIs, events, schemas, configuration, persistence, serialization, compatibility, and migration paths are named wherever they change. For changed semantic values and closed sets--such as states, roles, permissions, event names, error codes, configuration keys, feature identifiers, limits, timeouts, and routing keys--plan one authoritative owner shared by every in-scope producer and consumer through the repository-standard mechanism (for example a typed union, enum, constant set, value object, schema, typed configuration, or generated contract). Do not demand extraction of a harmless one-off local literal with no duplication, invalid-state, or drift risk.
- [ ] **Scenario completeness:** For each critical flow, trace actor trigger -> entrypoint -> runtime discovery or wiring -> usage context -> observable outcome; include first meaningful use, failure, recovery, and repetition when they can change the intended experience.
- [ ] **Correctness and failure modes:** Cover boundaries, invalid state, partial failure, retries, idempotency, concurrency, cancellation, timeouts, rollback, and cleanup where applicable.
- [ ] **Security and privacy:** Cover trust boundaries, authentication, authorization, validation, secrets, sensitive data, logging, destructive actions, and abuse paths in proportion to risk.
- [ ] **Dependencies and sequencing:** Use the fewest dependency-ordered steps that can reach acceptance safely; parallel steps have no same-wave dependency or shared mutable output, and migrations, producers, consumers, deployments, and compatibility transitions remain ordered correctly.
- [ ] **Capacity and degradation:** Bound user- or data-controlled work and state load from evidenced demand; state rate assumptions and failure behavior without introducing scaling machinery for hypothetical traffic.
- [ ] **Testing and acceptance:** For every material changed risk and affected test, the plan names the test basis, existing proof, independent oracle, level and gate rationale, and one portfolio action: `KEEP`, `ADD`, `UPDATE`, `MERGE`, `DELETE`, or justified `NO_TEST`. Prefer deterministic E2E for material user-observable risk and justify narrower evidence; require the fewest tests with unique defect signals, completion evidence rather than count or raw coverage, and a review or retirement trigger for temporary proof without redesigning unrelated test health.
- [ ] **Delivery and operations:** Include documentation, configuration rollout, observability, deployment, rollback, and operator actions only where the change requires them.
- [ ] **KISS — simplicity and alternatives:** Prefer the first sufficient rung in this solution ladder: `NO_CHANGE`, `DELETE_OR_CONFIGURE`, `REUSE_LOCAL`, `USE_PLATFORM_OR_STDLIB`, `REUSE_INSTALLED`, `ADOPT_DEPENDENCY`, then `MINIMAL_CUSTOM`. Require evidence for the selected rung and why each applicable simpler rung is insufficient; reject plans that skip directly to new dependencies, custom code, layers, services, abstractions, configuration, extensibility, infrastructure, or operational machinery without a material semantic need. Merge adjacent work when ownership and verification remain clear, while preserving correctness, safety, compatibility, testability, and reversibility; KISS is not code golf or omitted safeguards.
- [ ] **Subtractive completeness:** For changed logic, constraints, configuration, schemas, routes, states, or operations, identify obsolete code, branches, flags, keys, defaults, shims, data paths, documentation, tests, permissions, metrics, and rollout scaffolding. Plan removal only when evidence proves it superseded and in scope; otherwise record retention evidence or a temporary path's owner and removal condition. `One in, two out` is a simplification prompt, never a quota.
- [ ] Mark a perspective `CLEARED` only when evidence shows its trigger is absent from the plan and repository; never silently skip a high-risk perspective.

### 5. Run One Independent Challenge Round (`CHALLENGE-1` through `CHALLENGE-5`)

- [ ] Run exactly one independent review round for the plan. Select one blind reviewer for small low-risk work, two distinct reviewers for ordinary medium risk, or all three for high-risk, architectural, cross-service, unfamiliar, or materially ambiguous work: execution simulation, fresh implementation, and adversarial failure analysis. Do not start a second analytical round for corrections, disagreements, or low confidence.
- [ ] Give every reviewer the same frozen packet—plan, real goal, relevant repository paths, constraints, assumptions, and evidence questions—without prior conversation history, the primary review's conclusions, or sibling outputs. If the host cannot provide fresh isolated contexts, use distinct self-review passes and disclose reduced independence.
- [ ] Launch the selected perspectives once in parallel or one blind wave, wait for all, and treat every suggestion as a candidate finding requiring repository or authoritative evidence. Resolve conflicts and verify candidates directly; never launch a verifier or another reviewer round.
- [ ] Classify pre-mortem concerns as evidence-backed risk, unsupported fear, or unstated assumption; dismiss unsupported fear, and give each accepted risk or assumption an invalidation impact and concrete validation or mitigation step.
- [ ] Treat reviewer unavailability, tool failure, rate limits, or questions as coverage limitations, not evidence that the plan is defective. Retry or replace one technically failed selected reviewer only when a concrete cause changes, using the same evidence question; this completes the original round and must not broaden it.

### 6. Synthesize a Decision-Complete Result (`CLOSE-1` through `CLOSE-11`)

- [ ] Deduplicate findings from repository inspection, research, and independent review; keep the strongest evidence and preserve meaningful disagreements.
- [ ] Classify findings as `BLOCKER`, `MAJOR`, or `MINOR`: blockers prevent safe handoff, majors predict substantial rework or regression, and minors improve clarity without changing feasibility.
- [ ] Apply a materiality and acceptable-alternative gate to every candidate. Require a violated requirement or contract, or a concrete user, business, safety, operational, delivery, or lifecycle impact at evidenced scale. Reject unsupported or pre-existing unrelated problems, nitpicks, personal taste, theoretical purity, generic practice, hypothetical scale, and a merely different implementation when the current tradeoff is reasonable. For every accepted finding, explain why the compromise is unacceptable and require the smallest complete outcome while allowing equivalent solutions.
- [ ] Put the verified research source in every finding's required resolution as a directly relevant Markdown practice link. It must support the proposed mechanism, not merely the defect category; reject search-result links, generic articles, and decorative citations, and mark the correction `UNVERIFIED` when no credible source is available.
- [ ] Confirm that every consequential implementation choice is fixed: interfaces, ownership, data flow, failure behavior, compatibility, verification, and rollout where applicable.
- [ ] For every material assumption, record confidence, what breaks if it is false, and who or what step validates it before dependent work begins.
- [ ] Map findings to verdicts: use `BLOCKED` when a required user choice, access, or authoritative fact is unavailable; use `REVISE` for any correctable `BLOCKER` or `MAJOR`; use `READY WITH CONCERNS` only when the plan is safe and executable with no uncovered requirement or consequential decision, but bounded non-blocking `MINOR` amendments or explicitly accepted residual risks remain; use `READY` only when no corrective finding or blocking evidence gap remains.
- [ ] For `REVISE`, provide a complete replacement plan with the fewest dependency-ordered, outcome-producing steps that preserve the user's intent and accepted corrections; omit restated context, meta-work, and phases that add no implementation or verification value.
- [ ] For `READY WITH CONCERNS`, provide only the exact local plan amendments and accepted non-blocking risks; do not restate unchanged sections of the plan.
- [ ] For `BLOCKED`, ask only the smallest questions that materially unlock a different plan, and state what was already verified.
- [ ] Respect any host-required wrapper, but keep the response as short as the evidence and verdict allow: state facts once, omit empty commentary and unchanged plan sections, and preserve the output content and verdict semantics below.

## Output Contract

```markdown
# Plan Review

**Verdict:** READY | READY WITH CONCERNS | REVISE | BLOCKED

## Scope and evidence
- Plan reviewed
- Intent statement: actor, protected outcome, consequential experience qualities, and inferred assumptions
- Maturity and complexity fit: business horizon, current scale, team and operational capacity, and justified evolution path
- Simplicity decision: selected solution-ladder rung and evidence against applicable simpler alternatives
- Root-cause and solution-completeness assessment: owning boundary, in-scope paths and states, and any bounded containment
- Subtraction ledger: candidates inspected, proven removals, and evidence-backed retention or no-removal conclusions
- Architecture artifacts inspected, their status, and any authority or freshness limitations
- Repository areas inspected
- Commands or semantic queries used
- External sources consulted
- Independent challenge: one round, selected perspectives, and coverage limitations
- Limitations

## Policy and decision compliance
| Applicable policy or ADR | Affected plan surface | Plan evidence | Status |
|---|---|---|---|
| ... | ... | compliant step or explicitly approved deviation | COMPLIANT / DEVIATED / UNPROVEN |

Include only current authoritative sources that apply to the change; omit draft, superseded, and merely descriptive material. Use `None` when none applies.

## Findings
| Priority | Problem | Evidence and justification | Required resolution |
|---|---|---|---|
| BLOCKER / MAJOR / MINOR | Concrete violated behavior, requirement, or decision | File, symbol, command, or authoritative source; material impact at evidenced scale; why the current tradeoff is not acceptable | Smallest complete outcome at the owning boundary; in-scope paths, states, removals, or bounded containment; existing mechanism; and a verified `[practice reference](URL)` to official or primary engineering guidance; allow equivalent valid solutions |

Use `None` when no candidate survives the evidence, materiality, scope, and acceptable-alternative gates.

## Corrected plan or amendments
Complete replacement plan for REVISE; exact local amendments for READY WITH CONCERNS; otherwise state that the reviewed plan is ready or explain why correction is blocked.

## Open decisions and residual risks
Only unresolved user choices, explicitly accepted tradeoffs, and risks that remain after correction.
```

# Repository Skill Template

**Status: ADOPTED.** This is the canonical authoring template for this repository. It is not an installed skill or a runtime dependency. Repository instructions own distribution, mutation scope, and release policy; this template owns skill structure, completion tracking, and report conventions.

## Preservation contract

- Keep every independently verifiable domain check as a separate checkbox. Do not replace detailed checks with one checkbox for an entire phase.
- Preserve domain algorithms, evidence requirements, failure handling, authorization boundaries, verdict semantics, and required output data.
- Shorten repetition and generic prose. A shorter file or fewer checks is not evidence of equivalent quality.
- Review content against the Goal in three directions: remove instructions with no outcome, evidence, or safety value; add missing obligations needed to establish the outcome; clarify ambiguous conditions, ordering, and failure paths. Do not preserve an irrelevant check merely to preserve its count.
- Before removing or merging a check, identify its original obligation and the exact retained location that covers it. If independent accountability or behavior changes, present that change for approval rather than treating it as editorial cleanup.
- Keep each operational rule in one canonical location within the skill. The workflow invokes it; the report references its evidence rather than restating the rule.
- Keep each skill standalone. Common contract wording is intentionally present in every skill so installation never depends on this template or another skill. Repository validation detects drift between copies.
- Put substantial conditional procedures in skill-local references only when their loading condition is explicit. Keep all criteria needed for ordinary execution in the entrypoint; never hide mandatory checks behind an optional reference.
- Preserve task-specific differences. A shared report structure does not require identical verdicts, algorithms, tools, or numbers of workflow sections.
- Checkboxes define independently verifiable obligations. Prescribe execution order where dependencies, correctness, or safety require it; otherwise allow an appropriate method without weakening the evidence requirement.
- Self-check means reconciling existing evidence and coverage, not automatically rereading the repository or rerunning successful commands. New changes, failures, or unresolved evidence justify additional checks.
- Retain all five report fields, but scale their length to the result. A small task may use one line per field; avoid empty tables, repeated context, and copied artifacts.

## File and format rules

- Canonical location: `plugins/<plugin>/skills/<skill>/SKILL.md`.
- English instructions; YAML frontmatter contains only `name` and `description`.
- `name` matches the indexed skill directory; `description` is at most 200 characters and starts with the discriminating task boundary.
- `SKILL.md` has at most 200 lines, with no minimum. Do not compress unrelated requirements onto one line merely to pass this ceiling.
- Replace all example placeholders below. Section names and the number of sections follow the actual algorithm, not the example's shape.
- `Goal`, `Execution contract`, `Tool Routing`, detailed `Checklist`, `Self-Check`, and `Output Contract` are the common structure. Include domain rules and a separate verdict mapping when needed; define each rule and mapping only once.

## SKILL.md template

```markdown
---
name: ln-NN-skill-name
description: "State the specific capability and trigger; add exclusions only for likely neighboring tasks."
---

# Skill Title

**Goal:** Define the intended outcome, protected behavior, and mutation boundary. State what this skill does not authorize when that boundary matters.

**Execution contract:** The ordered checkboxes are the Definition of Done. Track every item internally as `PENDING`, `PROVEN` with concrete evidence, `CLEARED` with evidence that its condition is absent, or `UNPROVEN` with a gap; reading, delegation, or tool failure is not proof. Reconcile items after each section. Before returning, resolve all `PENDING` and count only `PROVEN` and `CLEARED`; apply the skill's verdict and approval rules to every gap.
Preserve user intent, scope, and existing authorization. Continue authorized work; ask only for consequential unresolved choices or required external approval. Scale depth to material risk without silently skipping checks. Preserve dependency and safety ordering; otherwise choose the verification method appropriate to each obligation.

## Tool Routing

| Evidence or operation needed | Preferred capability | Fallback or blocking condition |
|---|---|---|
| Task-specific need | Available capability and when it applies | Credible alternative; identify when missing evidence prevents the outcome |

## Domain Rules

- Define non-obvious invariants, evidence authority, and safety or approval gates that affect this workflow.
- Preserve independently meaningful domain rules; do not replace them with generic advice to use judgment.
- If conditional detail is substantial, link its skill-local reference here with the exact condition requiring it.

## Checklist

### 1. Establish Scope and Evidence

- [ ] Establish the requested outcome and authorized scope from the request and applicable repository instructions; separate discoverable facts from consequential unresolved choices.
- [ ] Record the relevant baseline, protected user work, and available evidence before interpreting results or making permitted changes.
- [ ] Identify the evidence required to establish this skill's outcome and which missing prerequisites would prevent it.

### 2. Perform the Domain Workflow

- [ ] Replace this example with one concrete, independently verifiable domain check and its required evidence.
- [ ] Retain each additional domain check separately, in dependency order, including conditional checks and failure paths from the existing skill.
- [ ] For a conditional check, identify its trigger; absence of the trigger needs evidence for `CLEARED`, not silent omission.

### 3. Verify the Outcome

- [ ] Trace every required outcome to observed evidence; distinguish a verified result from a proposed action, static inference, unavailable environment, or failed check.
- [ ] Resolve issues within the authorized mutation boundary and repeat affected verification when needed; read-only skills correct their analysis or report, not the reviewed implementation.
- [ ] Record remaining domain-specific risks and apply the verdict mapping without treating missing evidence as success.

## Verdict

- Define each skill-specific verdict once, with its evidence threshold and treatment of incomplete checks.
- Distinguish preparation, implementation, verification, and external publication when the workflow supports those states.
- State the stopping or approval conditions at the operation they govern; do not introduce additional approvals here.

## Self-Check

- [ ] **Reconcile before returning.** Check item-level evidence, requirement coverage, contradictions, scope, verdict, and applicable cleanup. Correct the report or authorized artifacts. Reuse valid evidence; do not automatically rescan the repository or rerun successful commands. Repeat checks only for relevant changes, failures, or unresolved evidence. Disclose remaining gaps.

## Output Contract

Report in the user's language, in this order; retain all five fields and state each fact once. Small results may use one line per field; omit empty tables and do not copy linked artifacts:

1. **Result:** Skill-specific verdict and supported outcome.
2. **Scope:** Reviewed/changed scope, exclusions, baseline, and material assumptions.
3. **Evidence:** Skill-specific fields below; distinguish facts, inferences, and unverified claims. Link artifacts; use tables when useful.
4. **Verification:** Checks/results, unavailable evidence, and applicable cleanup/external state.
5. **Completion:** `Checklist: X/Y complete`; `Incomplete: None` or each `UNPROVEN` item's reason, outcome impact, and exact next action; residual risks and required decisions.

**Skill-specific evidence:** Define the domain-specific report fields here. Preserve existing required data, such as finding severity and causal evidence, acceptance traceability, measured baselines, portfolio decisions, artifact paths, or remote publication identity. Reference canonical artifacts instead of copying their contents, except when the user must approve exact content.
```

## Change control and validation

Template adoption does not itself authorize removal of independently meaningful checks, weaker evidence thresholds, changed domain algorithms, or expanded mutation authority. Account for each removed or changed obligation against its previous location and the retained requirement. Apply explicit user authorization to substantive changes; do not ask again for the same approved scope.

Validate skill structure and common contract blocks against this template using the repository validator. Also run the repository-required skill, plugin, and marketplace validators. Static validation proves format and consistency, not behavioral equivalence. Run behavioral validation only when it is requested or warranted and permitted by the task; honor an explicit exclusion.

## Basis and local conventions

This template adapts [OpenAI skill-creator](https://github.com/openai/skills/blob/main/skills/.system/skill-creator/SKILL.md), [skill documentation](https://learn.chatgpt.com/docs/build-skills), and [GPT-6 Astra guidance](https://developers.openai.com/api/docs/guides/latest-model?model=gpt-6-astra): concise discovery, useful domain knowledge, risk-appropriate specificity, progressive disclosure, and proportionate verification.

The exact section names, checklist states, five-field report, two-field frontmatter restriction, and 200-character/200-line ceilings are repository conventions, not universal OpenAI requirements. Revisit compatibility when host contracts change; preserve useful domain checks when simplifying instructions.

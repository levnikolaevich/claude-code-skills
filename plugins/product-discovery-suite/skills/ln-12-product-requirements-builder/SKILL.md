---
name: ln-12-product-requirements-builder
description: "Defines product requirements, business rules and acceptance criteria for a committed intent; edits product docs only."
---

# Product Requirements Builder

**Goal:** Create or update a usable product requirements artifact that preserves the owner's intent and makes expected behavior testable. Change only authorized product documentation; do not invent commitments, design architecture, or implement.

**Execution contract:** The checklist defines completion. Track each item internally as `PENDING`, `PROVEN` with evidence, `CLEARED` with evidence its condition is absent, or `UNPROVEN` with a gap; reading, delegation, tool failure, a zero exit status, or a self-reported success is not proof; only the observed outcome is. Reconcile after each section. Before returning, resolve all `PENDING`, count only `PROVEN` and `CLEARED`, and apply verdict and approval rules to every gap.
Preserve intent, scope, and existing authorization. Continue authorized work; ask only for consequential unresolved choices or required external approval. When no one can answer during the run, state the exact question and apply the skill's verdict for the remaining gap instead of waiting or guessing. Scale depth to material risk without skipping checks. Preserve dependency and safety order; otherwise choose an appropriate verification method.
Accept equivalent user or repository evidence; no other skill, named artifact, or complete lifecycle is required. Preserve source requirement and decision IDs. Bind reused evidence to relevant source versions, dirty changes, configuration, and environment; invalidate only affected claims.
Choose one primary workflow by the requested outcome, honoring explicit selection. Consume neighboring contracts and valid evidence without duplicating ownership or restarting a full audit. Split genuinely distinct deliverables by scope, not by mandatory skill invocation. Broad independent assessments belong to audit workflows; focused reviews may stay with the domain workflow but remain read-only.
On continuation, reconcile task, authorization, current state, and unresolved evidence. For long work, return a compact continuation record or update an already authorized artifact; read-only skills do not persist it. Distinguish artifact readiness, verified behavior, and external-action authority.
Prepare authorized work before required approval. If blocked by an instruction, cite its exact source and unresolved boundary; do not invent approval gates from caution.
Before a new or changed technical decision, establish applicability and actual technology versions, then verify version-dependent assumptions against official documentation or specifications even when confident. Search and read primary pages for current external recommendations; search snippets are not evidence. Version-matched bundled documentation or still-valid prior evidence can suffice. Record the decision, applicable version, source and limitations. If evidence is unavailable, mark the affected conclusion UNVERIFIED and block only dependent work when essential. Prefer native mechanisms; add tools or abstractions only for an evidenced requirement. Reuse the existing project rule owner instead of creating parallel policy.


## Tool Routing

| Need | Preferred capability | Fallback |
|---|---|---|
| Intent and prior decisions | User request, product documents and accepted decisions | Bounded assumptions; ask only for missing consequential intent |
| Existing behavior | Focused repository, UI, contract and analytics evidence | Supplied examples with explicit uncertainty |
| Requirement artifact | Existing canonical product document and focused editor | User-approved destination; BLOCKED if no safe destination is available |

## Domain Rules

- Reuse the existing requirement owner; otherwise use an authorized docs/product/requirements.md. Do not impose a new document hierarchy on an established project.
- Separate observed behavior, owner preference, proposed requirements, accepted commitments, and unresolved choices. A discovery recommendation is not authorization to build.
- Use stable requirement identifiers when traceability spans artifacts. Keep functional rules here and reference architecture constraints by source; user stories are optional representations.

## Checklist

### 1. Establish Intent and Authority

- [ ] Resolve the problem, affected actors, intended outcome, horizon, approved documentation scope, and protected existing experience.
- [ ] Read repository instructions, relevant user evidence and existing requirements; inspect target files and user changes before editing.
- [ ] Identify one authoritative requirements destination and applicable decision owners; preserve unresolved conflicting sources.
- [ ] Separate non-goals, optional ideas and committed scope; clarify only choices that change acceptance or product intent.

### 2. Specify Observable Behavior

- [ ] Describe the initiating event, actor permissions, preconditions, successful outcome and meaningful alternatives for every in-scope journey.
- [ ] Specify business rules, calculations, entities and lifecycle transitions where they determine observable behavior.
- [ ] Specify applicable failure, empty, loading, retry, duplicate, cancellation and recovery behavior without inventing irrelevant states.
- [ ] Record affected integrations, external commitments, compatibility and data constraints from authoritative sources.
- [ ] Capture accessibility, privacy and other applicable user-facing constraints; reference architecture-driving targets without duplicating their owner.
- [ ] Separate required new UX from protected existing flows, copy and behavior.

### 3. Define Acceptance and Outcome

- [ ] Give each material requirement observable acceptance conditions with prerequisites and an expected result independent of implementation.
- [ ] Define the intended business effect, available baseline, measurement window and evidence source; keep unknown targets unknown.
- [ ] Identify dependencies and assumptions that can reverse scope, acceptance or the chosen product direction.
- [ ] Distinguish functional acceptance from product impact and from permission to publish or run an experiment.

### 4. Write and Validate

- [ ] Write the approved artifact with requirement IDs, source/status, acceptance, non-goals, assumptions and unresolved decisions.
- [ ] Preserve unrelated content and history of changed commitments; mark supersession instead of silently replacing accepted intent.
- [ ] Check consistency across rules, scenarios and acceptance; expose requirements that cannot yet be implemented or tested safely.
- [ ] Report the exact consequential gaps and next evidence actions; do not treat the document's existence as readiness.

## Verdict

- `READY`: requirements are consistent and testable, with no consequential unresolved intent preventing the next decision; proposed status does not imply owner acceptance.
- `INCOMPLETE`: a useful artifact exists but named requirements or decisions remain unresolved.
- `BLOCKED`: scope, authority, essential intent or a safe destination prevents responsible creation.

## Self-Check

- [ ] **Reconcile before returning.** Check item-level evidence, requirement coverage, contradictions, scope, verdict, and applicable cleanup. Correct the report or authorized artifacts. Reuse valid evidence; do not automatically rescan the repository or rerun successful commands. Repeat checks only for relevant changes, failures, or unresolved evidence. Disclose remaining gaps.

## Output Contract

Report in the user's language, in this order; label all five fields and state each fact once. Use controlled plain language: one fact per sentence, usually under 20 words, active voice, and one term per concept, with no synonyms for verdicts, IDs, or states. Small results may use one line per field; omit empty tables and do not copy linked artifacts:

1. **Result:** The exact skill-specific verdict token first, then the supported outcome.
2. **Scope:** Reviewed/changed scope, exclusions, baseline, and material assumptions.
3. **Evidence:** Skill-specific fields below; distinguish facts, inferences, and unverified claims. Link artifacts; use tables when useful.
4. **Verification:** Checks/results, unavailable evidence, and applicable cleanup/external state.
5. **Completion:** `Checklist: X/Y complete`; `Incomplete: None` or each `UNPROVEN` item's reason, outcome impact, and exact next action; residual risks and required decisions.

**Skill-specific evidence:** Artifact, intent, protected behavior, requirement/source/status/acceptance mapping, changed commitments, outcome measures, and consequential unknowns with their next evidence action.

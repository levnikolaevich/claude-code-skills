---
name: ln-12-product-requirements-builder
description: "Defines product requirements, business rules and acceptance criteria for a committed intent; edits product docs only."
---

# Product Requirements Builder

**Goal:** Create or update a usable product requirements artifact that preserves the owner's intent and makes expected behavior testable. Change only authorized product documentation; do not invent commitments, design architecture, or implement.

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

- [ ] Carry each mandatory user-facing standard into observable acceptance, including applicable locales, accessibility, device constraints and state preservation; link technical policy instead of copying its settings.

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

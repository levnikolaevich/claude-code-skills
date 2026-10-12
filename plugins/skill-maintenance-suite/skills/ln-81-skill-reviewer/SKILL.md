---
name: ln-81-skill-reviewer
description: "Reviews skill instructions, trigger boundaries and distribution contracts; not product code."
---

# Skill Reviewer

**Goal:** Review skill quality and configured distribution surfaces without modifying reviewed source or external systems. Distinguish static contract assurance from observed execution behavior.

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
| Repository scope and evidence | Native file search, focused reads, and Git diff | Equivalent read-only shell commands |
| Frontmatter and skill structure | Repository-defined or host-native skill validator | Manual YAML, path, naming, and repository-contract checks |
| Plugin integration | Repository-defined plugin validator plus manifest parsing | Manual manifest and applicable catalog comparison |
| Host discovery | Host-native validator for every configured distribution surface | Manual catalog, manifest, and source-path inspection |
| Current host rules | Official host documentation | Mark the claim `UNVERIFIED` when unavailable |
| Behavioral independence | Fresh subagent or clean context | Separate self-review passes with reduced-confidence disclosure |

Use external research only for current host behavior or a changing standard. Do not use web sources to override the repository's actual files, installed versions, or local validation output.

Tool absence is not itself a skill defect. Apply the documented fallback and use `BLOCKED` only when the missing capability prevents a reliable verdict.

## Workflow Boundary

This workflow reviews skill behavior and distribution read-only. Creating project-local procedures is authoring, not an implied repair phase of this review. Refer findings to canonical owners without changing reviewed skills.

## Checklist

### Establish scope and evidence

- [ ] Resolve target paths, Git diff, staged and untracked files; establish review mode: static content/distribution review, or behavioral validation when requested or warranted and permitted. Honor an explicit no-testing instruction; do not run scenarios or delegate evaluation in static-only mode.
- [ ] Read the repository instructions, skill contracts, and every configured host catalog before judging repository-specific conventions; do not require a catalog that the repository does not distribute.
- [ ] Separate primary skills from manifests, catalogs, and documentation affected by the same change.
- [ ] Confirm the repository-defined canonical skill layout; treat unauthorized, stale, or divergent host-specific copies as defects, while permitting adapters or generated copies that repository policy explicitly requires.
- [ ] Confirm frontmatter and folder naming satisfy the repository contract and each target host; require only `name` and `description` when that is the declared local convention rather than imposing it universally.
- [ ] Check that each description states the capability, positive trigger, and important near-negative boundary.
- [ ] Check that descriptions stay within the host limit and avoid claims broader than the workflow supports.
- [ ] Confirm each skill is standalone: no required skill, MCP server, tracker, coordinator, worker, or shared runtime.
- [ ] Apply the repository's declared completion convention; when an ordered checklist is the Definition of Done, flag a duplicate completion section.
- [ ] Preserve domain algorithms, tool routing, safety gates, evidence, verdicts, output, and residual risks. For removed checks, identify the retained obligation owner or explain why the check does not support the Goal; item count alone proves neither loss nor preservation.
- [ ] Flag generic explanations that add no decision value; preserve non-obvious domain knowledge and concrete safeguards even when no prior failure was recorded.
- [ ] Check content hierarchy and single-source ownership: keep each rule in the narrowest canonical section and flag repeated or contradictory guidance across the body, supporting files, manifests, and repository instructions.
- [ ] Flag filler, generated-summary prose, copied implementation or business logic, and volatile versions, paths, counts, defaults, or host behavior that can be replaced by a stable contract, authoritative source, capability description, or explicit update trigger.
- [ ] Verify every required capability has an available tool path, a credible fallback, or an explicit `BLOCKED` outcome.
- [ ] Check that each skill's mutation boundary matches its declared outcome; read-only workflows must not acquire implicit write authority.
- [ ] For optimization or experiment skills, require an evidence-based retain, discard, or rollback decision when they mutate state.
- [ ] For test-building or other bounded writers, confirm they cannot repair product code or touch unapproved external state unless their declared contract explicitly authorizes it.
- [ ] Trace the text through normal completion, missing tools, insufficient context, dirty Git state, failed commands, and conflicting evidence. Check prerequisites precede dependent actions, stop conditions permit safe progress, and verdicts cover failure states without contradiction.
- [ ] Check input/output compatibility, evidence invalidation, continuation, and instruction conflicts.
- [ ] Check that the output contract distinguishes facts, inferences, missing evidence, verdict, and residual risk.
- [ ] Compare neighboring triggers with each skill's Goal; require instructions to support an outcome, evidence need, or scope/safety constraint. Flag irrelevant work, missing obligations, and ambiguous branches without making skills depend on each other.

### Repository Validation

- [ ] Discover and run every repository-required skill validator for the changed skill directories; do not assume a validator name or location absent from repository evidence.
- [ ] If a required validator is unavailable, manually validate YAML parsing, naming, description constraints, and required file layout against the repository and host contracts.
- [ ] Run every repository-required plugin or package validator for affected distribution units.
- [ ] Run host-native strict validators for affected catalogs or manifests, plus any wider checks required by repository policy. Reuse valid passing evidence without rerunning unchanged checks; record actual coverage and do not treat marketplace validation as skill-frontmatter validation unless the host demonstrably traverses those skills.
- [ ] Parse all configured catalogs; compare plugin names and ordering only when repository policy requires cross-host parity.
- [ ] Confirm every declared catalog source, manifest path, and skill path exists.
- [ ] Confirm duplicated metadata such as plugin descriptions agree wherever the repository requires parity.
- [ ] For marketplace repositories, confirm stable identifiers have not changed unintentionally; display branding is not an identifier substitute.
- [ ] Search for stale names, deleted paths, draft markers, MCP coupling, orchestration terms, and generated copies.
- [ ] Apply line-count targets only when repository policy defines them, and treat them as a maintenance constraint rather than evidence of behavioral quality.

### Behavioral Review When In Scope

- [ ] Load [behavioral-review.md](references/behavioral-review.md) only when behavioral execution is in scope and authorized. Its 13 independent checklist items join this checklist's completion accounting after loading. In static-only mode, do not read the reference; mark its 13 execution-only items `CLEARED` with the scope reason, include them in the completion total, and state that behavior was not tested. Static inspection does not prove activation or execution quality.

### Evidence Rules

- [ ] Cite each finding to an exact file and the smallest useful line or section.
- [ ] Distinguish validator failures from manual concerns and speculative improvements.
- [ ] Require deterministic validator evidence, an authorized reproduction, or a complete static contradiction/failure path before assigning blocking severity; do not execute scenarios excluded by the review mode.
- [ ] Record commands executed, exit status, and material output without exposing secrets.
- [ ] Report coverage gaps when a required host or clean-context test cannot be run. Keep any permitted diagnostic artifact temporary, outside canonical plugin directories, and disclose it; do not stage, publish, or create external state during review.

## Verdict

- `PASS` — all required checks for the declared mode pass with no material concern; static-only `PASS` does not certify execution behavior.
- `CONCERNS` — no confirmed blocking defect in the reviewed scope, but bounded non-blocking uncertainty remains; do not infer untested publication or behavioral readiness.
- `FAIL` — a confirmed defect can cause wrong triggering, unsafe behavior, broken installation, or an invalid contract.
- `BLOCKED` — required evidence or tooling is unavailable and no credible fallback exists.

## Self-Check

- [ ] **Reconcile before returning.** Check item-level evidence, requirement coverage, contradictions, scope, verdict, and applicable cleanup. Correct the report or authorized artifacts. Reuse valid evidence; do not automatically rescan the repository or rerun successful commands. Repeat checks only for relevant changes, failures, or unresolved evidence. Disclose remaining gaps.

## Output Contract

Report in the user's language, in this order; label all five fields and state each fact once. Use controlled plain language: one fact per sentence, usually under 20 words, active voice, and one term per concept, with no synonyms for verdicts, IDs, or states. Small results may use one line per field; omit empty tables and do not copy linked artifacts:

1. **Result:** The exact skill-specific verdict token first, then the supported outcome.
2. **Scope:** Reviewed/changed scope, exclusions, baseline, and material assumptions.
3. **Evidence:** Skill-specific fields below; distinguish facts, inferences, and unverified claims. Link artifacts; use tables when useful.
4. **Verification:** Checks/results, unavailable evidence, and applicable cleanup/external state.
5. **Completion:** `Checklist: X/Y complete`; `Incomplete: None` or each `UNPROVEN` item's reason, outcome impact, and exact next action; residual risks and required decisions.

**Skill-specific evidence:** Target skills and distribution surfaces; structural/host parity, trigger boundaries, static versus behavioral coverage, and validator results. Findings need severity, exact location, impact, evidence, and minimal correction. Distinguish confirmed defects, manual concerns, and speculative improvements; report unavailable clean-context or runtime evidence and disclosed temporary artifacts.

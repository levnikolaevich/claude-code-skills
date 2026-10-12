---
name: ln-93-configuration-engineer
description: "Establishes configuration ownership, validation, secret boundaries and environment isolation; not credential identity policy or live deployment."
---

# Configuration Engineer

**Goal:** Deliver an approved configuration contract and its parser, injection paths, consumers and checks. Preserve compatibility and environment authority; rotation or shared-runtime restart requires explicit target scope.

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
| Actual stack and owners | Instructions, manifests, lockfiles, focused source/configuration reads and Git state | Supplied artifacts with explicit gaps; never infer versions from examples |
| External semantics | Version-matched official documentation, specifications and maintained upstream source | Bundled official docs or valid prior evidence; mark unsupported conclusions UNVERIFIED |
| Authorized changes | Project-native editor, configuration and maintained runtime tooling | Minimal scoped patch; BLOCKED when no safe mutation capability exists |
| Observable verification | Existing checks and isolated runtime/consumer exercises | Static evidence labeled as such; BLOCKED when essential behavior cannot be established |

## Boundaries

This workflow owns sourcing, capture and validation. Authentication owns credential semantics; deployment owns environment application. Exact keys/defaults belong to executable owners, not duplicated documentation inventories.

Review and explanation requests are read-only. Preparation does not authorize remote publication, deployment or shared-state mutation.

## Checklist

### 1. Trace effective values

- [ ] Trace affected keys through parser, defaults, consumers, examples, CI, build, process and deployment injection.
- [ ] Classify each value as secret, browser-public, runtime, migration/operator or process-only; identify build/startup/runtime capture.
- [ ] Prove precedence, absent/empty/invalid behavior and intended environment identity without printing sensitive values.
- [ ] Inspect aliases and fallback selectors; preserve verified consumers while eliminating unsupported duplicate owners.

### 2. Implement the contract

- [ ] Use native configuration/secret mechanisms; validate required values and relationships before unsafe effects.
- [ ] Keep environment identity, optimization mode and endpoint selection distinct when their meanings differ; labels alone do not prove safe targets.
- [ ] Prevent server-only values entering client bundles, image layers, command arguments or logs; keep examples synthetic.
- [ ] Update parser, consumers and examples together; document removal triggers for necessary transitional aliases.
- [ ] Isolate local/test resources from shared targets; reject ambiguous database/service destinations before mutation.
- [ ] For authorized rotation, establish consumer capture phase, overlap/recovery strategy and verification; invalidate old credentials only after required replacement evidence.

### 3. Verify effective behavior

- [ ] Exercise valid, missing, empty, invalid and competing-source inputs through the owning boundary; assert effective behavior rather than parser internals.
- [ ] Check build versus runtime exposure and restart/rebuild needs using synthetic canaries.
- [ ] Search affected consumers/docs for stale keys, shadow sources and public exposure; preserve unrelated configuration.

- [ ] Reconcile final changes with protected behavior, canonical owners and observed checks; update only authorized guidance and report remaining gaps.

## Verdict

- `DELIVERED`: the requested scoped change is retained with all required behavioral evidence.
- `PARTIAL`: an independently safe verified subset is retained; unresolved requirements are explicit.
- `NO_CHANGE`: evidence shows the requested outcome already holds without edits; not a fallback for missing checks.
- `PASS` / `CONCERNS` / `FAIL`: read-only assessment finds respectively no material issue, bounded nonblocking issues, or an evidenced required correction.
- `BLOCKED`: essential intent, authority, safe capability or evidence is unavailable; report actual retained/restored state.

## Self-Check

- [ ] **Reconcile before returning.** Check item-level evidence, requirement coverage, contradictions, scope, verdict, and applicable cleanup. Correct the report or authorized artifacts. Reuse valid evidence; do not automatically rescan the repository or rerun successful commands. Repeat checks only for relevant changes, failures, or unresolved evidence. Disclose remaining gaps.

## Output Contract

Report in the user's language, in this order; label all five fields and state each fact once. Use controlled plain language: one fact per sentence, usually under 20 words, active voice, and one term per concept, with no synonyms for verdicts, IDs, or states. Small results may use one line per field; omit empty tables and do not copy linked artifacts:

1. **Result:** The exact skill-specific verdict token first, then the supported outcome.
2. **Scope:** Reviewed/changed scope, exclusions, baseline, and material assumptions.
3. **Evidence:** Skill-specific fields below; distinguish facts, inferences, and unverified claims. Link artifacts; use tables when useful.
4. **Verification:** Checks/results, unavailable evidence, and applicable cleanup/external state.
5. **Completion:** `Checklist: X/Y complete`; `Incomplete: None` or each `UNPROVEN` item's reason, outcome impact, and exact next action; residual risks and required decisions.

**Skill-specific evidence:** Key names and owners without values, classification/capture phase, precedence, target identity, consumer changes, compatibility, effective behavior, rotation state and rebuild/restart impact.

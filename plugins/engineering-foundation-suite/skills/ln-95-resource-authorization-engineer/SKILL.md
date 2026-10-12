---
name: ln-95-resource-authorization-engineer
description: "Implements permissions and tenant or owner scoped resource access while preserving approved grants; not authentication or role redesign."
---

# Resource Authorization Engineer

**Goal:** Deliver approved operation/resource authorization with negative access evidence. Preserve grant matrix and observable behavior unless explicitly changed; unresolved grants are product decisions, never permission defaults.

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
| Actual stack and owners | Instructions, manifests, lockfiles, focused source/configuration reads and Git state | Supplied artifacts with explicit gaps; never infer versions from examples |
| External semantics | Version-matched official documentation, specifications and maintained upstream source | Bundled official docs or valid prior evidence; mark unsupported conclusions UNVERIFIED |
| Authorized changes | Project-native editor, configuration and maintained runtime tooling | Minimal scoped patch; BLOCKED when no safe mutation capability exists |
| Observable verification | Existing checks and isolated runtime/consumer exercises | Static evidence labeled as such; BLOCKED when essential behavior cannot be established |

## Boundaries

Authentication supplies trusted actor context. This workflow owns permission evaluation and resource scope for each independently protected object. Roles may group permissions; attributes/relationships express resource policy. Do not mandate a policy engine, RLS or role taxonomy.

For access check/use races, this workflow owns the authorization predicate and when it must hold. Consume the operation's atomicity mechanism; do not define a second transaction or retry policy.

Review and explanation requests are read-only. Preparation does not authorize remote publication, deployment or shared-state mutation.

## Checklist

### 1. Recover policy

- [ ] Inventory detail, list, search, download/export, creation, mutation, bulk, nested and background entrypoints.
- [ ] Recover actors, operation permissions, role grants, owner/tenant relationships and exceptions from approved policy and actual behavior; identify contradictions.
- [ ] Bind actor attributes to verified server context; client identifiers select resources but never prove authorization.

### 2. Enforce the contract

- [ ] Deny unknown operations, missing required attributes and unmatched policy; centralize policy ownership without empty wrappers.
- [ ] Check operation permission and resource scope at server owning boundaries; UI visibility/layout is not access control.
- [ ] Apply authorization predicates to initial retrieval and collections where needed to prevent existence/row leaks; allow valid empty collections.
- [ ] Authorize every resource in compound, nested, file and bulk operations; reading metadata does not imply download or write permission.
- [ ] Derive creation/reassignment ownership from trusted actor and validated resolved records; reject forged tenant/owner fields.
- [ ] Close check/use races with actual transactions or conditional writes when concurrent changes affect access.
- [ ] Preserve approved denial/concealment, cache and background credential semantics; role-to-permission refactoring must not broaden grants.
- [ ] When database policies are relied upon, verify runtime privileges and trusted context propagation; do not assume defense in depth replaces application checks.

### 3. Prove access boundaries

- [ ] Exercise actor-operation-resource matrix: allowed, missing permission, foreign tenant/owner, nonexistent ID and revoked access.
- [ ] Attempt identifier substitution through collections, objects, files/exports, bulk and alternate entrypoints; assert no data/effect escapes scope.
- [ ] Compare retained grants and consumer outcomes with approved baseline; report missing policy separately from implementation failure.

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

**Skill-specific evidence:** Approved grants, trusted inputs, operation/resource matrix, owning guards/query predicates, tested bypasses, compatibility and unresolved policy decisions.

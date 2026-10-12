---
name: ln-94-authentication-engineer
description: "Implements or repairs identity verification and session or credential lifecycle; not operation permissions, resource access policy or a new identity provider by default."
---

# Authentication Engineer

**Goal:** Deliver approved authentication behavior using supported platform or maintained identity mechanisms. Preserve login flows and clients unless change is authorized; do not invent enrollment, recovery or privilege policy.

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

Authentication establishes a verified actor and credential context. Authorization decides which operations/resources that actor may access. Reuse existing identity providers; custom cryptography or new infrastructure needs an evidenced gap.

Review and explanation requests are read-only. Preparation does not authorize remote publication, deployment or shared-state mutation.

## Checklist

### 1. Establish identity boundaries

- [ ] Identify actors, credential types, trust boundaries, provider/library versions and entrypoints; distinguish application identity from ingress authentication.
- [ ] Trace existing sign-in, validation, issuance, renewal, logout, expiry, revocation and recovery flows.
- [ ] Read approved enrollment, MFA and recovery policy; expose missing decisions instead of granting features or privileges.

### 2. Implement lifecycle

- [ ] Validate credential authenticity, issuer/audience, lifetime and intended use through supported APIs; decoded claims alone are not authentication.
- [ ] Define credential precedence; reject an explicitly invalid credential instead of silently downgrading to another identity.
- [ ] Bind sessions to trusted server context; apply cookie, transport and CSRF protections appropriate to credential transport.
- [ ] Prevent fixation and replay where applicable; rotate/invalidate credentials at contract-required lifecycle transitions.
- [ ] Use maintained password storage/verification when applicable; prevent account enumeration, secret logging and recovery bypasses.
- [ ] Apply approved attempt limits and recent-auth/MFA gates; preserve accessible recovery without inventing its business policy.
- [ ] Propagate minimal verified actor context to permission checks; keep business grants out of authentication middleware.

### 3. Verify actors and failures

- [ ] Exercise valid, malformed, expired, revoked and conflicting credentials through real entrypoints; cover renewal/logout and concurrent refresh where supported.
- [ ] Check cross-user session isolation, redirect validation and credential leakage in responses, storage and logs.
- [ ] Preserve approved UX and compatibility; distinguish local checks from untested provider integration.

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

**Skill-specific evidence:** Identity/trust boundaries, supported credentials, lifecycle policy, preserved flows, version-specific decisions, observed expiry/revocation/renewal and external integration limits.

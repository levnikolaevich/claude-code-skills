---
name: ln-94-authentication-engineer
description: "Implements or repairs identity verification and session or credential lifecycle; not operation permissions, resource access policy or a new identity provider by default."
---

# Authentication Engineer

**Goal:** Deliver approved authentication behavior using supported platform or maintained identity mechanisms. Preserve login flows and clients unless change is authorized; do not invent enrollment, recovery or privilege policy.

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

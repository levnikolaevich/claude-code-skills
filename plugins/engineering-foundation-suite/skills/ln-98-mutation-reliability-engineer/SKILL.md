---
name: ln-98-mutation-reliability-engineer
description: "Implements transactions, idempotency and interrupted-operation recovery; not schema migration or a mandatory background-job platform."
---

# Mutation Reliability Engineer

**Goal:** Deliver approved mutation reliability while preserving business effects and consumer contracts. Change only scoped operations and required integration boundaries; live replay/compensation requires explicit affected-target authority.

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

This workflow owns runtime atomicity, concurrency and recovery. Database lifecycle owns schema delivery; errors own safe consumer representation. Choose transactions, replayable requests or durable jobs from operation needs; at-least-once delivery does not guarantee exactly-once effects.

Authorization owns access predicates and their required validity window; enforce them through the operation's atomicity mechanism without redefining grants. For durable audit records, implement only the approved effect-to-record consistency contract; record contents, access and retention remain separate policy inputs.

Review and explanation requests are read-only. Preparation does not authorize remote publication, deployment or shared-state mutation.

## Checklist

### 1. Model failure windows

- [ ] Trace dispatch, each database/file/queue/external effect and acknowledgement; identify authoritative completion evidence.
- [ ] Define protected invariants, concurrent actors, existing retry owners and approved partial-success behavior.
- [ ] Classify request-atomic, replayable request or durable job; prefer existing transactions/constraints before new coordination.

### 2. Implement recovery

- [ ] Align transaction ownership with the business invariant and native isolation; use constraints/conditional writes to close demonstrated races.
- [ ] For replayable requests, scope idempotency key and fingerprint, persist effect/result consistently, and define conflicting reuse and retention from the contract.
- [ ] Lost commit acknowledgement or post-dispatch timeout is not rollback; resolve authoritative state before retry or compensation.
- [ ] Bound attempts, deadlines and backoff with appropriate jitter; retry only classified transient failures and replay-safe effects at one layer.
- [ ] For durable jobs use maintained mechanisms when they fit; define claims, necessary leases, idempotent handlers, retry/poison-item handling and terminal state.
- [ ] Checkpoint resumable work at durable boundaries; worker termination must resume without skipped/duplicated business effects.
- [ ] Model non-atomic database/filesystem/remote windows explicitly; use recoverable stages or existing outbox/inbox mechanisms where justified.
- [ ] Keep authorization context and resource access valid during execution; do not retain stale privileges to simplify replay.

### 3. Exercise interruption

- [ ] Inject failure before effect, after effect before response and during recovery; observe authoritative final state, not just retry command success.
- [ ] Exercise duplicate/concurrent submissions, mismatched idempotency payloads and applicable worker restart; assert business invariants.
- [ ] Verify bounded cleanup cannot delete valid output after unknown commit; report unresolved external effects without automatic compensation.

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

**Skill-specific evidence:** Invariant, effect/acknowledgement boundaries, execution model, transaction/idempotency/retry owners, interruption/concurrency evidence, unresolved effects and recovery authority.

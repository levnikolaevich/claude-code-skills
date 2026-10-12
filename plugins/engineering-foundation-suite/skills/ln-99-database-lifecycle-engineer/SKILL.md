---
name: ln-99-database-lifecycle-engineer
description: "Prepares and verifies schema migrations, database roles and isolated recovery or test resources; not query tuning or runtime mutation orchestration."
---

# Database Lifecycle Engineer

**Goal:** Deliver approved database lifecycle artifacts and verified changes on authorized targets. Separate authoring, disposable verification and shared application; code changes or connectivity do not authorize shared data mutation.

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

This workflow owns schema delivery, migration authority and database provisioning/recovery. Runtime replay belongs to the operation owner; query optimization and read-only persistence audit are separate outcomes. Configuration supplies connections, not authority to use them.

A focused review of a migration or recovery procedure stays within this domain and remains read-only. An independent assessment across queries, transactions and persistence lifetimes belongs to persistence auditing; do not duplicate that assessment here.

Review and explanation requests are read-only. Preparation does not authorize remote publication, deployment or shared-state mutation.

## Checklist

### 1. Identify catalog and target

- [ ] Inspect migration framework/version, catalog/checksums, baseline, consumers and source/target states; preserve applied immutable migrations.
- [ ] Identify preservation, lock, rewrite, backfill and mixed-version compatibility risks before selecting steps.
- [ ] Separate application, migration and admin capabilities through native privileges; do not grant runtime DDL for easier startup.
- [ ] Prove target identity and authorized operation independently of labels; stop ambiguous/shared changes before mutation.

### 2. Prepare delivery and recovery

- [ ] Use the existing ordered migration mechanism; avoid parallel bootstrap, ad hoc repair or privileged automatic startup paths.
- [ ] Use compatible transitions where rolling versions require them; do not promise rollback of irreversible data loss.
- [ ] Make backfills/nontransactional steps resumable with observable progress and applicable native lock/time limits.
- [ ] Provision isolated disposable resources with unique run ownership and synthetic/approved sanitized data; never reuse/delete shared databases by guessed names.
- [ ] Before shared apply/restore, verify explicit target authority, actual identity, required backup/recovery evidence, write window and compatibility.
- [ ] Execute only the authorized phase; preserve failure state and establish native retry/repair semantics before another attempt.

### 3. Prove lifecycle safety

- [ ] Exercise supported predecessor-to-target migration on isolated data; check schema/grants, preserved rows and application compatibility.
- [ ] Verify rerun, interrupted backfill and applicable concurrent/nontransactional recovery; bind evidence to exact checksums.
- [ ] For backup/restore scope, demonstrate restoration and usable data in isolation; backup command success alone proves no recovery.
- [ ] Reconcile actual catalog/target after failure; remove only identified run-owned resources and disclose cleanup/application gaps.

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

**Skill-specific evidence:** Catalog/migration identities, source/target/checksums, roles, data/lock/compatibility impacts, authorized phase, isolated verification, restoration and actual target/cleanup state.

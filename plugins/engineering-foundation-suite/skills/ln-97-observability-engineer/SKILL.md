---
name: ln-97-observability-engineer
description: "Implements structured diagnostics, correlation and justified metrics or traces; not incident investigation or a mandatory telemetry platform."
---

# Observability Engineer

**Goal:** Deliver approved observability that answers concrete diagnostic questions with bounded cost/exposure. Limit instrumentation and pipeline changes to scope; live collector deployment remains separate.

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
| Actual stack and owners | Instructions, manifests, lockfiles, focused source/configuration reads and Git state | Supplied artifacts with explicit gaps; never infer versions from examples |
| External semantics | Version-matched official documentation, specifications and maintained upstream source | Bundled official docs or valid prior evidence; mark unsupported conclusions UNVERIFIED |
| Authorized changes | Project-native editor, configuration and maintained runtime tooling | Minimal scoped patch; BLOCKED when no safe mutation capability exists |
| Observable verification | Existing checks and isolated runtime/consumer exercises | Static evidence labeled as such; BLOCKED when essential behavior cannot be established |

## Boundaries

This workflow owns emitted diagnostic events and delivery properties. Error handling owns public semantics; durable mutation state owns business outcomes. Best-effort operational logs are not a durable audit ledger. Incident investigation consumes telemetry without changing producers.

For a durable audit-ledger request, use approved requirements for record contents, access, retention, integrity and failure behavior. Missing consequential policy belongs to requirements or architecture decisions, not logging defaults. Scoped product implementation owns the ledger; operation reliability supplies effect-to-record consistency. No other skill invocation is required, and instrumentation scope alone does not authorize implementing the ledger.

Review and explanation requests are read-only. Preparation does not authorize remote publication, deployment or shared-state mutation.

## Checklist

### 1. Define diagnostic needs

- [ ] Identify operators, failure questions, entrypoints, runtime versions, existing signal owners and collection paths.
- [ ] Map each event/signal to a diagnostic question and appropriate severity; remove duplicate layer-by-layer emission and unjustified noise.
- [ ] Classify sensitivity, retention/access needs and delivery guarantees; distinguish operational diagnostics from durable audit records.

### 2. Instrument owners

- [ ] Use native structured logging and existing collectors; new backends, tracing or direct collector coupling need evidence.
- [ ] Include stable event identity, time, severity, service/environment and useful request/operation/release correlation without competing ID owners.
- [ ] Redact secrets/sensitive payloads, sanitize untrusted fields and bound record/stack detail using actual transport constraints.
- [ ] Emit terminal errors once at the responsible boundary; preserve useful context without treating expected control flow as exceptional.
- [ ] Emit durable lifecycle claims only after the outcome is established; distinguish attempted, committed, failed and unknown effects.
- [ ] Keep high-cardinality identifiers out of metric dimensions/index labels; choose retention/sampling for actual diagnostic and cost needs.
- [ ] Add metrics/traces only for an unanswered diagnostic question; propagate context across actual async/process boundaries using supported mechanisms.
- [ ] Handle collector outages and instrumentation failure according to delivery requirements; ordinary diagnostic failure must not silently change product outcomes.

### 3. Verify utility

- [ ] Exercise success, rejection and failure from producer through the available collection boundary.
- [ ] Check actual output for redaction with synthetic canaries, levels, duplicate events, correlation and limits.
- [ ] Exercise unavailable collection/full buffers when material; separate verified emission, remote ingestion and audit durability.

- [ ] Reconcile final changes with protected behavior, canonical owners and observed checks; update affected guidance within the authorized change and report remaining gaps.

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

**Skill-specific evidence:** Diagnostic questions, event/level owners, correlation, redaction/cost decisions, observed safe samples, delivery guarantees and unavailable pipeline evidence.

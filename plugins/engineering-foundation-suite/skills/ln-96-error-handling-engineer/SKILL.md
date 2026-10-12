---
name: ln-96-error-handling-engineer
description: "Implements safe error boundaries, cancellation and user recovery contracts; not telemetry pipelines or durable retry machinery."
---

# Error Handling Engineer

**Goal:** Deliver approved error handling from failing operation to consumer feedback. Preserve transport/UX contracts unless change is authorized; do not redesign screens or introduce logging/recovery frameworks.

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

Errors own classification, safe translation and consumer recovery information. Observability owns diagnostic emission; mutation reliability owns effect resolution and replay. Transport failure after dispatch does not prove failure or rollback.

Consume the diagnostic contract's emission owner when handling errors; checking for duplicate logs does not authorize a competing event policy. If that owner is missing, expose the contract gap or resolve only an explicitly scoped diagnostic decision.

Review and explanation requests are read-only. Preparation does not authorize remote publication, deployment or shared-state mutation.

## Checklist

### 1. Trace failure ownership

- [ ] Identify transport, domain, infrastructure, client and process boundaries; inspect existing public contracts.
- [ ] Classify expected rejection, unknown failure, cancellation, timeout and unknown outcome; preserve causes for controlled diagnostics.
- [ ] Find duplicate catches, swallowed exceptions and competing feedback owners; retain catches only for translation, cleanup or justified recovery.

### 2. Implement boundaries

- [ ] Use native exception/response mechanisms; consider Problem Details for HTTP without breaking clients, and native contracts for other transports.
- [ ] Expose stable safe codes/messages and allowed details; do not serialize arbitrary exceptions, secrets or internal topology.
- [ ] Keep transport mapping at the boundary, not infrastructure primitives; unknown failures produce safe generic responses.
- [ ] Prevent cleanup failure replacing the primary failure; preserve cancellation and runtime-appropriate fatal-process behavior.
- [ ] Handle streaming failures after headers in the stream owner; do not claim the original status can still be replaced.
- [ ] Validate bounded error payloads at clients; distinguish malformed responses, transport failures and confirmed rejection.
- [ ] Choose one visible feedback owner; preserve input, accessible error/status semantics and useful recovery without duplicate notifications.
- [ ] Distinguish initial-load failure from empty data and refresh failure from losing loaded data; notification failure must not undo confirmed mutation success.
- [ ] Offer retries only from the operation contract; resolve unknown effects before replay or compensation.

### 3. Exercise consumers

- [ ] Inject expected and unexpected boundary failures; verify public shape/status, secret redaction and preserved diagnostic cause.
- [ ] Exercise cancellation, disconnect-after-dispatch, cleanup failure and applicable streaming paths; assert safe outcomes.
- [ ] Check clients for one useful feedback path and retained state; verify no duplicate log emission or incidental UX expansion.

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

**Skill-specific evidence:** Failure taxonomy, owners, public compatibility, safe responses, feedback ownership, unknown outcome handling, executed failure cases and client coverage gaps.

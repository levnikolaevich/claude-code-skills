---
name: ln-71-operations-investigator
description: "Diagnoses incidents from operational evidence and proposes recovery; does not change live systems."
---

# Operations Investigator

**Goal:** Establish the impact and supported causes of one operational incident or deviation, and return bounded recovery or remediation options. Do not change services, configuration, credentials, persisted data or incident systems.

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
| Incident boundary | User report, service ownership and operational objectives | Explicit bounded assumptions and missing evidence |
| Operational evidence | Authorized read-only metrics, logs, traces and deployment/change history | Sanitized exports with timestamps and provenance |
| Hypothesis checks | Existing telemetry queries and safe offline reproduction | Static causal trace; no production probes or load without authority |

## Workflow Boundary

This workflow owns read-only incident diagnosis. Observability engineering changes instrumentation; mutation or database engineering changes recovery mechanisms. Diagnostic access does not authorize replay, repair, migration or collector deployment.

## Domain Rules

- Separate symptoms, contributing conditions, supported cause and unresolved hypotheses. Correlation with a deployment is not causal proof.
- Bound telemetry queries by incident window and scope; redact sensitive values and avoid unbounded queries or costly live experiments.
- Urgency does not authorize recovery mutations. Describe immediate safe options separately from root-cause remediation and prevention.

## Checklist

### 1. Establish the Incident

- [ ] Resolve affected service, environment, users, symptoms, time window, timezone, severity evidence and investigation authority.
- [ ] Identify baseline service objectives, normal behavior, ownership and current incident/recovery status.
- [ ] Record evidence availability, retention, sampling and clock uncertainty before interpreting absence of events.
- [ ] Identify already attempted mitigations and source/deployment/configuration changes within the causal window.

### 2. Collect and Correlate Evidence

- [ ] Build a timeline from observed events with source identities and timestamps; distinguish event time from ingestion time.
- [ ] Measure impact on requests, users, data correctness and dependencies where evidence permits; do not fabricate denominators.
- [ ] Trace the failure across entrypoints, dependencies, state and resource boundaries using correlated evidence.
- [ ] Inspect material errors, saturation, latency, retries, timeouts and configuration changes without assuming one universal failure pattern.
- [ ] Preserve conflicting and missing signals, including sampling or missing instrumentation that can change the conclusion.

### 3. Test Explanations and Recovery Options

- [ ] Rank plausible causal explanations and identify an observation that could refute each material candidate.
- [ ] Use safe existing evidence or authorized offline reproduction to distinguish alternatives; do not execute live fixes.
- [ ] Identify immediate containment and recovery options with prerequisites, expected effect, risk and verification signals.
- [ ] Separate reversible mitigations from irreversible data or infrastructure actions and flag missing authority explicitly.
- [ ] Define the smallest owning remediation and prevention scope supported by the evidence; avoid unrelated hardening.

### 4. Report Operational Findings

- [ ] State whether the cause is supported, narrowed to hypotheses, or unknown, with evidence strength and residual ambiguity.
- [ ] If recovery evidence exists, verify the observed identity and health window without claiming this investigation performed recovery.
- [ ] Return the incident timeline, bounded action options and next evidence steps without changing external incident records.
- [ ] Name observability gaps that prevented diagnosis and the concrete signal needed to resolve each.

## Verdict

- `DIAGNOSED`: evidence supports a causal explanation and bounded action options; this does not mean the incident is resolved.
- `INCONCLUSIVE`: useful investigation narrowed the issue but cause or impact remains unproven.
- `BLOCKED`: essential incident identity, authorized evidence or safe investigation capability is unavailable.

## Self-Check

- [ ] **Reconcile before returning.** Check item-level evidence, requirement coverage, contradictions, scope, verdict, and applicable cleanup. Correct the report or authorized artifacts. Reuse valid evidence; do not automatically rescan the repository or rerun successful commands. Repeat checks only for relevant changes, failures, or unresolved evidence. Disclose remaining gaps.

## Output Contract

Report in the user's language, in this order; label all five fields and state each fact once. Use controlled plain language: one fact per sentence, usually under 20 words, active voice, and one term per concept, with no synonyms for verdicts, IDs, or states. Small results may use one line per field; omit empty tables and do not copy linked artifacts:

1. **Result:** The exact skill-specific verdict token first, then the supported outcome.
2. **Scope:** Reviewed/changed scope, exclusions, baseline, and material assumptions.
3. **Evidence:** Skill-specific fields below; distinguish facts, inferences, and unverified claims. Link artifacts; use tables when useful.
4. **Verification:** Checks/results, unavailable evidence, and applicable cleanup/external state.
5. **Completion:** `Checklist: X/Y complete`; `Incomplete: None` or each `UNPROVEN` item's reason, outcome impact, and exact next action; residual risks and required decisions.

**Skill-specific evidence:** Incident/environment, impact and measurement limits, timeline, source identities, causal and rejected hypotheses, recovery options and verification, observed current status and exact remaining evidence needs.

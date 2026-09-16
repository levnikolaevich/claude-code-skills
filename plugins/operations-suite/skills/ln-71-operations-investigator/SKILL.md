---
name: ln-71-operations-investigator
description: "Diagnoses incidents from operational evidence and proposes recovery; does not change live systems."
---

# Operations Investigator

**Goal:** Establish the impact and supported causes of one operational incident or deviation, and return bounded recovery or remediation options. Do not change services, configuration, credentials, persisted data or incident systems.

**Execution contract:** The checklist defines completion. Track each item internally as `PENDING`, `PROVEN` with evidence, `CLEARED` with evidence its condition is absent, or `UNPROVEN` with a gap; reading, delegation, or tool failure is not proof. Reconcile after each section. Before returning, resolve all `PENDING`, count only `PROVEN` and `CLEARED`, and apply verdict and approval rules to every gap.
Preserve intent, scope, and existing authorization. Continue authorized work; ask only for consequential unresolved choices or required external approval. Scale depth to material risk without skipping checks. Preserve dependency and safety order; otherwise choose an appropriate verification method.
Accept equivalent user or repository evidence; no other skill, named artifact, or complete lifecycle is required. Preserve source requirement and decision IDs. Bind reused evidence to relevant source versions, dirty changes, configuration, and environment; invalidate only affected claims.
On continuation, reconcile task, authorization, current state, and unresolved evidence. For long work, return a compact continuation record or update an already authorized artifact; read-only skills do not persist it. Distinguish artifact readiness, verified behavior, and external-action authority.
Prepare authorized work before required approval. If blocked by an instruction, cite its exact source and unresolved boundary; do not invent approval gates from caution.


## Tool Routing

| Need | Preferred capability | Fallback |
|---|---|---|
| Incident boundary | User report, service ownership and operational objectives | Explicit bounded assumptions and missing evidence |
| Operational evidence | Authorized read-only metrics, logs, traces and deployment/change history | Sanitized exports with timestamps and provenance |
| Hypothesis checks | Existing telemetry queries and safe offline reproduction | Static causal trace; no production probes or load without authority |

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

Report in the user's language, in this order; retain all five fields and state each fact once. Small results may use one line per field; omit empty tables and do not copy linked artifacts:

1. **Result:** Skill-specific verdict and supported outcome.
2. **Scope:** Reviewed/changed scope, exclusions, baseline, and material assumptions.
3. **Evidence:** Skill-specific fields below; distinguish facts, inferences, and unverified claims. Link artifacts; use tables when useful.
4. **Verification:** Checks/results, unavailable evidence, and applicable cleanup/external state.
5. **Completion:** `Checklist: X/Y complete`; `Incomplete: None` or each `UNPROVEN` item's reason, outcome impact, and exact next action; residual risks and required decisions.

**Skill-specific evidence:** Incident/environment, impact and measurement limits, timeline, source identities, causal and rejected hypotheses, recovery options and verification, observed current status and exact remaining evidence needs.

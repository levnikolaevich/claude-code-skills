---
name: ln-63-deployment-engineer
description: "Prepares delivery pipelines and remote infrastructure, then executes authorized rollouts; not standalone quality-gate setup or local container packaging."
---

# Deployment Engineer

**Goal:** Prepare and, when authorized, deploy one bounded change through the established delivery platform. Modify only approved CI/CD, IaC, configuration and deployment documentation; external actions remain limited to the named environment and authority.

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
| Source and environment | Repository release/build definitions, immutable artifact identity and environment inventory | Supplied verified artifacts; BLOCKED if target identity is uncertain |
| Provider semantics | Installed CLI/provider version and current official documentation | Reviewed native plan with explicit unsupported semantics |
| Preparation | Native build, pipeline validation, IaC plan and configuration diff | Non-mutating inspection; disclose missing execution proof |
| Deployment and health | Authorized provider CLI/API, rollout status, logs and probes | Exact operator procedure; do not report execution that was not observed |

## Workflow Boundary

This workflow owns delivery topology, pipeline triggers, permissions, credentials, environments, artifact publication, remote infrastructure, rollout and observed health. Quality-gate configuration owns check semantics and commands; it may connect them to existing local/CI entrypoints without changing these delivery aspects. Consume those commands instead of duplicating rules in pipelines. Container engineering owns image/local packaging; configuration engineering owns value semantics; database lifecycle owns migration semantics. Consume those existing contracts and evidence without requiring another skill or copying their checklists. Execute only the authorized delivery step; a migration or policy redesign needs its own explicit scope.

## Domain Rules

- Prepare a concrete source/artifact, environment diff, rollout, health checks, stop conditions and recovery before requesting any missing external approval. Existing unchanged authorization remains valid.
- Identify account, region, cluster/workspace and environment before mutation. A local configuration edit or release tag does not authorize live application, data migration or resource deletion.
- Use existing credential stores and secret references; never embed or print credentials. An IaC plan may refresh state or contact services: inspect native command semantics before calling it.
- A failed rollout is not a successful request. Recover only within granted authority; stop retries when the same failure recurs without new evidence or safe recovery is unavailable.

## Checklist

### 1. Establish Scope and Baseline

- [ ] Resolve the requested outcome: preparation only or execution, target environment, allowed resources, change window and external authority.
- [ ] Inspect repository instructions, dirty files, delivery conventions, current deployed identity and protected resources.
- [ ] Bind the proposed deployment to a checked source revision and immutable build artifact or digest.
- [ ] Inspect required access without disclosing secrets; distinguish unavailable access from a product defect.

### 2. Prepare the Delivery Change

- [ ] Identify necessary CI/CD, IaC and configuration changes and reuse the existing platform mechanisms.
- [ ] Scope resource creation, change and deletion explicitly; identify data, availability, cost and compatibility impacts.
- [ ] Apply only authorized local changes and use native formatting, validation and planning commands with understood side effects.
- [ ] Verify build provenance, configuration, secret references and environment prerequisites for the exact proposed artifact.
- [ ] Define rollout batches, health signals, observation windows and success thresholds from requirements or current operational policy.
- [ ] Define abort conditions and a tested or evidenced recovery path, including limits of rollback after data changes.
- [ ] Present the concrete target, diff, artifact and recovery boundary if external approval is still required; do not execute dependent mutations before it.

### 3. Execute Authorized Delivery

- [ ] For preparation-only scope, clear execution obligations with evidence of that boundary and retain an executable operator plan.
- [ ] Before an authorized apply, reconcile target identity, current drift, artifact and approval scope; regenerate affected plans after material changes.
- [ ] Execute through native deployment mechanisms and record operation identity, resulting resources and progress.
- [ ] Observe deployment status and user-facing smoke/health behavior for the required window; command exit success alone is insufficient.
- [ ] On failure, stop forward rollout, preserve diagnostic evidence and perform only authorized recovery; verify the resulting state.
- [ ] Retry only after a specific cause or prerequisite changes; stop when additional attempts cannot produce safe new evidence.

### 4. Reconcile the Result

- [ ] Verify the actual deployed identity and required health evidence, or report the exact prepared-only boundary.
- [ ] Reconcile managed configuration and documentation with actual state; preserve unrelated work and remove only run-owned temporary artifacts.
- [ ] Report partial application, drift, recovery performed, ongoing observation gaps and any unresolved user action.

## Verdict

- `PREPARED`: the requested preparation is validated and execution prerequisites/limits are explicit; it does not satisfy a request that also requires deployment.
- `DEPLOYED`: the authorized artifact is observed in the target environment with all required health evidence.
- `FAILED`: deployment or health failed; report the actual partial/recovered state and unresolved outcome.
- `BLOCKED`: essential identity, authority, verification or a safe recovery prerequisite is unavailable.

## Self-Check

- [ ] **Reconcile before returning.** Check item-level evidence, requirement coverage, contradictions, scope, verdict, and applicable cleanup. Correct the report or authorized artifacts. Reuse valid evidence; do not automatically rescan the repository or rerun successful commands. Repeat checks only for relevant changes, failures, or unresolved evidence. Disclose remaining gaps.

## Output Contract

Report in the user's language, in this order; label all five fields and state each fact once. Use controlled plain language: one fact per sentence, usually under 20 words, active voice, and one term per concept, with no synonyms for verdicts, IDs, or states. Small results may use one line per field; omit empty tables and do not copy linked artifacts:

1. **Result:** The exact skill-specific verdict token first, then the supported outcome.
2. **Scope:** Reviewed/changed scope, exclusions, baseline, and material assumptions.
3. **Evidence:** Skill-specific fields below; distinguish facts, inferences, and unverified claims. Link artifacts; use tables when useful.
4. **Verification:** Checks/results, unavailable evidence, and applicable cleanup/external state.
5. **Completion:** `Checklist: X/Y complete`; `Incomplete: None` or each `UNPROVEN` item's reason, outcome impact, and exact next action; residual risks and required decisions.

**Skill-specific evidence:** Requested mode, target/account/environment, source and artifact identity, approved diff, validation, rollout operation, health/window evidence, recovery and actual final state; separate readiness from execution.

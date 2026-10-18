---
name: ln-72-product-outcome-evaluator
description: "Evaluates observed product outcomes against a prior hypothesis; does not run experiments or change user treatment."
---

# Product Outcome Evaluator

**Goal:** Determine what available evidence supports about a delivered product outcome and recommend continuation, adjustment or stopping. Remain read-only: do not change instrumentation, experiments, user treatment, campaigns or product files.

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
| Original hypothesis | Product intent, baseline, experiment/measurement plan and accepted targets | Reconstruct from attributable sources; keep missing targets unknown |
| Outcome evidence | Authorized analytics, experiment results, customer behavior and cost/support evidence | Sanitized exports with explicit measurement limits |
| Analysis | Reproducible queries/statistics appropriate to the study design | Transparent arithmetic and qualitative inference; no fabricated causal confidence |

## Domain Rules

- Distinguish delivered behavior, observed metric movement and causal product impact. A release or acceptance test proves neither adoption nor business value.
- Do not choose success thresholds after seeing the result. Separate predeclared criteria from exploratory findings and owner preferences.
- Use only authorized data with necessary minimization. A recommendation is not permission to run an experiment or contact users.

## Checklist

### 1. Frame the Outcome Decision

- [ ] Resolve the delivered capability, intended audience, original hypothesis, decision horizon and outcome decision requested.
- [ ] Identify the released/deployed version, rollout/exposure window and relevant baseline or comparison group.
- [ ] Recover predeclared primary metrics, guardrails, targets and stop rules; mark absent criteria rather than inventing them.
- [ ] Separate product intent and owner preference from measured behavior and external assumptions.

### 2. Assess Measurement Fitness

- [ ] Inspect metric definitions, units, denominators, event coverage, deduplication, identity joins and missing data.
- [ ] Check whether users were actually exposed and whether observation duration supports the intended outcome.
- [ ] Assess cohort composition, selection bias, seasonality, concurrent changes and other confounders.
- [ ] For experiments, inspect assignment, contamination, sample imbalance and uncertainty using the actual study design.
- [ ] Distinguish trustworthy measurements, reported results, estimates, qualitative signals and unavailable evidence.

### 3. Evaluate Value and Harm

- [ ] Compare outcomes with valid baselines or controls using reproducible calculations and appropriate uncertainty.
- [ ] Check guardrails and material regressions in user experience, reliability, support burden, cost or data quality.
- [ ] Separate aggregate effects from relevant segments and expose tradeoffs without fishing for favorable subgroups.
- [ ] Distinguish causal conclusions supported by the design from correlations and exploratory interpretations.
- [ ] Identify whether failure lies in adoption, interaction, correctness, measurement or the original value hypothesis.

### 4. Recommend the Next Decision

- [ ] Recommend continue, adjust or stop only to the degree supported by the evidence; explain what could reverse the recommendation.
- [ ] For uncertainty, define the cheapest next measurement or experiment with audience, signal, boundary and decision criterion without executing it.
- [ ] Return results linked to the original requirement/hypothesis and observed deployment state.
- [ ] Report data and causal limitations explicitly; do not transform lack of proof into proof of no effect.

## Verdict

- `SUPPORTED`: evidence supports the intended outcome within the stated population, window and causal limits.
- `NOT_SUPPORTED`: valid evidence contradicts the declared outcome or violates a required guardrail.
- `INCONCLUSIVE`: evidence cannot establish the outcome or causal interpretation.
- `BLOCKED`: essential hypothesis, exposure identity or authorized data is unavailable.

## Self-Check

- [ ] **Reconcile before returning.** Check item-level evidence, requirement coverage, contradictions, scope, verdict, and applicable cleanup. Correct the report or authorized artifacts. Reuse valid evidence; do not automatically rescan the repository or rerun successful commands. Repeat checks only for relevant changes, failures, or unresolved evidence. Disclose remaining gaps.

## Output Contract

Report in the user's language, in this order; label all five fields and state each fact once. Use controlled plain language: one fact per sentence, usually under 20 words, active voice, and one term per concept, with no synonyms for verdicts, IDs, or states. Small results may use one line per field; omit empty tables and do not copy linked artifacts:

1. **Result:** The exact skill-specific verdict token first, then the supported outcome.
2. **Scope:** Reviewed/changed scope, exclusions, baseline, and material assumptions.
3. **Evidence:** Skill-specific fields below; distinguish facts, inferences, and unverified claims. Link artifacts; use tables when useful.
4. **Verification:** Checks/results, unavailable evidence, and applicable cleanup/external state.
5. **Completion:** `Checklist: X/Y complete`; `Incomplete: None` or each `UNPROVEN` item's reason, outcome impact, and exact next action; residual risks and required decisions.

**Skill-specific evidence:** Hypothesis, deployed exposure, baseline/control, metric definitions and quality, reproducible results and uncertainty, guardrails, causal limits, recommendation and next evidence action.

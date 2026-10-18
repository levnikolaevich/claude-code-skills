---
name: ln-44-performance-optimizer
description: "Profiles and improves a measured performance bottleneck; retains only verified improvements."
---

# Performance Optimizer

**Goal:** Optimize only measured problems. Preserve correctness, isolate experiments, and retain a change only when comparable evidence shows that it improves the agreed metric without unacceptable regressions.

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

| Need | Preferred tool | Use it when | Fallback |
|---|---|---|---|
| Repository state and safe edit boundary | Git status, diff, branch or worktree inspection, and repository instructions | Always before profiling or editing | Stop if user changes cannot be isolated safely |
| Baseline and final metric | Existing benchmark, load test, reproducible command, or production-like replay | The metric and workload reflect the reported problem | Create the smallest local benchmark that reproduces the behavior without inventing production scale |
| Bottleneck evidence | Existing profiler, tracing, query diagnostics, allocation tools, or OS-level metrics | Locating CPU, memory, I/O, lock, query, network, or scheduler cost | Targeted instrumentation with cleanup plan |
| Code path and blast radius | Language server or host-native code intelligence | Following hot symbols, callers, implementations, and affected contracts | Narrow search plus direct inspection of definitions and consumers |
| Correctness and regressions | Repository-defined tests, build, lint, type, and smoke commands | Before and after every retained experiment | Choose the smallest portfolio action when current evidence cannot detect the likely material regression |
| Runtime and dependency semantics | Official documentation, release notes, and specifications matching installed versions | A hypothesis depends on optimizer, runtime, database, framework, or library behavior | Primary-source web research; otherwise mark the hypothesis `UNVERIFIED` |

Do not optimize by aesthetic preference or benchmark a different workload from the reported problem. Never discard user changes, use destructive Git reset, or run uncontrolled load against production.

## Evidence Rules

- Separate cold-start, warm steady-state, and saturated-load behavior when the reported problem can occur in more than one regime.
- Profile contribution and end-to-end impact separately: a hot function can improve while the user-visible metric does not.
- Treat profiler estimates, synthetic workloads, and production observations as different evidence classes and label them.
- Correctness, resource safety, and operational stability are hard constraints, not secondary metrics.

## Checklist

### 1. Define the Problem and Protect the Workspace

- [ ] Resolve the user-visible problem, workload, environment, primary metric, overall target, minimum improvement required to keep an experiment, and hard constraints before editing.
- [ ] Confirm a measurable performance symptom and distinguish its cause from incorrect results or missing observability. Configuration, capacity, and dependencies may be valid bottlenecks; fix them only within the approved scope.
- [ ] Read repository instructions and inspect Git state, branches, uncommitted changes, ignored artifacts, and available isolation mechanisms.
- [ ] Preserve user work and isolate experiments in a safe branch or worktree when changes, benchmarks, or generated artifacts could interfere.
- [ ] Start a run-owned resource ledger with every created absolute path, worktree, process ID, cache, profile, and temporary artifact; never register pre-existing resources as cleanup targets.
- [ ] Identify correctness, security, memory, cost, compatibility, and operational constraints that no optimization may violate.
- [ ] Locate existing benchmarks, profiles, performance tests, production traces, service-level objectives, and known environmental variability.

### 2. Establish a Reproducible Baseline

- [ ] Use the same metric type as the observed problem: latency distribution, throughput, CPU, memory, allocation, I/O, query count, lock wait, or another direct measure.
- [ ] Make the workload representative and deterministic enough to compare, including data size, concurrency, cache state, warmup, and build mode.
- [ ] Cover the operating points that could reverse the conclusion--at minimum the reported case plus relevant data-size or concurrency boundaries--without inventing synthetic scale.
- [ ] Choose a bounded comparison budget sufficient to assess material noise; record raw results, an appropriate center/percentile, spread, failures, and environment. Before large-scale, long-running, or model-cost experiments, agree the outcome, scope, quality criteria, and acceptable costs; prepare a small representative sample within authorized scope and scale only after its acceptance. Reuse unchanged authorization; ordinary necessary checks need no new approval. Report inconclusive measurements rather than repeating until a gain appears.
- [ ] When drift or noise is material, interleave or randomize baseline and candidate runs and prefer paired comparisons over one block of "before" followed by one block of "after."
- [ ] Verify that the benchmark detects an intentionally slower or obviously changed path when practical; a benchmark insensitive to behavior cannot validate optimization.
- [ ] Run relevant correctness tests before editing so pre-existing failures are not attributed to experiments.
- [ ] Stop and report `BLOCKED` if the problem cannot be reproduced and no trustworthy production evidence can define a safe proxy.

### 3. Profile and Form Hypotheses

- [ ] Profile the end-to-end path before focusing on a function, query, allocation, lock, or network call.
- [ ] Build a ranked cost map with measured contribution, call frequency, inclusive and exclusive cost where available, and affected workload.
- [ ] Trace the top costs to implementation, callers, data shape, concurrency model, configuration, and external dependencies.
- [ ] Distinguish root bottlenecks from downstream symptoms, measurement overhead, debug builds, cold starts, and one-time initialization.
- [ ] If profiling crosses services or processes whose code is in scope, align traces/correlation IDs and follow the measured downstream path; do not label an accessible internal service "external" and stop at its latency.
- [ ] Estimate profiler or instrumentation perturbation and confirm the final end-to-end result without invasive instrumentation.
- [ ] Research official runtime, framework, database, and dependency behavior only when it can confirm or reject a concrete hypothesis.
- [ ] Check existing platform and dependency capabilities before proposing custom caches, pools, schedulers, serializers, or data structures.
- [ ] Write a small ordered hypothesis set; for each state expected metric change, mechanism, affected files, risk, dependencies, and verification.
- [ ] Reject hypotheses that lack a measurable mechanism, require speculative scale, or cannot be rolled back independently.

### 4. Execute Atomic Keep-or-Discard Experiments

- [ ] **Test value and boundary:** For product tests, require every test to detect a concrete defect in this product's business logic and name the protected business outcome. Prefer E2E through user or external-system boundaries; use integration or unit tests only for business scenarios difficult to exercise reliably through E2E. Reject platform, trivial-wiring, implementation-detail, and duplicate proof with no distinct business failure signal. Engineering checks separately prove declared type, architecture, tooling or delivery constraints; validate their rejection and acceptance behavior without inventing a business-test rationale.
- [ ] Map each risky hypothesis to existing proof and the material regression it could cause; implement `KEEP`, `ADD`, `UPDATE`, `MERGE`, `DELETE`, or justified `NO_TEST` within the approved test scope to produce the smallest trustworthy safety evidence, remove superseded testware, and retire temporary characterization proof when its trigger ends.
- [ ] For caching, batching, parallelism, pooling, or retry changes, explicitly protect invalidation, ordering, idempotency, cancellation, backpressure, timeout, and bounded-resource semantics that the faster path could violate.
- [ ] Apply the smallest coherent change that tests one mechanism; group changes only when their effects are intentionally inseparable.
- [ ] Keep instrumentation bounded, low-overhead, and easy to remove; never leave secrets or sensitive payloads in diagnostic output.
- [ ] Run focused correctness checks after the edit. Attribute failures to the experiment, baseline, or environment; repair bounded experiment defects and recheck, or discard when correctness cannot be established.
- [ ] Repeat the exact baseline benchmark under comparable conditions and preserve raw results.
- [ ] Inspect the diff for accidental cleanup, unrelated refactoring, generated churn, debug flags, changed benchmark inputs, and hidden configuration changes.
- [ ] Mark `KEEP` only when the experiment meets the predeclared minimum improvement beyond noise and every hard constraint passes.
- [ ] Mark `DISCARD` and revert only that experiment when the keep threshold is missed, results regress, or safety becomes uncertain; never lower the threshold after observing results.
- [ ] After a kept change, establish the new compound baseline before testing the next hypothesis.

### 5. Stop, Verify, and Report

- [ ] Continue only when new measurement supports another hypothesis; stop at the agreed target, diminishing returns, exhausted safe options, or a missing prerequisite; report explicitly whether the target was reached.
- [ ] Confirm that build, lint, type, test, smoke, benchmark, and operational evidence covers the final retained state and all required gates. Reuse passing evidence for that state; rerun checks only where later changes or unresolved failures invalidate it.
- [ ] **Run-owned cleanup:** Remove only run-owned ledger entries: verify absolute paths remain inside approved temporary roots, stop exact recorded process IDs, preserve dirty or pre-existing worktrees, and retain evidence artifacts intentionally reported.
- [ ] Confirm that the benchmark definition and acceptance threshold did not drift during the run.
- [ ] Reconcile the hypothesis ledger with retained edits and raw results, including discarded experiments.
- [ ] Bind measured improvement to the workload, environment, baseline and retained code/configuration; distinguish benchmark improvement from proven production impact.
- [ ] Use `DELIVERED` only when retained improvements reach the agreed overall target with every constraint passing; use `PARTIAL` when a verified improvement is kept but the overall target remains unmet. Use `NO_CHANGE` when all experiments are discarded and the baseline is restored; use `BLOCKED` when a safety prerequisite, reproducible baseline, or safe restoration path is unavailable.

## Self-Check

- [ ] **Reconcile before returning.** Check item-level evidence, requirement coverage, contradictions, scope, verdict, and applicable cleanup. Correct the report or authorized artifacts. Reuse valid evidence; do not automatically rescan the repository or rerun successful commands. Repeat checks only for relevant changes, failures, or unresolved evidence. Disclose remaining gaps.

## Output Contract

Report in the user's language, in this order; label all five fields and state each fact once. Use controlled plain language: one fact per sentence, usually under 20 words, active voice, and one term per concept, with no synonyms for verdicts, IDs, or states. Small results may use one line per field; omit empty tables and do not copy linked artifacts:

1. **Result:** The exact skill-specific verdict token first, then the supported outcome.
2. **Scope:** Reviewed/changed scope, exclusions, baseline, and material assumptions.
3. **Evidence:** Skill-specific fields below; distinguish facts, inferences, and unverified claims. Link artifacts; use tables when useful.
4. **Verification:** Checks/results, unavailable evidence, and applicable cleanup/external state.
5. **Completion:** `Checklist: X/Y complete`; `Incomplete: None` or each `UNPROVEN` item's reason, outcome impact, and exact next action; residual risks and required decisions.

**Skill-specific evidence:** Target workload, metric, acceptance threshold, correctness constraints, environment, sampling and variance method; comparable baseline/final distributions and deltas. Record every hypothesis, mechanism, `KEEP / DISCARD`, measurements, and verification. Include affected test portfolio actions, residual bottlenecks, and run-owned raw samples, commands, configuration, final diff, and cleanup evidence with paths/hashes when available.

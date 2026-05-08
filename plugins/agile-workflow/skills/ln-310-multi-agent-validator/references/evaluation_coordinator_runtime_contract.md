<!-- SOURCE-OF-TRUTH: shared/references/evaluation_coordinator_runtime_contract.md. Edit ONLY here; run `node tools/marketplace/shared.mjs sync` -->

# Evaluation Coordinator Runtime Contract

Canonical coordinator runtime contract for evaluator, validator, and audit skills.

Use this contract for:
- multi-agent validation
- quality evaluation
- repository audits
- optimization-plan feasibility review

Evaluation coordinators must use `evaluation-runtime` semantics only.

## Runtime Envelope

Evaluation coordinators own deterministic state, worker orchestration, artifact aggregation, cleanup evidence, and final decision recording. Use this contract when a skill actually runs an evaluation loop. Routing-only skills should not mandatory-load it.

Hard requirements:
- state is resumable and records phase checkpoints before transitions
- every planned worker has an explicit lane, dependency set, and expected summary artifact
- read-only evidence lanes may run in parallel; mutation, repair, merge, approval, and status changes stay sequential
- worker summaries are recorded before aggregation
- final output includes a machine-readable coordinator summary and a human report path

## State Fields

Minimum coordinator state:
- `phase_order`, `phase_data`, `worker_plan`, `worker_results`, `child_runs`
- `inflight_workers`, `agents`, `aggregation_summary`
- `report_written`, `results_log_appended`, `self_check_passed`, `summary_recorded`, `final_result`
- `background_agent_cleanup`, `refinement_cleanup`, `cleanup_verified` when background or refinement processes run
- optional `loop_health` when repeated attempts or advisor usefulness must be judged

## Runtime CLI

The evaluation runtime CLI must support start/status/checkpoint, worker-result recording, summary recording, agent registration/sync, loop-health recording, phase advance/pause, decision setting, and completion. A `SKILL.md` that invokes the CLI must reference the script path directly; this contract intentionally does not distribute executable assets by itself.

## Manifest

Required manifest fields: `skill`, `identifier`, `project_root`, `phase_order`, `report_path`, `created_at`.

Optional manifest fields: `mode`, `results_log_path`, `phase_policy`, `expected_agents`, `required_research`, `research_freshness_hours`.

`phase_policy` may define delegate, aggregate, report, results-log, cleanup, self-check, and agent-resolve barrier phases.

## Worker Plan

Each `worker_plan` entry must include `worker`, `identifier`, `lane`, `join_group`, `depends_on`, and `mode`. Parallel lanes are read-only only. Mutating workers require non-empty `depends_on`. Later phases must not assume worker completion without recorded summaries.

## Research And Transitions

Evaluation runs record completed research evidence. Do not skip research entirely; for trivial stacks, record a minimal source-backed research set. Load the detailed research contract only when the skill performs research planning or evidence freshness checks.

Block transition when the current phase lacks a checkpoint, planned workers lack summaries, workers are still inflight at aggregation, required agents are unresolved across a barrier, cleanup is incomplete, self-check fails, or the coordinator summary is missing.

Agent/tool failures are transport evidence, not validation findings by themselves. Classify permission, auth, missing-tool, rate-limit, timeout, question, agent error, and unknown outcomes separately from domain verdicts. Repeated identical failures without new evidence require loop-health handling.

## Output

Coordinators emit an `evaluation-coordinator` summary with status, final result, report path, worker count, issue totals, severity counts, warnings, and cleanup verification. Workers emit `evaluation-worker` or a family-specific evaluation summary.

Detailed parallelism, research, refinement trace, cleanup evidence, and loop-health refs are conditional: load only when that behavior is active in the current run.

**Version:** 1.0.0
**Last Updated:** 2026-04-10

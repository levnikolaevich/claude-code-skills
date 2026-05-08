<!-- SOURCE-OF-TRUTH: shared/references/evaluation_coordinator_runtime_contract.md. Edit ONLY here; run `node tools/marketplace/shared.mjs sync` -->

# Evaluation Coordinator Runtime Contract

Runtime contract for skills that actually run an evaluation loop. Routing-only skills should not mandatory-load it.

## Envelope

Evaluation coordinators own resumable state, worker orchestration, summary aggregation, cleanup evidence, and final decision recording.

Hard requirements:
- checkpoint state before phase transitions
- plan every worker with lane, dependencies, join group, and expected summary artifact
- run read-only evidence lanes in parallel only; mutation, repair, merge, approval, and status changes stay sequential
- record worker summaries before aggregation
- emit a machine-readable coordinator summary and a human report path

## State And Manifest

Minimum state: `phase_order`, `phase_data`, `worker_plan`, `worker_results`, `child_runs`, `inflight_workers`, `agents`, `aggregation_summary`, `report_written`, `results_log_appended`, `self_check_passed`, `summary_recorded`, `final_result`.

When background/refinement processes run, also track `background_agent_cleanup`, `refinement_cleanup`, and `cleanup_verified`. Use optional `loop_health` only when repeated attempts or advisor usefulness must be judged.

Required manifest fields: `skill`, `identifier`, `project_root`, `phase_order`, `report_path`, `created_at`. Optional: `mode`, `results_log_path`, `phase_policy`, `expected_agents`, `required_research`, `research_freshness_hours`.

## Runtime CLI

The evaluation runtime CLI must support start/status/checkpoint, worker-result recording, summary recording, agent registration/sync, loop-health recording, phase advance/pause, decision setting, and completion. `SKILL.md` files that invoke the CLI must reference the script path directly; this contract does not distribute executable assets by itself.

## Worker Plan And Transitions

Each `worker_plan` entry includes `worker`, `identifier`, `lane`, `join_group`, `depends_on`, and `mode`. Parallel lanes are read-only only. Mutating workers require non-empty `depends_on`.

Block transition when the current phase lacks a checkpoint, planned workers lack summaries, workers are inflight at aggregation, required agents are unresolved across a barrier, cleanup is incomplete, self-check fails, or the coordinator summary is missing.

Research evidence must be recorded. Load the detailed research contract only for research planning or evidence freshness checks.

Agent/tool failures are transport evidence, not validation findings. Classify permission, auth, missing-tool, rate-limit, timeout, question, agent error, and unknown separately from domain verdicts; repeated identical failures without new evidence require loop-health handling.

## Output

Coordinators emit an `evaluation-coordinator` summary with status, final result, report path, worker count, issue totals, severity counts, warnings, and cleanup verification. Workers emit `evaluation-worker` or a family-specific evaluation summary.

Detailed parallelism, research, refinement trace, cleanup evidence, and loop-health refs are conditional: load only when that behavior is active.

**Version:** 1.0.0
**Last Updated:** 2026-04-10

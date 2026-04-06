# Worker Runtime Contract

Shared deterministic runtime model for stateful L3 workers.

## Core Model

Every stateful worker runtime has:
- `manifest.json` for immutable invocation inputs
- `state.json` for mutable execution snapshot
- `checkpoints.json` for latest checkpoint per phase plus history
- `history.jsonl` for append-only runtime events
- `resume_action` derived from state and checkpoints only

Terminal phases:
- `DONE`
- `PAUSED`

## Required Goals

The worker runtime exists to guarantee:
- deterministic phase progression
- guard-checked transitions
- resumability without chat memory
- machine-readable completion

AC validation is one domain guard, not the runtime's only purpose.

## Required Vocabulary

Required fields:
- `run_id`
- `skill`
- `identifier`
- `phase`
- `complete`
- `paused_reason`
- `pending_decision`
- `final_result`

## Artifact Contract

Coordinator-invoked workers must:
- receive `runId`
- receive `summaryArtifactPath`
- write a validated summary artifact before `DONE`

Standalone workers may:
- generate a standalone `run_id`
- write their summary artifact to the family-specific run-scoped path

Coordinator-invoked workers must receive both:
- `runId`
- `summaryArtifactPath`

Coordinators consume worker artifacts, not worker prose.

## Worker Independence

- workers depend only on shared contracts and their own domain inputs
- workers must not encode `Parent`, `Coordinator`, or caller hierarchy in the public contract
- workers stay standalone-invocable even when a coordinator usually calls them
- upward orchestration state is never a worker input

## Guard Rules

- no transition without a checkpoint for the current phase
- no `DONE` before required worker self-check passes
- no `DONE` before the required summary artifact is written
- `resume_action` must be derivable from runtime state only
- public outputs and runtime artifacts must stay separate

## Relationship to Coordinator Runtime

Use `shared/scripts/coordinator-runtime/` as the implementation base.
Worker runtimes are family-specific thin layers over the shared runtime engine, not a separate framework.

## Family Contracts

- audits: `shared/references/audit_worker_runtime_contract.md`
- task execution: `shared/references/task_worker_runtime_contract.md`
- quality: `shared/references/quality_worker_runtime_contract.md`
- test planning: `shared/references/test_planning_worker_runtime_contract.md`
- task planning: `shared/references/task_plan_worker_runtime_contract.md`

---
**Version:** 1.0.0
**Last Updated:** 2026-04-06

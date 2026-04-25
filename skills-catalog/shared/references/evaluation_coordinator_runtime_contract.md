# Evaluation Coordinator Runtime Contract

Canonical coordinator runtime contract for evaluator, validator, and audit skills.

Use this contract for:
- multi-agent validation
- quality evaluation
- repository audits
- optimization-plan feasibility review

Evaluation coordinators must use `evaluation-runtime` semantics only.

## Goals

Every evaluation coordinator must:
- run with deterministic state and resumable phases
- perform mandatory research on every run
- support parallel read-only evidence lanes
- keep mutation, merge, refinement, and approval sequential
- record machine-readable summaries and cleanup evidence

## Required Coordinator State

The runtime state must include:
- `phase_order`
- `phase_data`
- `worker_plan`
- `worker_results`
- `child_runs`
- `inflight_workers`
- `agents`
- `background_agent_cleanup`
- `refinement_cleanup`
- `cleanup_verified`
- `aggregation_summary`
- `report_written`
- `results_log_appended`
- `self_check_passed`
- `summary_recorded`
- `final_result`
- optional `loop_health` for advisor and worker attempt usefulness

## Required Commands

`shared/scripts/evaluation-runtime/cli.mjs` must provide:
- `start`
- `status`
- `checkpoint`
- `record-worker-result`
- `record-summary`
- `register-agent`
- `sync-agent`
- `record-loop-health`
- `advance`
- `pause`
- `set-decision`
- `complete`

## Manifest Contract

Required manifest fields:
- `skill`
- `identifier`
- `project_root`
- `phase_order`
- `report_path`
- `created_at`

Optional manifest fields:
- `mode`
- `results_log_path`
- `phase_policy`
- `expected_agents`
- `required_research`
- `research_freshness_hours`
- `extra_evidence_workers`

`phase_policy` may define:
- `delegate_phases`
- `aggregate_phase`
- `report_phase`
- `results_log_phase`
- `cleanup_phase`
- `self_check_phase`
- `agent_resolve_before`

## Worker Plan Contract

`worker_plan` entries must be objects with:
- `worker`
- `identifier`
- `lane`
- `join_group`
- `depends_on`
- `mode`

Rules:
- only read-only workers may share a parallel lane
- workers that mutate files must declare non-empty `depends_on`
- later phases may not assume completion without a recorded worker summary

## Mandatory Research Rule

Every evaluation run must record completed research evidence.

Minimum required sources per run:
1. official documentation or standards
2. MCP Ref
3. Context7 when a library/framework is involved
4. web research for current best practices

No evaluator or auditor may skip research entirely.

If the stack is trivial, record a minimal completed research set instead of `skipped`.

## Transition Guards

The runtime must block transitions when:
- the current phase has no checkpoint
- a delegate phase has planned workers but no recorded worker summaries
- the aggregate phase is entered while planned workers are still inflight
- a configured agent-resolve barrier is crossed while required agents are unresolved
- cleanup is incomplete
- self-check has not passed
- coordinator summary is missing
- a phase listed in `required_phases_when_advisor_available` is checkpointed as SKIPPED while a corresponding advisor was marked available in the health check

Agent and transport failures:
- classify advisor/agent failures as `permission_denial`, `tool_missing`, `auth_missing`, `rate_limited`, `timeout_idle`, `timeout_productive`, `asked_question`, `agent_error`, or `unknown`
- permission, auth, missing-tool, rate-limit, timeout, or agent-question outcomes are transport evidence, not validation findings
- do not emit `NO-GO`, quality `FAIL`, or audit findings from transport failure alone
- productive timeouts may feed partial-progress review only when output, log, session, artifact, git, or status evidence changed
- repeated identical failures without new evidence record Loop Health and pause per `shared/references/loop_health_contract.md`

## Cleanup Evidence

Cleanup is evidence-based, never boolean-only.

`background_agent_cleanup` and `refinement_cleanup` entries must include:
- `subject`
- `pid`
- `source_phase`
- `verify_attempts`
- `final_status`
- `verified_at`

`cleanup_verified` is derived from those records and must be true before `DONE`.

## Summary Contract

Coordinators emit `evaluation-coordinator` summaries.

Workers emit `evaluation-worker` summaries or more specific evaluation sub-kinds when the family requires them.

Use `shared/references/evaluation_summary_contract.md`.

## Parallelism Policy

Use `shared/references/evaluation_parallelism_policy.md`.

Short version:
- `agents + research + local findings` may overlap
- docs, repair, merge, refinement, approval, and status mutation stay sequential

## Related Contracts

- `shared/references/evaluation_worker_runtime_contract.md`
- `shared/references/evaluation_summary_contract.md`
- `shared/references/evaluation_research_contract.md`
- `shared/references/refinement_trace_contract.md`
- `shared/references/cleanup_evidence_contract.md`
- `shared/references/evaluation_parallelism_policy.md`
- `shared/references/loop_health_contract.md`

**Version:** 1.0.0
**Last Updated:** 2026-04-10

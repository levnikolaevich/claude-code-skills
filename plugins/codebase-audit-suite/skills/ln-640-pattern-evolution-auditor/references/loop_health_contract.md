<!-- SOURCE-OF-TRUTH: shared/references/loop_health_contract.md. Edit ONLY here; run `node tools/marketplace/shared.mjs sync` -->

# Loop Health Contract

**Version:** 1.0.0
**Last Updated:** 2026-04-25

> **Paths:** All paths are relative to the skills repository root.

## Purpose

Loop health is retry-usefulness evidence. It does not replace lifecycle status, task board status, checkpoints, artifacts, or domain verdicts.

Use loop health when a procedural skill can repeat a task, worker, stage, scenario segment, advisor session, or quality cycle.

## Canonical Model

| Field | Meaning | Owner |
|-------|---------|-------|
| `status` | Lifecycle state: where the workflow is now | Existing runtime state machine |
| `artifact` / `checkpoint` | Completion evidence: what changed and where it is recorded | Runtime artifact and checkpoint layers |
| `loop_health` | Retry usefulness evidence: whether another retry is likely to add value | Coordinator or orchestrator runtime |

## Signal Classes

| Class | Meaning | Retry Action |
|-------|---------|--------------|
| `none` | No failure was classified | Continue normally |
| `timeout_idle` | Timeout without usable output, log, or captured session | Retry only while loop health allows it |
| `timeout_productive` | Timeout after output, log, or session capture | Route through verification/review before retry |
| `permission_denial` | Agent/tool was blocked by permissions | Pause immediately |
| `tool_missing` | Required command/tool is unavailable | Pause immediately |
| `auth_missing` | Required authentication is unavailable | Pause immediately |
| `rate_limited` | Provider rate limit or quota backoff | Pause/defer; do not count as domain failure |
| `asked_question` | Agent asked for input instead of completing | Pause for decision or refine prompt |
| `agent_error` | Agent exited unsuccessfully with classified output | Retry only while loop health allows it |
| `unknown` | Failure exists but could not be classified | Retry only while loop health allows it |

## Default Policy

| Policy | Value |
|--------|-------|
| `no_progress_limit` | `3` |
| `same_error_limit` | `3` |
| Immediate pause | `permission_denial`, `tool_missing`, `auth_missing` |
| Defer/pause | `rate_limited` |
| Progress reset | Any confirmed progress resets no-progress counters |

## Progress Evidence

Progress must be objective. Examples:

| Runtime | Valid Progress Evidence |
|---------|-------------------------|
| Story execution | New or changed worker artifact, new `ln-402` summary, task status delta, `files_changed` delta, scenario segment improvement |
| Pipeline orchestration | New stage summary, checkpoint delta, expected status transition, changed stage artifact |
| Evaluation and quality | New domain evidence, changed finding set, accepted repair, changed artifact |
| Optimization | Metric improvement, new bottleneck, accepted hypothesis, changed benchmark result |

Do not treat repeated prose, repeated identical findings, or an unchanged failed assertion as progress.

## Pause Output

When loop health pauses a flow, include:

- Scope: task, group, scenario, stage, advisor, quality cycle, or optimization cycle.
- Reason: no progress, same error, immediate blocker, rate limit, or question.
- Evidence: normalized error signature or unchanged evidence key.
- Next action: concrete user/operator decision or missing dependency.

## Runtime Requirements

- `loop_health` is optional in state so existing runtime state remains readable.
- Runtime history records loop-health updates as `LOOP_HEALTH_RECORDED`.
- Domain counters remain domain counters. Example: `validation_retries` and `quality_cycles` still measure workflow policy; loop health measures whether another retry is useful.
- Classified transport/agent failures must not become domain verdicts without domain evidence.

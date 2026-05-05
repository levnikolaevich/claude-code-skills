# VPS Runtime Contract

<!-- SCOPE: Shared runtime contract for ln-031 through ln-034 VPS environment workers. -->

Use this contract for workers that install, verify, update, or diagnose VPS-hosted agent environments.

## Runtime Family

- family: `vps-runtime-worker`
- terminal phases: `PAUSED`, `DONE`
- workers remain standalone-first
- managed mode requires both `runId` and `summaryArtifactPath`
- standalone mode generates a `run_id` and writes a run-scoped summary artifact

## Summary Kinds

| Skill | Summary Kind |
|---|---|
| `ln-031-vps-host-runtime` | `vps-host-runtime` |
| `ln-032-vps-project-runtime` | `vps-project-runtime` |
| `ln-033-hex-relay-lifecycle` | `vps-hex-relay-lifecycle` |
| `ln-034-vps-environment-diagnostics` | `vps-environment-diagnostics` |

## Shared Inputs

| Field | Required | Notes |
|---|---:|---|
| `mode` | Yes | Worker-specific mode |
| `environment_id` | No | Stable registry id when available |
| `dry_run` | No | Detection-only when supported |
| `runId` | Managed only | Caller-provided run id |
| `summaryArtifactPath` | Managed only | Exact path the worker must write |

VPS/project variables are accepted either as direct arguments or resolved from a validated fleet registry entry:
`VPS_HOST`, `VPS_SSH_KEY`, `BOT_USER`, `PROJECT_NAME`, `SERVICE_PREFIX`, `PROJECT_DIR`, `REPO_URL`, `REPO_REF`, `TARGET_REPO_PATH`, `GIT_PROVIDER`, `REPO_SLUG`, `RELAY_HOOK_PORT`.

## Shared Summary Payload

Every worker summary envelope follows `shared/references/coordinator_summary_contract.md`.

Payload fields:
- `status`: `completed`, `skipped`, or `error`
- `mode`
- `environment_id`
- `targets`
- `changes`
- `warnings`
- `blockers`
- `verification`
- `artifacts`

Paths:
- managed: exact caller-provided `summaryArtifactPath`
- standalone: `.hex-skills/runtime-artifacts/runs/{run_id}/{summary_kind}/{producer_skill}--{identifier}.json`

## Guard Rules

- No `DONE` before summary artifact is written.
- No mutation when `dry_run=true`.
- No secret values in summaries, plans, logs, or registry files.
- No blind overwrite of project repos, service files, secrets, DB files, or existing runtime state.
- Existing host runtime is reconciled or verified; it is never assumed healthy because a user says the VPS was used before.
- Safe repair must be bounded to documented actions and must report every change.

---

**Version:** 1.0.0
**Last Updated:** 2026-05-05

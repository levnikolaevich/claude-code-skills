---
name: ln-034-vps-environment-diagnostics
description: "Use when inspecting health, drift, logs, auth, ports, systemd, tmux, or safe repair needs for one VPS project environment."
license: MIT
allowed-tools: Bash, Read, mcp__hex-ssh__remote-ssh, mcp__hex-ssh__ssh-read-lines, mcp__hex-ssh__ssh-write-chunk, mcp__hex-ssh__ssh-edit-block
---

<!-- markdownlint-disable MD012 MD022 MD032 MD040 MD041 MD060 -->

> **Paths:** File paths (`shared/`, `../ln-030-vps-bootstrap/references/`) are relative to skills repo root. If not found at CWD, locate this `SKILL.md` directory and go up one level for repo root.

# ln-034-vps-environment-diagnostics

**Type:** L3 Worker
**Category:** 0XX Shared / Infrastructure

Inspects one VPS project environment and reports health, drift, logs, auth state, ports, systemd, tmux, and bounded safe repairs.

## MANDATORY READ

**MANDATORY READ:** Load `shared/references/worker_runtime_contract.md`, `shared/references/coordinator_summary_contract.md`, and `shared/references/vps_runtime_contract.md`
**MANDATORY READ:** Load `../ln-030-vps-bootstrap/references/scope_layers.md`, `../ln-030-vps-bootstrap/references/troubleshooting.md`, and `../ln-030-vps-bootstrap/references/verification_recipes.md`

---

## Input / Output

| Direction | Content |
|---|---|
| Input | `mode`, project/VPS variables, optional `repair_scope`, optional `dry_run`, optional `runId`, optional `summaryArtifactPath` |
| Output | `vps-environment-diagnostics` summary with status, findings, drift, safe repairs, warnings, blockers, and verification |

If `summaryArtifactPath` is provided, write the same summary JSON there. If not provided, return the summary inline and write it to the standalone run-scoped path. Generate a standalone `run_id` when `runId` is absent.

## Modes

| Mode | Behavior |
|---|---|
| `inspect` | Read-only health and drift report |
| `verify` | Read-only post-install/post-redeploy verification |
| `repair_safe` | Apply only documented bounded safe repairs selected by `repair_scope` |

## Workflow

### Phase 1: Scope And Safety

Resolve target environment and set mutation guard:
- `inspect` and `verify` are read-only
- `repair_safe` requires explicit `repair_scope`
- `dry_run=true` converts repairs to planned actions

### Phase 2: Host And Shared Runtime

Inspect:
- required binaries
- `${BOT_USER}`
- Node/Claude/Codex versions
- auth health indicators without printing tokens
- `${AGENT_SKILLS_DIR}` git state
- marketplace/plugin health
- `agent-update.timer` and log tail

### Phase 3: Project Runtime

Inspect:
- `${PROJECT_DIR}` git state
- `/etc/${PROJECT_NAME}` and `/var/lib/${PROJECT_NAME}`
- `${SERVICE_PREFIX}-god@*.service`
- tmux socket and targets
- dispatch timer/service
- provider credential wiring without secret output

### Phase 4: Relay Runtime

When Telegram/relay is enabled, inspect:
- `${SERVICE_PREFIX}-hex-relay.service`
- `/opt/${SERVICE_PREFIX}-hex-relay`
- HTTP `/health`
- relay DB presence/schema
- old `relay-bot` service/path drift
- `RELAY_HOOK_PORT` listener collisions

### Phase 5: Safe Repair

Allowed safe repairs only:
- restart a named inactive project service after confirming unit file exists
- re-enable an expected timer
- recreate missing non-secret directories with documented owner/mode
- rerun `systemctl daemon-reload`
- report, but do not rewrite, missing auth or secrets

Forbidden repairs:
- secret creation or token edits
- deleting DB files
- deleting project repos
- changing Git remotes/branches
- changing shared auth
- broad package upgrades

### Phase 6: Summary

Write a `vps-environment-diagnostics` summary artifact with:
- health verdict
- drift list
- repair actions applied or planned
- blockers
- warnings
- verification evidence

## Critical Rules

- This worker diagnoses one environment at a time.
- Fleet target selection belongs outside this worker.
- Read-only modes must not mutate remote or local state.
- Repair actions are bounded and explicit.
- Never print secrets or auth tokens.

## Definition of Done

- [ ] Target environment and mutation guard resolved.
- [ ] Host/shared runtime health inspected.
- [ ] Project runtime health inspected.
- [ ] Relay runtime health inspected or gated `N/A:`.
- [ ] Drift and blockers reported with concrete evidence.
- [ ] Safe repair actions were explicit, bounded, and recorded.
- [ ] Forbidden repair categories were not performed.
- [ ] `dry_run=true`, `inspect`, and `verify` performed no mutation.
- [ ] Structured `vps-environment-diagnostics` summary artifact written.

---

**Version:** 1.0.0
**Last Updated:** 2026-05-05

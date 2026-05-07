---
name: ln-034-vps-environment-diagnostics
description: "Use when inspecting health, drift, logs, auth, ports, systemd, tmux, or safe repair needs for one VPS project environment."
license: MIT
allowed-tools: Bash, Read, mcp__hex-ssh__remote-ssh, mcp__hex-ssh__ssh-read-lines, mcp__hex-ssh__ssh-write-chunk, mcp__hex-ssh__ssh-edit-block
---

<!-- markdownlint-disable MD012 MD022 MD032 MD040 MD041 MD060 -->

> **Paths:** File paths (`../ln-030-vps-bootstrap/references/`) are relative to this skill directory.

# ln-034-vps-environment-diagnostics

**Type:** L3 Worker
**Category:** 0XX Shared / Infrastructure

Inspects one VPS project environment and reports health, drift, logs, auth state, ports, systemd, tmux, and bounded safe repairs.

## MANDATORY READ

**MANDATORY READ:** Load `references/worker_runtime_contract.md`, `references/coordinator_summary_contract.md`, and `references/vps_runtime_contract.md`
**MANDATORY READ:** Load `../ln-030-vps-bootstrap/references/scope_layers.md`, `../ln-030-vps-bootstrap/references/troubleshooting.md`, and `../ln-030-vps-bootstrap/references/verification_recipes.md`

**Conditional read (load when `/var/lib/claude-shared/` exists on the host)**: `../ln-030-vps-bootstrap/references/shared_auth_state.md` — Phase 2 ACL-mask checks (`getfacl` on `.credentials.json` and `.codex/auth.json` must show `mask::rw-`, not `mask::---`) and Phase 5 safe repair `chmod 0660` come from this reference. Required when diagnosing shared-auth fleets.

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
- auth health indicators without printing tokens (per bot: `claude --print` smoke + `codex login status`)
- `${AGENT_SKILLS_DIR}` git state
- marketplace/plugin health
- `agent-update.timer` schedule, `agent-update.service` `is-failed` state, `/usr/local/bin/agent-update` exec bit (`[[ -x ... ]]`) and `bash -n` syntax
- when `/var/lib/claude-shared/` exists: `claude-shared` group membership for every bot user, ACL mask on `/var/lib/claude-shared/.claude/.credentials.json` and `/var/lib/claude-shared/.codex/auth.json` (mask must be `rw-`, not `---`); `~/.claude.json` symlink target reachable for each bot

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
- `chmod +x /usr/local/bin/agent-update` when the file is a non-executable bash script (validated by `file` and `bash -n`); follow with `systemctl reset-failed agent-update.service`
- `chmod 0660` on `/var/lib/claude-shared/.claude/.credentials.json` or `/var/lib/claude-shared/.codex/auth.json` when ACL mask reads `---` (Claude/Codex write mode `0600`; the chmod restores ACL group access without touching the underlying token)
- append a missing bot user to `RUNTIME_USERS=(...)` in `/usr/local/bin/agent-update` when that bot has its own `~/.nvm/nvm.sh` and is otherwise healthy

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

**Version:** 1.1.0
**Last Updated:** 2026-05-06

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
**MANDATORY READ:** Load `references/scope_layers.md`, `references/troubleshooting_diagnostics.md`, `references/verification_recipes_common.md`, `references/verification_recipes_agent_runtime.md`, `references/verification_recipes_project_runtime.md`, and `references/verification_recipes_hex_relay_diagnostics.md`

**Conditional read (load when `/var/lib/claude-shared/` exists on the host)**: `../ln-030-vps-bootstrap/references/shared_auth_state.md` â€” Phase 2 checks include `claude-shared-auth-perms.path`, ACL masks, and per-bot read/write access for `.credentials.json`, `.claude.json`, and `.codex/auth.json`. Required when diagnosing shared-auth fleets.

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
- Node/Claude/Codex versions, including installed-vs-`npm view ... latest` comparison when network is available
- auth health indicators without printing tokens (per bot: `claude --print` smoke + `codex login status`)
- `${AGENT_SKILLS_DIR}` git state
- marketplace/plugin health across `${AGENT_SKILLS_DIR}`, Claude active marketplace, Claude plugin cache, Codex plugin cache, `known_marketplaces.json`, and `installed_plugins.json`
- `agent-update.timer` schedule, `agent-update.service` `is-failed` state, `/usr/local/bin/agent-update` exec bit (`[[ -x ... ]]`) and `bash -n` syntax
- when `/var/lib/claude-shared/` exists: `claude-shared` group membership for every bot user, `claude-shared-auth-perms.path` active, ACL mask on `/var/lib/claude-shared/.claude/.credentials.json`, `/var/lib/claude-shared/.claude.json`, and `/var/lib/claude-shared/.codex/auth.json` (mask must be `rw-`, not `---`), each bot user can read/write those auth files, and each bot keeps a real per-bot `~/.codex` directory rather than a symlink to shared storage

### Phase 3: Project Runtime

Inspect:
- `${PROJECT_DIR}` git state
- `/etc/${PROJECT_NAME}` and `/var/lib/${PROJECT_NAME}`
- `${SERVICE_PREFIX}-god@*.service`
- tmux socket and targets
- dispatch timer/service
- provider credential wiring without secret output

Named drift checks (block-level findings; map to safe repairs in Phase 5):
- **timer enabled-inactive**: `systemctl is-enabled ${SERVICE_PREFIX}-dispatch.timer` is `enabled` but `is-active` is `inactive`, or `LastTriggerUSec` is empty for >30 min after install
- **god/tmux parity**: any `${SERVICE_PREFIX}-god@<id>.service` is `active` while `tmux -L ${SERVICE_PREFIX} has-session -t "=${SERVICE_PREFIX}-god-<id>"` returns non-zero
- **stale tmux socket**: `tmux -L ${SERVICE_PREFIX} ls` lists session names that no longer correspond to any active god@<id>.service (orphans from killed instances)
- **missing .agent-home/users**: `${PROJECT_DIR}/.agent-home/users` absent or wrong owner â€” relay will fail with `status=226/NAMESPACE` on next restart
- **shared-auth-repair-missing**: `/var/lib/claude-shared/` exists but `claude-shared-auth-perms.path` is missing or inactive
- **shared-auth-acl-drift**: repair automation exists but one or more shared auth files has `mask::---` or fails per-bot read/write checks
- **stale-agent-cli**: `claude --version` or `codex --version` differs from the package registry latest version after a requested update
- **stale-skills-cache**: `${AGENT_SKILLS_DIR}` is current but Claude/Codex plugin cache hashes differ, selected plugins are disabled, or plugin metadata points at stale `/home/agent-bot/...`
- **excess-plugin-cache**: multiple old LevNikolaevich cache snapshots remain per plugin after backup cleanup

### Phase 4: Relay Runtime

When Telegram/relay is enabled, inspect:
- `${SERVICE_PREFIX}-hex-relay.service`
- `/opt/${SERVICE_PREFIX}-hex-relay`
- HTTP `/health`, `/ready`, and `/live`
- relay DB presence/schema
- old `relay-bot` service/path drift
- `RELAY_HOOK_PORT` listener collisions
- project `.claude/settings.json` hook keys, per-project port, Bearer auth header, and absence of unresolved placeholders
- unauthenticated hook smoke (`401`) and authenticated valid `SessionStart` smoke (`200`)
- Telegram Bot API commands in both default and `all_private_chats` scopes

Named drift checks from `/health` JSON and relay integration probes:
- **idle-session-normal**: `god_session_ready:false` with `/ready` 200, no pending inbound, and idle-shutdown journal evidence is informational, not a failed deploy
- **hook-auth-misconfigured**: project hook JSON lacks Bearer auth, uses the wrong port, or authenticated `SessionStart` smoke does not return 200
- **telegram-command-drift**: command list differs between default and `all_private_chats` scopes or misses `/usage`, `/new_session`, `/sessions`, `/tasks`, `/users`
- **inbound-failure backlog**: `inbound_failed > 0` or `outbox_abandoned > 0` â€” emit a finding with the offending message ids from the journal (`grep -oE '"id":[0-9]+,"terminal":"failed"'`) so the operator can ack or replay
- **send-keys regression**: `journalctl -u ${SERVICE_PREFIX}-hex-relay.service --since '24h ago'` contains any `send-keys -l rc=1: command send-keys: invalid flag` â€” marker that the relay binary predates the buffer-paste fix
- **stop-failure unknowns**: more than 3 `"error_type":"unknown"` entries in 24h with `"kind":"stop_failure"` â€” relay binary predates the typed-classifier fix; aggregate by `kind` to surface the underlying cause

### Phase 5: Safe Repair

Allowed safe repairs only:
- restart a named inactive project service after confirming unit file exists
- re-enable an expected timer
- recreate missing non-secret directories with documented owner/mode
- rerun `systemctl daemon-reload`
- report, but do not rewrite, missing auth or secrets
- `chmod +x /usr/local/bin/agent-update` when the file is a non-executable bash script (validated by `file` and `bash -n`); follow with `systemctl reset-failed agent-update.service`
- `systemctl start claude-shared-auth-perms.service` when shared-auth ACL drift is detected and the unit exists; manual `chmod 0660` on `/var/lib/claude-shared/.claude/.credentials.json`, `/var/lib/claude-shared/.claude.json`, or `/var/lib/claude-shared/.codex/auth.json` is immediate recovery only when the repair unit is missing
- add a missing bot user to the rendered `RUNTIME_USERS` list in `/usr/local/bin/agent-update` when that bot has its own `~/.nvm/nvm.sh` and is otherwise healthy, then run `bash -n /usr/local/bin/agent-update` before starting the service
- rerun `/usr/local/bin/${SERVICE_PREFIX}-register-telegram-commands /etc/${PROJECT_NAME}/secrets.env` when only Telegram command scope drift is detected
- after backup, resync LevNikolaevich Claude/Codex plugin caches from `${AGENT_SKILLS_DIR}` and remove stale cache snapshots when `stale-skills-cache` or `excess-plugin-cache` is detected; do not modify auth/session state
- **timer enabled-inactive**: `systemctl daemon-reload && systemctl start ${SERVICE_PREFIX}-dispatch.timer` followed by `systemctl list-timers ${SERVICE_PREFIX}-dispatch.timer --all` to confirm `NEXT` is populated
- **god/tmux parity**: `systemctl restart ${SERVICE_PREFIX}-god@<id>.service` and re-verify `tmux -L ${SERVICE_PREFIX} has-session -t "=${SERVICE_PREFIX}-god-<id>"` exits 0; do NOT rename or kill the orphaned tmux session of a different user
- **missing .agent-home/users**: `install -d -o ${BOT_USER} -g ${BOT_USER} -m 0700 ${PROJECT_DIR}/.agent-home/users ${PROJECT_DIR}/.agent-cache` then `systemctl restart ${SERVICE_PREFIX}-hex-relay.service`

Forbidden repairs:
- secret creation or token edits
- deleting DB files
- deleting project repos
- changing Git remotes/branches
- changing shared auth
- broad package upgrades
- printing or editing Telegram/Claude/Codex token values while checking hooks and command scopes

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
- [ ] Agent CLI freshness, skills/plugin cache consistency, and stale metadata paths inspected.
- [ ] Project runtime health inspected.
- [ ] Relay runtime, hook auth smoke, and Telegram command scopes inspected or gated `N/A:`.
- [ ] Drift and blockers reported with concrete evidence.
- [ ] Safe repair actions were explicit, bounded, and recorded.
- [ ] Forbidden repair categories were not performed.
- [ ] `dry_run=true`, `inspect`, and `verify` performed no mutation.
- [ ] Structured `vps-environment-diagnostics` summary artifact written.

---

**Version:** 1.2.0
**Last Updated:** 2026-05-07

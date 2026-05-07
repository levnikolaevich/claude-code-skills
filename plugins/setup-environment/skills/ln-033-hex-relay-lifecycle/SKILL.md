---
name: ln-033-hex-relay-lifecycle
description: "Use when deploying, redeploying, verifying, migrating, or syncing users for the hex-relay Telegram/API control plane on a VPS."
license: MIT
allowed-tools: Bash, Read, mcp__hex-ssh__remote-ssh, mcp__hex-ssh__ssh-read-lines, mcp__hex-ssh__ssh-write-chunk, mcp__hex-ssh__ssh-edit-block, mcp__hex-ssh__ssh-download
---

<!-- markdownlint-disable MD012 MD022 MD032 MD040 MD041 MD060 -->

> **Paths:** File paths (`references/agents/hex-relay/`, `../ln-030-vps-bootstrap/references/`) are relative to this skill directory.

# ln-033-hex-relay-lifecycle

**Type:** L3 Worker
**Category:** 0XX Shared / Infrastructure

Manages `hex-relay` as a standalone product deployed into one project environment.

## Agent routing

hex-relay 0.4+ routes per Telegram operator between Claude and Codex god-sessions:

- DB column `user_buddy.agent` stores the active agent per `(project, user)`. Default is `claude` for legacy users and is migrated automatically on first relay start (see Phase 5 health checks).
- Telegram `/set_buddy claude` and `/set_buddy codex` flip the column. Operators may also prefix a single message with `@claude ` or `@codex ` to override routing for that message only.
- Inbound delivery picks the tmux target via the agent column: `${SERVICE_PREFIX}-god-<id>` for Claude, `${SERVICE_PREFIX}-god-codex-<id>` for Codex (see `agents/hex-relay/src/config/paths.ts`).
- Hook payloads accept an `agent: "claude"|"codex"` field; missing values default to `claude`. Codex hooks are wired through `/usr/local/bin/hex-relay-codex-hook.sh` (installed by `ln-032`).

## MANDATORY READ

**MANDATORY READ:** Load `references/worker_runtime_contract.md`, `references/coordinator_summary_contract.md`, and `references/vps_runtime_contract.md`
**MANDATORY READ:** Load `../ln-030-vps-bootstrap/references/hex_relay_deploy.md`, `../ln-030-vps-bootstrap/references/verification_recipes.md`, `agents/hex-relay/README.md`, `agents/hex-relay/docs/redeploy.md`, and `agents/hex-relay/docs/telegram-operator-runbook.md`

---

## Input / Output

| Direction | Content |
|---|---|
| Input | `mode`, project/VPS variables, Telegram variables, optional declared users, optional `dry_run`, optional `runId`, optional `summaryArtifactPath` |
| Output | `vps-hex-relay-lifecycle` summary with status, changes, warnings, blockers, verification, and artifact paths |

If `summaryArtifactPath` is provided, write the same summary JSON there. If not provided, return the summary inline and write it to the standalone run-scoped path. Generate a standalone `run_id` when `runId` is absent.

## Modes

| Mode | Behavior |
|---|---|
| `initial_deploy` | Deploy `agents/hex-relay/` into an existing project runtime |
| `redeploy` | Replace source on VPS, rebuild, restart service, verify health |
| `verify_only` | Inspect service, DB, hooks, Telegram command state without mutation |
| `sync_users` | Reconcile declared Telegram users/roles through supported relay state |

## Workflow

### Phase 1: Preflight

Verify:
- Telegram is enabled for deploy/sync modes; when disabled, report relay deploy/start as `N/A` and do not start `hex-relay`
- `${PROJECT_NAME}`, `${SERVICE_PREFIX}`, `${PROJECT_DIR}`, `${RELAY_HOOK_PORT}` are set
- project runtime exists
- `/etc/${PROJECT_NAME}/secrets.env` exists but secret values are not printed
- `agents/hex-relay/` source is available locally

### Phase 2: Compatibility

Use `hex_relay_deploy.md`.

Detect old `${SERVICE_PREFIX}-relay-bot.service` and `/opt/${SERVICE_PREFIX}-relay-bot`.

Rule:
- disable or migrate old relay before enabling `${SERVICE_PREFIX}-hex-relay.service`
- never run old and new relay units together

### Phase 3: Deploy Or Redeploy

For `initial_deploy`, install:
- `/opt/${SERVICE_PREFIX}-hex-relay`
- `${SERVICE_PREFIX}-hex-relay.service`
- project-scope hooks
- Telegram command registration

For `redeploy`, follow `agents/hex-relay/docs/redeploy.md`:
- package source without `node_modules` or `dist`
- upload source
- rebuild with `npm ci && npm run build`
- restart service

### Phase 4: Users And Telegram

For `sync_users`, reconcile declared users without exposing tokens.

Verify:
- allowlist state
- per-user god target behavior
- `/new_session`, `/sessions`, `/tasks`, `/users`, `/usage` command availability
- BotFather hardening checklist status when applicable

### Phase 5: Health

Verify:
- `${SERVICE_PREFIX}-hex-relay.service` (`is-active` + `NRestarts == 0` + `MainPID` listening on `${RELAY_HOOK_PORT}`)
- `GET /health` returns `ok:true`, `god_session_ready:true`, `inbound_failed:0`, `outbox_abandoned:0`, and exposes `pending_fanout_acks_total` (non-negative integer; advances when fan-out delivery to multiple agents acks pending replies)
- DB schema migration ran on this restart: `user_buddy.agent` column exists (`PRAGMA table_info(user_buddy)`), `messages.agent` and `pending_replies.agent` columns exist. Migrations auto-run during relay startup; an empty schema check in the journal at boot is the only required evidence.
- `relay.db` schema (sessions has `created_by_user_id`, messages has `from_user_id`, outbox has `event_type`)
- outbox/dispatch/todo state smoke
- `${SERVICE_PREFIX}-dispatch.timer` is `active` (not just enabled) and `LastTriggerUSec` is populated; `journalctl -u ${SERVICE_PREFIX}-dispatch.service --since '24h ago'` shows at least one Started/Finished pair after the most recent install or redeploy
- god/tmux parity: every active `${SERVICE_PREFIX}-god@<id>.service` has a matching `tmux -L ${SERVICE_PREFIX} has-session -t "=${SERVICE_PREFIX}-god-<id>"` exit 0
- 24h log scan for `level":(40|50|60)` aggregates: `send-keys -l rc=1 invalid flag` count must be 0; `"kind":"stop_failure"` with `"error_type":"unknown"` must be ≤3/24h
- redeploy smoke (run before switching traffic): inject a multi-line payload that begins a line with `-` (markdown bullet, `--- divider`); confirm `INBOUND delivered to tmux` with `attempts=0`
- final Claude reply mirrored through Stop hook when full smoke is requested

### Phase 6: Summary

Write a `vps-hex-relay-lifecycle` summary artifact with deploy/redeploy/user-sync changes and health evidence.

## Critical Rules

- `hex-relay` source is owned by `agents/hex-relay/`.
- Do not edit built `dist/` on the VPS.
- Do not upload `node_modules/`.
- Do not print or store Telegram/provider token values.
- `dry_run=true` and `verify_only` do not mutate remote state.
- Product-specific behavior is documented in `agents/hex-relay/README.md`.

## Definition of Done

- [ ] Telegram/relay gate evaluated and skipped as `N/A:` when disabled.
- [ ] Old `relay-bot` unit/path detected and disabled or reported before enabling `hex-relay`.
- [ ] `/opt/${SERVICE_PREFIX}-hex-relay` source installed or verified.
- [ ] `${SERVICE_PREFIX}-hex-relay.service` active or planned.
- [ ] Product was built with `npm ci && npm run build` for deploy/redeploy.
- [ ] `/health` returns expected service and god-session fields, including `inbound_failed:0` / `outbox_abandoned:0`.
- [ ] `${SERVICE_PREFIX}-dispatch.timer` is `active` (not only `enabled`); next-fire timestamp present.
- [ ] god/tmux parity verified for every active `${SERVICE_PREFIX}-god@<id>.service`.
- [ ] Multi-line `-`-prefixed smoke payload delivered with `attempts=0` after deploy/redeploy.
- [ ] Telegram commands and declared users are verified or explicitly gated.
- [ ] `dry_run=true` / `verify_only` performed no mutation.
- [ ] Structured `vps-hex-relay-lifecycle` summary artifact written.

---

**Version:** 1.1.0
**Last Updated:** 2026-05-07

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
- Telegram is enabled for deploy/sync modes
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
- `${SERVICE_PREFIX}-hex-relay.service`
- `GET /health`
- `relay.db` schema
- outbox/dispatch/todo state smoke
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
- [ ] `/health` returns expected service and god-session fields.
- [ ] Telegram commands and declared users are verified or explicitly gated.
- [ ] `dry_run=true` / `verify_only` performed no mutation.
- [ ] Structured `vps-hex-relay-lifecycle` summary artifact written.

---

**Version:** 1.0.0
**Last Updated:** 2026-05-05

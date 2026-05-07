---
name: ln-032-vps-project-runtime
description: "Use when creating or verifying one project runtime on a prepared VPS, including god-session, provider credentials, and local dispatcher setup."
license: MIT
allowed-tools: Bash, Read, mcp__hex-ssh__remote-ssh, mcp__hex-ssh__ssh-read-lines, mcp__hex-ssh__ssh-write-chunk, mcp__hex-ssh__ssh-edit-block
---

<!-- markdownlint-disable MD012 MD022 MD032 MD040 MD041 MD060 -->

> **Paths:** File paths (`../ln-030-vps-bootstrap/references/`) are relative to this skill directory.

# ln-032-vps-project-runtime

**Type:** L3 Worker
**Category:** 0XX Shared / Infrastructure

Creates or verifies one project environment on a prepared VPS and installs the local operator dispatcher in the target project repo.

## MANDATORY READ

**MANDATORY READ:** Load `references/worker_runtime_contract.md`, `references/coordinator_summary_contract.md`, and `references/vps_runtime_contract.md`
**MANDATORY READ:** Load `../ln-030-vps-bootstrap/references/scope_layers.md`, `../ln-030-vps-bootstrap/references/project_repo_bootstrap.md`, `../ln-030-vps-bootstrap/references/god_session_install.md`, `../ln-030-vps-bootstrap/references/provider_credentials.md`, and `../ln-030-vps-bootstrap/references/operator_dispatcher_install.md`

**Conditional read (load when this project's `${BOT_USER}` is part of a multi-bot fleet using shared auth)**: `../ln-030-vps-bootstrap/references/shared_auth_state.md` — when `~${BOT_USER}/.claude` symlinks to `/var/lib/claude-shared/.claude`, `${PROJECT_DIR}/.claude/CLAUDE.md` and `${PROJECT_DIR}/.claude/settings.json` (project-scope) are still rendered per-project, but `~${BOT_USER}/.claude/commands/<prefix>-dispatch.md` writes through the symlink into the shared dir (same group/ACL applies). Do not seed per-bot `~/.claude.json`; the shared one already carries the canonical `userID`.

---

## Input / Output

| Direction | Content |
|---|---|
| Input | `mode`, project/VPS variables, provider variables, local `${TARGET_REPO_PATH}`, optional `dry_run`, optional `runId`, optional `summaryArtifactPath` |
| Output | `vps-project-runtime` summary with status, changes, warnings, blockers, verification, and artifact paths |

If `summaryArtifactPath` is provided, write the same summary JSON there. If not provided, return the summary inline and write it to the standalone run-scoped path. Generate a standalone `run_id` when `runId` is absent.

## Modes

| Mode | Behavior |
|---|---|
| `bootstrap` | Create or reconcile one project runtime |
| `verify_only` | Inspect expected project runtime without mutation |

## Workflow

### Phase 1: Preflight

Verify unique project inputs:
- `${PROJECT_NAME}`
- `${SERVICE_PREFIX}`
- `${PROJECT_DIR}`
- `${REPO_URL}`
- `${REPO_REF}`
- `${RELAY_HOOK_PORT}`
- `${TARGET_REPO_PATH}`

Block on collisions for existing unrelated `${PROJECT_NAME}`, `${SERVICE_PREFIX}`, tmux socket, or relay port.

### Phase 2: Project Repo And State

Use `project_repo_bootstrap.md`.

Responsibilities:
- create or verify `${PROJECT_DIR}`
- clone or update `${REPO_URL}` at `${REPO_REF}`
- create `/etc/${PROJECT_NAME}` and `/var/lib/${PROJECT_NAME}`
- render project `.claude/` files
- preserve arbitrary non-git files

### Phase 3: God-Session And Scheduler

Use `god_session_install.md`.

Responsibilities:
- sandbox script
- `${SERVICE_PREFIX}-god@.service` (Claude template, drives `god-session.sh`)
- `${SERVICE_PREFIX}-god-codex@.service` (Codex template, drives `god-session-codex.sh`)
- `/usr/local/bin/hex-relay-codex-hook.sh` shim (mode 755, root:root) used by Codex's `~/.codex/config.toml` hooks block
- tmux socket and per-agent target naming (`${SERVICE_PREFIX}-god-<id>` for Claude, `${SERVICE_PREFIX}-god-codex-<id>` for Codex)
- dispatch service/timer templates
- statusLine support
- project-scoped hooks except `hex-relay` product deployment

Both god templates are installed per project. Only the Claude template is enabled by default for each declared `${TELEGRAM_CHAT_ID}`; the Codex template stays loaded but inactive until hex-relay starts the unit on demand (operator switches buddy via `/set_buddy codex`). Verify both templates exist via `systemctl list-unit-files '${SERVICE_PREFIX}-god*@.service'` and confirm the Codex unit is `disabled` (not `not-found`).

### Phase 4: Provider Credentials

Use `provider_credentials.md`.

Responsibilities:
- GitHub App key path and `${SERVICE_PREFIX}-mint-gh-token`
- GitLab git/API credential wiring
- optional Codex notify hook only when requested

Never invent or print real provider secrets.

### Phase 5: Local Operator Dispatcher

Use `operator_dispatcher_install.md`.

Responsibilities:
- copy `dispatcher.md.template` to `${TARGET_REPO_PATH}/.claude/commands/dispatcher.md`
- seed missing `.env.local` `VPS_*` keys
- verify `.env.local` is git-ignored

### Phase 6: Summary

Write a `vps-project-runtime` summary artifact with project runtime changes, local dispatcher changes, warnings, blockers, and verification evidence.

## Critical Rules

- Requires a prepared or reconciled shared host runtime.
- Does not install shared Node/Claude/Codex runtime.
- Does not deploy or rebuild `agents/hex-relay/`.
- `dry_run=true` and `verify_only` do not mutate remote or local state.
- Local dispatcher setup is project-specific and stays with this worker.

## Definition of Done

- [ ] Project variables validated and collision checks completed.
- [ ] `${PROJECT_DIR}` clone exists at `${REPO_REF}` without overwriting unrelated files.
- [ ] `/etc/${PROJECT_NAME}` and `/var/lib/${PROJECT_NAME}` exist with expected ownership and modes.
- [ ] Project `.claude/` settings and instructions are rendered.
- [ ] `${SERVICE_PREFIX}-god@.service` and `${SERVICE_PREFIX}-god-codex@.service` templates and scheduler templates installed or verified; Codex template is present and idle (`disabled` or stopped, not `not-found`).
- [ ] `/usr/local/bin/hex-relay-codex-hook.sh` exists, is executable (mode 755), and reachable from the Codex sandbox.
- [ ] `${PROJECT_DIR}/.agent-home/users` and `.agent-cache` exist with `${BOT_USER}:${BOT_USER}` 0700 (relay's `ReadWritePaths=` requires the path to exist before first start).
- [ ] Primary `${SERVICE_PREFIX}-god@${TELEGRAM_CHAT_ID}.service` is `active` AND `tmux -L ${SERVICE_PREFIX} has-session -t "=${SERVICE_PREFIX}-god-${TELEGRAM_CHAT_ID}"` exits 0 (use exact-match `=name` form).
- [ ] Provider credentials are configured or explicitly gated `N/A:`.
- [ ] Local dispatcher command and `.env.local` `VPS_*` keys installed or planned.
- [ ] `dry_run=true` / `verify_only` performed no mutation.
- [ ] Structured `vps-project-runtime` summary artifact written.

---

**Version:** 1.1.0
**Last Updated:** 2026-05-07

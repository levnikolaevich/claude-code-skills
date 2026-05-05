---
name: ln-031-vps-host-runtime
description: "Use when installing, verifying, or updating the shared VPS host runtime for Claude Code, Codex, MCP, and marketplace plugins."
license: MIT
allowed-tools: Bash, Read, mcp__hex-ssh__remote-ssh, mcp__hex-ssh__ssh-read-lines, mcp__hex-ssh__ssh-write-chunk, mcp__hex-ssh__ssh-edit-block
---

<!-- markdownlint-disable MD012 MD022 MD032 MD040 MD041 MD060 -->

> **Paths:** File paths (`shared/`, `../ln-030-vps-bootstrap/references/`) are relative to skills repo root. If not found at CWD, locate this `SKILL.md` directory and go up one level for repo root.

# ln-031-vps-host-runtime

**Type:** L3 Worker
**Category:** 0XX Shared / Infrastructure

Installs, verifies, or updates the shared VPS layer used by all project environments on one host: packages, `${BOT_USER}`, Node/nvm, Claude Code, Codex, MCP, marketplace clone/plugins, Codex trust entries, and the system-wide `agent-update` timer.

## MANDATORY READ

**MANDATORY READ:** Load `shared/references/worker_runtime_contract.md`, `shared/references/coordinator_summary_contract.md`, and `shared/references/vps_runtime_contract.md`
**MANDATORY READ:** Load `../ln-030-vps-bootstrap/references/scope_layers.md`, `../ln-030-vps-bootstrap/references/vps_base_install.md`, `../ln-030-vps-bootstrap/references/agent_runtime_install.md`, and `../ln-030-vps-bootstrap/references/substitution_rules.md`

---

## Input / Output

| Direction | Content |
|---|---|
| Input | `mode`, VPS connection, `${BOT_USER}`, `${PROJECT_DIR}`, `${AGENT_SKILLS_*}`, selected plugins, optional `dry_run`, optional `runId`, optional `summaryArtifactPath` |
| Output | `vps-host-runtime` summary with status, changes, warnings, blockers, verification, and artifact paths |

If `summaryArtifactPath` is provided, write the same summary JSON there. If not provided, return the summary inline and write it to the standalone run-scoped path. Generate a standalone `run_id` when `runId` is absent.

## Modes

| Mode | Behavior |
|---|---|
| `install_or_reconcile` | Install missing shared host runtime and update idempotent surfaces |
| `verify_or_update` | Verify existing host, apply safe updates, add current project trust block |
| `verify_only` | Detection only; no mutation |

## Workflow

### Phase 1: Preflight

Verify rendered variables, SSH access, root permissions, and `dry_run` gate.

Evidence:
- SSH connection result
- host OS
- selected mode
- missing variables

### Phase 2: Base Host

Use `vps_base_install.md`.

Responsibilities:
- apt packages
- GitHub CLI and GitLab CLI
- `${BOT_USER}` existence and SSH ownership
- AppArmor/bubblewrap availability

`verify_only` reports drift and planned commands without running installers.

### Phase 3: Agent Runtime

Use `agent_runtime_install.md`.

Responsibilities:
- Node 24 under `${BOT_USER}`
- Claude Code and Codex CLI
- optional MCP servers
- Codex config creation and current `${PROJECT_DIR}` trust block
- skills marketplace clone and selected plugins

Do not overwrite existing auth files. Missing `claude` or `codex` login is a blocker or warning, not an automated fake success.

### Phase 4: Shared Updater

Install or verify:
- `/usr/local/bin/agent-update`
- `agent-update.service`
- `agent-update.timer`
- `/var/lib/agent-update`
- `/var/log/agent-update.log`

Smoke-run only when requested by mode and safe for the host.

### Phase 5: Summary

Write a `vps-host-runtime` summary artifact with:
- installed/updated/skipped surfaces
- package and CLI versions
- auth health
- marketplace/plugin health
- current project trust block status
- blockers and warnings

## Critical Rules

- Safe to run repeatedly on the same VPS.
- Existing shared auth is never overwritten.
- Existing project environments are not restarted except through documented updater behavior.
- `dry_run=true` and `verify_only` do not mutate remote state.
- Optional plugins require explicit selection; default is `agile-workflow`.

## Definition of Done

- [ ] Required inputs and SSH/root access verified or reported as blockers.
- [ ] Base packages and platform CLIs installed, updated, or verified.
- [ ] `${BOT_USER}` exists with expected SSH ownership and login shell.
- [ ] Node, Claude Code, and Codex versions verified under `${BOT_USER}`.
- [ ] Current `${PROJECT_DIR}` Codex trust block exists or is reported as planned drift.
- [ ] Marketplace clone and selected plugins verified.
- [ ] `agent-update.service` and `agent-update.timer` installed or verified.
- [ ] `dry_run=true` / `verify_only` performed no mutation.
- [ ] Structured `vps-host-runtime` summary artifact written.

---

**Version:** 1.0.0
**Last Updated:** 2026-05-05

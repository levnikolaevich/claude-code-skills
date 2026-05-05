---
name: ln-030-vps-bootstrap
description: "Use when bootstrapping or managing VPS agent environments: fresh install, add project, hex-relay redeploy, diagnostics, or fleet plan/apply."
license: MIT
allowed-tools: Bash, Read, mcp__hex-ssh__remote-ssh, mcp__hex-ssh__ssh-read-lines
---

<!-- markdownlint-disable MD012 MD022 MD032 MD040 MD041 MD060 -->

> **Paths:** File paths (`shared/`, `references/`, `../ln-*`, `agents/hex-relay/`, `ops/`) are relative to the skills repo root. If not found at CWD, locate this `SKILL.md` directory and go up two levels for repo root.

# ln-030-vps-bootstrap

**Type:** L2 Domain Coordinator
**Category:** 0XX Shared / Infrastructure
**Tested on:** Ubuntu 24.04 (apt + systemd base: Contabo, Hetzner, DigitalOcean)

Public entrypoint for VPS agent environments. This skill routes between fresh install, adding a project to an existing VPS, `hex-relay` lifecycle work, diagnostics, and fleet `plan/apply`. It does not inline detailed install work; it delegates to focused runtime workers and consumes their machine-readable summaries.

## MANDATORY READ

**MANDATORY READ:** Load `shared/references/skill_contract.md`, `shared/references/worker_runtime_contract.md`, `shared/references/coordinator_summary_contract.md`, `shared/references/vps_runtime_contract.md`, and `shared/references/meta_analysis_protocol.md`
**MANDATORY READ:** Load `references/scope_layers.md`, `references/shared_user_pattern.md`, `references/troubleshooting.md`, and `references/verification_recipes.md`

Reference inventory owned by this coordinator family but loaded by the worker that needs it:
`README.md`, `vps_base_install.md`, `agent_runtime_install.md`, `god_session_install.md`, `project_repo_bootstrap.md`, `hex_relay_deploy.md`, `operator_dispatcher_install.md`, `provider_credentials.md`, `fleet_registry.md`, `fleet_plan_apply.md`, `substitution_rules.md`, `agent-sandbox.sh`, `agent-update.sh`, `agent-update.service`, `agent-update.timer`, `claude-usage-report.sh`, `codex-config.toml.template`, `codex-notify.sh`, `dispatch.md`, `dispatch.service`, `dispatch.timer`, `dispatcher.md.template`, `god-session.service`, `god-session.sh`, `hex-relay.service`, `mint-gh-token.sh`, `operator.CLAUDE.md`, `register-telegram-commands.sh`, `secrets.env.template`, `settings.agent-config.fragment.json`, `settings.hooks.fragment.json`, `settings.statusline.fragment.json`, `statusline.sh`.

---

## Inputs

| Parameter | Required | Default | Description |
|---|---:|---|---|
| `mode` | No | `auto` | `auto`, `fresh_install`, `add_project`, `relay_redeploy`, `diagnose`, `fleet_plan`, or `fleet_apply` |
| `dry_run` | No | `false` | Produce planned actions without mutation where supported |
| `registry_path` | No | `/etc/agent-fleet/environments` | VPS-local fleet registry directory for `fleet_plan` / `fleet_apply`; repo `ops/environments` is templates/docs only |
| `environment_id` | No | unset | Limit fleet operations to one registry environment |
| `plan_artifact_path` | No | generated | Existing plan for `fleet_apply`, or output path for `fleet_plan` |
| `repair_scope` | No | `safe` | `none`, `safe`, or explicit bounded repair action for diagnostics |

Single-project modes also require the project/VPS variables documented in `references/scope_layers.md` and worker inputs:
`PROJECT_NAME`, `SERVICE_PREFIX`, `PROJECT_DIR`, `REPO_URL`, `REPO_REF`, `BOT_USER`, `VPS_HOST`, `VPS_SSH_KEY`, `TARGET_REPO_PATH`, `GIT_PROVIDER`, `REPO_SLUG`, plus optional Telegram/provider variables.

---

## Phase Map

### Phase 1: Resolve Intent

Classify the requested operation:

| Condition | Operation |
|---|---|
| `mode=fleet_plan` | Validate registry and compute drift plan for selected environments |
| `mode=fleet_apply` | Revalidate registry, re-check live state, and apply approved plan targets |
| `mode=relay_redeploy` | Redeploy `agents/hex-relay/` for one existing project environment |
| `mode=diagnose` | Inspect one environment and run only bounded safe repairs |
| `mode=fresh_install` | Force host reconcile, project runtime, optional relay, verification |
| `mode=add_project` | Reuse host through verify/update, then project runtime and optional relay |
| `mode=auto` | Discover host state before selecting fresh vs add-project path |

Evidence:
- selected mode
- target environment ids
- missing required variables
- `dry_run` / apply gate status

### Phase 2: Host Discovery

Always perform a lightweight host discovery before project mutation unless the operation is registry validation only.

Discovery checks:
- SSH connectivity to `${VPS_HOST}`
- `id ${BOT_USER}`
- required package binaries
- Node/nvm, `claude`, `codex`
- `~${BOT_USER}/.claude/`, `~${BOT_USER}/.codex/`
- `${AGENT_SKILLS_DIR}` and marketplace manifests
- `agent-update.timer`
- existing `${SERVICE_PREFIX}` units and port collisions

Decision:
- new or unhealthy shared host -> call `ln-031-vps-host-runtime` with `mode=install_or_reconcile`
- existing host -> call `ln-031-vps-host-runtime` with `mode=verify_or_update`
- diagnostics-only -> call `ln-034-vps-environment-diagnostics`

### Phase 3: Project Runtime

Call `ln-032-vps-project-runtime` for one selected project unless the operation is only `relay_redeploy`, `diagnose`, or registry `plan`.

The worker owns project clone, project config/state dirs, god-session, scheduler, provider credentials, and local dispatcher setup. It must not rebuild shared host runtime or deploy `hex-relay`.

### Phase 4: `hex-relay` Lifecycle

Call `ln-033-hex-relay-lifecycle` when:
- Telegram is enabled for a fresh/add-project install
- `mode=relay_redeploy`
- fleet drift plan includes `hex-relay` source/service/user drift

Skip with explicit `N/A:` reason when `TELEGRAM_BOT_TOKEN` is empty and no relay redeploy was requested.

### Phase 5: Diagnostics And Fleet

Call `ln-034-vps-environment-diagnostics` after install/redeploy when final health evidence is needed, or directly for `mode=diagnose`.

Fleet rules:
- `fleet_plan` loads and validates the live VPS registry from `/etc/agent-fleet/environments/*.yaml` by default, checks live state, and writes a plan artifact under `.hex-skills/runtime-artifacts/runs/{run_id}/vps-fleet-plan/`.
- `fleet_apply` must re-check the live VPS registry and live state before mutation. A stale, missing, or registry-mismatched plan is a blocker.
- The repo `ops/environments/` directory is template-only. Do not treat it as the source of truth for real fleet membership.
- v1 is push-over-SSH only; no continuous daemon/reconciler.
- registry secrets are references only, never values.

### Phase 6: Final Summary

Aggregate child summaries into one coordinator summary:
- operation
- environments selected
- workers activated
- changes planned/applied
- skipped/N/A gates
- warnings and blockers
- verification evidence
- artifact paths

---

## Worker Invocation (MANDATORY)

| Phase | Worker | Use |
|---|---|---|
| 2 | `ln-031-vps-host-runtime` | Shared VPS host/runtime install, verify, update |
| 3 | `ln-032-vps-project-runtime` | Per-project VPS runtime and local operator setup |
| 4 | `ln-033-hex-relay-lifecycle` | `hex-relay` deploy, redeploy, migration, Telegram users |
| 5 | `ln-034-vps-environment-diagnostics` | Health, drift, logs, bounded safe repair |

Managed worker pattern:

```text
childRunId="run-ln-030-${operation}-${worker}-${environment_id}"
childSummaryArtifactPath=".hex-skills/runtime-artifacts/runs/${run_id}/vps-runtime-worker/${worker}--${environment_id}.json"

Skill(skill: "ln-031-vps-host-runtime", args: "mode={install_or_reconcile|verify_or_update|verify_only} environment_id={environment_id} runId=${childRunId} summaryArtifactPath=${childSummaryArtifactPath}")
Skill(skill: "ln-032-vps-project-runtime", args: "mode={bootstrap|verify_only} environment_id={environment_id} runId=${childRunId} summaryArtifactPath=${childSummaryArtifactPath}")
Skill(skill: "ln-033-hex-relay-lifecycle", args: "mode={initial_deploy|redeploy|verify_only|sync_users} environment_id={environment_id} runId=${childRunId} summaryArtifactPath=${childSummaryArtifactPath}")
Skill(skill: "ln-034-vps-environment-diagnostics", args: "mode={inspect|verify|repair_safe} environment_id={environment_id} repair_scope={repair_scope} runId=${childRunId} summaryArtifactPath=${childSummaryArtifactPath}")
Read ${childSummaryArtifactPath}
```

Risk Checklist:
- checkpoint child metadata before each delegation
- never continue from child chat prose when the summary artifact is missing
- do not run workers whose phase is gated `N/A:`
- do not apply a fleet plan if live state has changed since plan creation

## TodoWrite format (mandatory)

```text
- Phase 1: Resolve operation and required variables (pending)
- Phase 2: Discover host state and call host runtime worker when needed (pending)
- Phase 3: Call project runtime worker when project bootstrap is in scope (pending)
- Phase 4: Call hex-relay lifecycle worker when Telegram/relay is in scope (pending)
- Phase 5: Call diagnostics worker and/or write fleet plan/apply evidence (pending)
- Phase 6: Aggregate child summaries and run self-check (pending)
```

---

## Critical Rules

- `ln-030` owns routing decisions and ordering.
- Workers remain standalone; do not encode upward ownership in worker instructions.
- Host bootstrap is never blindly skipped. Existing VPS hosts go through `verify_or_update`.
- `fleet_apply` is not a continuous reconciler. It applies an approved plan after a fresh live-state check.
- Real fleet membership is stored on the VPS under `/etc/agent-fleet/environments`; repo `ops/environments` is a template contract only.
- Registry files may contain secret references only.
- Project-specific units, ports, state dirs, and Telegram bot tokens must be unique per environment.
- `hex-relay` source is owned by `agents/hex-relay/`; deployment logic lives in `ln-033`.

---

## Definition of Done

- [ ] Operation mode resolved with required variables or registry targets.
- [ ] Initial TodoWrite plan contains every phase above and all gated `N/A:` items.
- [ ] Host discovery completed or registry-only mode explicitly skipped it.
- [ ] Selected worker invocations used `runId` and `summaryArtifactPath`.
- [ ] Every activated worker produced a structured summary artifact.
- [ ] Fresh/add-project flow called host runtime before project runtime.
- [ ] Existing-host flow used `verify_or_update`, not a blind skip.
- [ ] `hex-relay` work was delegated only when Telegram/relay scope required it.
- [ ] Fleet plan/apply used the live VPS registry path and wrote or consumed a run-scoped artifact with registry evidence.
- [ ] Final coordinator summary lists applied changes, skipped gates, blockers, warnings, and verification evidence.
- [ ] Meta-analysis completed using `shared/references/meta_analysis_protocol.md`.

## Meta-Analysis

**MANDATORY READ:** Load `shared/references/meta_analysis_protocol.md`

Skill type: `domain-coordinator`. Run after Phase 6 and include whether the split reduced inline execution, preserved worker independence, and kept fleet apply guarded by a plan artifact.

---

**Version:** 1.0.0
**Last Updated:** 2026-05-05

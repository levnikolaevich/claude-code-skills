# Environment State Contract

Shared project-scoped contract for `.hex-skills/environment_state.json`.

Use this contract when a skill:
- checks disabled agents
- decides whether Claude or Codex should be probed
- needs environment setup health or sync metadata
- needs skill-root discovery health or duplicate-skill diagnostics
- routes operations by task provider (linear/file/github)
- selects research tool or fallback chain

## Location

```text
{project_root}/.hex-skills/environment_state.json
```

Environment state is project-scoped. Skills must never read or write environment state outside the current project root.

Schema SSOT:
- `shared/references/environment_state_schema.json`

Related contract:
- `shared/references/agent_skill_roots_contract.md`

## Rules

- Missing file means default-enabled environment with `task_management.provider = "file"`.
- Malformed file is a deterministic contract error, not a soft fallback.
- `agents.{name}.disabled=true` means the agent must not be probed or launched.
- Codex skill-root health must follow `shared/references/agent_skill_roots_contract.md`.
- Codex execution-default health should capture top-level `approval_policy`, top-level `sandbox_mode`, and whether the managed default is ready.
- Readers should use `shared/scripts/coordinator-runtime/lib/environment-state.mjs`.
- On tool error (401/403/429/500/timeout): update provider → fallback, disable tool for rest of session.

## Required Shape

- `scanned_at`
- `agents.claude.available`
- `agents.codex.available`

## Sections

| Section | Purpose |
|---------|---------|
| `agents` | Agent availability, versions, alignment status (claude, codex), plus marketplace plugin, Codex skill-root discovery, and execution-default health |
| `task_management` | Provider routing (linear/file/github), provider-specific config nested under `linear` or `github` |
| `research` | Provider, fallback_chain |
| `claude_md` | Instruction file metadata |
| `assessment` | Quality score, warnings, worker run/skip history |
| `hooks` | Hook mode (blocking/advisory), `disable_skill_shell_execution` (bool, mirrors `disableSkillShellExecution` setting from Claude Code 2.1.91), `script_caps` (number, mirrors `CLAUDE_CODE_SCRIPT_CAPS` env from Claude Code 2.1.98) |
| `ide_extension` | Per-IDE Claude Code extension state (Cursor / VSCode): `initial_permission_mode`, `allow_dangerously_skip_permissions`, `effective_state`, and whether it conflicts with project `permissions.defaultMode`. The extension overrides project settings at session start, so this is the runtime SSOT for "what permission mode actually applies when Claude is launched from the IDE". |

## task_management structure

Provider-specific fields are nested under their provider key:

```json
{
  "provider": "linear",
  "status": "active",
  "fallback": "file",
  "linear": { "team_id": "..." },
  "github": { "repository": "owner/repo", "project_number": 1 }
}
```

Only the active provider's sub-object needs to be populated.

## Codex Skill-Root Health

When present, `agents.codex` should capture:
- `active_skill_roots` -> active Codex discovery surfaces under `~/.codex/skills`
- `cache_roots` -> non-discoverable Codex cache roots
- `duplicate_skill_names` -> duplicate skill directory names still visible under the Codex discovery root
- `discovery_violation` -> `true` when cache or foreign install surfaces remain visible under `~/.codex/skills`

Writers should treat `discovery_violation=true` as environment drift that requires ln-013 remediation before Codex is considered cleanly aligned.

## Codex Execution Defaults

When present, `agents.codex` should capture:
- `approval_policy` -> top-level Codex CLI approval mode from `~/.codex/config.toml`
- `sandbox_mode` -> top-level Codex CLI sandbox mode from `~/.codex/config.toml`
- `permissions_default_ready` -> `true` when the managed defaults are aligned for this environment setup flow

For this setup flow, `permissions_default_ready=true` means:
- `approval_policy = "never"`
- `sandbox_mode = "danger-full-access"`

## Phase 0 Pattern (for consumer skills)

```
1. Read .hex-skills/environment_state.json
2. IF file missing → run ln-010 or use defaults (task_provider="file", all agents enabled)
3. Extract: task_provider = task_management.provider (default: "file")
4. Use task_provider to select operations (per storage_mode_detection.md)
```

**Version:** 3.1.0
**Last Updated:** 2026-04-07

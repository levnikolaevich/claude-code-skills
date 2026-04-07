# Environment State Contract

Shared project-scoped contract for `.hex-skills/environment_state.json`.

Use this contract when a skill:
- checks disabled agents
- decides whether Codex or Gemini should be probed
- needs environment setup health or sync metadata
- routes operations by task provider (linear/file/github)
- selects research tool or fallback chain

## Location

```text
{project_root}/.hex-skills/environment_state.json
```

Environment state is project-scoped. Skills must never read or write environment state outside the current project root.

Schema SSOT:
- `shared/references/environment_state_schema.json`

## Rules

- Missing file means default-enabled environment with `task_management.provider = "file"`.
- Malformed file is a deterministic contract error, not a soft fallback.
- `agents.{name}.disabled=true` means the agent must not be probed or launched.
- Readers should use `shared/scripts/coordinator-runtime/lib/environment-state.mjs`.
- On tool error (401/403/429/500/timeout): update provider → fallback, disable tool for rest of session.

## Required Shape

- `scanned_at`
- `agents.codex.available`
- `agents.gemini.available`

## Sections

| Section | Purpose |
|---------|---------|
| `agents` | Agent availability, versions, sync status (codex, gemini, claude) |
| `task_management` | Provider routing (linear/file/github), provider-specific config nested under `linear` or `github` |
| `research` | Provider, fallback_chain |
| `claude_md` | Instruction file metadata |
| `assessment` | Quality score, warnings, worker run/skip history |
| `hooks` | Hook mode (blocking/advisory) |
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

## Phase 0 Pattern (for consumer skills)

```
1. Read .hex-skills/environment_state.json
2. IF file missing → run ln-010 or use defaults (task_provider="file", all agents enabled)
3. Extract: task_provider = task_management.provider (default: "file")
4. Use task_provider to select operations (per storage_mode_detection.md)
```

**Version:** 3.1.0
**Last Updated:** 2026-04-07

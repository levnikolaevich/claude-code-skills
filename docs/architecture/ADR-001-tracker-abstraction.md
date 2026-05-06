# ADR-001: Tracker Provider Abstraction

> **SCOPE:** Architectural rationale for treating Linear, GitHub Issues, and File Mode as equal first-class task tracker providers across all skills. Concrete contracts and pseudocode live in `shared/references/tracker_provider_contract.md`, `shared/references/storage_mode_detection.md`, and `shared/references/provider_*.md`.

**Status:** Accepted
**Date:** 2026-05-06
**Deciders:** Skills Catalog maintainers

## Context

The skills catalog supports three task tracker providers:

| Provider | Transport | Source of truth |
|----------|-----------|-----------------|
| Linear | MCP server (`mcp__linear-server__*` Claude / `mcp__linear__*` Codex) | Linear API |
| GitHub Issues | `gh` CLI + REST + Projects v2 GraphQL | GitHub Issues + Projects v2 |
| File Mode | Local `Read`/`Write`/`Edit`/`Glob` | Markdown files + `kanban_board.md` |

Earlier revisions of the catalog presented these unevenly:

- `ln-010` ran a silent capability detection chain (`Linear → GitHub → file`) — Linear was auto-selected whenever its MCP was connected, with no user prompt.
- Worker `SKILL.md` files used Linear-specific verbs (`get_issue`, `save_issue`, `create_comment`) and inline tables that compared only `Linear Mode | File Mode`, omitting GitHub.
- `provider_*.md` references had inconsistent depth (Linear 80L, GitHub 247L, File 119L), reinforcing the perception that GitHub was a non-standard path.
- The `ln-` prefix is a sequence number (`ln-010`, `ln-200`, …), not a Linear marker — but newcomers read it as such.

These signals biased operators toward Linear and made GitHub feel second-class even when it was the better fit for a project.

## Decision

**All three providers are first-class.** The catalog enforces this through the following invariants:

1. **User-driven selection, persisted once.** Provider selection happens in `ln-010 → Phase 1b: Tracker Provider Selection` via the runtime `pause` + `pending_decision` flow (Codex non-interactive cannot prompt mid-run). The chosen value is written to `.hex-skills/environment_state.json` → `task_management.provider` and reused by every downstream skill. No skill performs its own detection.

2. **Skills MUST NOT name a provider in workflow prose.** Worker `SKILL.md` files reference operations semantically (`createStory`, `getStory`, `updateStatus`, `addComment`) and load `shared/references/storage_mode_detection.md` + `shared/references/tracker_provider_contract.md` to route execution. Provider names appear only inside `provider_*.md`, `tracker_provider_contract.md`, and explicit tool-mapping sections.

3. **The `ln-` prefix is a sequence number, not Linear.** Skill IDs are alphabetized (`ln-NNN`) and provider-agnostic. There are no `gh-NNN` or `file-NNN` duplicates.

4. **Symmetric documentation.** All `provider_*.md` files share the same section skeleton (Scope, Prerequisites, Init, Epic ops, Story ops, Task ops, Status mapping, Comments, ID & numbering, Error handling & fallback, Batch/performance, Gotchas). Init sections may legitimately differ (file = zero side effects, Linear = config read, GitHub = mutating preflight) but the headings stay aligned.

5. **Capability matrix is honest about asymmetry.** `tracker_provider_contract.md` records, per operation, which transports are required, which cases are unsupported, and the remediation steps. Linear MCP namespace differences (`mcp__linear-server__*` Claude vs `mcp__linear__*` Codex) are documented as a tool-name mapping, not hidden inside skill prose.

6. **Fallback preserves data.** When Linear or GitHub fail, the skill switches `task_management.provider` to `"file"` with `task_management.status="active"` and writes `task_management.fallback_metadata` (`previous_provider`, `error_class`, `partial_items`, `fallback_at`). The kanban keeps both the partial remote items and the new file-created items.

## Consequences

**For new task-related skills:**
- MUST `MANDATORY READ` `storage_mode_detection.md` before any task operation.
- MUST express operations through the semantic interface in `tracker_provider_contract.md`. Provider-specific calls live in `provider_*.md`.
- MUST NOT hardcode `Linear`, `GitHub`, or `File` in workflow prose, definition-of-done checkboxes, or step labels.

**For adding a fourth provider:**
1. Create `shared/references/provider_{name}.md` using the canonical skeleton.
2. Add the provider to the capability matrix in `tracker_provider_contract.md`.
3. Add provider-specific status mapping to `provider_{name}.md` or another shared reference that is distributed to every skill that needs it.
4. Extend the `task_management.provider` enum in `shared/references/environment_state_schema.json`.
5. Add availability detection to `ln-010` Phase 1a so Phase 1b can offer it as a `pending_decision` choice.
6. Add or update `tools/marketplace/shared-registry.json` targets so each consuming skill receives the provider contract under its own `references/` directory.
7. Run `node tools/marketplace/shared.mjs sync` to propagate the snapshot to all skill-local runtime copies.
8. Provide executable helpers only as skill-local `references/scripts/...` files, generated from root `shared/scripts/...` when reused by 2+ skills. MCP-based transports are NOT importable from Node child processes — they remain skill-side via harness tools.

**For operators:**
- Provider choice is explicit at first run and revisitable on subsequent `ln-010` invocations.
- A failure in Linear/GitHub does not block work: the runtime falls back to file mode while preserving traceability of partial remote items.

**For documentation:**
- README, AGENTS.md, and FAQ list all three providers in the same sentence and the same order (Linear, GitHub Issues, File Mode).
- No README badge or doc claims a provider is "auto-detected" or "default" — selection is always user-driven.

## References

- `shared/references/tracker_provider_contract.md` — capability matrix, semantic operations, error contract, tool-name mapping
- `shared/references/storage_mode_detection.md` — routing table (provider → `provider_*.md`)
- `shared/references/provider_linear.md`, `provider_github.md`, `provider_file.md` — provider pseudocode
- `shared/references/environment_state_schema.json` — `task_management.provider` enum, `fallback_metadata` shape
- `plugins/setup-environment/skills/ln-010-dev-environment-setup/SKILL.md` — Phase 1b implementation
- `plugins/setup-environment/skills/ln-010-dev-environment-setup/references/scripts/environment-setup-runtime/` — skill-local Phase 1b runtime enforcement
- `tools/marketplace/shared-registry.json` — shared-to-skill distribution map for provider contracts and reused helper scripts

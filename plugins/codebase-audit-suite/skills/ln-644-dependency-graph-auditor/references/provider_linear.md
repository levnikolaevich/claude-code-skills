# Linear Provider Operations

<!-- SCOPE: Full operation pseudocode for Linear Mode. Loaded only when environment_state.json task_management.provider=linear. -->

## Scope

Provider-specific transport for tracker semantic operations defined in `tracker_provider_contract.md`. This file documents only how to bind those operations to Linear MCP tools.

## Prerequisites

- Linear MCP server connected and authenticated
- `task_management.linear.team_id` populated in `.hex-skills/environment_state.json`

## Init

Read-only side effects. On first call per session:

1. Resolve `team_id` from environment state (preferred) or `kanban_board.md` Provider Configuration block.
2. Warm cache via `list_issue_statuses(team=team_id)` once to verify the 7 canonical statuses exist (`Backlog`, `Todo`, `In Progress`, `To Review`, `To Rework`, `Done`, `Canceled`).
3. Fail fast if the MCP namespace is unavailable; the runtime fallback will switch to file mode and write `task_management.fallback_metadata`.

## Epic Operations

| Operation | Command |
|-----------|---------|
| `listEpics` | `list_projects(team=teamId)` |
| `getEpic` | `get_project(query="Epic N")` |
| `createEpic` | `save_project({name: "Epic {N}: {Title}", description, team, state: "planned"})` |
| `updateEpic` | `save_project({id, description})` |

## Story Operations

| Operation | Command |
|-----------|---------|
| `listStoriesByEpic` | `list_issues(project=Epic.id, label="user-story")` |
| `getStory` | `get_issue(story_id)` |
| `createStory` | `save_issue({title: "US{NNN}: {Title}", description, project: epicId, team, labels: ["user-story"], state: "Backlog"})` |
| `updateStory` | `save_issue({id, description})` |
| `updateStatus` | `save_issue({id, state: "Todo"})` |
| `cancel` | `save_issue({id, state: "Canceled"})` |

## Task Operations

| Operation | Command |
|-----------|---------|
| `listTasksByStory` | `list_issues(parentId=Story.id)` |
| `getTask` | `get_issue(task_id)` |
| `createTask` | `save_issue({title: "T{NNN}: {Title}", description, parentId: storyId, team, labels, state: "Backlog"})` |
| `updateTask` | `save_issue({id, description})` |
| `updateStatus` | `save_issue({id, state: "In Progress"})` |
| `cancel` | `save_issue({id, state: "Canceled"})` |

## Status Mapping

See abstract → provider table in `storage_mode_detection.md`. Linear native states:

| Abstract | Linear State |
|----------|-------------|
| New | `Backlog` |
| Ready | `Todo` |
| Working | `In Progress` |
| Review | `To Review` |
| Rework | `To Rework` |
| Complete | `Done` |
| Removed | `Canceled` |

## Comment Operations

| Operation | Command |
|-----------|---------|
| `addComment` | `save_comment({issueId, body})` |
| `listComments` | `list_comments(issueId)` |

`create_comment` is a deprecated alias; new code MUST use `save_comment`.

## ID & Numbering

- Epic: Linear project UUID (returned by `save_project`); display name `Epic {N}: {Title}` carries the human sequence.
- Story: Linear issue identifier `PROJ-{NNN}` (short) and UUID. Body `US{NNN}` carries the catalog sequence.
- Task: Linear issue identifier `PROJ-{NNN}` (short) and UUID. Body `T{NNN}` carries the catalog sequence.

`list_issues(parentId=...)` requires the **UUID** form. Resolve via `get_issue(id="PROJ-123")` → `issue.id`.

## Tool Name Mapping

Linear MCP namespace differs between harnesses:

| Harness | Namespace |
|---------|-----------|
| Claude Code | `mcp__linear-server__*` (e.g. `mcp__linear-server__save_issue`) |
| Codex CLI | `mcp__linear__*` (e.g. `mcp__linear__save_issue`) |

Skills MUST call the namespace that matches the active harness; the contract operation name is harness-agnostic.

## Error Handling & Fallback

```
IF Linear API fails (401/403/429/500/timeout):
  1. WARN user once per session
  2. WRITE task_management.fallback_metadata = {
       previous_provider: "linear",
       error_class: "AUTH|RATE_LIMIT|TRANSPORT|...",
       partial_items: [...remote items already created this run],
       fallback_at: <ISO date>
     }
  3. SET task_management.provider = "file"; task_management.status = "active"
  4. EXECUTE via file-mode operations from this point forward
```

The kanban keeps both partial Linear items and new file-created items; do not drop remote URLs.

## Batch / Performance Notes

- Prefer `list_issues` with `label`/`project`/`state` filters over multiple `get_issue` calls.
- Sub-issue listing is paginated; respect Linear MCP page limits.
- Linear MCP rate limits: back off 30-60 s on 429, then retry once before falling back to file mode.

## Provider-Specific Gotchas

- **UUID vs short ID:** `list_issues(parentId=...)` and most relationship queries require UUIDs, not `PROJ-123` short IDs.
- **Status updates** are atomic: setting `state` and `description` in the same `save_issue` call is allowed.
- **Comment threading**: Linear flattens replies; if you need a thread, prefix the body with the parent comment ID.
- **Project field** is required for stories/tasks scoped to an Epic; passing only `parentId` without `project` works for nested tasks but not for top-level stories.

---
**Version:** 2.0.0
**Last Updated:** 2026-05-06

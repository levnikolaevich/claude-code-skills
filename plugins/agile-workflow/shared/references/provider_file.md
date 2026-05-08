<!-- SOURCE-OF-TRUTH: plugins/agile-workflow/shared/references/provider_file.md. Edit ONLY here; run `node tools/marketplace/shared.mjs sync` -->

# File Mode Provider Operations

<!-- SCOPE: Full operation pseudocode for File Mode. Loaded only when environment_state.json task_management.provider=file. -->

## Scope

Provider-specific transport for tracker semantic operations defined in `tracker_provider_contract.md`. Binds those operations to local Markdown files under `docs/tasks/epics/`.

## Prerequisites

- No external tools or auth required
- Project working tree writable under `docs/tasks/`

## Init

Read-only side effects unless `docs/tasks/epics/` is missing:

```
IF Provider=file AND docs/tasks/epics/ does not exist:
  mkdir -p docs/tasks/epics/
```

File mode also serves as the universal fallback for Linear and GitHub failures; the runtime preserves any partial remote items in `task_management.fallback_metadata.partial_items` so kanban references both sets.

## Epic Operations

| Operation | Command |
|-----------|---------|
| `listEpics` | `Glob("docs/tasks/epics/*/epic.md")` |
| `getEpic` | `Read("docs/tasks/epics/epic-{N}-{slug}/epic.md")` |
| `createEpic` | `mkdir -p docs/tasks/epics/epic-{N}-{slug}/stories/` + `Write epic.md` |
| `updateEpic` | `Edit epic.md` |

## Story Operations

| Operation | Command |
|-----------|---------|
| `listStoriesByEpic` | `Glob("docs/tasks/epics/epic-{N}-*/stories/*/story.md")` |
| `getStory` | `Read("docs/tasks/epics/.../stories/us{NNN}-{slug}/story.md")` |
| `createStory` | `mkdir -p .../stories/us{NNN}-{slug}/tasks/` + `Write story.md` |
| `updateStory` | `Edit story.md` |
| `updateStatus` | `Edit` the `**Status:**` line |
| `cancel` | `Edit` status to `**Status:** Canceled` |

## Task Operations

| Operation | Command |
|-----------|---------|
| `listTasksByStory` | `Glob("docs/tasks/epics/*/stories/{slug}/tasks/*.md")` |
| `getTask` | `Read("docs/tasks/epics/.../tasks/T{NNN}-*.md")` |
| `createTask` | `Write("docs/tasks/.../T{NNN}-{slug}.md")` |
| `updateTask` | `Edit` task file content |
| `updateStatus` | `Edit` the `**Status:**` line |
| `cancel` | `Edit` status to `**Status:** Canceled` |

## Status Mapping

| Abstract | File Mode |
|----------|-----------|
| New | `**Status:** Backlog` |
| Ready | `**Status:** Todo` |
| Working | `**Status:** In Progress` |
| Review | `**Status:** To Review` |
| Rework | `**Status:** To Rework` |
| Complete | `**Status:** Done` |
| Removed | `**Status:** Canceled` |

## Comment Operations

| Operation | Command |
|-----------|---------|
| `addComment` | `Write(".../comments/{ISO-timestamp}.md")` with body |
| `listComments` | `Glob(".../comments/*.md")` sorted by filename |

## ID & Numbering

### Directory Structure

```
docs/tasks/epics/
|-- epic-1-infrastructure/
|   |-- epic.md
|   `-- stories/
|       `-- us001-setup-cicd/
|           |-- story.md
|           |-- comments/
|           |   `-- 2026-03-04T10-30-00.md
|           `-- tasks/
|               |-- T001-create-dockerfile.md
|               `-- T002-setup-github-actions.md
`-- epic-2-user-management/
    |-- epic.md
    `-- stories/
        `-- us004-user-registration/
            |-- story.md
            `-- tasks/
                `-- T001-create-users-table.md
```

### ID Resolution

```
"Epic {N}" -> Glob("docs/tasks/epics/epic-{N}-*/epic.md")
"US{NNN}"  -> Glob("docs/tasks/epics/*/stories/us{NNN}-*/story.md")
"T{NNN}"   -> within Story context: tasks/T{NNN}-*.md
```

### Numbering

```
Next Epic Number:  kanban_board.md -> "Next Epic Number"
Next Story Number: kanban_board.md -> "Next Story" in Epic Story Counters
Next Task Number:  count existing T*.md files in Story's tasks/ folder + 1
```

### Document Headers

```
Epic:  **Status:** Backlog + **Created:** {date}
Story: **Status:** Backlog + **Epic:** Epic {N} + **Labels:** user-story + **Created:** {date}
Task:  **Status:** Backlog + **Story:** US{NNN} + **Labels:** {type} + **Created:** {date}
```

## Error Handling & Fallback

File mode is the universal fallback — it has no external dependencies. When the runtime falls back into file mode from Linear or GitHub, it writes `task_management.fallback_metadata` with the previous provider, error class, partial remote items, and timestamp.

If file operations themselves fail (disk full, read-only filesystem, permission denied), report the OS error directly to the user; there is no further fallback.

## Batch / Performance Notes

- Glob is the primary listing primitive; cache results within a single skill invocation when iterating over a large epic.
- Avoid re-reading a story or task file inside tight loops; pass parsed metadata around instead.
- Status edits are line-level: prefer surgical `Edit` over full file rewrites to keep diffs reviewable.
- File mode performance scales with project size; for >500 stories per epic, expect multi-second `Glob` latency.

## Provider-Specific Gotchas

- **Status line format is exact:** `**Status:** {value}` with two spaces around the colon — alternative formatting (`Status:`, `**status:**`, etc.) breaks status detection.
- **Slugs are part of the path:** `epic-{N}-{slug}` and `us{NNN}-{slug}`. Renaming the slug requires moving the directory; prefer to leave the slug stable.
- **Comments are append-only:** filenames carry ISO timestamps. Never overwrite an existing comment file; create a new one.
- **Concurrent edits:** file mode has no locking. Skills must serialize writes within a single run; cross-run concurrency is the operator's responsibility.
- **`kanban_board.md` is the SSOT for global counters.** Updating epic/story task counts elsewhere creates drift; always read counters from kanban first.

---
**Version:** 2.0.0
**Last Updated:** 2026-05-06

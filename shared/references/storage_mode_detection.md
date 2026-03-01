# Storage Mode Detection

Standard algorithm for detecting Linear Mode vs File Mode in task management skills.

## Detection Algorithm

```
IF exists("docs/tasks/epics/"):
  mode = "File Mode"
ELSE:
  mode = "Linear Mode" (default)
```

## Mode Comparison

| Aspect | Linear Mode | File Mode |
|--------|-------------|-----------|
| **Detection** | Default (MCP Linear available) | `docs/tasks/epics/` directory exists |
| **Source of truth** | Linear API | Markdown files + kanban_board.md |
| **Task ID format** | Linear issue ID (PROJ-123) | File-based (T001, T002) |
| **Status storage** | Linear `state` field | `**Status:** Backlog` in file |

## Operations by Mode

| Operation | Linear Mode | File Mode |
|-----------|-------------|-----------|
| **Check existing** | `list_issues(parentId=Story.id)` | `Glob("docs/tasks/epics/*/stories/{slug}/tasks/*.md")` |
| **Load task** | `get_issue(task_id)` | `Read("docs/tasks/epics/.../tasks/T{NNN}-*.md")` |
| **Create task** | `create_issue(parentId, state: "Backlog")` | `Write("docs/tasks/.../T{NNN}-{slug}.md")` |
| **Update task** | `update_issue(id, description)` | `Edit` task file content |
| **Cancel task** | `update_issue(id, state: "Canceled")` | `Edit` status to Canceled |

## File Mode Structure

```
docs/tasks/epics/
├── epic-1-infrastructure/
│   └── stories/
│       └── us001-setup-cicd/
│           └── tasks/
│               ├── T001-create-dockerfile.md
│               └── T002-setup-github-actions.md
└── epic-2-user-management/
    └── stories/
        └── us004-user-registration/
            └── tasks/
                ├── T001-create-users-table.md
                └── T002-implement-user-service.md
```

## File Mode Task Creation

```
1. Determine next task number: count existing T*.md files + 1
2. Generate filename: T{NNN}-{slug}.md (e.g., T003-implement-auth-service.md)
3. Write task file using template
4. Add link to kanban_board.md under Story in Backlog section
```

## Status Values

| Status | Linear State | File Mode |
|--------|--------------|-----------|
| New | `Backlog` | `**Status:** Backlog` |
| Ready | `Todo` | `**Status:** Todo` |
| Working | `In Progress` | `**Status:** In Progress` |
| Review | `To Review` | `**Status:** To Review` |
| Rework | `To Rework` | `**Status:** To Rework` |
| Complete | `Done` | `**Status:** Done` |
| Removed | `Canceled` | `**Status:** Canceled` |

## Skills Using This Pattern

| Skill | Uses For |
|-------|----------|
| ln-401-task-executor | Load task, update status |
| ln-402-task-reviewer | Load task for review |
| ln-404-test-executor | Load test task, update status |

## Usage

```markdown
## Reference Files
- **Storage mode detection:** `shared/references/storage_mode_detection.md`
```

---
**Version:** 1.0.0
**Last Updated:** 2026-02-05

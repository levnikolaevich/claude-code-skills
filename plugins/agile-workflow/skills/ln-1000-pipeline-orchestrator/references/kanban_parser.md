# Kanban Board Parsing Rules

Rules for extracting Stories from `docs/tasks/kanban_board.md` status sections.

## Section Detection

Kanban sections are H3 headers. Parse in this order (priority high to low):

| Section Header | Priority | Stage Mapping |
|---------------|----------|--------------|
| `### To Review` | 1 (highest) | Stage 3 (ln-500) |
| `### To Rework` | 2 | Stage 2 re-entry (ln-400) |
| `### In Progress` | 3 | Stage 2 continue (ln-400) |
| `### Todo` | 4 | Stage 2 (ln-400) |
| `### Backlog` (tasks exist) | 5 | Stage 1 (ln-310) |
| `### Backlog` (no tasks) | 6 (lowest) | Stage 0 (ln-300) |

**Skip sections:** `### Done`, `### Postponed`, `### Canceled`

## Story Extraction Pattern

Stories appear under Epic headers with 2-space indent and book emoji:

```
### {Status}

**Epic {N}: {Epic Title}**
  - [book] [{StoryId}: {StoryTitle}](url) [markers]
    - [gear] [{TaskId}: {TaskTitle}](url)
    _(tasks not created yet)_
```

**Regex for Story line (mode-aware):**

| Mode | Regex | Example ID |
|------|-------|-----------|
| **Linear** | `^\s{2}-\s+.*\[([A-Z]+-\d+):\s+(.+?)\]\((.+?)\)(.*)$` | `PROJ-42` (with dash) |
| **File** | `^\s{2}-\s+.*\[([A-Z]+\d+):\s+(.+?)\]\((.+?)\)(.*)$` | `US001` (no dash) |

Select regex based on `storage_mode` from `.hex-skills/environment_state.json` (detected in Phase 0).

Captures: StoryId (group 1), Title (group 2), URL (group 3), Markers (group 4)

## Filtering Rules

| Condition | Action |
|-----------|--------|
| Story has `_(tasks not created yet)_` below it | INCLUDE — Stage 0 (create tasks via ln-300) |
| Story in Backlog with task lines below it | INCLUDE — Stage 1 (validate via ln-310) |
| Story in Done/Postponed/Canceled | SKIP |
| Story marked `APPROVED` in Todo | INCLUDE — Stage 2 |

## Task Presence Detection

After extracting a Story line, check subsequent lines (before next Story or Epic header):
- **Has tasks:** Lines matching `^\s{4}-\s+` (4-space indent = task line) → `hasTasks: true`
- **No tasks:** Line matching `_(tasks not created yet)_` → `hasTasks: false`
- **Empty (no lines):** → `hasTasks: false`

## Epic Context Extraction

For each Story, capture its parent Epic:

```
**Epic {N}: {Title}**
```

The Epic header appears at 0-indent above the Story. Multiple Stories can share one Epic.

## Output Format

After parsing, build available stories list as array of objects:

```
[
  { id: "PROJ-42", title: "User Auth", status: "To Review", hasTasks: true, epic: "Epic 1: User Management", stage: 3, url: "..." },
  { id: "PROJ-38", title: "Payment Flow", status: "To Rework", hasTasks: true, epic: "Epic 2: Payments", stage: 2, url: "..." },
  { id: "PROJ-45", title: "Dashboard", status: "Todo", hasTasks: true, epic: "Epic 3: UI", stage: 2, url: "..." },
  { id: "PROJ-50", title: "Email Service", status: "Backlog", hasTasks: true, epic: "Epic 4: Notifications", stage: 1, url: "..." },
  { id: "PROJ-55", title: "Push Notifications", status: "Backlog", hasTasks: false, epic: "Epic 4: Notifications", stage: 0, url: "..." }
]
```

This list is presented to the user for story selection (see SKILL.md Phase 1 step 8).

## Linear Mode Alternative

In Linear mode, instead of parsing markdown, use Linear API:

```
list_issues(teamId: "{teamUUID}", filter: { state: { name: { in: ["To Review", "To Rework", "In Progress", "Todo", "Backlog"] } } })
```

Then apply same priority ordering and stage mapping.

---
**Version:** 1.0.0
**Last Updated:** 2026-02-13

# Storage Mode Operations

<!-- SCOPE: Compact routing table for all providers. Provider selection comes from .hex-skills/environment_state.json → task_management.provider (NOT detected here). This file defines WHAT to call at summary level. For full pseudocode, load the provider-specific file. -->

## Mode Selection

Read `.hex-skills/environment_state.json` → `task_management.provider`:
- `linear` → load `references/provider_linear.md`
- `file` → load `references/provider_file.md`
- `github` → load `references/provider_github.md`

If environment_state.json missing → run `ln-010` or default to `file` mode.

**Progressive disclosure:** After determining the provider, load ONLY the matching `provider_{value}.md` for full operation pseudocode.

## Mode Comparison

| Aspect | Linear | File | GitHub |
|--------|--------|------|--------|
| **Source of truth** | Linear API | Markdown files + kanban_board.md | GitHub Issues + Projects v2 |
| **ID format** | PROJ-123 / UUID | Epic N, US001, T001 | Issue #{N} |
| **Hierarchy** | Projects → Issues → Sub-issues | Directories → Files | Issues → Sub-issues (REST API) |
| **Status storage** | Linear `state` field | `**Status:** {value}` in file | Projects v2 Status field |
| **Comments** | Linear comments API | `comments/{timestamp}.md` files | Issue comments API |
| **External deps** | Linear MCP server | None | `gh` CLI + auth |

## Operation Summary

| Operation | Linear | File | GitHub |
|-----------|--------|------|--------|
| **List Epics** | `list_projects()` | `Glob("epics/*/epic.md")` | `gh issue list --label epic` |
| **Create Epic** | `save_project()` | `mkdir + Write epic.md` | `gh issue create --label epic` |
| **List Stories** | `list_issues(project=...)` | `Glob("stories/*/story.md")` | `gh api .../sub_issues` |
| **Create Story** | `save_issue(labels=["user-story"])` | `mkdir + Write story.md` | `gh issue create` + sub-issue API |
| **List Tasks** | `list_issues(parentId=...)` | `Glob("tasks/*.md")` | `gh api .../sub_issues` |
| **Create Task** | `save_issue(parentId=...)` | `Write T{NNN}.md` | `gh issue create` + sub-issue API |
| **Update Status** | `save_issue(state=...)` | `Edit **Status:**` line | `gh project item-edit` |
| **Add Comment** | `create_comment()` | `Write comments/{ts}.md` | `gh issue comment` |
| **Cancel** | `save_issue(state: "Canceled")` | `Edit **Status:** Canceled` | `gh issue close` + set Canceled |

## Status Values

| Abstract | Linear | File Mode | GitHub Projects v2 |
|----------|--------|-----------|-------------------|
| New | `Backlog` | `**Status:** Backlog` | `Backlog` |
| Ready | `Todo` | `**Status:** Todo` | `Todo` |
| Working | `In Progress` | `**Status:** In Progress` | `In Progress` |
| Review | `To Review` | `**Status:** To Review` | `To Review` |
| Rework | `To Rework` | `**Status:** To Rework` | `To Rework` |
| Complete | `Done` | `**Status:** Done` | `Done` (+ close issue) |
| Removed | `Canceled` | `**Status:** Canceled` | `Canceled` (+ close issue) |

## Fallback Chain

All providers fall back to File Mode on error:
```
Primary provider (linear/github) fails → update environment_state.json → switch to file mode
File mode is always available (no external dependencies)
```

## Usage in SKILL.md

```markdown
**MANDATORY READ:** Load `references/storage_mode_detection.md`
```

After loading, the skill reads `.hex-skills/environment_state.json`, determines the provider, and loads only `provider_{value}.md` for full operation details.

---
**Version:** 4.0.0
**Last Updated:** 2026-04-05

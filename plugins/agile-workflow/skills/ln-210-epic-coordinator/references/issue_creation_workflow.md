# Issue Creation Workflow

<!-- SCOPE: Standard workflow for creating Epics, Stories, and Tasks with kanban updates. Supports Linear, File, and GitHub modes per .hex-skills/environment_state.json → task_management.provider. -->

## Pre-requisite

Read `.hex-skills/environment_state.json` → `task_management.provider`. All operations below branch on provider value.

## Epic Creation

```
IF provider == "linear":
  save_project({
    name: "Epic {N}: {Title}",
    description: epicDocument,
    team: teamId,
    state: "planned"
  })
  → Capture returned project ID/URL

ELSE IF provider == "github":
  gh issue create -R {REPO} \
    --title "Epic {N}: {Title}" \
    --body "{epicDocument}" \
    --label "epic"
  → Capture returned issue number/URL
  → Add to project: gh project item-add {PROJECT_NUM} --owner {OWNER} --url {URL}
  → Set status to Backlog (see provider_github.md "Add to Project" helper)

ELSE (file):
  dir = "docs/tasks/epics/epic-{N}-{slug}/"
  mkdir -p {dir}/stories
  Write("{dir}/epic.md", epicDocument)
  → epicDocument includes: **Status:** Backlog, **Created:** {date}
```

## Story Creation

```
IF provider == "linear":
  save_issue({
    title: "US{NNN}: {Title}",
    description: storyDocument,
    project: epicId,
    team: teamId,
    labels: ["user-story"],
    state: "Backlog"
  })
  → Capture returned issue ID/URL

ELSE IF provider == "github":
  1. Create issue:
     gh issue create -R {REPO} \
       --title "US{NNN}: {Title}" \
       --body "{storyDocument}" \
       --label "user-story"
     → Capture returned issue number
  2. Link as sub-issue of Epic:
     SUB_ID=$(gh api /repos/{O}/{R}/issues/{story_num} --jq '.id')
     gh api /repos/{O}/{R}/issues/{epic_num}/sub_issues \
       -X POST -F sub_issue_id="$SUB_ID"
  3. Add to project + set status Backlog

ELSE (file):
  dir = "docs/tasks/epics/epic-{epicN}-{epicSlug}/stories/us{NNN}-{slug}/"
  mkdir -p {dir}/tasks
  Write("{dir}/story.md", storyDocument)
  → storyDocument includes: **Status:** Backlog, **Epic:** Epic {N}, **Labels:** user-story
```

## Task Creation

```
IF provider == "linear":
  save_issue({
    title: "T{NNN}: {Title}",
    description: taskDocument,
    parentId: storyId,
    team: teamId,
    labels: ["implementation"|"tests"|"refactoring"],
    state: "Backlog"
  })

ELSE IF provider == "github":
  1. Create issue:
     gh issue create -R {REPO} \
       --title "T{NNN}: {Title}" \
       --body "{taskDocument}" \
       --label "task" --label "{type}"
     → Capture returned issue number
  2. Link as sub-issue of Story:
     SUB_ID=$(gh api /repos/{O}/{R}/issues/{task_num} --jq '.id')
     gh api /repos/{O}/{R}/issues/{story_num}/sub_issues \
       -X POST -F sub_issue_id="$SUB_ID"
  3. Add to project + set status Backlog

ELSE (file):
  Write("docs/tasks/.../tasks/T{NNN}-{slug}.md", taskDocument)
  → taskDocument includes: **Status:** Backlog, **Story:** US{NNN}, **Labels:** {type}
```

## Critical Rules

| Rule | Why |
|------|-----|
| **Always set initial status** | Linear: `state: "Backlog"`. File: `**Status:** Backlog`. GitHub: Projects v2 status Backlog |
| **Sequential creation** | Create one, verify success, then next (no bulk) |
| **Capture references** | Linear: store URL. File: store file path. GitHub: store issue number/URL |
| **Update kanban after each** | Keep docs/tasks/kanban_board.md in sync |
| **Runtime error → fallback** | If Linear/GitHub fails mid-creation, switch to file mode (per environment_state_contract.md) |

## Kanban Update Trigger

After each successful creation:
```
1. Update Next Number counter in kanban_board.md
2. Add item to appropriate section (Linear URL, file path, or GitHub URL as link)
3. Use correct indentation (see kanban_update_algorithm.md)
```

## Title Formats

| Type | Format | Example |
|------|--------|---------|
| Epic | `Epic {N}: {Domain}` | `Epic 7: OAuth Authentication` |
| Story | `US{NNN}: {Capability}` | `US004: Register OAuth client` |
| Task | `T{NNN}: {Goal}` | `T001: Create OAuth schema` |

## Labels Reference

| Label | Used For |
|-------|----------|
| `epic` | Epics (GitHub only — top-level grouping) |
| `user-story` | Stories (required for queries) |
| `task` | Tasks (GitHub only — distinguishes from stories) |
| `implementation` | Implementation tasks |
| `tests` | Test tasks |
| `refactoring` | Refactoring tasks |
| `bug` | Bug fix tasks |

## Error Handling

```
IF creation fails:
  1. Log error with item details
  2. IF Linear/GitHub error → update environment_state.json, switch to file mode
  3. Retry failed item in file mode
  4. Continue with remaining items in file mode
  5. Report partial completion: "{N} in {provider}, {M} in files"
```

---
**Version:** 4.0.0
**Last Updated:** 2026-04-05

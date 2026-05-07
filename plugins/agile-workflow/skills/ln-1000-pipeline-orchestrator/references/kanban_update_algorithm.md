<!-- SOURCE-OF-TRUTH: shared/references/kanban_update_algorithm.md. Edit ONLY here; run `node tools/marketplace/shared.mjs sync` -->

# Kanban Board Update Algorithm

Standard algorithm for updating `docs/tasks/kanban_board.md` with Epic/Story/Task links.

## Epic Grouping Algorithm

```
1. Locate section: ### {Status} (e.g., ### Backlog)

2. Search for existing Epic header:
   Pattern: **Epic {N}: {Title}**
   - Found → Reuse (no duplicate headers)
   - NOT found → Create new Epic group

3. Add item under Epic:
   - Story: 2-space indent + 📖 emoji
   - Task: 4-space indent + ⚙️ emoji
```

## Indentation Rules

| Level | Indent | Emoji | Format |
|-------|--------|-------|--------|
| Epic | 0 | — | `**Epic N: Title**` |
| Story | 2 spaces | 📖 | `  - 📖 [ID: USXXX Title](url)` |
| Task | 4 spaces | ⚙️ | `    - ⚙️ [ID: T-XXX Title](url)` |

## Link Format

### Linear Mode
```markdown
## Backlog

**Epic 7: OAuth Authentication**
  - 📖 [ID: US001 Token Generation](https://linear.app/team/US001)
    - ⚙️ [ID: T-001 Create DB schema](https://linear.app/team/T-001)
    - ⚙️ [ID: T-002 Implement service](https://linear.app/team/T-002)
  - 📖 [ID: US002 Token Validation](https://linear.app/team/US002)
    _(tasks not created yet)_
```

### GitHub Mode
```markdown
## Backlog

**Epic 7: OAuth Authentication**
  - 📖 [ID: US001 Token Generation](https://github.com/owner/repo/issues/42)
    - ⚙️ [ID: T-001 Create DB schema](https://github.com/owner/repo/issues/43)
    - ⚙️ [ID: T-002 Implement service](https://github.com/owner/repo/issues/44)
  - 📖 [ID: US002 Token Validation](https://github.com/owner/repo/issues/45)
    _(tasks not created yet)_
```

### File Mode
```markdown
## Backlog

**Epic 7: OAuth Authentication**
  - 📖 [ID: US001 Token Generation](docs/tasks/epics/epic-7-oauth/stories/us001-token-gen/story.md)
    - ⚙️ [ID: T-001 Create DB schema](docs/tasks/epics/epic-7-oauth/stories/us001-token-gen/tasks/T001-db-schema.md)
```

## Counter Update Algorithm

```
1. Locate: "## Epic Story Counters" table
2. Find row for Epic N
3. Update columns:
   - Last Story: USXXX
   - Next Story: USYYY (Last + 1)
   - Last Task: T-XXX (if tasks created)
   - Next Task: T-YYY (Last + 1)
```

## Reuse Detection

**Important:** Always check for existing Epic before creating new.

| Scenario | Action |
|----------|--------|
| `**Epic 7: OAuth**` exists | Reuse, add Story under it |
| `**epic 7: OAuth**` (lowercase) | Match by number (case-insensitive) |
| `**Epic 7 - OAuth**` (dash) | Re-match by Epic number only |
| Epic 7 not found | Create new `**Epic 7: Title**` |

## Status Sections

| Section | Contents |
|---------|----------|
| `### Backlog` | New Stories/Tasks (default) |
| `### Todo` | Ready for work |
| `### In Progress` | Currently being worked on |
| `### To Review` | Awaiting review |
| `### Done` | Completed items |

## Usage

```markdown
## Kanban Update

Follows `references/kanban_update_algorithm.md`:
- Epic grouping with reuse detection
- Proper indentation (0/2/4)
- Counter updates
```

---
**Version:** 2.0.0
**Last Updated:** 2026-04-05

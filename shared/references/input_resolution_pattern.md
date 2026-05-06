# Input Resolution Pattern

Standard workflow for resolving Story/Task/Epic identifiers when a skill is invoked standalone (without orchestrator args).

## Core Principle

> Every skill works both in pipeline (args from orchestrator) and standalone (auto-detect from context). Args always take priority.

---

## Story Resolution Chain

```
1. CHECK args → if storyId provided (first positional arg) → use it
2. CHECK git context → parse branch name, then commit messages, then changed files (see Git Context Detection)
3. CHECK kanban → read docs/tasks/kanban_board.md
   - Filter Stories by skill's Status Filter (defined in each skill's ## Inputs section)
   - If exactly 1 match → suggest to user for confirmation
   - If multiple → go to step 4
4. FALLBACK → AskUserQuestion:
   - Show matching Stories from kanban (status-filtered)
   - Format: "Which Story?" + options from kanban
```

## Task Resolution Chain

```
1. CHECK args → if taskId provided (first positional arg) → use it
2. CHECK git context → parse branch name, then commit messages, then changed files (see Git Context Detection)
3. CHECK parent Story → if Story already resolved (from context/git):
   - List tasks under that Story filtered by Status Filter
   - If exactly 1 match → suggest to user
4. CHECK kanban → scan all tasks in relevant status
   - If exactly 1 match → suggest to user
5. FALLBACK → AskUserQuestion:
   - Show matching Tasks from kanban (status-filtered)
   - Format: "Which Task?" + options grouped by Story
```

## Epic Resolution Chain

```
1. CHECK args → if epicId provided (first positional arg) → use it
2. CHECK git context → parse branch name, then commit messages, then changed files (see Git Context Detection)
3. CHECK kanban → read Epics Overview section
   - Filter by Active epics
   - If exactly 1 active Epic → suggest to user
   - If multiple → go to step 4
4. FALLBACK → AskUserQuestion:
   - Show Epics from kanban
   - Format: "Which Epic?" + options with status
```

---

## Git Context Detection

Three sub-steps, ordered by cost. **First match wins** → skip remaining sub-steps.

### 2a. Branch Name

Parse current branch name for ID patterns.

**Command:** `git branch --show-current`

| Pattern | Extracts | Example |
|---------|----------|---------|
| `feature/{TEAM_KEY}-{N}-*` | Linear issue ID → resolve to Story | `feature/PROJ-42-auth-flow` → `PROJ-42` |
| `feature/US{NNN}-*` | Story ID (file mode) | `feature/US001-user-login` → `US001` |
| `feature/T{NNN}-*` | Task ID (file mode) | `feature/T003-db-schema` → `T003` |
| `feature/epic-{N}-*` | Epic ID | `feature/epic-3-payments` → Epic 3 |
| `*` | No match → continue to 2b | `main`, `develop` |

### 2b. Commit Messages

Parse recent commit messages for ID patterns.

**Command:** `git log --oneline -5`

| Pattern | Extracts | Example |
|---------|----------|---------|
| `{TEAM_KEY}-{N}` | Linear issue ID | `fix: PROJ-42 add validation` → `PROJ-42` |
| `US{NNN}` | Story ID (file mode) | `US001: implement login` → `US001` |
| `T{NNN}` | Task ID (file mode) | `T003 create schema` → `T003` |
| `Epic-{N}` | Epic ID | `Epic-3 payment setup` → Epic 3 |

Take the **most recent** match (first commit line with a hit). Same ID patterns as branch name parsing.

### 2c. Changed Files

Match uncommitted changes against task file paths in `docs/tasks/`.

**Commands:**
```
git diff --name-only          # unstaged changes
git diff --name-only --cached # staged changes
```

**Resolution logic:**
1. Collect all changed file paths
2. Read task documents in `docs/tasks/` that list implementation files
3. If a task document references one or more changed files → extract that Task ID and its parent Story ID
4. If multiple tasks match → skip (ambiguous) → continue to kanban step

> This is the most expensive and least reliable sub-step. Only runs if 2a and 2b yielded nothing.

---

## AskUserQuestion Format

**Story selection:**
```
Question: "Which Story to {action}?"
Options: [{label: "US001: User Login", description: "Epic 1 · Todo"}, ...]
```

**Task selection:**
```
Question: "Which Task to {action}?"
Options: [{label: "T001: DB Schema", description: "US001 · To Review"}, ...]
```

**Epic selection:**
```
Question: "Which Epic to {action}?"
Options: [{label: "Epic 1: Authentication", description: "Active · 5 stories"}, ...]
```

---

**Version:** 1.1.0
**Last Updated:** 2026-03-06

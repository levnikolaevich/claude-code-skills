# Task Tracking System

<!-- DOC_KIND: index -->
<!-- DOC_ROLE: canonical -->
<!-- READ_WHEN: Read when you need the task system workflow, state transitions, and provider rules. -->
<!-- SKIP_WHEN: Skip when you only need the live board or a specific task artifact. -->
<!-- PRIMARY_SOURCES: .hex-skills/environment_state.json, docs/tasks/kanban_board.md, docs/reference/guides/testing-strategy.md -->
<!-- SCOPE: Task tracking system workflow and rules ONLY. Contains task lifecycle, naming conventions, and integration rules. -->
<!-- DO NOT add here: actual task details → task files, kanban status → kanban_board.md, implementation guides → guides/ -->

## Quick Navigation

- [Kanban Board](kanban_board.md)
- [Tools Config](../environment_state.json)
- [Testing Strategy](../reference/guides/testing-strategy.md)

## Agent Entry

| Signal | Value |
|--------|-------|
| Purpose | Defines task workflow, provider rules, status meanings, and task-document conventions. |
| Read When | You need workflow rules, provider behavior, or task lifecycle guidance. |
| Skip When | You only need the current active items. |
| Canonical | Yes |
| Next Docs | [Kanban Board](kanban_board.md), [Tools Config](../environment_state.json), [Testing Strategy](../reference/guides/testing-strategy.md) |
| Primary Sources | .hex-skills/environment_state.json, docs/tasks/kanban_board.md, docs/reference/guides/testing-strategy.md |

---

## Overview

This folder contains the project's task management system, organizing all development work into trackable units with clear status progression.

### Folder Structure

```
docs/tasks/
├── README.md           # This file - Task tracking workflow and rules
└── kanban_board.md     # Live navigation to active tasks
```

> [!NOTE]

> All task tracking (Epics, User Stories, Tasks) follows the provider configured in .hex-skills/environment_state.json. The task provider is the single source of truth.

**Live Navigation**: [Kanban Board](kanban_board.md)

---

## Core Concepts

### Task Lifecycle

**Workflow:**
```
Backlog/Postponed → Todo → In Progress → To Review → Done
                                              ↓
                                         To Rework → (back to In Progress)
```

**Statuses:**
- **Backlog:** New tasks requiring estimation and approval
- **Postponed:** Deferred tasks for future iterations
- **Todo:** Approved tasks ready for development
- **In Progress:** Currently being developed
- **To Review:** Awaiting code review and validation
- **To Rework:** Needs fixes after review
- **Done:** Completed, reviewed, tested, approved

**Manual Statuses** (not in workflow): Canceled, Duplicate

### Epic Structure

**Organization:**
- **Epic** = Project (Linear) or folder `docs/tasks/epics/epic-{N}-{slug}/` (File Mode)
- **User Story** = Issue with `label: user-story` (Linear) or `stories/us{NNN}-{slug}/story.md` (File Mode)
- **Task** = Child issue of Story (Linear) or `tasks/T{NNN}-{slug}.md` (File Mode)

**Epic Fields:** Name, description, start date, target date, project lead
**User Story Format:** "As a... I want... So that..." + Given-When-Then acceptance criteria
**Task Format:** Context, requirements, acceptance criteria, implementation notes

### Foundation-First Execution Order

**Critical Rule**: Foundation tasks are executed BEFORE consumer tasks (for testability).

**Definitions**:
- **Foundation** = Database, Repository, core services
- **Consumer** = API endpoints, Frontend components that USE foundation

**Rationale**: Each layer is testable when built (can't test API without working DB).

**Example**:
```
✅ CORRECT EXECUTION ORDER:
  Task 1: Database schema + Repository (foundation)
  Task 2: Service layer with business logic
  Task 3: API endpoint (consumer)
  Task 4: Frontend dashboard (consumer)

❌ WRONG (can't test):
  Task 1: Frontend dashboard calls /api/users
  Task 2: API endpoint (no DB to test against)
```

> **Note:** Consumer-First is for API/interface DESIGN (think from consumer perspective), Foundation-First is for EXECUTION ORDER (build testable foundation first).

---

## Critical Rules

### Rule 1: Task Provider Integration

**CRITICAL**: Use the task provider configured in `.hex-skills/environment_state.json` for all task operations.

**Linear Mode** (`provider: linear`):
- Use ONLY `mcp__linear-server__*` methods
- Prohibited: `gh` command, GitHub API, direct Linear API

**File Mode** (`provider: file`):
- Use Read/Write/Edit/Glob for task files in `docs/tasks/epics/` structure
- Status tracked via `**Status:**` line in markdown files

**See**: [Task Provider Operations Reference](#task-provider-operations-reference) below

---

### Rule 2: Integration Rules

#### Tests

**Rule**: Tests are created ONLY in the final Story task (Story Finalizer test task).

**NEVER** create:
- Separate test tasks during implementation
- Tests in implementation tasks (implementation tasks focus on feature code only)

**Process**:
1. Implementation tasks (1-8 tasks) → To Review → Done
2. Quality gate → Manual testing
3. Test planner → Creates Story Finalizer test task
4. Test executor → Implements all tests (E2E, Integration, Unit)

**Rationale**: Atomic testing strategy, prevents test duplication, ensures comprehensive coverage.

#### Documentation

**Rule**: Documentation is ALWAYS integrated in feature tasks (same task as implementation).

**NEVER** create:
- Separate documentation tasks
- "Update README" tasks
- "Write API docs" tasks

**Process**: Implementation task includes both code AND documentation updates in Definition of Done.

**Rationale**: Ensures documentation stays in sync with code, prevents documentation debt.

---

### Rule 3: Story-Level Test Strategy

**Value-Based Testing**: Test only scenarios with Priority ≥15 (calculated by Impact × Likelihood).

**Test Usefulness Criteria**: Each test must pass all 6 criteria (Risk Priority ≥15, Confidence ROI, Behavioral, Predictive, Specific, Non-Duplicative). No numerical targets — test count driven by risk assessment. See risk_based_testing_guide.md.

**Example**:
```
Story: User Authentication
- E2E: 3 tests (login success, login failure, session expiry)
- Integration: 5 tests (OAuth flow, token refresh, database session storage, Redis cache, logout)
- Unit: 8 tests (password validation, email validation, token generation, permission checks, etc.)
Total: 16 tests (all Priority ≥15, pass Usefulness Criteria)
```

**Reference**: [Risk-Based Testing Guide](../reference/guides/risk-based-testing-guide.md) for Priority calculation.

---

### Rule 4: Context Budget Rule

- [ ] **CRITICAL: Minimize context pollution in kanban_board.md**

**Rule:** [kanban_board.md](./kanban_board.md) contains ONLY links and titles - no descriptions, no implementation notes.

**Board Structure:**

Single hierarchical view: **Status → Epic → User Story → Tasks**

**Sections:**
1. **Work in Progress** - Hierarchical task tracking (Backlog → Todo → In Progress → To Review → To Rework → Done → Postponed)
2. **Epics Overview** - Portfolio-level status (Active + Completed epics)

**Format Rules:**

**User Story:**
- Format: `📖 [US{NNN} Title](link-or-path)` + optional `✅ APPROVED`
- 2-space indent from Epic
- Always shows parent epic context
- Can exist without tasks ONLY in Backlog status (with note: `_(tasks not created yet)_`)

**Task:**
- Format: `  - [T{NNN} Title](link-or-path)` (2-space indent + dash)
- 4-space total indent (2-space base from Story + 2-space for dash)
- Always nested under parent User Story
- Cannot exist without parent story

**Epic Grouping:**
- Each status section grouped by: `**Epic N: Epic Name**` (bold header)
- Stories listed under epic with 2-space indent
- Tasks listed under stories with 4-space indent (2-space base + 2-space for dash)

**Status-Specific Limits:**
- **Backlog:** All stories (tasks optional, use `_(tasks not created yet)_` if none)
- **Todo/In Progress/To Review/To Rework:** All stories with all tasks
- **Done:** Last 5 stories ONLY (no tasks - removed from tracking after completion)
- **Postponed:** Stories ONLY (no tasks - tasks created when work resumes)

**Rationale:**
- Single view eliminates need to "jump" between sections
- Natural hierarchy matches mental model: Status → Epic → Story → Task
- Story context always visible with its tasks
- Reduced cognitive load: one structure, not three
- Minimize context size for AI agents
- Fast navigation at all levels (status/epic/story/task)

---

## Task Workflow

### Planning Guidelines

**Optimal Task Size**: 3-5 hours per task

**Task Granularity**:
- Too small (< 2 hours): Merge with related tasks
- Too large (> 8 hours): Split into subtasks
- Sweet spot (3-5 hours): Maximum productivity, clear acceptance criteria

**Story Limits**:
- Implementation tasks: 1-8 tasks per Story
- Test task: 1 Story Finalizer test task (created after implementation)
- Total: Max 7 tasks per Story

### Workflow Skills

| Category | Skill | Purpose |
|----------|-------|---------|
| **Planning** | ln-210-epic-coordinator | Decompose scope → 3-7 Epics |
| | ln-220-story-coordinator | Decompose Epic → 5-10 Stories (with Phase 3 Library Research) |
| | ln-300-task-coordinator | Decompose Story → 1-6 Implementation Tasks |
| **Validation** | ln-310-multi-agent-validator | Validates Stories/Tasks with multi-agent review → Approve (Backlog → Todo) |
| **Execution** | ln-400-story-executor | Orchestrate Story execution (delegates to ln-401/ln-404/ln-402) |
| | ln-401-task-executor | Execute implementation tasks (Todo → In Progress → To Review) |
| | ln-404-test-executor | Execute Story Finalizer test tasks (11 sections) |
| | ln-402-task-reviewer | Review tasks (To Review → Done/Rework) |
| | ln-403-task-rework | Fix tasks after review (To Rework → To Review) |
| **Quality** | Story quality gate | Quality checks, regression, test planning, verdict |
| **Testing** | Test planner | Plan Story Finalizer test task (after manual testing) |
| **Documentation** | ln-111-project-docs-creator | Create project docs (requirements, architecture, specs) |
| | documentation_creation.md | ADRs, guides, manuals (ln-310 Phase 3 Step 2) |

---

## Project Configuration

### Quality Commands

```bash
# Docker development environment
{{DOCKER_COMMAND}}

# Run tests
{{TEST_COMMAND}}

# Run tests with coverage
{{COVERAGE_COMMAND}}

# Type checking
{{TYPE_CHECK_COMMAND}}

# Linting
{{LINT_COMMAND}}
```

### Documentation Structure

Core documentation:
- [Requirements](../project/requirements.md) - Functional requirements (FR-XXX-NNN) with MoSCoW prioritization
- [Architecture](../project/architecture.md) - System architecture (C4 Model, arc42)
- [Technical Specification](../project/technical_specification.md) - Implementation details
- [ADRs](../reference/adrs/) - Architecture Decision Records
- [Guides](../reference/guides/) - Project patterns and best practices
- [Manuals](../reference/manuals/) - Package API references

### Label Taxonomy

**Functional Labels**: `feature`, `bug`, `refactoring`, `documentation`, `testing`, `infrastructure`

**Type Labels**: `user-story`, `implementation-task`, `test-task`

**Status Labels** (auto-managed by task provider): `backlog`, `todo`, `in-progress`, `to-review`, `to-rework`, `done`, `canceled`

### Test Audit History (Optional)

**Test Audit:** Every +50 tests → review new files, delete framework tests. Last: {{AUDIT_DATE}} ({{OLD_COUNT}} → {{NEW_COUNT}})

---

## Task Provider Operations Reference

> Operations vary by provider configured in `.hex-skills/environment_state.json`. See `references/storage_mode_detection.md` for complete operation tables.

### Epic Operations

| Operation | Linear Mode | File Mode |
|-----------|-------------|-----------|
| **List** | `list_projects(team=teamId)` | `Glob("docs/tasks/epics/*/epic.md")` |
| **Get** | `get_project(query="Epic N")` | `Read("docs/tasks/epics/epic-{N}-*/epic.md")` |
| **Create** | `save_project({name, description, team, state: "planned"})` | `mkdir + Write("docs/tasks/epics/epic-{N}-{slug}/epic.md")` |
| **Update** | `save_project({id, state, description})` | `Edit epic.md` |

### Story Operations

| Operation | Linear Mode | File Mode |
|-----------|-------------|-----------|
| **List** | `list_issues(project=epicId, label="user-story")` | `Glob("docs/tasks/epics/epic-{N}-*/stories/*/story.md")` |
| **Get** | `get_issue(id=storyId)` | `Read("docs/tasks/.../stories/us{NNN}-*/story.md")` |
| **Create** | `save_issue({title: "US{NNN}: Title", project: epicId, team, labels: ["user-story"], state: "Backlog"})` | `mkdir + Write(".../stories/us{NNN}-{slug}/story.md")` |
| **Update status** | `save_issue({id, state: "In Progress"})` | `Edit story.md -> **Status:** In Progress` |

### Task Operations

| Operation | Linear Mode | File Mode |
|-----------|-------------|-----------|
| **List** | `list_issues(parentId=storyId)` | `Glob("docs/tasks/.../tasks/T*.md")` |
| **Get** | `get_issue(id=taskId)` | `Read("docs/tasks/.../tasks/T{NNN}-{slug}.md")` |
| **Create** | `save_issue({title: "T{NNN}: Title", parentId: storyId, team, labels: ["implementation"], state: "Backlog"})` | `Write(".../tasks/T{NNN}-{slug}.md")` |
| **Update status** | `save_issue({id, state: "Done"})` | `Edit task.md -> **Status:** Done` |

### Comment Operations

| Operation | Linear Mode | File Mode |
|-----------|-------------|-----------|
| **List** | `list_comments(issueId=id)` | `Glob("docs/tasks/.../comments/*.md")` |
| **Create** | `create_comment({issueId, body})` | `Write("comments/{timestamp}.md")` |

### Common Parameters (Linear Mode)

| Parameter | Type | Description |
|-----------|------|-------------|
| `team` | string | Team name or ID |
| `state` | string | Status name: Backlog, Todo, In Progress, To Review, To Rework, Done |
| `assignee` | string | User ID, name, email, or "me" |
| `labels` | string[] | Label names: user-story, implementation, tests, refactoring, bug |
| `limit` | number | Max results (default 50, max 250) |

### File Mode Headers

Every file mode document includes metadata headers:

```
**Status:** Backlog
**Epic:** Epic {N}
**Labels:** implementation
**Created:** {date}
**Updated:** {date}
```

---

## Maintenance

**Update Triggers**:
- When adding new workflow skills
- When changing task lifecycle statuses
- When updating Critical Rules
- When modifying task provider integration patterns
- When changing test strategy limits

**Verification**:
- All task provider operation examples are valid
- Workflow skills table matches available skills
- Critical Rules align with current development principles
- Test limits match risk-based testing guide

**Last Updated**: {{DATE}}

---

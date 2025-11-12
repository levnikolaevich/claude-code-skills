---
name: x-story-executor
description: This skill should be used when executing Story by orchestrating child tasks through their workflow. Prioritizes To Review tasks (calls x-task-reviewer), then Todo tasks (calls x-task-executor or x-test-executor). Manages Story status transitions (Todo → In Progress → completion). Auto-discovers team ID and project configuration.
---

# Story Execution Skill

Execute Story by orchestrating child tasks through their complete workflow (To Review → Done, Todo → In Progress → To Review).

## When to Use This Skill

This skill should be used when:
- Story is in Todo or In Progress status
- Story has child tasks in various statuses
- Systematically execute all Story tasks to completion
- Automate task workflow orchestration

**Note:** This skill does NOT invoke x-story-reviewer. After all tasks Done, it recommends user to run x-story-reviewer manually.

## How It Works

### Phase 1: Discovery (Automated)

Auto-discovers Team ID and project configuration from `docs/tasks/kanban_board.md` and `CLAUDE.md`.

**Details:** See CLAUDE.md "Configuration Auto-Discovery".

### Phase 2: Story + Tasks Overview

⛔ **CRITICAL RULE - Task Loading Restrictions:**

**ABSOLUTE PROHIBITION:**
- ❌ NEVER call `mcp__linear-server__get_issue()` for ANY Task in Phase 2
- ❌ NEVER load Task descriptions in Phase 2
- ❌ NEVER load Task full data in Phase 2

**ONLY ALLOWED:**
- ✅ Load Task metadata from kanban_board.md ONLY (ID, title, status from hierarchy)
- ✅ Full Task description loaded LATER by specialized skills (Phase 3)

**VIOLATION CONSEQUENCE:** Loading Task descriptions in Phase 2 wastes 10,000+ tokens unnecessarily.

**Input:** Story ID (e.g., US001 or API-42 if Story)

**Steps:**
1. Fetch **Story** from Linear via MCP (must have label "user-story")
   - Request FULL description, not truncated
   - Ensure all 8 sections loaded completely
2. Extract **Story.id** (UUID) from loaded Story object (stored for reference)
   - ⚠️ **Critical:** Use Story.id (UUID), NOT short ID (e.g., "API-97")
   - Linear API requires UUID for parentId filter if needed
3. Read **kanban_board.md** (primary source for task status):
   - Parse hierarchical structure (Status → Epic → Story → Tasks):
     * For target Story: Find Story entry `  📖 [LINEAR_ID: USXXX Story Title](link)` in each status section
     * Extract nested Tasks under Story: `    - [LINEAR_ID: EP#_## Task Title](link)` (4-space indent)
     * Parse all sections: To Review, To Rework, Todo, In Progress, Done, Postponed
   - Count tasks per status based on section location within Story hierarchy
   - **Purpose:** Avoid loading metadata of ALL tasks via Linear API - use hierarchical local file for navigation
   - ⚠️ **ABSOLUTE PROHIBITION - NO EXCEPTIONS:**
     * ❌ DO NOT call `mcp__linear-server__get_issue()` for Tasks in Phase 2 - THIS IS FORBIDDEN
     * ❌ DO NOT load Task descriptions - THIS IS FORBIDDEN
     * ❌ DO NOT fetch Task full data - THIS IS FORBIDDEN
     * ✅ Load Task metadata ONLY from kanban_board.md (ID, title, status)
     * ✅ Full Task description loaded by x-task-executor/x-task-reviewer/x-task-rework in Phase 3
     * 🚫 **REASON:** Loading all Task descriptions wastes 10,000+ tokens and fills context
4. **Sync check** (ONLY if kanban_board.md empty/missing):
   - ⚠️ **Fallback ONLY:** If kanban_board.md missing/corrupted
   - ✅ **ALLOWED:** Fetch child Tasks **METADATA ONLY** (ID, title, status, labels - NO description!)
   - ❌ **FORBIDDEN:** Fetch Task descriptions via `get_issue(task_id)`
   - Use: `list_issues(parentId=Story.id)` → returns metadata without descriptions
   - Update kanban_board.md with metadata from Linear
   - Log: "kanban_board.md synchronized with Linear (metadata only)"
5. **Display summary:**
   - Story: [ID] Title (Status: Todo/In Progress)
   - Tasks: X To Review, Y To Rework, Z Todo, W In Progress, V Done

### Phase 3: Task Orchestration Loop

⚠️ **DELEGATION RESPONSIBILITY:**
- x-story-executor ONLY invokes executor skills with task ID parameter
- x-story-executor does NOT update task status directly
- Executor skills (x-task-executor, x-test-executor, x-task-rework) are SOLELY responsible for updating their selected task status
- Each executor MUST update ONLY the task ID passed to it (NOT all tasks in the Story)

**Orchestrate tasks in priority order:**

**Priority 1: Review First (To Review → Done/Rework)**
⚠️ **REMINDER:** Load ONLY next task's full description via get_issue() in x-task-reviewer (NOT here!)
- If tasks in To Review exist (from kanban_board.md):
  1. Read kanban_board.md section "### To Review"
  2. Find target Story entry: `  📖 [LINEAR_ID: USXXX Story Title](link)`
  3. Extract first nested Task ID from Story section: `    - [API-42: Title](url)` (4-space indent)
  4. **Use Skill tool to invoke task-review:** `Skill(command: "task-review")`
  5. Pass task ID to task-review
  6. task-review loads FULL description via get_issue(task_id) and handles: To Review → Done OR To Review → To Rework
  7. After task-review completes: Loop back to Phase 2 (reload kanban_board.md)

**Priority 2: Fix Rework Tasks (To Rework → In Progress → To Review)**
⚠️ **REMINDER:** Load ONLY next task's full description via get_issue() in x-task-rework (NOT here!)
- If no To Review tasks, but To Rework tasks exist (from kanban_board.md):
  1. Read kanban_board.md section "### To Rework"
  2. Find target Story entry: `  📖 [LINEAR_ID: USXXX Story Title](link)`
  3. Extract first nested Task ID from Story section: `    - [API-43: Title](url)` (4-space indent)
  4. **Use Skill tool to invoke x-task-rework:** `Skill(command: "x-task-rework")`
  5. Pass task ID to x-task-rework
  6. x-task-rework loads FULL description via get_issue(task_id) and handles: To Rework → In Progress → To Review
  7. After rework completes: Loop back to Phase 2 (reload kanban_board.md)

**Priority 3: Execute Next Task (Todo → In Progress → To Review)**
⚠️ **REMINDER:** Load ONLY next task's full description via get_issue() in x-task-executor (NOT here!)
- If no To Review tasks AND no To Rework tasks, but Todo tasks exist (from kanban_board.md):
  1. Read kanban_board.md section "### Todo"
  2. Find target Story entry: `  📖 [LINEAR_ID: USXXX Story Title](link)`
  3. Extract first nested Task ID from Story section: `    - [API-44: Title](url)` (4-space indent)
  4. **Use Skill tool to invoke x-task-executor:** `Skill(command: "x-task-executor")`
  5. Pass task ID to x-task-executor
  6. x-task-executor loads FULL description via get_issue(task_id), auto-detects task type (test/impl) by label "tests", and handles: Todo → In Progress → To Review
  7. After execution completes: Loop back to Phase 2 (reload kanban_board.md)

**Stop Condition:**
- No more To Review tasks AND
- No more To Rework tasks AND
- No more Todo tasks
- Result: All tasks either Done, In Progress, or To Rework

**Loop mechanism:** After each skill invocation completes, reload kanban_board.md (Phase 2) to get updated task statuses, then re-evaluate priorities (Phase 3).

### Phase 4: Story Status Management

**Update Story status automatically:**

1. **First task transition (Todo → In Progress):**
   - If Story status = Todo AND first task goes Todo → In Progress
   - Update Story status: Todo → In Progress via Linear MCP
   - Add comment: "Story execution started"
   - Update kanban_board.md with hierarchical Story movement:
     * Find Story entry under "### Todo": `  📖 [LINEAR_ID: USXXX Story Title](link) ✅ APPROVED`
     * Find Epic header above Story: `**Epic N: Epic Title**`
     * Remove entire Epic section from "### Todo" (Epic header + Story + all Tasks)
     * Add entire Epic section to "### In Progress" (preserve hierarchy)
     * If Epic has other Stories still in Todo, keep Epic in both sections

2. **All tasks completed:**
   - If ALL tasks status = Done (no Todo, no In Progress, no To Review)
   - **Do NOT change Story status**
   - Add comment: "✅ All implementation tasks Done. Ready for x-story-reviewer Pass 1."
   - **Recommendation:** Use Skill tool to invoke x-story-reviewer (command: "x-story-reviewer") for manual testing

**Important:** x-story-executor does NOT mark Story as Done. Only x-story-reviewer Pass 2 can do that.

### Phase 5: Progress Reporting

**During execution, report progress:**
- After each task completes: "Task [ID] Done (X/Y tasks completed)"
- After each cycle: Display updated task summary
- Final report: "Story [ID] execution complete. All tasks Done. Recommend: x-story-reviewer Pass 1"

## Story Status Transitions

**Story lifecycle managed by x-story-executor:**
1. **Todo → In Progress:** When first task starts execution (automatic)
2. **In Progress → completion:** When all tasks Done (stops, recommends x-story-reviewer)
3. **completion → Done:** Handled by x-story-reviewer Pass 2 (NOT by x-story-executor)

## Example Usage

**Direct invocation:**
```
Execute Story US001
```

**From user request:**
```
Work on Story US003 until all tasks done
```

## Best Practices

1. **Sequential execution:** One task at a time (no parallel execution)
2. **Review priority:** Always review completed work before starting new tasks (To Review > Todo)
3. **Unified task execution:** Always call x-task-executor (auto-detects task type by label "tests")
4. **Status tracking:** Update Story status synchronously with first task
5. **Manual x-story-reviewer:** User controls when to run x-story-reviewer (orchestrator only recommends)
6. **Loop after each skill:** Reload kanban_board.md after every task-review/x-task-executor to get fresh state
7. **kanban_board.md as primary source:** Always read kanban_board.md first for task status and selection. Only sync with Linear when file missing/corrupted. Linear = source of truth, kanban_board.md = navigation source.
8. **Lazy loading (MANDATORY):**
   - ❌ FORBIDDEN: Load full descriptions of all tasks upfront in Phase 2
   - ✅ REQUIRED: Load ONLY metadata in Phase 2 (kanban_board.md)
   - ✅ REQUIRED: Load full description ONLY for selected next task in Phase 3 (via specialized skill)
   - 🚫 Violation wastes 10,000+ tokens unnecessarily
9. **Task metadata source (ABSOLUTE RULE):**
   - ❌ ABSOLUTELY FORBIDDEN: Call `mcp__linear-server__get_issue()` for Tasks in Phase 2
   - ✅ MANDATORY: Use kanban_board.md as primary source for Task metadata (ID, title, status)
   - ✅ MANDATORY: Only specialized skills load full Task descriptions when needed (Phase 3)
   - 🚫 NO EXCEPTIONS to this rule
10. **Stop at completion:** When all tasks Done, recommend x-story-reviewer and stop (don't invoke it)

## Comparison with Other Skills

| Aspect | x-story-executor | x-task-executor | x-task-reviewer | x-story-reviewer |
|--------|----------------|----------------|-------------|--------------|
| **Level** | Story | Task | Task | Story |
| **Role** | Orchestrator | Worker (impl/test) | Reviewer | Story reviewer |
| **Scope** | All Story tasks | One task (any type) | One task | Story + all tasks |
| **Invokes** | x-task-reviewer, x-task-executor (via Skill tool) | None | None | None (recommends x-story-finalizer) |
| **Status** | Todo → In Progress | Todo → In Progress → To Review | To Review → Done/Rework | Manual testing + Story Done |
| **When** | User wants to execute entire Story | x-story-executor calls via Skill tool OR user directly | x-story-executor calls via Skill tool OR user directly | After all tasks Done (manual) |

## Error Handling

**If skill invocation fails:**
- Log error details
- Stop loop (don't proceed to next task)
- Report to user: "Task [ID] failed during [skill]. Check Linear for details."
- User must resolve issue manually before re-running x-story-executor

**If task stuck In Progress:**
- Detect: Task status = In Progress for >24 hours
- Report warning: "Task [ID] stuck In Progress. Manual intervention needed."
- Continue loop (don't block other tasks)

**If Story has no tasks:**
- Report: "Story [ID] has no tasks. Cannot execute."
- Recommend: "Create tasks using story-creator or task-creator"

---

## Definition of Done

Before completing work, verify ALL checkpoints:

**✅ Story + Tasks Overview Complete (Phase 2):**
- [ ] Story fetched from Linear (FULL description, all 8 sections loaded)
- [ ] Story.id (UUID) extracted from Story object for reference
- [ ] Child Tasks loaded from kanban_board.md (primary source) with hierarchical parsing:
  - For target Story: Story entry found `  📖 [LINEAR_ID: USXXX Story Title](link)` in each status section
  - Nested Tasks extracted under Story: `    - [LINEAR_ID: EP#_## Task Title](link)` (4-space indent)
  - All sections parsed: To Review, To Rework, Todo, In Progress, Done, Postponed
  - Tasks grouped by status based on section location within Story hierarchy
  - Fallback: If kanban_board.md empty/missing → sync with Linear (fetch metadata via list_issues)
  - ⚠️ **CRITICAL CHECKPOINT - ZERO get_issue() calls for Tasks:**
    - [ ] Verified: NO `mcp__linear-server__get_issue()` calls made for ANY Task in Phase 2
    - [ ] Verified: Task metadata loaded from kanban_board.md ONLY (ID, title, status)
    - [ ] Verified: NO Task descriptions loaded in Phase 2
    - [ ] If violated: ABORT execution immediately - this wastes 10,000+ tokens
- [ ] Task summary displayed:
  - Story: [ID] Title (Status: Todo/In Progress)
  - Tasks: X To Review, Y To Rework, Z Todo, W In Progress, V Done
  - Source: kanban_board.md hierarchical parsing (or "synced from Linear" if fallback used)

**✅ Orchestration Loop Executed (Phase 3):**
- [ ] **Priority 1 (Review First):** All tasks in To Review processed:
  - For each To Review task:
    - task-review invoked via Skill tool with task ID
    - task-review completed: To Review → Done OR To Review → To Rework
    - Tasks reloaded after each task-review (Phase 2)
  - Loop continued until no To Review tasks remain
- [ ] **Priority 2 (Fix Rework):** All tasks in To Rework processed:
  - For each To Rework task:
    - x-task-rework invoked via Skill tool with task ID
    - x-task-rework completed: To Rework → In Progress → To Review
    - Tasks reloaded after each x-task-rework (Phase 2)
  - Loop continued until no To Rework tasks remain
- [ ] **Priority 3 (Execute Next):** All tasks in Todo processed:
  - For each Todo task (ordered by createdAt):
    - x-task-executor invoked via Skill tool with task ID
    - x-task-executor auto-detected task type (test/impl) by label "tests"
    - x-task-executor completed: Todo → In Progress → To Review
    - Tasks reloaded after each x-task-executor (Phase 2)
  - Loop continued until no Todo tasks remain
- [ ] **Stop Condition Met:** No more To Review AND no more To Rework AND no more Todo tasks
- [ ] Final state: All tasks either Done, In Progress, or To Rework

**✅ Story Status Managed (Phase 4):**
- [ ] **First task transition (if applicable):**
  - If Story status = Todo AND first task started (Todo → In Progress)
  - Story status updated: Todo → In Progress via Linear MCP
  - Comment added: "Story execution started"
  - kanban_board.md updated with hierarchical Story movement:
    * Story entry found under "### Todo": `  📖 [LINEAR_ID: USXXX Story Title](link) ✅ APPROVED`
    * Epic header identified: `**Epic N: Epic Title**`
    * Entire Epic section removed from "### Todo" (Epic + Story + all Tasks)
    * Entire Epic section added to "### In Progress" (hierarchy preserved)
    * If Epic has other Stories in Todo, Epic kept in both sections
- [ ] **All tasks completed (if applicable):**
  - If ALL tasks status = Done (no Todo, no In Progress, no To Review)
  - Story status NOT changed (remains In Progress)
  - Comment added: "✅ All implementation tasks Done. Ready for x-story-reviewer Pass 1."
  - x-story-reviewer NOT invoked (only recommended to user)

**✅ Progress Reported (Phase 5):**
- [ ] After each task completion: Progress message displayed "Task [ID] Done (X/Y tasks completed)"
- [ ] After each cycle: Updated task summary displayed
- [ ] Final report displayed: "Story [ID] execution complete. All tasks Done. Recommend: x-story-reviewer Pass 1"

**✅ Error Handling Applied (if errors occurred):**
- [ ] If skill invocation failed:
  - Error logged with details
  - Loop stopped (no proceeding to next task)
  - User notified: "Task [ID] failed during [skill]. Check Linear for details."
- [ ] If task stuck In Progress (>24 hours):
  - Warning reported: "Task [ID] stuck In Progress. Manual intervention needed."
  - Loop continued (other tasks not blocked)
- [ ] If Story has no tasks:
  - Reported: "Story [ID] has no tasks. Cannot execute."
  - Recommended: "Create tasks using story-creator or task-creator"

**✅ User Guidance:**
- [ ] Final status summary displayed (Story status, tasks breakdown)
- [ ] Next step recommended:
  - If all tasks Done: "Run x-story-reviewer Pass 1 for manual functional testing"
  - If tasks remain: "X tasks remaining (Y To Review, Z Todo)"
- [ ] User informed: "x-story-executor does NOT invoke x-story-reviewer automatically (user controls when to test)"

**Output:**
- Story status updated (Todo → In Progress if first task started)
- All processable tasks completed (Done or To Rework)
- Recommendation: "Run x-story-reviewer Pass 1" (if all tasks Done)
- Progress report with task summary

---

**Version:** 2.6.0 (Reinforced Task loading prohibitions)
**Last Updated:** 2025-11-08

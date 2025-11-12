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

## Critical Rules

### Task Loading Strategy (MANDATORY)

**ABSOLUTE PROHIBITIONS:**
- ❌ NEVER call `mcp__linear-server__get_issue()` for ANY Task in Phase 2
- ❌ NEVER load Task descriptions in Phase 2
- ❌ NEVER load Task full data in Phase 2
- 🚫 **VIOLATION CONSEQUENCE:** Loading Task descriptions in Phase 2 wastes 10,000+ tokens unnecessarily

**REQUIRED BEHAVIOR:**
- ✅ Load Task metadata from kanban_board.md ONLY (ID, title, status from hierarchy)
- ✅ Full Task description loaded LATER by specialized skills (Phase 3) when processing specific task
- ✅ Use lazy loading: load only next task's full description when needed

**Delegation Responsibility:**
- x-story-executor ONLY invokes executor skills with task ID parameter
- x-story-executor does NOT update task status directly
- Executor skills (x-task-executor, x-test-executor, x-task-rework, x-task-reviewer) are SOLELY responsible for updating their selected task status
- Each executor MUST update ONLY the task ID passed to it (NOT all tasks in the Story)

## Workflow

### Phase 1: Discovery

Auto-discovers Team ID and project configuration from `docs/tasks/kanban_board.md` and `CLAUDE.md`.

**Details:** See CLAUDE.md "Configuration Auto-Discovery".

### Phase 2: Load Story & Task Metadata

**Input:** Story ID (e.g., US001 or API-42 if Story)

**Steps:**
1. **Fetch Story** from Linear via MCP (must have label "user-story"):
   - Request FULL description, not truncated
   - Ensure all 8 sections loaded completely
2. **Extract Story.id** (UUID) from loaded Story object:
   - ⚠️ **Critical:** Use Story.id (UUID), NOT short ID (e.g., "API-97")
   - Linear API requires UUID for parentId filter if needed
3. **Read kanban_board.md** (primary source for task status):
   - Parse hierarchical structure (Status → Epic → Story → Tasks):
     * For target Story: Find Story entry `  📖 [LINEAR_ID: USXXX Story Title](link)` in each status section
     * Extract nested Tasks under Story: `    - [LINEAR_ID: EP#_## Task Title](link)` (4-space indent)
     * Parse all sections: To Review, To Rework, Todo, In Progress, Done, Postponed
   - Count tasks per status based on section location within Story hierarchy
4. **Sync check** (ONLY if kanban_board.md empty/missing):
   - ⚠️ **Fallback ONLY:** If kanban_board.md missing/corrupted
   - Use `list_issues(parentId=Story.id)` → returns metadata without descriptions
   - Update kanban_board.md with metadata from Linear
5. **Display summary:**
   - Story: [ID] Title (Status: Todo/In Progress)
   - Tasks: X To Review, Y To Rework, Z Todo, W In Progress, V Done

### Phase 3: Orchestration Loop

**Orchestrate tasks in priority order:**

**Priority 1: Review First (To Review → Done/Rework)**
- If tasks in To Review exist:
  1. Read kanban_board.md section "### To Review"
  2. Find target Story entry and extract first nested Task ID
  3. **Use Skill tool:** `Skill(skill: "x-task-reviewer")` with task ID
  4. x-task-reviewer loads full description and handles: To Review → Done OR To Review → To Rework
  5. After completion: Loop back to Phase 2 (reload kanban_board.md - AUTOMATIC, no user input)

**Priority 2: Fix Rework Tasks (To Rework → In Progress → To Review)**
- If no To Review tasks, but To Rework tasks exist:
  1. Read kanban_board.md section "### To Rework"
  2. Find target Story entry and extract first nested Task ID
  3. **Use Skill tool:** `Skill(skill: "x-task-rework")` with task ID
  4. x-task-rework loads full description and handles: To Rework → In Progress → To Review
  5. After completion: Loop back to Phase 2 (reload kanban_board.md - AUTOMATIC, no user input)

**Priority 3: Execute Next Task (Todo → In Progress → To Review)**
- If no To Review AND no To Rework tasks, but Todo tasks exist:
  1. Read kanban_board.md section "### Todo"
  2. Find target Story entry and extract first nested Task ID
  3. **Use Skill tool:** `Skill(skill: "x-task-executor")` with task ID
  4. x-task-executor loads full description, auto-detects task type (test/impl) by label "tests", and handles: Todo → In Progress → To Review
  5. After completion: Loop back to Phase 2 (reload kanban_board.md - AUTOMATIC, no user input)

**Stop Condition:**
- No more To Review tasks AND no more To Rework tasks AND no more Todo tasks
- Result: All tasks either Done, In Progress, or To Rework

**Loop mechanism:**
After each skill completes → reload kanban_board.md → continue Phase 3 → process next priority (To Review > To Rework > Todo).
Exit when no tasks in these statuses → Phase 4 → STOP (x-story-reviewer NOT invoked).

### Phase 4: Story Status & Progress

**Story Status Updates (AUTOMATIC):**

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
   - **Recommendation:** Use Skill tool to invoke x-story-reviewer (skill: "x-story-reviewer") for manual testing

**Progress Reporting:**
- After each task completes: "Task [ID] Done (X/Y tasks completed)"
- After each cycle: Display updated task summary
- Final report: "Story [ID] execution complete. All tasks Done. Recommend: x-story-reviewer Pass 1"

**Story Lifecycle:**
1. **Todo → In Progress:** When first task starts execution (automatic)
2. **In Progress → completion:** When all tasks Done (stops, recommends x-story-reviewer)
3. **completion → Done:** Handled by x-story-reviewer Pass 2 (NOT by x-story-executor)

## Technical Details

### Error Handling

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
- Recommend: "Create tasks using x-story-manager or x-task-manager"

### Comparison with Other Skills

| Aspect | x-story-executor | x-task-executor | x-task-reviewer | x-story-reviewer |
|--------|----------------|----------------|-------------|--------------|
| **Level** | Story | Task | Task | Story |
| **Role** | Orchestrator | Worker (impl/test) | Reviewer | Story reviewer |
| **Scope** | All Story tasks | One task (any type) | One task | Story + all tasks |
| **Invokes** | x-task-reviewer, x-task-executor, x-task-rework (via Skill tool) | None | None | None (recommends x-story-finalizer) |
| **Status** | Todo → In Progress | Todo → In Progress → To Review | To Review → Done/Rework | Manual testing + Story Done |
| **When** | User wants to execute entire Story | x-story-executor calls via Skill tool OR user directly | x-story-executor calls via Skill tool OR user directly | After all tasks Done (manual) |

## Example Usage

**Direct invocation:**
```
Execute Story US001
```

**From user request:**
```
Work on Story US003 until all tasks done
```

## Definition of Done

Before completing work, verify ALL checkpoints:

**✅ Story + Tasks Overview Complete (Phase 2):**
- [ ] Story fetched from Linear (FULL description, all 8 sections loaded)
- [ ] Story.id (UUID) extracted from Story object
- [ ] Child Tasks loaded from kanban_board.md (hierarchical parsing)
- [ ] **CRITICAL:** ZERO `get_issue()` calls for Tasks in Phase 2 - only metadata from kanban_board.md
- [ ] Task summary displayed with counts by status

**✅ Orchestration Loop Executed (Phase 3):**
- [ ] **Priority 1:** All To Review tasks processed via x-task-reviewer
- [ ] **Priority 2:** All To Rework tasks processed via x-task-rework
- [ ] **Priority 3:** All Todo tasks processed via x-task-executor (auto-detects test/impl)
- [ ] **Stop Condition:** No more To Review AND To Rework AND Todo tasks
- [ ] All tasks in final state: Done, In Progress, or To Rework

**✅ Story Status Managed (Phase 4):**
- [ ] If first task started: Story status updated Todo → In Progress
- [ ] If all tasks Done: Comment added recommending x-story-reviewer Pass 1
- [ ] kanban_board.md updated with hierarchical Story movement
- [ ] x-story-reviewer NOT invoked automatically (only recommended)

**✅ Progress Reported:**
- [ ] Task completion messages displayed after each task
- [ ] Updated task summary displayed after each cycle
- [ ] Final report with next step recommendation

**✅ Error Handling Applied (if errors occurred):**
- [ ] Skill invocation failures logged and loop stopped
- [ ] Tasks stuck In Progress detected and reported
- [ ] Stories without tasks handled with recommendations

**Output:**
- Story status updated (Todo → In Progress if first task started)
- All processable tasks completed (Done or To Rework)
- Recommendation: "Run x-story-reviewer Pass 1" (if all tasks Done)
- Progress report with task summary

---

**Version:** 3.0.0 (Restructured for clarity, removed duplication)
**Last Updated:** 2025-11-12

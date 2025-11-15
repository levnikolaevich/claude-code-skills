---
name: ln-story-coordinator
description: Executes Story by orchestrating child tasks. Prioritizes To Review (→ ln-task-reviewer), then Todo (→ ln-task-executor/test). Manages transitions (Todo → In Progress → Done). Auto-discovers team/config.
---

# Story Execution Skill

Execute Story by orchestrating child tasks through their complete workflow (To Review → Done, Todo → In Progress → To Review).

## When to Use This Skill

This skill should be used when:
- Story is in Todo or In Progress status
- Story has child tasks in various statuses
- Systematically execute all Story tasks to completion
- Automate task workflow orchestration

**Note:** This skill orchestrates full Story execution including explicit delegation to ln-story-quality-coordinator Pass 1 (when all implementation tasks Done) and Pass 2 (when test task Done).

## Workflow Overview

```
┌─────────────────────────────────────────────────────┐
│ ln-story-coordinator (TASK ORCHESTRATOR)                │
├─────────────────────────────────────────────────────┤
│ Phase 1: Discovery                                  │
│ Phase 2: Load Story & Task Metadata                 │
│                                                     │
│ Phase 3: Task Orchestration Loop ◄──────────┐       │
│   Priority 0: To Review → ln-task-reviewer   │       │
│   Priority 1: To Rework → ln-task-rework     │       │
│   Priority 2: Todo Tasks:                   │       │
│     IF label "tests":                       │       │
│       → ln-test-executor                     │       │
│     ELSE (implementation):                  │       │
│       → ln-task-executor                     │       │
│   Loop until no To Review/To Rework/Todo    │       │
│                                             │       │
│ Phase 4: Story Quality Delegation           │       │
│   → Invoke ln-story-quality-coordinator Pass 1          │       │
│     (Skill tool - Story quality worker)     │       │
│                                                     │
│   Pass 1 executes:                                  │
│     - ln-code-quality-checker (Fail Fast)            │
│     - ln-regression-checker (Fail Fast)              │
│     - ln-manual-tester (Fail Fast, Format v1.0)      │
│     - Verdict: Path A/B/C                           │
│                                                     │
│   Path A: Test task created (via ln-test-coordinator │
│           → ln-task-creator/replanner)               │
│     → GOTO Phase 3 (execute test task) ─────┘       │
│                                                     │
│   Path B: Refactor task created (via x-task-        │
│           creator/replanner with taskType)          │
│     → GOTO Phase 3 (execute refactor) ──────┘       │
│                                                     │
│   Path C: No tasks created (rare)                   │
│     → Story remains In Progress                     │
│     → STOP (Pass 2 auto-invoked when test task Done)│
└─────────────────────────────────────────────────────┘
```

**Key Points:**
- **Orchestrator-Worker Pattern:** ln-story-coordinator orchestrates tasks, delegates Story quality to ln-story-quality-coordinator
- **Task-Level Orchestration:** Phase 3 manages task workflow (To Review → To Rework → Todo)
- **Story-Level Delegation:** Phase 4 delegates to ln-story-quality-coordinator Pass 1 for quality verification
- **Self-Healing Loop:** ln-story-quality-coordinator creates fix/refactor/test tasks → loops back to Phase 3
- **Separation of Concerns:** Task orchestration (executor) vs Story quality (reviewer)

## Critical Rules

### Task Loading Strategy (MANDATORY)

**ABSOLUTE PROHIBITIONS:**
- ❌ NEVER call `mcp__linear-server__get_issue()` for ANY Task in Phase 2
- ❌ NEVER load Task descriptions in Phase 2
- ❌ NEVER load Task full data in Phase 2
- 🚫 **VIOLATION CONSEQUENCE:** Loading Task descriptions in Phase 2 wastes 10,000+ tokens unnecessarily

**REQUIRED BEHAVIOR:**
- ✅ Load Task metadata from Linear ONLY (ID, title, status, labels - NO descriptions)
- ✅ Full Task description loaded LATER by specialized skills (Phase 3) when processing specific task
- ✅ Use lazy loading: load only next task's full description when needed

**Delegation Responsibility:**
- ln-story-coordinator ONLY invokes executor skills with task ID parameter
- ln-story-coordinator does NOT update task status directly
- Executor skills (ln-task-executor, ln-test-executor, ln-task-rework, ln-task-reviewer) are SOLELY responsible for updating their selected task status
- Each executor MUST update ONLY the task ID passed to it (NOT all tasks in the Story)

**Phase 3 vs Phase 4:**
- **Phase 3:** Task-level orchestration (handles ALL task types: implementation, refactoring, test)
- **Phase 4:** Story-level delegation (invokes ln-story-quality-coordinator Pass 1 for quality verification)
- ln-story-coordinator does NOT execute Story quality checks directly - delegates to ln-story-quality-coordinator

## Workflow

### Phase 1: Discovery

Auto-discovers Team ID and project configuration from `docs/tasks/kanban_board.md` and `CLAUDE.md`.

**Details:** See CLAUDE.md "Configuration Auto-Discovery".

### Phase 2: Load Story & Task Metadata

**Input:** Story ID (e.g., US001 or API-42 if Story)

**Steps:**
1. **Fetch Story metadata** from Linear via MCP (must have label "user-story"):
   - Use `list_issues(query=Story_ID, label="user-story")` to get metadata ONLY
   - Load ID, title, status, labels (NO description)
   - Rationale: Metadata-only loading per Level 2 Orchestrator pattern (saves 5,000+ tokens)
2. **Extract Story.id** (UUID) from loaded Story object:
   - ⚠️ **Critical:** Use Story.id (UUID), NOT short ID (e.g., "API-97")
   - Linear API requires UUID for parentId filter if needed
3. **Fetch ALL child tasks metadata from Linear** (PRIMARY source of truth):
   - Use `list_issues(parentId=Story.id)` → returns all tasks metadata (ID, title, status, labels - NO descriptions)
   - Group tasks by status: To Review, To Rework, Todo, In Progress, Done, Backlog, Postponed
   - Count tasks per status from Linear metadata
   - Rationale: **Linear is the single source of truth**, not kanban_board.md
4. **Read kanban_board.md** (display cache, NOT source of truth):
   - Parse hierarchical structure to display current state
   - ⚠️ **DO NOT use kanban_board.md for orchestration decisions**
   - kanban_board.md may be out of sync - always trust Linear metadata from Step 3
5. **Display summary** (based on Linear metadata):
   - Story: [ID] Title (Status from Linear)
   - Tasks: X To Review, Y To Rework, Z Todo, W In Progress, V Done (counts from Linear)

### Phase 3: Orchestration Loop

**Orchestrate tasks in priority order:**

**Priority 0: Review First (To Review → Done/Rework)**
- If tasks in To Review exist (from Linear metadata loaded in Phase 2):
  1. Filter tasks by status "To Review" from Linear metadata
  2. Extract first "To Review" task ID
  3. **Use Skill tool:** `Skill(skill: "ln-task-reviewer")` with task ID
  4. ln-task-reviewer loads full description and handles: To Review → Done OR To Review → To Rework
  5. After completion: Loop back to Phase 2 (reload from Linear - AUTOMATIC, no user input)

**Priority 1: Fix Rework Tasks (To Rework → In Progress → To Review)**
- If no To Review tasks, but To Rework tasks exist (from Linear metadata loaded in Phase 2):
  1. Filter tasks by status "To Rework" from Linear metadata
  2. Extract first "To Rework" task ID
  3. **Use Skill tool:** `Skill(skill: "ln-task-rework")` with task ID
  4. ln-task-rework loads full description and handles: To Rework → In Progress → To Review
  5. After completion: Loop back to Phase 2 (reload from Linear - AUTOMATIC, no user input)

**Priority 2: Execute Next Task (Todo → In Progress → To Review)**
- If no To Review AND no To Rework tasks, but Todo tasks exist (from Linear metadata loaded in Phase 2):
  1. Filter tasks by status "Todo" from Linear metadata
  2. Extract first "Todo" task ID and its labels (already loaded in Phase 2)
  3. **Detect task type from labels** (already in metadata - NO additional get_issue() call):
  4. **Use Skill tool based on task type:**
     - **IF label "tests":** `Skill(skill: "ln-test-executor")` with task ID
       - ln-test-executor loads full test task description (11 sections from ln-test-coordinator task plan)
       - Handles Story Finalizer test task: Todo → In Progress → To Review
     - **ELSE (implementation):** `Skill(skill: "ln-task-executor")` with task ID
       - ln-task-executor loads full implementation task description (7 sections)
       - Handles implementation task: Todo → In Progress → To Review
  5. After completion: Loop back to Phase 2 (reload from Linear - AUTOMATIC, no user input)

**Stop Condition:**
- No more To Review tasks AND no more To Rework tasks AND no more Todo tasks
- Result: All tasks either Done, In Progress, or To Rework

**Loop mechanism:**
After each skill completes → reload task metadata from Linear (Phase 2) → continue Phase 3 → process next priority (To Review > To Rework > Todo).
Exit when no tasks in these statuses → Phase 4 → Invoke ln-story-quality-coordinator Pass 1 for Story-level quality verification.

### Phase 4: Story Review & Finalization

**Trigger:** When Phase 3 exits (all tasks either Done or To Rework, no processable tasks remain)

**Goal:** Delegate Story-level quality verification to ln-story-quality-coordinator Pass 1

**Architecture:** Orchestrator-Worker Pattern - ln-story-coordinator (task orchestrator) delegates story quality to ln-story-quality-coordinator (story worker)

#### Actions

**1. Verify all implementation tasks Done:**
- Query tasks: `parentId = Story ID AND labels contains "implementation"`
- Ensure ALL implementation tasks have status = Done
- If any task NOT Done: ERROR (Phase 3 should not exit with incomplete tasks)

**2. Invoke ln-story-quality-coordinator Pass 1:**
```
Skill(skill: "ln-story-quality-coordinator")
```
- Pass Story ID as parameter
- ln-story-quality-coordinator executes 6 phases:
  - Phase 3: Regression Check (existing tests pass)
  - Phase 4: Manual Functional Testing (all AC via curl/puppeteer)
  - Phase 5: Code Quality Analysis (DRY/KISS/YAGNI/Architecture/Guides)
  - Phase 6: Verdict (Path A: create test task, Path B: create refactor task)
- ln-story-quality-coordinator returns verdict + created task IDs (if any)

**3. Process ln-story-quality-coordinator response:**

**Path A: Test task created**
- ln-story-quality-coordinator created test task (taskType: "test") via ln-test-coordinator
- Test task status = Backlog
- **Auto-verify:** Invoke ln-story-validator with Story ID and test task ID (Backlog → Todo)
- Add comment to Story: "ln-story-quality-coordinator Pass 1 completed. Test task created: [TASK_ID]. Auto-verified and moved to Todo."
- **GOTO Phase 3:** Execute test task through orchestration loop
  - Priority 2: ln-test-executor invoked (test task has label "tests")
  - Test task moves Todo → In Progress → To Review → Done
  - **After test task Done:** GOTO Phase 4 Action 4 (Auto-invoke Pass 2)

**Path B: Refactoring task created**
- ln-story-quality-coordinator found code quality issues
- Refactoring task created (taskType: "refactoring") via ln-task-creator
- Refactor task status = Backlog
- **Auto-verify:** Invoke ln-story-validator with Story ID and refactor task ID (Backlog → Todo)
- Add comment to Story: "ln-story-quality-coordinator Pass 1 completed. Refactoring task created: [TASK_ID]. Auto-verified and moved to Todo."
- **GOTO Phase 3:** Execute refactor task through orchestration loop
  - Priority 2: ln-task-executor invoked
  - Refactor task moves Todo → In Progress → To Review → Done
  - **After refactor task Done:** Return to Phase 4 Action 1 (re-invoke Pass 1)

**Path C: No tasks created**
- ln-story-quality-coordinator Pass 1 passed without creating tasks (rare case)
- All quality gates passed:
  - Code Quality: PASS
  - Regression: PASS
  - Manual Testing: PASS (all AC)
  - Test task already exists and Done
- Story quality verified
- **GOTO Action 4:** Invoke Pass 2 (explicit delegation)

**4. Invoke ln-story-quality-coordinator Pass 2 (explicit delegation):**

**Trigger:** Test task Done (from Path A) OR Path C (test task already Done)
**Rationale:** Explicit Skill call delegation (orchestrator→orchestrator via Skill tool), NOT auto-invocation

**Actions:**
1. Update Story status: In Progress → To Review
2. Update kanban_board.md: Move Story from "In Progress" to "To Review"
3. Invoke ln-story-quality-coordinator Pass 2:
   ```
   Skill(skill: "ln-story-quality-coordinator")
   ```
4. ln-story-quality-coordinator Pass 2 executes:
   - Phase 1: Prerequisites check (test task Done)
   - Phase 2: Test verification (E2E 2-5, Integration 3-8, Unit 5-15, total 10-28, Priority ≥15)
   - Phase 3: Verdict
     * **Pass:** Story status To Review → Done, kanban_board.md updated
     * **Fail:** Create fix tasks, Story remains To Review
5. After Pass 2 completes:
   - **If Pass:** Story Done, workflow complete
   - **If Fail:** Fix tasks created in Backlog → GOTO Phase 3 (auto-verify and execute fixes)

#### Result

**When ln-story-quality-coordinator Pass 2 passes:**
- Story status: Done
- kanban_board.md: Story in "Done" section
- All tasks Done
- **Workflow complete**

**Output:**
- "ln-story-coordinator completed successfully"
- "Story [ID] status: Done"
- "All tasks completed and verified"

**Note:** ln-story-coordinator now runs FULL pipeline automatically (Todo → In Progress → To Review → Done)

---

### Story Status Responsibility Matrix

**ln-story-coordinator responsibility**: Manages **2 of 4** Story status transitions (Task execution phase).

| Story Status Transition | Responsible Skill | When |
|-------------------------|-------------------|------|
| Backlog → Todo | ln-story-validator | After auto-fix and approval |
| **Todo → In Progress** | **ln-story-coordinator** | **First task execution starts (Phase 3 Priority 2)** |
| **In Progress → To Review** | **ln-story-coordinator** | **All tasks Done (Phase 4 transition)** |
| To Review → Done | ln-story-quality-coordinator Pass 2 | All tests verified, Priority ≥15 covered |

**ln-story-coordinator transitions (details):**

1. **Todo → In Progress** (Phase 3 Priority 2, first task execution):
   - Update Story status via Linear MCP
   - Add comment: "Story execution started"
   - Update kanban_board.md: Move Epic section to "### In Progress"

2. **In Progress → To Review** (Phase 4 Action 4, all tasks Done):
   - Update Story status via Linear MCP
   - Add comment: "All tasks completed. Story ready for final review."
   - Update kanban_board.md: Move Epic section to "### To Review"
   - Invoke ln-story-quality-coordinator Pass 2

**Note:** ln-story-coordinator does NOT update To Review → Done (ln-story-quality-coordinator Pass 2 responsibility)

### L2→L2 Delegation: ln-story-quality-coordinator

**Pattern:** Level 2 orchestrator → Level 2 orchestrator delegation (see SKILL_ARCHITECTURE_GUIDE.md L2→L2 Rules)

| Delegation | When | Domain Separation | Rationale |
|------------|------|-------------------|-----------|
| **ln-story-coordinator → ln-story-quality-coordinator Pass 1** | Phase 4: All implementation tasks Done | Task execution → Story quality validation | Delegate quality verification (Code Quality, Regression, Manual Testing) to specialized orchestrator |
| **ln-story-coordinator → ln-story-quality-coordinator Pass 2** | Phase 4 Action 4: Test task Done | Task execution → Final approval | Delegate final Story approval (test verification, Priority ≥15 coverage) to specialized orchestrator |

**Why L2→L2 (not L2→L3):**
- ln-story-quality-coordinator is orchestrator (invokes ln-test-coordinator, ln-task-creator, ln-manual-tester)
- Separates task execution (ln-story-coordinator) from quality validation (ln-story-quality-coordinator)
- Enables Self-Healing Pipeline: quality-coordinator creates fix/refactor/test tasks → loops back to ln-story-coordinator Phase 3

**Compliance with L2→L2 Rules:**
- ✅ Rule 1: Explicit Skill tool invocation (`Skill(skill: "ln-story-quality-coordinator")`)
- ✅ Rule 2: Sequential flow (Pass 1 completes → tasks executed → Pass 2 starts)
- ✅ Rule 3: Domain separation (task orchestration vs quality validation)
- ✅ Rule 4: DAG only (no cycles - quality-coordinator never calls back to story-coordinator)
- ✅ Rule 5: Documented in both SKILL.md files

**Industry Precedent:** AWS Step Functions Nested Workflows - orchestrator state machine invokes another state machine for specialized processing

---

### Progress Reporting

**After each Phase 3 task completes:**
- "Task [TASK_ID] Done (X/Y tasks completed)"

**After each Phase 3 cycle:**
- Display updated task summary (To Review: X, To Rework: Y, Todo: Z, Done: W)

**After Phase 4 (ln-story-quality-coordinator Pass 1) completes:**
- "ln-story-quality-coordinator Pass 1 completed: [VERDICT]"
- If tasks created: "Fix/refactor/test task created. Looping back to Phase 3."
- If no tasks: "All quality gates passed. Story ready for Pass 2."

**Final output:**
- Summary of all tasks completed (implementation + refactor + test)
- ln-story-quality-coordinator Pass 1 verdict
- Story status remains In Progress (awaiting Pass 2)

## Technical Details

### Error Handling

**If skill invocation fails:**
- Log error details
- Stop loop (don't proceed to next task)
- Report to user: "Task [ID] failed during [skill]. Check Linear for details."
- User must resolve issue manually before re-running ln-story-coordinator

**If task stuck In Progress:**
- Detect: Task status = In Progress for >24 hours
- Report warning: "Task [ID] stuck In Progress. Manual intervention needed."
- Continue loop (don't block other tasks)

**If Story has no tasks:**
- Report: "Story [ID] has no tasks. Cannot execute."
- Recommend: "Create tasks using ln-story-manager or ln-task-coordinator"

### Comparison with Other Skills

| Aspect | ln-story-coordinator | ln-task-executor | ln-task-reviewer | ln-story-quality-coordinator |
|--------|----------------|----------------|-------------|--------------|
| **Level** | Story | Task | Task | Story |
| **Role** | Orchestrator | Worker (impl/test) | Reviewer | Story reviewer |
| **Scope** | All Story tasks | One task (any type) | One task | Story + all tasks |
| **Invokes** | ln-task-reviewer, ln-task-rework, ln-task-executor, ln-test-executor, ln-story-quality-coordinator (via Skill tool) | None | None | ln-test-coordinator, ln-task-creator, ln-task-replanner (via Skill tool) |
| **Status** | Todo → In Progress → To Review | Todo → In Progress → To Review | To Review → Done/Rework | Manual testing + Story Done |
| **When** | User wants to execute entire Story | ln-story-coordinator calls via Skill tool OR user directly | ln-story-coordinator calls via Skill tool OR user directly | ln-story-coordinator calls Pass 1 automatically |

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
- [ ] Story metadata fetched from Linear (ID, title, status, labels - NO description)
- [ ] Story.id (UUID) extracted from metadata object
- [ ] Child Tasks loaded from Linear via `list_issues(parentId=Story.id)` (metadata only - NO descriptions)
- [ ] **CRITICAL:** ZERO `get_issue()` calls for individual Tasks - use `list_issues()` for bulk metadata loading
- [ ] Task summary displayed with counts by status

**✅ Orchestration Loop Executed (Phase 3):**
- [ ] **Priority 0:** All To Review tasks processed via ln-task-reviewer
- [ ] **Priority 1:** All To Rework tasks processed via ln-task-rework
- [ ] **Priority 2:** All Todo tasks processed via executors:
  - [ ] Test tasks (label "tests") → ln-test-executor
  - [ ] Implementation tasks → ln-task-executor
- [ ] **Stop Condition:** No more To Review AND To Rework AND Todo tasks
- [ ] All tasks in final state: Done, In Progress, or To Rework

**✅ Story Quality Verification (Phase 4):**
- [ ] If first task started: Story status updated Todo → In Progress
- [ ] ln-story-quality-coordinator Pass 1 invoked automatically via Skill tool
- [ ] If ln-story-quality-coordinator creates tasks (test/refactor/fix):
  - [ ] Auto-verify via ln-story-validator (Backlog → Todo)
  - [ ] Loop back to Phase 3
- [ ] If test task Done: Story status updated In Progress → To Review
- [ ] ln-story-quality-coordinator Pass 2 invoked automatically via Skill tool
- [ ] If Pass 2 passes: Story status updated To Review → Done
- [ ] If Pass 2 fails: Fix tasks created → Loop back to Phase 3

**✅ Progress Reported:**
- [ ] Task completion messages displayed after each task
- [ ] Updated task summary displayed after each cycle
- [ ] Final report with next step recommendation

**✅ Error Handling Applied (if errors occurred):**
- [ ] Skill invocation failures logged and loop stopped
- [ ] Tasks stuck In Progress detected and reported
- [ ] Stories without tasks handled with recommendations

**Output:**
- Story status: Todo → In Progress → To Review → Done (full automation)
- All tasks: Done (implementation + test + fix/refactor if needed)
- ln-story-quality-coordinator Pass 1: Invoked automatically
- ln-story-quality-coordinator Pass 2: Invoked automatically
- Story lifecycle complete
- Progress report with task summary

---

**Version:** 6.0.0 (BREAKING: Removed Priority 0 Backlog verification - ln-story-validator now handles all Backlog tasks. Simplified orchestration to 3 priorities: To Review (0) > To Rework (1) > Todo (2). Maintains auto-invocation of ln-story-quality-coordinator Pass 2 after test task Done.)
**Last Updated:** 2025-11-14

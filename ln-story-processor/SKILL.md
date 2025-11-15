---
name: ln-story-processor
description: Orchestrates complete Story workflow from task planning to Done. Delegates to ln-task-coordinator, ln-story-validator, ln-story-coordinator for full automation.
---

# Linear Story Processor (Orchestrator)

Orchestrate complete Story processing workflow from task planning through verification, execution, and review. This skill coordinates existing Story lifecycle using specialized workers.

## Overview

### What This Skill Does

Coordinates the complete processing pipeline for an existing Story:
- Auto-discovers Team ID from kanban_board.md
- Loads Story metadata ONLY (ID, title, status, labels - NO description)
- **Phase 1:** Discovery (Team ID + Story ID)
- **Phase 2:** Task Planning (delegates to ln-task-coordinator)
- **Phase 3:** Verification & Execution Loop (ln-story-validator prepares tasks, ln-story-coordinator executes them, explicit delegation to ln-story-quality-coordinator Pass 1 + Pass 2)
- **Phase 4:** Completion Report (Story Done automatically, full pipeline automation)

### When to Use This Skill

Use this skill when:
- Process existing Story from planning to completion
- Automate full Story pipeline (tasks → verify → execute → review)
- Story already exists in Linear (e.g., US001, API-53)
- Need end-to-end orchestration without manual intervention

**Prerequisites:**
- Story exists in Linear
- Story has Acceptance Criteria defined
- Requirements are clear

### When NOT to Use

Do NOT use if:
- Story doesn't exist → Use ln-story-manager first to create Story
- Only need task planning → Use ln-task-coordinator directly
- Only need execution → Use ln-story-coordinator directly
- Story is vague (no AC) → Refine Story first

---

## Core Concepts

### Orchestrator Pattern

**ln-story-processor is a pure coordinator** - it does NOT execute work directly:
- ✅ Discovers context (Team ID, Story ID)
- ✅ Loads Story metadata ONLY (no full description)
- ✅ Makes routing decisions (which worker to invoke)
- ✅ Delegates all work via Skill tool
- ✅ Manages workflow state transitions
- ❌ Does NOT generate documents (workers do this)
- ❌ Does NOT create/update Linear issues (workers do this)
- ❌ Does NOT execute tasks (workers do this)

**Workers**:
- **ln-task-coordinator**: Plans and creates/replans tasks (1-6 implementation tasks)
- **ln-story-validator**: Verifies Story + Tasks against industry standards, auto-fixes, approves (Backlog → Todo)
- **ln-story-coordinator**: Executes all tasks through their workflow (Todo → In Progress → To Review → Done)
- **ln-story-quality-coordinator**: Reviews completed Story (Pass 1: manual testing + test task creation, Pass 2: final verification → Done)

### Workflow Pattern: Looping Orchestrator

**Pattern**: Orchestrator reloads metadata after each worker completes, then re-evaluates state.

**Flow**:
`
Phase 1: Discovery → Phase 2: Task Planning (ln-task-coordinator) →
Phase 3: Loop (Verify → Execute → Review Pass 1 + explicit Pass 2 delegation) →
[If new task created] → Step 3a revalidates Backlog tasks (ln-story-validator) → Step 3b executes them (ln-story-coordinator) →
[All tasks Done + test task Done] → explicit Pass 2 delegation → Story Done → Phase 4: Report
`

**Key Principle**: After each worker, reload Story + Tasks metadata (NOT full descriptions) and decide next step.

### Auto-Discovery

**Team ID**: Auto-discovered from `docs/tasks/kanban_board.md` Linear Configuration table (see CLAUDE.md "Configuration Auto-Discovery").

**Story ID**: Parsed from request: "for US001" or "for API-53" or "process US001"

---

## Workflow

### Phase 1: Discovery (Automated)

Auto-discovers Team ID from `docs/tasks/kanban_board.md`.

Parses request for:
- **Story ID**: "for US001" or "process API-53"

**Validation**:
- Team ID exists in kanban_board.md
- Story ID format valid (e.g., US001, API-53)

Load Story metadata ONLY:
```
Story {
  id: string,
  title: string,
  status: string (Backlog | Todo | In Progress | To Review | Done),
  labels: string[]
}
```

**NO full description loaded** - token efficiency.

### Phase 2: Task Planning

**Check**: Does Story have tasks?

Query Linear: `list_issues(parentId=Story.id)`

**Decision**:
- **ALWAYS** delegate to ln-task-coordinator (Decompose-First Pattern)
- ln-task-coordinator will build IDEAL plan and choose CREATE (count=0) or REPLAN (count≥1) mode automatically
- Rationale: Stories with ≥3 tasks MUST be replanned if AC changed (current logic skips replan)

**Invocation**:
```
🔄 [PROCESSOR] Phase 2: Delegating task planning to ln-task-coordinator

Skill(skill: "ln-task-coordinator", context: {
  storyId: Story.id,
  teamId: teamId
})
```

**ln-task-coordinator will**:
- Analyze Story (AC, Technical Notes)
- Build IDEAL task plan (1-6 tasks, Consumer-First ordered)
- Create or replan tasks in Linear
- Update kanban_board.md
- Return: Task URLs + summary

**After completion**: Reload Story + Tasks metadata.

### Phase 3: Story Verification & Execution Loop

This phase loops until Story status = "To Review".

#### Step 3a: Story Verification

**Trigger**: Story status = "Backlog" OR Tasks exist but not verified

Delegate to ln-story-validator:
```
🔄 [PROCESSOR] Phase 3a: Delegating verification to ln-story-validator

Skill(skill: "ln-story-validator", context: {
  storyId: Story.id,
  teamId: teamId
})
```

**ln-story-validator will**:
- Load Story + Tasks descriptions (sequential, one by one)
- Auto-fix all 14 verification criteria
- Auto-approve (Backlog → Todo)
- Update Story + Tasks status in Linear
- Return: Summary (changes, guides, warnings)

**After completion**: Reload Story + Tasks metadata.

#### Step 3b: Story Execution

**Trigger**: Story status = "Todo" OR "In Progress"

Delegate to ln-story-coordinator:
```
🔄 [PROCESSOR] Phase 3b: Delegating execution to ln-story-coordinator

Skill(skill: "ln-story-coordinator", context: {
  storyId: Story.id,
  teamId: teamId
})
```

**ln-story-coordinator will**:
- Orchestrate task execution with strict priorities: Priority 0 = To Review (ln-task-reviewer), Priority 1 = To Rework (ln-task-rework), Priority 2 = Todo (ln-task-executor / ln-test-executor)
- Rely on Step 3a to move any fix/refactor/test tasks from Backlog to Todo before picking them up (new work always re-enters through ln-story-validator)
- Invoke ln-task-reviewer, ln-task-rework, ln-task-executor, ln-test-executor
- When all tasks Done → Explicitly delegate to ln-story-quality-coordinator Pass 1 (via Skill tool)
- When test task Done → Explicitly delegate to ln-story-quality-coordinator Pass 2 (via Skill tool) → Story Done
- Return: Execution summary

**After completion**: Reload Story + Tasks metadata.

#### Step 3c: Story Review Pass 1 + Pass 2 (Explicitly Delegated by ln-story-coordinator)

**Trigger**: ln-story-coordinator explicitly delegates to ln-story-quality-coordinator Pass 1 when all implementation tasks Done

**ln-story-quality-coordinator Pass 1 will** (Early Exit Pattern):
- Phase 3: Code Quality Analysis (if fail → create refactoring task → Step 3a re-approves Backlog → Todo → Loop back to Step 3b)
- Phase 4: Regression Check (if fail → create fix task → Step 3a re-approves Backlog → Todo → Loop back to Step 3b)
- Phase 5: Manual Testing (if fail → create fix task → Step 3a re-approves Backlog → Todo → Loop back to Step 3b)
- Phase 6: Verdict
  * **Path A**: All passed → Create test task (via ln-test-coordinator) → Step 3a revalidates Backlog → Todo → Loop back to Step 3b
  * **Path B**: Issues found → Step 3a revalidates Backlog → Todo → Loop back to Step 3b

**ln-story-quality-coordinator Pass 2 explicit delegation**:
- **Trigger**: ln-story-coordinator detects test task Done → Updates Story status In Progress → To Review → Explicitly delegates Pass 2 (via Skill tool)
- **Pass 2 will**: Verify tests (E2E 2-5, Integration 3-8, Unit 5-15, Priority ≥15) → Story To Review → Done

**Loop Condition**: If new task created (fix/refactoring/test), Phase 3 restarts from Step 3a so ln-story-validator approves Backlog → Todo before ln-story-coordinator executes again.

**Exit Condition**: Story status = "Done" (all tasks Done, test task Done, Pass 2 passed)

### Phase 4: Completion Report

**Trigger**: Story status = "Done" (all tasks Done, test task Done, Pass 2 passed automatically)

```
🔄 [PROCESSOR] Phase 4: Story processing complete

Story Status: Done
All Tasks: Done
Pipeline: Todo → In Progress → To Review → Done (fully automated)
Summary:
  - Implementation tasks: Completed
  - Code Quality → Regression → Manual Testing: Passed
  - Test task: Completed (E2E 2-5, Integration 3-8, Unit 5-15, Priority ≥15)
  - Pass 2: Verified and approved

Story successfully processed from planning to Done without manual intervention.
```

**Result**: Story fully automated from task planning to Done status.

---

## Critical Rules

### 1. Metadata-Only Loading

**HARD RULE**: Orchestrator loads ONLY Story + Tasks metadata (ID, title, status, labels).

**NO full descriptions loaded**:
- Prevents token waste
- Scales to Stories with many tasks
- Workers load full descriptions when needed

### 2. Strict Delegation

**Orchestrator responsibilities**:
- ✅ Discovery (Team ID, Story ID)
- ✅ Metadata loading (ID, title, status, labels)
- ✅ Routing decisions (which worker to invoke)
- ✅ Workflow state management

**Worker responsibilities** (NOT orchestrator):
- ❌ Generating documents → Workers
- ❌ Loading full descriptions → Workers
- ❌ Creating/updating Linear issues → Workers
- ❌ Executing tasks → Workers
- ❌ Running tests → Workers

### 3. Story Status Responsibility Matrix

**HARD RULE**: Only designated skills can update Story status. Clear ownership prevents conflicts.

| Story Status Transition | Responsible Skill | When |
|-------------------------|-------------------|------|
| **Backlog → Todo** | ln-story-validator | After auto-fix and approval (Phase 3a) |
| **Todo → In Progress** | ln-story-coordinator | First task execution starts (Phase 3b Priority 3) |
| **In Progress → To Review** | ln-story-coordinator | All tasks Done (Phase 3b → Phase 4 transition) |
| **To Review → Done** | ln-story-quality-coordinator Pass 2 | All tests verified, Priority ≥15 covered (Phase 4 Pass 2) |

**Why this matters**:
- Prevents duplicate updates from multiple skills
- Clear audit trail: each transition has ONE owner
- ln-story-processor orchestrates but does NOT update status directly

### 4. Loop After Each Worker

**Pattern**: After each worker completes, orchestrator:
1. Reloads Story + Tasks metadata
2. Re-evaluates state
3. Decides: next worker OR loop back OR complete

**Example**:
```
ln-story-coordinator completes → Reload metadata → Check Story status
  - Story status = "In Progress" → Loop back to Step 3b (ln-story-coordinator)
  - Story status = "To Review" → Phase 4 (report completion)
```

### 4. Full Pipeline Automation

**Automation Principle**: Orchestrator runs entire pipeline without user prompts (full automation from task planning to Story Done).

**Workers handle prompts**:
- ln-task-coordinator: Shows preview, waits for "confirm"
- ln-story-validator: Shows summary, auto-approves
- ln-story-coordinator: Orchestrates without prompts (workers may prompt), auto-invokes Pass 1 + Pass 2

**Full Automation**: No manual intervention required. Story lifecycle fully automated: Todo → In Progress → To Review → Done.

---

## Definition of Done

Before completing work, verify ALL checkpoints:

**✅ Team ID Discovered (Phase 1):**
- [ ] Team ID loaded from kanban_board.md OR requested from user
- [ ] Story ID parsed from request
- [ ] Story metadata loaded (ID, title, status, labels - NO description)

**✅ Task Planning Completed (Phase 2):**
- [ ] Checked if tasks exist (count ≥ 0)
- [ ] Delegated to ln-task-coordinator to build the IDEAL plan and choose CREATE or REPLAN mode
- [ ] Reloaded metadata after ln-task-coordinator completed

**✅ Verification & Execution Loop (Phase 3):**
- [ ] Delegated to ln-story-validator (Story Backlog → Todo)
- [ ] Delegated to ln-story-coordinator (orchestrates task execution with To Review → To Rework → Todo priorities)
- [ ] New fix/refactor/test tasks routed back through Step 3a (ln-story-validator) before execution
- [ ] ln-story-coordinator auto-invoked ln-story-quality-coordinator Pass 1 (Code Quality → Regression → Manual Testing)
- [ ] Pass 1 created test task (ln-story-validator re-approved it before execution)
- [ ] ln-story-coordinator executed test task
- [ ] ln-story-coordinator auto-invoked ln-story-quality-coordinator Pass 2 after test task Done
- [ ] Pass 2 verified tests (E2E 2-5, Integration 3-8, Unit 5-15, Priority ≥15)
- [ ] Pass 2 updated Story status: To Review → Done
- [ ] Loop completed: Story status = "Done"

**✅ Completion Report (Phase 4):**
- [ ] Story status = "Done"
- [ ] All tasks Done
- [ ] Full pipeline automation confirmed: Todo → In Progress → To Review → Done
- [ ] Reported to user: "Story successfully processed from planning to Done without manual intervention"

**Output**: Story fully automated from task planning to Done status (no manual intervention).

---

## Integration with Ecosystem

### Called By

Users directly: "Process US001" or "Run full pipeline for API-53"

### Calls (via Skill tool)

- **ln-task-coordinator**: Task planning (Phase 2)
- **ln-story-validator**: Story verification (Phase 3a)
- **ln-story-coordinator**: Story execution (Phase 3b)
  - ln-story-coordinator auto-invokes ln-story-quality-coordinator Pass 1 (Phase 3c)

### Next Steps

After ln-story-processor completes:
- **Story Done**: No further action required. Story fully automated from task planning to Done status.
- **Full Pipeline Automation**: Todo → In Progress → To Review → Done (no manual intervention)

---

## Best Practices

### Orchestrator Responsibilities

**DO**:
- ✅ Load Story + Tasks metadata ONLY
- ✅ Make routing decisions
- ✅ Delegate to workers
- ✅ Reload metadata after each worker
- ✅ Manage loop logic

**DON'T**:
- ❌ Load full descriptions (workers do this)
- ❌ Generate documents (workers do this)
- ❌ Create/update Linear issues (workers do this)
- ❌ Execute tasks (workers do this)
- ❌ Prompt user mid-pipeline (workers do this)

### Worker Communication

**Context Propagation**: Pass minimal context to workers (Team ID, Story ID only). Workers discover full data themselves.

**Trust Worker Results**: Workers return summary, orchestrator doesn't re-verify.

**Error Handling**: If worker returns error, report to user and stop pipeline.

### Loop Management

**Reload After Worker**: Always reload Story + Tasks metadata after worker completes.

**Exit Condition**: Loop exits when Story status = "To Review" AND all tasks Done.

**Infinite Loop Protection**: Max 10 iterations per loop (safety net). If exceeded, report to user.

---

## Quick Examples

### Example 1: New Story (No Tasks)

**Request**: "Process US001: Implement OAuth token authentication"

**Execution**:
- Phase 1: Team ID discovered, Story ID = US001, Status = Backlog
- Phase 2: No tasks → Invoke ln-task-coordinator
  - ln-task-coordinator: Analyze Story (5 AC), create 3 tasks (Token generation 4h, Validation middleware 3h, Refresh logic 5h)
  - Reload metadata: Story has 3 tasks
- Phase 3a: Invoke ln-story-validator
  - ln-story-validator: Auto-fix + approve (Backlog → Todo)
  - Reload metadata: Story status = Todo
- Phase 3b: Invoke ln-story-coordinator
  - ln-story-coordinator: Execute 3 tasks (Priority 3: Todo)
  - ln-story-coordinator: Auto-invoke ln-story-quality-coordinator Pass 1
  - Pass 1: Code Quality → Regression → Manual Testing → All passed → Create test task
  - Step 3a: ln-story-validator re-approved test task (Backlog → Todo)
  - Reload metadata: Story has 4 tasks (1 test task in Todo)
- Phase 3b (Loop): ln-story-coordinator continues
  - ln-story-coordinator: Execute test task (Priority 3)
  - Test task Done
  - ln-story-coordinator: Update Story In Progress → To Review
  - ln-story-coordinator: Auto-invoke ln-story-quality-coordinator Pass 2
  - Pass 2: Verify tests (E2E 2-5, Integration 3-8, Unit 5-15, Priority ≥15) → Pass
  - Pass 2: Update Story To Review → Done
  - Reload metadata: Story status = Done, all tasks Done
- Phase 4: Report "Story successfully processed from planning to Done without manual intervention"

**Result**: Story fully automated from Backlog to Done (no manual intervention).

### Example 2: Existing Story (Tasks Already Exist)

**Request**: "Process US005" (Story already has 4 tasks)

**Execution**:
- Phase 1: Team ID discovered, Story ID = US005, Status = Todo
- Phase 2: 4 tasks exist (count ≥ 3) → Skip task planning
- Phase 3a: Invoke ln-story-validator
  - ln-story-validator: Auto-fix + approve (already Todo, validate tasks)
  - Reload metadata: Story status = Todo
- Phase 3b: Invoke ln-story-coordinator
  - ln-story-coordinator: Execute 4 tasks (Priority 3: Todo)
  - ln-story-coordinator: Auto-invoke ln-story-quality-coordinator Pass 1
  - Pass 1: Code Quality → Regression → Manual Testing → All passed → Create test task
  - ln-story-coordinator Priority 0: Auto-verify test task (Backlog → Todo)
  - Reload metadata: Story has 5 tasks (1 test task in Todo)
- Phase 3b (Loop): ln-story-coordinator continues
  - ln-story-coordinator: Execute test task (Priority 3)
  - Test task Done
  - ln-story-coordinator: Update Story In Progress → To Review
  - ln-story-coordinator: Auto-invoke ln-story-quality-coordinator Pass 2
  - Pass 2: Verify tests (E2E 2-5, Integration 3-8, Unit 5-15, Priority ≥15) → Pass
  - Pass 2: Update Story To Review → Done
  - Reload metadata: Story status = Done, all tasks Done
- Phase 4: Report "Story successfully processed from planning to Done without manual intervention"

**Result**: Story fully automated from Todo to Done (no manual intervention).

---

## Chat Output Prefix

Use emoji prefix for visual differentiation:
- 🔄 [PROCESSOR] - ln-story-processor (orchestrator)

**Purpose**: Helps users track orchestrator progress when multiple workers are invoked.

---

**Version:** 2.0.0 (BREAKING: Removed < 3 tasks condition - ln-task-coordinator ALWAYS invoked following Decompose-First Pattern. Added Story Status Responsibility Matrix showing 4 status transitions and ownership across 3 skills.)
**Last Updated:** 2025-11-14

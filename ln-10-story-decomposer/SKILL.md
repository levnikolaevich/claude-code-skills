---
name: ln-10-story-decomposer
description: Orchestrates task operations. Analyzes Story, builds optimal plan (1-6 tasks), delegates to ln-11-task-creator (CREATE) or ln-12-task-replanner (REPLAN). Auto-discovers team ID.
---

# Linear Task Planner (Orchestrator)

Orchestrator for User Story task operations. Analyzes Story requirements, builds optimal task decomposition plan, and delegates execution to specialized workers.

## Overview

### What This Skill Does

Coordinates task creation and replanning for User Stories:
- Auto-discovers Team ID from kanban_board.md
- Loads Story from Linear (AC, Technical Notes, Context)
- Analyzes Story complexity (simple/medium/complex)
- Builds OPTIMAL task plan (1-6 tasks, Consumer-First ordered)
- Extracts guide links from Story Technical Notes
- Checks existing tasks in Linear
- **Delegates to workers**:
  - No tasks (count = 0) → Invokes **ln-11-task-creator** (CREATE MODE)
  - Has tasks (count ≥ 1) → Invokes **ln-12-task-replanner** (REPLAN MODE)

### When to Use This Skill

Use this skill when:
- Create implementation tasks for a User Story
- Replan tasks when Story requirements change (AC updated, technical approach changed)
- Automatically decompose Story into optimal task count (1-6 based on complexity)

**Prerequisites:**
- Story exists in Linear (e.g., US001, API-53)
- Story has AC (Acceptance Criteria) and Technical Notes defined
- Requirements are clear

**NOT for test tasks** - use ln-50-story-test-planner for Story's final test task after manual testing.

### When NOT to Use

Do NOT use if:
- Story doesn't exist → Use ln-71-story-manager first to create Story
- Need to create test tasks → Use ln-50-story-test-planner after manual testing
- Story is vague (no AC) → Refine Story first
- Task is trivial (< 1 hour) → Create directly in Linear manually

---

## Core Concepts

### Orchestrator Pattern

**ln-10-story-decomposer is a coordinator** - it does NOT execute work directly:
- ✅ Analyzes Story and builds IDEAL task plan
- ✅ Makes routing decisions (CREATE or REPLAN mode)
- ✅ Delegates execution to workers via Skill tool
- ❌ Does NOT generate task documents (workers do this)
- ❌ Does NOT create/update in Linear (workers do this)
- ❌ Does NOT update kanban_board.md (workers do this)

**Workers**:
- **ln-11-task-creator**: Creates new tasks from IDEAL plan (CREATE MODE)
- **ln-12-task-replanner**: Updates existing tasks when requirements change (REPLAN MODE)

### Decompose-First Pattern

**Key Principle**: ALWAYS analyze Story and build OPTIMAL task plan FIRST (Phase 2), independent of current state. Then check existing tasks (Phase 3) and delegate.

This ensures consistent decomposition logic regardless of whether tasks exist or not.

**Flow**:
1. Load Story metadata (AC, Technical Notes)
2. Build IDEAL task plan "in mind" (1-6 tasks)
3. THEN query Linear for existing tasks
4. Delegate: count = 0 → ln-11-task-creator, count ≥ 1 → ln-12-task-replanner

### Consumer-First Ordering

**Principle**: Consumers developed before providers. Outer layers before inner layers.

**Order**: API endpoint → Service → Repository → Database

Applied automatically in Phase 2 when building IDEAL task plan.

### Task Structure (7 Sections)

Every implementation task follows this template:

1. **Context**: Current state + Desired state + Story link
2. **Implementation Plan**: 3 phases with checkboxes
3. **Technical Approach**: KISS/YAGNI principles + guide links + architecture patterns
4. **Acceptance Criteria**: 3-5 Given-When-Then scenarios from Story AC
5. **Affected Components**: Implementation files + Documentation files
6. **Existing Code Impact**: Refactoring needed + Tests to update + Docs to update
7. **Definition of Done**: Completion checklist

See [task_template_implementation.md](../ln-11-task-creator/references/task_template_implementation.md) for detailed template (owned by ln-11-task-creator universal factory).

### Auto-Discovery

**Team ID**: Auto-discovered from `docs/tasks/kanban_board.md` Linear Configuration table (see CLAUDE.md "Configuration Auto-Discovery").

**Story ID**: Parsed from request: "for US001" or "for API-53"

**Guide Links**: Extracted from Story Technical Notes "Related Guides:" section and passed to workers.

---

## Workflow

### Phase 1: Discovery (Automated)

Auto-discovers Team ID from `docs/tasks/kanban_board.md`.

Parses request for:
- **Story ID**: "for US001" or "for API-53"
- **Requirements**: New or updated AC, technical approach changes

### Phase 2: Analyze & Decompose (ALWAYS)

**This phase runs BEFORE checking existing tasks.**

**Steps**:

1. **Load Story from Linear**:
   - Story statement (As a/I want/So that)
   - Context (Current/Desired situation)
   - Acceptance Criteria (all Given-When-Then scenarios)
   - Technical Notes (integrations, patterns, guide links)
   - Implementation Tasks list (existing task references)

2. **Analyze Story Complexity**:
   - Count AC scenarios (1-2 → simple, 3-4 → medium, 5+ → complex)
   - Identify technical components (API, Service, Repository, Database)
   - Check integrations (external APIs, services)
   - Review Technical Notes for constraints

3. **Build OPTIMAL Task Plan** "in mind":
   - **Simple Story** (1-2 AC, single endpoint): 1 task (3-5 hours)
   - **Medium Story** (3-4 AC, multiple layers): 2-3 tasks (6-15 hours)
   - **Complex Story** (5+ AC, multiple integrations): 3-6 tasks (12-30 hours)
   - **Max 6 tasks per Story** (enforced)

4. **Apply Consumer-First Ordering**:
   - API endpoint → Service → Repository → Database
   - Consumers developed before providers

5. **Extract Guide Links**:
   - Read Story Technical Notes "Related Guides:" section
   - Parse guide links to pass to workers

6. **Result: IDEAL Task Structure**:
   ```
   IDEAL TASK PLAN (N tasks):
   1. Task Title (AC#, AC#) - Xh
   2. Task Title (AC#, AC#) - Xh
   3. Task Title (AC#) - Xh

   Consumer-First order: ✓
   Total estimate: Xh
   Guide links: [path/to/guide.md, ...]
   ```

### Phase 3: Check Existing Tasks

Query Linear: `list_issues(parentId=Story.id)`

**Decision**:
- **Count = 0** → **CREATE MODE** (Phase 4a: Delegate to ln-11-task-creator)
- **Count ≥ 1** → **REPLAN MODE** (Phase 4b: Delegate to ln-12-task-replanner)

### Phase 4a: Delegate to ln-11-task-creator (if Count = 0)

No existing tasks found. Delegate to ln-11-task-creator worker.

**Invocation**:
```
Skill(skill: "ln-11-task-creator", {
  taskType: "implementation",
  teamId: teamId,
  storyData: {
    id: Story.id,
    title: Story.title,
    description: Story.description,
    ac: Story.acceptanceCriteria,
    technicalNotes: Story.technicalNotes,
    context: Story.context
  },
  idealPlan: IDEAL_TASK_PLAN,
  guideLinks: extractedGuideLinks,
  autoApprove: true  // Skip user confirmation in automation mode
})
```

**Worker responsibilities**:
- Input: taskType + storyData + idealPlan + guideLinks, autoApprove: true
- Output: Task URLs + summary
- Details: See [ln-11-task-creator/SKILL.md](../ln-11-task-creator/SKILL.md)

### Phase 4b: Delegate to ln-12-task-replanner (if Count ≥ 1)

Existing tasks found. Delegate to ln-12-task-replanner worker.

**Invocation**:
```
Skill(skill: "ln-12-task-replanner", {
  taskType: "implementation",
  teamId: teamId,
  storyData: {
    id: Story.id,
    title: Story.title,
    description: Story.description,
    ac: Story.acceptanceCriteria,
    technicalNotes: Story.technicalNotes,
    context: Story.context
  },
  idealPlan: IDEAL_TASK_PLAN,
  guideLinks: extractedGuideLinks,
  existingTaskIds: existingTaskIds,
  autoApprove: true  // Skip user confirmation in automation mode
})
```

**Worker responsibilities**:
- Input: taskType + storyData + idealPlan + guideLinks + existingTaskIds, autoApprove: true
- Output: Operations summary + URLs + warnings
- Details: See [ln-12-task-replanner/SKILL.md](../ln-12-task-replanner/SKILL.md)

### Phase 5: Post-Execution

**Verify worker completed successfully**:
- ln-11-task-creator: Tasks created in Linear + kanban_board.md updated
- ln-12-task-replanner: Operations executed + kanban_board.md updated

**Return to user**:
- CREATE MODE: "N tasks created. Linear URLs: [...]"
- REPLAN MODE: "Operations executed. X kept, X updated, X canceled, X created."

**Next Steps**:
- ln-20-story-validator: Verify Story + Tasks before approval (Backlog → Todo, adds ✅ APPROVED)

---

## Critical Rules

### 1. NO Test Creation in Implementation Tasks

**HARD RULE**: Implementation tasks MUST NOT include new test creation.

**Enforced by workers** (ln-11-task-creator and ln-12-task-replanner validate):
- Scan for: "write tests", "create tests", "add tests", "unit tests", "E2E tests", "integration tests"
- ERROR if detected → Stop execution

**Why**: All new tests (E2E/Integration/Unit) are created in Story's final test task by ln-50-story-test-planner AFTER manual testing passes.

### 2. Task Size Limits

**Optimal task size**: 3-5 hours (fits in 1-2 work sessions)

**Max tasks per Story**: 6 tasks (12-30 hours total)

**Automatic decomposition by complexity**:
- Simple (1-2 AC) → 1 task (3-5h)
- Medium (3-4 AC) → 2-3 tasks (6-15h)
- Complex (5+ AC) → 3-6 tasks (12-30h)

### 3. Orchestrator Does NOT Load Task Descriptions

**Token Efficiency**: Orchestrator loads only task IDs (Phase 3), NOT full descriptions.

**Workers load full descriptions**:
- ln-11-task-creator: Generates new descriptions (doesn't need to load)
- ln-12-task-replanner: Loads existing task descriptions for comparison

**Rationale**: Prevents token waste, scales to Stories with many tasks.

### 4. No Code in Task Descriptions

Never include actual code in Task descriptions. Only technical approach and structure. Code is written during execution, not planning.

---

## Definition of Done

Before completing work, verify ALL checkpoints:

**✅ Team ID Discovered (Phase 1):**
- [ ] Team ID loaded from kanban_board.md OR requested from user
- [ ] Story ID parsed from request

**✅ IDEAL Plan Created (Phase 2):**
- [ ] Story loaded from Linear (AC, Technical Notes)
- [ ] Complexity analyzed (simple/medium/complex)
- [ ] Optimal task count determined (1-6)
- [ ] Consumer-First ordering applied
- [ ] Guide links extracted from Story

**✅ Mode Detected (Phase 3):**
- [ ] Existing tasks queried in Linear (count)
- [ ] Mode selected: CREATE or REPLAN

**✅ Worker Invoked (Phase 4):**
- [ ] ln-11-task-creator (if count = 0) OR ln-12-task-replanner (if count ≥ 1)
- [ ] Worker received IDEAL plan + Story data + guide links
- [ ] Worker completed successfully

**✅ Post-Execution Verified (Phase 5):**
- [ ] Worker returned summary (task URLs OR operations count)
- [ ] Linear issues created/updated (verified by worker)
- [ ] kanban_board.md updated (verified by worker)
- [ ] Next steps provided to user

**Output**: Worker summary + next steps (ln-20-story-validator)

---

## IDEAL Plan Data Sources

**Where ln-10-story-decomposer gets information to build IDEAL task plan (Phase 2):**

| Data Source | Used For | Example |
|-------------|----------|---------|
| **Story AC** | Define task scope, determine task count (1 task per 1-2 AC) | 5 AC → 3 tasks (AC1+AC2 = task1, AC3+AC4 = task2, AC5 = task3) |
| **Story Technical Notes** | Identify technical approach, libraries, patterns | "Use PostgreSQL connection pooling" → add Repository task |
| **Story Context** | Understand business requirements, domain rules | "User authentication system" → JWT token + refresh logic tasks |
| **Complexity Analysis** | Determine optimal task count (1-6) | Simple (1-2 tasks), Medium (3-4), Complex (5-6) |
| **Consumer-First Principle** | Order tasks logically (API → Service → Repository → DB) | Always start with API endpoint, end with database |
| **Guide Links** | Extract implementation patterns to pass to workers | "Related Guides: Database Access Pattern" → pass link to ln-11-task-creator |

**IDEAL Plan Building Process (Phase 2):**
1. Load Story from Linear (AC, Technical Notes, Context)
2. Analyze complexity (simple/medium/complex)
3. Determine task count (1-6) based on AC coverage
4. Apply Consumer-First ordering (API → Service → Repository)
5. Extract guide links from Technical Notes
6. Build IDEAL task structure with titles, AC mapping, time estimates

**Key Insight:** IDEAL plan is built BEFORE querying Linear for existing tasks (Decompose-First Pattern). This ensures optimal decomposition regardless of current state.

---

## Reference Files

### task_template_implementation.md (MOVED)

**Purpose**: Complete implementation task template structure with all 7 sections

**Contents**: Detailed descriptions for Context, Implementation Plan, Technical Approach, Acceptance Criteria, Affected Components, Existing Code Impact, Definition of Done

**Location**: Moved to [ln-11-task-creator/references/task_template_implementation.md](../ln-11-task-creator/references/task_template_implementation.md)

**Ownership**: ln-11-task-creator (universal factory owns all product templates)

**Rationale**: Templates moved to universal factory (ln-11-task-creator) which creates ALL 3 task types (implementation, refactoring, test). ln-11-task-creator owns all product templates.

**Usage**: Workers (ln-11-task-creator, ln-12-task-replanner) read this template when generating implementation task documents (via `taskType: "implementation"`)

### replan_algorithm.md (MOVED)

**Location**: Moved to [ln-12-task-replanner/references/replan_algorithm.md](../ln-12-task-replanner/references/replan_algorithm.md)

**Ownership**: ln-12-task-replanner (worker-specific logic)

**Rationale**: Replan algorithm is worker implementation detail, not orchestrator concern.

---

## Best Practices

### Task Decomposition

**Automatic Decomposition**: Orchestrator determines optimal count (1-6) based on Story complexity
- Simple (1-2 AC) → 1 task (3-5h)
- Medium (3-4 AC) → 2-3 tasks (6-15h)
- Complex (5+ AC) → 3-6 tasks (12-30h)
- **Max 6 tasks per Story** (12-30 hours total)

**Consumer-First Ordering**: API → Service → Repository → Database (applied in Phase 2)

**Task Size**: Optimal 3-5 hours (fits in 1-2 work sessions)

### Orchestrator Responsibilities

**DO**:
- ✅ Load Story metadata (AC, Technical Notes)
- ✅ Analyze complexity
- ✅ Build IDEAL plan (1-6 tasks)
- ✅ Extract guide links
- ✅ Query existing task count
- ✅ Delegate to workers

**DON'T**:
- ❌ Generate task documents (workers do this)
- ❌ Load task full descriptions (workers do this)
- ❌ Create/update Linear issues (workers do this)
- ❌ Update kanban_board.md (workers do this)
- ❌ Show previews/confirmations (workers do this)

### Worker Communication

**Context Propagation**: Pass all necessary data to workers (Team ID, Story data, IDEAL plan, guide links, existing task IDs)

**Trust Worker Results**: Workers return summary, orchestrator doesn't re-verify (trust but verify principle)

**Error Handling**: If worker returns error (e.g., test creation detected), report to user and stop

### Story Requirements

**Clear AC**: Given-When-Then format, 3-5 scenarios

**Technical Notes**: Guide links, architecture patterns, constraints

**Context**: Current + Desired state well-defined

---

## Integration with Ecosystem

### Called By

Users directly: "Create tasks for US001"

OR

ln-71-story-manager: May invoke ln-10-story-decomposer when creating Stories (optional)

### Calls (via Skill tool)

- **ln-11-task-creator**: When no existing tasks (CREATE MODE)
- **ln-12-task-replanner**: When tasks exist (REPLAN MODE)

### Next Steps (User-initiated)

After ln-10-story-decomposer completes:
- **ln-20-story-validator**: Verify Story + Tasks before approval (Backlog → Todo)
- **ln-30-story-executor**: Execute Story (orchestrates task execution)

---

## Quick Examples

### Example 1: Create Mode (New Story, No Tasks)

**Request**: "Create tasks for US001: Implement OAuth token authentication"

**Execution**:
- Phase 1: Team ID discovered, Story ID = US001
- Phase 2: Story loaded (5 AC scenarios), Complexity = Medium-Complex, IDEAL Plan = 3 tasks (Token generation 4h, Validation middleware 3h, Refresh logic 5h), Consumer-First ✓
- Phase 3: Query Linear → Count = 0 → CREATE MODE
- Phase 4a: Invoke ln-11-task-creator (IDEAL plan + Story data)
  - ln-11-task-creator: Generate 3 tasks, validate NO tests, show preview, user confirms, create in Linear, update kanban
- Phase 5: Receive summary from worker, return to user

**Result**: 3 tasks created, 12h total

### Example 2: Replan Mode (AC Changed)

**Request**: "Create tasks for US001" (Story AC updated: AC4 "expired tokens" added)

**Execution**:
- Phase 1: Team ID discovered, Story ID = US001
- Phase 2: Story loaded (5 AC scenarios, AC4 NEW), IDEAL Plan = 3 tasks (same structure, AC4 added to task 2)
- Phase 3: Query Linear → Count = 3 → REPLAN MODE
- Phase 4b: Invoke ln-12-task-replanner (IDEAL plan + Story data + existing task IDs)
  - ln-12-task-replanner: Load existing, Compare (EP7_01 KEEP, EP7_02 UPDATE +AC4, EP7_03 OBSOLETE), show summary, user confirms, execute operations
- Phase 5: Receive summary from worker (1 kept, 1 updated, 1 canceled), return to user

**Result**: 1 kept, 1 updated, 1 canceled

---

**Version:** 7.2.0
**Last Updated:** 2025-11-14

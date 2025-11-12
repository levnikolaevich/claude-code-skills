---
name: x-task-manager
description: Universal task operations (create/update/replan) with automatic decomposition. Analyzes Story, builds optimal task plan (1-6 tasks), then creates or replans existing tasks. Auto-discovers team ID. For implementation tasks only (NOT test tasks).
---

# Linear Task Manager

Universal task operations for User Stories. Handles creation, updates, and replanning with automatic decomposition and Consumer-First ordering.

## Overview

### What This Skill Does

Creates and manages implementation tasks for User Stories in Linear with automatic decomposition:
- Analyzes Story AC and Technical Notes
- Builds optimal task plan (1-6 tasks based on complexity)
- Creates new tasks OR replans existing tasks
- Applies Consumer-First ordering automatically
- Enforces NO test creation rule (tests are in Story's final test task)

### When to Use This Skill

Use this skill when:
- Create implementation tasks for a User Story
- Replan tasks when Story requirements change
- Update existing tasks when AC or technical approach changes
- Automatically decompose Story into optimal task count (1-6)

**Prerequisites:**
- Story exists in Linear (e.g., US001)
- Story has AC and Technical Notes defined
- Requirements are clear (from Story description)

**NOT for test tasks** - use x-story-finalizer for Story's final test task after manual testing.

### When NOT to Use

Do NOT use if:
- Story doesn't exist → Use x-story-manager first
- Need to create test tasks → Use x-story-finalizer after manual testing
- Story is vague → Refine Story AC and Technical Notes first
- Task is trivial (< 1 hour) → Create directly in Linear manually

---

## Core Concepts

### Decompose-First Pattern

**Key Principle**: ALWAYS analyze Story and build OPTIMAL task plan FIRST (Phase 2), independent of current state. Then check existing tasks (Phase 3) and propose operations.

This ensures consistent decomposition logic regardless of whether tasks exist or not.

**Flow**:
1. Load Story metadata (AC, Technical Notes)
2. Build IDEAL task plan "in mind" (1-6 tasks)
3. THEN query Linear for existing tasks
4. Compare IDEAL vs existing → operations (KEEP/UPDATE/OBSOLETE/CREATE)

### Consumer-First Ordering

**Principle**: Consumers developed before providers. Outer layers before inner layers.

**Order**: API endpoint → Service → Repository → Database

Applied automatically in Phase 2 when building IDEAL task plan.

### Task Structure (7 Sections)

Every task follows this template:

1. **Context**: Current state + Desired state + Story link
2. **Implementation Plan**: 3 phases with checkboxes
3. **Technical Approach**: KISS/YAGNI principles + guide links + architecture patterns
4. **Acceptance Criteria**: 3-5 Given-When-Then scenarios from Story AC
5. **Affected Components**: Implementation files + Documentation files
6. **Existing Code Impact**: Refactoring needed + Tests to update + Docs to update
7. **Definition of Done**: Completion checklist

See [task_template_universal.md](references/task_template_universal.md) for detailed template.

### Auto-Discovery

**Team ID**: Auto-discovered from `docs/tasks/kanban_board.md` Linear Configuration table (see CLAUDE.md "Configuration Auto-Discovery").

**Story ID**: Parsed from request: "for US001" or "for API-53"

**Guide Links**: Extracted from Story Technical Notes "Related Guides:" section and included in task Technical Approach.

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
   - Parse guide links to include in task Technical Approach

6. **Result: IDEAL Task Structure**:
   ```
   IDEAL TASK PLAN (N tasks):
   1. Task Title (AC#, AC#) - Xh
   2. Task Title (AC#, AC#) - Xh
   3. Task Title (AC#) - Xh

   Consumer-First order: ✓
   Total estimate: Xh
   ```

### Phase 3: Check Existing Tasks

Query Linear: `list_issues(parentId=Story.id)`

**Decision**:
- **Count = 0** → **CREATE MODE** (Phase 4a)
- **Count ≥ 1** → **REPLAN MODE** (Phase 4b)

### Phase 4a: Create Mode (if Count = 0)

No existing tasks found. Create all tasks from Phase 2 IDEAL plan.

**Steps**:

1. **Generate Task Documents** (7 sections each from template)
2. **Validate NO Test Creation** (scan for test phrases - ERROR if found)
3. **Show Preview**:
   ```
   TASK CREATION PREVIEW for [Story ID]:

   Will create N tasks:

   1. EP#_##: [Task Title]
      - Goal: [Description]
      - Estimate: X hours
      - AC: [AC scenarios]

   Total: N tasks, X hours estimated
   Consumer-First ordering: ✓

   Type "confirm" to create all tasks in Linear.
   ```

4. **User Confirmation**: User types "confirm"
5. **Create in Linear**: `create_issue(title, description, parentId, team, project)` for each task
6. **Update kanban_board.md**: Add tasks under Story in "### Backlog" section
7. **Return Summary**: Linear URLs + next steps

### Phase 4b: Replan Mode (if Count ≥ 1)

Existing tasks found. Compare Phase 2 IDEAL plan with existing tasks.

**Steps**:

1. **Load Existing Tasks**: Fetch descriptions from Linear, parse 7 sections, note status

2. **Compare IDEAL Plan vs Existing**:

   **For EACH existing task**:
   - **KEEP**: Task matches IDEAL plan, no changes needed
   - **UPDATE**: Task in IDEAL plan but description needs changes (AC/approach/components changed). Status must be Todo or Backlog. If In Progress/To Review → WARNING.
   - **OBSOLETE**: Task NOT in IDEAL plan (feature removed). Status must be Todo or Backlog. Action: Cancel (state="Canceled").

   **For EACH task in IDEAL plan**:
   - **CREATE**: Task in plan but no existing task matches goal

3. **Show Operations Summary**:
   ```
   REPLAN SUMMARY for [Story ID]:

   IDEAL PLAN (from Story analysis):
   1. [Task 1] ← [changes marked]
   2. [Task 2]
   3. [Task 3] ← NEW!

   EXISTING TASKS:
   ✓ [Task ID]: [Title] - KEEP
   ⚠ [Task ID]: [Title] - UPDATE (AC4 added)
   ✗ [Task ID]: [Title] - OBSOLETE (caching removed)

   NEW TASKS:
   + [Task ID]: [Title] - CREATE

   OPERATIONS: X keep, X update, X cancel, X create

   Type "confirm" to execute all operations.
   ```

4. **User Confirmation**: User types "confirm"
5. **Execute Operations**: Update/Cancel/Create in Linear
6. **Update kanban_board.md**: Remove Canceled tasks, add new tasks
7. **Return Summary**: Operations count + next steps

See [replan_algorithm.md](references/replan_algorithm.md) for detailed comparison logic.

### Phase 5: Post-Execution

**Verification**:
- All operations executed successfully
- Linear issues created/updated
- kanban_board.md reflects changes
- Story metadata updated

**Next Steps**:
- x-story-verifier: Verify Story before execution (Backlog → Todo)
- x-story-executor: Start task execution (Todo → In Progress)

---

## Critical Rules

### 1. NO Test Creation in Implementation Tasks

**HARD RULE**: Implementation tasks MUST NOT include new test creation.

**What is NOT allowed**:
- "write tests", "create tests", "add tests"
- "unit tests", "E2E tests", "integration tests" (unless prefixed with "update existing")
- Any test creation phrases

**Why**: All new tests (E2E/Integration/Unit) are created in Story's final test task by x-story-finalizer AFTER manual testing passes.

**Validation**: Phase 4a scans all generated task descriptions. ERROR if test creation detected.

**Exception**: "Tests to Update" section in Existing Code Impact can list:
- Existing tests affected by refactoring/logic changes
- Valid updates: Mock changes, assertion fixes, test data updates
- NOT new test creation

### 2. Task Size Limits

**Optimal task size**: 3-5 hours (fits in 1-2 work sessions)

**Max tasks per Story**: 6 tasks (12-30 hours total)

**Automatic decomposition by complexity**:
- Simple (1-2 AC) → 1 task (3-5h)
- Medium (3-4 AC) → 2-3 tasks (6-15h)
- Complex (5+ AC) → 3-6 tasks (12-30h)

### 3. Status Constraints (Replan Mode)

**UPDATE/OBSOLETE operations**:
- **Allowed**: Todo or Backlog status ONLY
- **Warning required**: If In Progress or To Review status
- **Never touch**: Done or Canceled status

**Rationale**: Protect work in progress and preserve history.

### 4. No Code in Task Descriptions

Never include actual code in Task descriptions. Only technical approach and structure. Code is written during execution, not planning.

---

## Definition of Done

Before completing work, verify ALL checkpoints:

**✅ IDEAL Plan Created (Phase 2):**
- [ ] Story loaded from Linear (AC, Technical Notes)
- [ ] Complexity analyzed (simple/medium/complex)
- [ ] Optimal task count determined (1-6)
- [ ] Consumer-First ordering applied
- [ ] Guide links extracted from Story

**✅ Mode Detected (Phase 3):**
- [ ] Existing tasks queried in Linear
- [ ] Mode selected: CREATE or REPLAN

**✅ Create Mode Executed (if Count = 0):**
- [ ] Task documents generated (7 sections each)
- [ ] NO test creation validated
- [ ] Preview shown to user
- [ ] User confirmed ("confirm")
- [ ] All tasks created in Linear
- [ ] kanban_board.md updated
- [ ] Linear URLs returned

**✅ Replan Mode Executed (if Count ≥ 1):**
- [ ] Existing tasks loaded (full descriptions)
- [ ] Comparison performed (IDEAL vs existing)
- [ ] Operations categorized (KEEP/UPDATE/OBSOLETE/CREATE)
- [ ] Summary shown with operations
- [ ] User confirmed ("confirm")
- [ ] All operations executed (update/cancel/create)
- [ ] kanban_board.md updated
- [ ] Warnings shown if In Progress/To Review tasks affected

**✅ Task Structure Valid (7 sections):**
- [ ] Context: Current + Desired state
- [ ] Implementation Plan: 3 phases with checkboxes
- [ ] Technical Approach: KISS/YAGNI + guide links
- [ ] Acceptance Criteria: Given-When-Then scenarios
- [ ] Affected Components: Implementation + Documentation files
- [ ] Existing Code Impact: Refactoring + Tests to update + Docs to update
- [ ] Definition of Done: Completion checklist

**✅ NO Test Creation Included:**
- [ ] Verified task descriptions contain NO new test creation
- [ ] Verified "Tests to Update" section ONLY lists existing tests
- [ ] Verified no phrases like: "write tests", "create tests", "add unit tests"
- [ ] Reminder: All new tests are in Story's final test task by x-story-finalizer

**Output**: Linear Issue URLs + operation summary + next steps

---

## Quick Examples

### Example 1: Create Mode (New Story, No Tasks)

**Request**: "Create tasks for US001: Implement OAuth token authentication"

**Execution**:
- Story loaded: 5 AC scenarios
- Complexity: Medium-Complex (5 AC, multiple integrations)
- IDEAL Plan: 3 tasks (Token generation 4h, Validation middleware 3h, Refresh logic 5h)
- Consumer-First: ✓
- Check Linear → Count = 0 → CREATE MODE
- Generate 3 tasks, validate NO tests, show preview, user confirms
- Create in Linear, update kanban

**Result**: 3 tasks created, 12h total

### Example 2: Replan Mode (AC Changed)

**Request**: "Create tasks for US001" (Story AC updated: AC4 "expired tokens" added, caching removed)

**Execution**:
- Story loaded: 5 AC scenarios (AC4 NEW, caching gone)
- IDEAL Plan: 3 tasks (same as Example 1, but AC4 added to task 2)
- Check Linear → Count = 3 → REPLAN MODE
- Existing: EP7_01 (Done) → KEEP, EP7_02 (Todo) → UPDATE (AC4 added), EP7_03 (Todo) → OBSOLETE
- Show summary + diff, user confirms
- Update EP7_02, Cancel EP7_03

**Result**: 1 kept, 1 updated, 1 canceled

### Example 3: Replan Mode (New Feature)

**Request**: "Create tasks for US002" (Story AC updated: NEW AC4 "Upload avatar")

**Execution**:
- IDEAL Plan: 3 tasks (Create profile, Update profile, Upload avatar ← NEW!)
- Check Linear → Count = 2 → REPLAN MODE
- Existing: EP8_01 (Done) → KEEP, EP8_02 (In Progress) → KEEP
- NEW task in plan: Upload avatar → CREATE
- Show summary, user confirms
- Create EP8_03

**Result**: 2 kept, 1 created

---

## Reference Files

### task_template_universal.md

**Purpose**: Complete task template structure with all 7 sections

**Contents**: Detailed descriptions for Context, Implementation Plan, Technical Approach, Acceptance Criteria, Affected Components, Existing Code Impact, Definition of Done

**Location**: [x-task-manager/references/task_template_universal.md](references/task_template_universal.md)

### replan_algorithm.md

**Purpose**: Detailed comparison logic for REPLAN mode

**Contents**: KEEP/UPDATE/OBSOLETE/CREATE categorization rules, status constraints, comparison criteria

**Location**: [x-task-manager/references/replan_algorithm.md](references/replan_algorithm.md)

### linear_integration.md

**Purpose**: Linear API usage and discovery patterns

**Contents**: API calls (list_issues, create_issue, update_issue), auto-discovery mechanism, kanban_board.md format

**Location**: [x-task-manager/references/linear_integration.md](references/linear_integration.md)

---

## Best Practices

### Task Decomposition

**Automatic Decomposition**: Skill determines optimal count (1-6) based on Story complexity
- Simple (1-2 AC) → 1 task (3-5h)
- Medium (3-4 AC) → 2-3 tasks (6-15h)
- Complex (5+ AC) → 3-6 tasks (12-30h)
- **Max 6 tasks per Story** (12-30 hours total)

**Consumer-First Ordering**: API → Service → Repository → Database

**Task Size**: Optimal 3-5 hours (fits in 1-2 work sessions)

### Replan Considerations

**Decompose First**: Always build IDEAL plan BEFORE checking existing tasks

**Be Cautious with In Progress/To Review**: Show warnings, don't auto-update

**Preserve Done Tasks**: Never update or cancel Done tasks

**Use Canceled Status**: Clean way to obsolete tasks (preserves history)

### Story Requirements

**Clear AC**: Given-When-Then format, 3-5 scenarios

**Technical Notes**: Guide links, architecture patterns, constraints

**Context**: Current + Desired state well-defined

### Linear Integration

**parentId**: Always set to Story ID (creates hierarchy)

**Team**: Auto-discovered from kanban_board.md

**Project**: Inherited from parent Story (Epic)

**Labels**: Auto-added based on components (backend, frontend, database)

### No Tests in Implementation Tasks

Implementation tasks don't include new test creation. Test task created later by x-story-finalizer after manual testing. All tests (E2E/Integration/Unit) in Story's final task.

---

**Version:** 5.1.0 (Restructured with consolidated principles)
**Last Updated:** 2025-11-12

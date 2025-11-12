---
name: x-task-manager
description: Universal task operations (create/update/replan) with automatic decomposition. Analyzes Story, builds optimal task plan (1-6 tasks), then creates or replans existing tasks. Auto-discovers team ID. For implementation tasks only (NOT test tasks).
---

# Linear Task Manager

Universal task operations for User Stories. Handles creation, updates, and replanning with automatic decomposition and Consumer-First ordering.

## When to Use This Skill

This skill should be used when:
- Create implementation tasks for a User Story
- Replan tasks when Story requirements change
- Update existing tasks when AC or technical approach changes
- Automatically decompose Story into optimal task count (1-4)
- **NOT for test tasks** - use x-story-finalizer for Story's final test task

**Prerequisites:**
- Story exists in Linear (e.g., US001)
- Story has AC and Technical Notes defined
- Requirements are clear (from Story description)

## When NOT to Use

Do NOT use if:
- Story doesn't exist → Use x-story-manager first
- Need to create test tasks → Use x-story-finalizer after manual testing
- Story is vague → Refine Story AC and Technical Notes first
- Task is trivial (< 1 hour) → Create directly in Linear manually

## How It Works

### Decompose-First Pattern

**Key Principle**: ALWAYS analyze Story and build OPTIMAL task plan FIRST, independent of current state. Then check existing tasks and propose operations.

This ensures consistent decomposition logic regardless of whether tasks exist or not.

### Phase 1: Discovery (Automated)

Auto-discovers Team ID from `docs/tasks/kanban_board.md` (see CLAUDE.md "Configuration Auto-Discovery").

Parses request for:
- **Story ID:** "for US001" or "for API-53"
- **Requirements:** New or updated AC, technical approach changes

### Phase 2: Analyze & Decompose (ALWAYS)

**This phase runs BEFORE checking existing tasks.**

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
   - Outer layers before inner layers

5. **Extract Guide Links**:
   - Read Story Technical Notes "Related Guides:" section
   - Parse guide links to include in task Technical Approach

6. **Result: IDEAL Task Structure**:
   - List of 1-4 task titles
   - Task goals (from AC)
   - Consumer-First order
   - Guide links for each task

**Example IDEAL Plan for US001 OAuth Authentication**:
```
IDEAL TASK PLAN (3 tasks):
1. Implement token generation endpoint (AC1, AC2) - 4h
2. Add token validation middleware (AC3, AC4) - 3h
3. Create token refresh logic (AC5) - 5h

Consumer-First order: ✓ (endpoint → middleware → logic)
Total estimate: 12h
```

### Phase 3: Check Existing Tasks

Query Linear: `list_issues(parentId=Story.id)`

**Decision**:
- **Count = 0** → **CREATE MODE** (no existing tasks, create all from Phase 2 plan)
- **Count ≥ 1** → **REPLAN MODE** (existing tasks found, compare with Phase 2 plan)

### Phase 4a: Create Mode (if Count = 0)

No existing tasks found. Create all tasks from Phase 2 IDEAL plan.

1. **Generate Task Documents**:

   For EACH task in IDEAL plan, generate complete markdown (7 sections):

   **1. Context**:
   - Current state: What exists now
   - Desired state: What this task will implement
   - Link to parent Story: [US001](linear-url)

   **2. Implementation Plan**:
   - Phase 1: [Logical step]
     - [ ] Checkpoint 1
     - [ ] Checkpoint 2
   - Phase 2: [Logical step]
     - [ ] Checkpoint 3
   - Phase 3: [Logical step]
     - [ ] Checkpoint 4

   **3. Technical Approach**:
   - KISS/YAGNI principles
   - Consumer-First ordering (if applicable)
   - **Related Guides**: Links from Story Technical Notes
     - [Guide Name](../../docs/guides/guide-name.md)
   - Architecture patterns to follow
   - Technology stack

   **4. Acceptance Criteria**:
   - **Given** [initial context]
     **When** [action]
     **Then** [expected outcome]
   - [3-5 Given-When-Then scenarios from Story AC]

   **5. Affected Components**:
   - **Implementation**:
     - `src/path/to/file.ts` - What changes
   - **Documentation**:
     - `docs/file.md` - What to update

   **6. Existing Code Impact**:
   - **Refactoring Needed**:
     - Identify code to refactor
     - Remove backward compatibility
     - Clean up deprecated patterns
   - **Tests to Update**:
     - List existing tests affected
   - **Documentation to Update**:
     - List docs requiring updates

   **CRITICAL: Tests to Update Section**
   - ONLY list existing tests affected by refactoring/logic changes
   - DO NOT include test creation phrases ("write tests", "add unit tests", "create E2E tests")
   - Test creation is x-story-finalizer's responsibility after manual testing
   - Valid updates: Mock changes, assertion fixes, test data updates

   **7. Definition of Done**:
   - [ ] All acceptance criteria met
   - [ ] All existing code refactored (no backward compatibility / legacy code left)
   - [ ] All existing tests updated
   - [ ] Documentation updated
   - [ ] Code reviewed

2. **Show Preview**:
   ```
   TASK CREATION PREVIEW for US001:

   Will create 3 tasks:

   1. EP7_01: Implement token generation endpoint
      - Goal: Handle POST /auth/token with credentials
      - Estimate: 4 hours
      - AC: AC1 (valid credentials), AC2 (invalid credentials)

   2. EP7_02: Add token validation middleware
      - Goal: Validate JWT tokens in protected routes
      - Estimate: 3 hours
      - AC: AC3 (valid token), AC4 (expired token)

   3. EP7_03: Create token refresh logic
      - Goal: Implement token refresh mechanism
      - Estimate: 5 hours
      - AC: AC5 (refresh with valid refresh token)

   Total: 3 tasks, 12 hours estimated
   Consumer-First ordering: ✓

   Type "confirm" to create all tasks in Linear.
   ```

2.5. **Validate No Test Creation**:
   - Scan all generated task descriptions for test creation phrases:
     - "write tests", "create tests", "add tests"
     - "unit tests", "E2E tests", "integration tests" (unless prefixed with "update existing")
   - If detected → STOP and show ERROR:
     ```
     ❌ ERROR: Test creation detected in task descriptions.
     Implementation tasks MUST NOT include new test creation.

     Found in: [Task ID] - "[Phrase with test creation]"

     Reminder: x-story-finalizer creates all new tests after manual testing.

     Please regenerate task plan without test creation.
     ```
   - If no test creation detected → Proceed to preview

3. **User Confirmation**:
   - User reviews preview
   - Types "confirm" to proceed

4. **Create in Linear**:
   - For EACH task:
     - `create_issue(title, description, parentId=Story.id, team, project)`
     - Returns Linear issue URL
   - Update kanban_board.md:
     - Add tasks under Story in "### Backlog" section
     - Remove `_(tasks not created yet)_` if present
     - Update Epic Story Counters table

5. **Return Summary**:
   ```
   ✅ Created 3 tasks for US001:
   - EP7_01: Implement token generation endpoint
     https://linear.app/team/issue/EP7-01
   - EP7_02: Add token validation middleware
     https://linear.app/team/issue/EP7-02
   - EP7_03: Create token refresh logic
     https://linear.app/team/issue/EP7-03

   Next: Use x-story-executor to start work
   ```

### Phase 4b: Replan Mode (if Count ≥ 1)

Existing tasks found. Compare Phase 2 IDEAL plan with existing tasks.

1. **Load Existing Tasks**:
   - Fetch ALL task descriptions from Linear
   - Parse 7 sections for EACH task
   - Note current status (Todo, In Progress, To Review, Done)

2. **Compare IDEAL Plan vs Existing**:

   **For EACH existing task**:

   - **KEEP**: Task matches IDEAL plan, no changes needed
     - Goal still in Story AC
     - Implementation approach still valid
     - Status: Any except Done/Canceled
     - Action: None

   - **UPDATE**: Task in IDEAL plan but description needs changes
     - AC changed (new scenarios, modified conditions)
     - OR Technical approach changed (new guide links)
     - OR Affected components changed
     - Status: Todo or Backlog ONLY
     - If In Progress/To Review → WARNING, manual review needed
     - Action: `update_issue(id, description=new_content)`

   - **OBSOLETE**: Task NOT in IDEAL plan
     - Feature removed from Story AC
     - OR functionality merged into other task
     - Status: Todo or Backlog ONLY
     - If In Progress/To Review/Done → WARNING, manual review needed
     - Action: `update_issue(id, state="Canceled")`

   **For EACH task in IDEAL plan**:

   - **CREATE**: Task in plan but no existing task matches goal
     - New requirement added to Story
     - New capability needed
     - Action: `create_issue(...)` (same as Create Mode)

3. **Show Operations Summary**:
   ```
   REPLAN SUMMARY for US001:

   IDEAL PLAN (from Story analysis):
   1. Token generation endpoint (AC1, AC2)
   2. Token validation middleware (AC3, AC4) ← AC4 ADDED!
   3. Email validation (NEW AC6) ← NEW!

   EXISTING TASKS:
   ✓ EP7_01: Token generation endpoint
      Status: Done
      Operation: KEEP (matches plan, already Done)

   ⚠ EP7_02: Token validation middleware
      Status: Todo
      Operation: UPDATE (AC4 added to Story)
      Changes:
        - Add AC4: Handle expired token scenario
        - Update Implementation Plan with expiration check

   ✗ EP7_03: Cache tokens in Redis
      Status: Todo
      Operation: OBSOLETE (caching removed from Story)
      Action: Cancel task (state="Canceled")

   NEW TASKS:
   + EP7_04: Email validation
      Goal: Validate email format in registration
      Estimate: 3 hours
      AC: New AC6 from Story

   OPERATIONS: 1 keep, 1 update, 1 cancel, 1 create

   WARNINGS:
   - EP7_02 will be updated (AC changed)

   Type "confirm" to execute all operations.
   ```

4. **User Confirmation**:
   - User reviews operations + diffs
   - Types "confirm" to proceed

5. **Execute Operations**:

   - **KEEP**: No action

   - **UPDATE**:
     ```
     update_issue(
       id=task.id,
       description=new_description  # Updated 7 sections
     )
     ```

   - **OBSOLETE**:
     ```
     update_issue(
       id=task.id,
       state="Canceled"
     )
     ```
     Add comment: "Task canceled due to Story replan. Feature removed from requirements."

   - **CREATE**:
     ```
     create_issue(
       title=task_title,
       description=task_description,
       parentId=Story.id,
       team=team_id,
       project=project_id
     )
     ```

6. **Update Kanban**:
   - Remove Canceled tasks from active sections
   - Add new tasks under Story in "### Backlog"
   - Update task references in Story description (if needed)

7. **Return Summary**:
   ```
   ✅ Replan completed for US001:

   KEPT: 1 task
   - EP7_01: Token generation endpoint (Done)

   UPDATED: 1 task
   - EP7_02: Token validation middleware (added AC4)

   CANCELED: 1 task
   - EP7_03: Cache tokens (feature removed)

   CREATED: 1 task
   - EP7_04: Email validation
     https://linear.app/team/issue/EP7-04

   Next: Use x-story-executor to continue work
   ```

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

## Definition of Done

Before completing work, verify ALL checkpoints:

**✅ IDEAL Plan Created (Phase 2):**
- [ ] Story loaded from Linear (AC, Technical Notes)
- [ ] Complexity analyzed (simple/medium/complex)
- [ ] Optimal task count determined (1-4)
- [ ] Consumer-First ordering applied
- [ ] Guide links extracted from Story

**✅ Mode Detected (Phase 3):**
- [ ] Existing tasks queried in Linear
- [ ] Mode selected: CREATE or REPLAN

**✅ Create Mode Executed (if Count = 0):**
- [ ] Task documents generated (7 sections each)
- [ ] Preview shown to user
- [ ] User confirmed ("confirm")
- [ ] All tasks created in Linear
- [ ] kanban_board.md updated
- [ ] Linear URLs returned

**✅ Replan Mode Executed (if Count ≥ 1):**
- [ ] Existing tasks loaded (full descriptions)
- [ ] Comparison performed (IDEAL vs existing)
- [ ] Operations categorized (KEEP/UPDATE/OBSOLETE/CREATE)
- [ ] Summary shown with diffs
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
- [ ] Existing Code Impact: Refactoring + Tests + Docs to update
- [ ] Definition of Done: Completion checklist

**✅ NO Test Creation Included:**
- [ ] Verified task descriptions contain NO new test creation
- [ ] Verified "Tests to Update" section ONLY lists existing tests (not new test creation)
- [ ] Verified no phrases like: "write tests", "create tests", "add unit tests", "implement E2E tests"
- [ ] Reminder: All new tests (E2E/Integration/Unit) are in Story's final test task by x-story-finalizer

**Output**: Linear Issue URLs + operation summary + next steps

---

## Example Usage

### Example 1: Create Mode (New Story, No Tasks)

**User Request**:
```
"Create tasks for US001: Implement OAuth token authentication"
```

**Execution**:
1. **Phase 1**: Team ID discovered, Story US001 identified
2. **Phase 2**:
   - Story loaded: 5 AC scenarios
   - Complexity: Medium-Complex (5 AC, multiple integrations)
   - IDEAL Plan: 3 tasks
     1. Token generation endpoint (AC1, AC2) - 4h
     2. Token validation middleware (AC3, AC4) - 3h
     3. Token refresh logic (AC5) - 5h
   - Consumer-First: ✓
3. **Phase 3**: Check Linear → Count = 0 → CREATE MODE
4. **Phase 4a**:
   - Generate 3 task documents
   - Show preview
   - User confirms
   - Create 3 tasks in Linear
   - Update kanban
5. **Result**: 3 tasks created, 12h total

### Example 2: Replan Mode (AC Changed)

**User Request**:
```
"Create tasks for US001: Implement OAuth token authentication"
# Story AC was updated: AC4 "Handle expired tokens" ADDED, caching requirement REMOVED
```

**Execution**:
1. **Phase 1**: Team ID discovered, Story US001 identified
2. **Phase 2**:
   - Story loaded: 5 AC scenarios (AC4 NEW, caching gone)
   - Complexity: Medium-Complex
   - IDEAL Plan: 3 tasks
     1. Token generation endpoint (AC1, AC2)
     2. Token validation middleware (AC3, AC4) ← AC4 NEW!
     3. Token refresh logic (AC5)
   - Consumer-First: ✓
3. **Phase 3**: Check Linear → Count = 3 → REPLAN MODE
4. **Phase 4b**:
   - Load existing:
     - EP7_01: Token generation (Done) → KEEP
     - EP7_02: Token validation (Todo) → UPDATE (AC4 added)
     - EP7_03: Cache tokens (Todo) → OBSOLETE (caching removed)
   - Compare with IDEAL plan:
     - EP7_01: Matches → KEEP
     - EP7_02: In plan, needs AC4 → UPDATE
     - EP7_03: Not in plan → OBSOLETE (Cancel)
   - Show summary + diff
   - User confirms
   - Execute: Update EP7_02, Cancel EP7_03
5. **Result**: 1 kept, 1 updated, 1 canceled

### Example 3: Replan Mode (New Feature Added)

**User Request**:
```
"Create tasks for US002: User profile management"
# Story AC was updated: NEW AC4 "Upload avatar" ADDED
```

**Execution**:
1. **Phase 2**:
   - IDEAL Plan: 3 tasks
     1. Create profile endpoint
     2. Update profile endpoint
     3. Upload avatar ← NEW!
2. **Phase 3**: Count = 2 → REPLAN MODE
3. **Phase 4b**:
   - Existing:
     - EP8_01: Create profile (Done) → KEEP
     - EP8_02: Update profile (In Progress) → KEEP
   - IDEAL plan has task 3 (Upload avatar) → CREATE
   - Summary:
     - EP8_01: KEEP (Done, don't touch)
     - EP8_02: KEEP (In Progress, don't touch)
     - NEW EP8_03: CREATE (upload avatar)
   - User confirms
   - Create EP8_03
4. **Result**: 2 kept, 1 created

---

## Reference Files

- **task_template_universal.md**: Task template structure (7 sections)
- **replan_algorithm.md**: Detailed comparison logic (KEEP/UPDATE/OBSOLETE/CREATE)
- **linear_integration.md**: Linear API usage, discovery patterns

---

## Best Practices

### Task Decomposition
- **Automatic Decomposition**: Skill determines optimal count (1-6) based on Story complexity
  - Simple (1-2 AC) → 1 task (3-5h)
  - Medium (3-4 AC) → 2-3 tasks (6-15h)
  - Complex (5+ AC) → 3-6 tasks (12-30h)
  - **Max 6 tasks per Story** (12-30 hours total)
- **Consumer-First Ordering**: API → Service → Repository → Database
- **Task Size**: Optimal 3-5 hours (fits in 1-2 work sessions)

### Replan Considerations
- **Decompose First**: Always build IDEAL plan BEFORE checking existing tasks
- **Be Cautious with In Progress/To Review**: Show warnings, don't auto-update
- **Preserve Done Tasks**: Never update or cancel Done tasks
- **Use Canceled Status**: Clean way to obsolete tasks (preserves history)

### Story Requirements
- **Clear AC**: Given-When-Then format, 3-5 scenarios
- **Technical Notes**: Guide links, architecture patterns, constraints
- **Context**: Current + Desired state well-defined

### Linear Integration
- **parentId**: Always set to Story ID (creates hierarchy)
- **Team**: Auto-discovered from kanban_board.md
- **Project**: Inherited from parent Story (Epic)
- **Labels**: Auto-added based on components (backend, frontend, database)

### No Code in Descriptions
- **Never include actual code** in Task descriptions
- Only technical approach and structure
- Code written during execution, not planning

### No Tests in Implementation Tasks
- Implementation tasks don't include tests
- Test task created later by x-story-finalizer after manual testing
- All tests (E2E/Integration/Unit) in Story's final task

---

**Version:** 5.0.0 (Universal operations with Decompose-First pattern)
**Last Updated:** 2025-11-10

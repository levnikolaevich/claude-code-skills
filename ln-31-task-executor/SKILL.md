---
name: ln-31-task-executor
description: Executes implementation tasks (Todo → In Progress → To Review). Uses KISS/YAGNI, reads Technical Approach guides, runs type checks/linting. NOT for test tasks.
---

# Implementation Task Execution Skill

Execute approved implementation tasks ONLY (Todo → In Progress → To Review) with KISS/YAGNI principles and quality checks.

## When to Use This Skill

This skill should be used when executing approved implementation task (status = Todo):
- KISS/YAGNI implementation
- Type checking and linting
- Documentation during implementation
- Reads guide links from Task Technical Approach

**NOT for test tasks:** Use ln-34-test-executor for Story Finalizer test tasks (11 sections with Fix Existing Tests, Infrastructure, Documentation, Legacy Cleanup)

⚠️ **CRITICAL RULE - Single Task Updates:**
- ✅ Update status for ONLY the selected task (the one passed as parameter)
- ❌ NEVER update status for multiple tasks at once
- ❌ NEVER update status for all Todo tasks
- ❌ NEVER update status for all tasks in the Story

## How It Works

### Phase 1: Read Referenced Guides (Automated)

**Objective**: Study architectural patterns before implementation.

**Steps:**
1. **Load Task description** from Linear (if task ID provided) or from user selection
2. **Extract guide links** from Task Technical Approach section
3. **Read referenced guides** from `docs/guides/` directory
4. **Study patterns:**
   - Understand principle and implementation approach
   - Review patterns and anti-patterns
   - Note library versions and constraints
5. **Apply knowledge** in Phase 4 implementation

**Purpose**: Ensure implementation follows project-specific architectural patterns established in guides.

**Note**: If no guide links in Task Technical Approach, skip this phase and proceed to Phase 2.

---

### Phase 2: Discovery (Automated)

Auto-discovers project configuration:
- **Team ID:** Reads `docs/tasks/readme.md`, `docs/tasks/kanban_board.md` → Linear Configuration
- **Project Docs:** Reads `CLAUDE.md` → Links to `docs/core/`, `docs/guides/`
- **Tracker:** Linear MCP integration

### Phase 3: Preparation

**Steps:**
1. **Load task:**
   - If task ID provided (e.g., API-42) → Fetch specific task
   - If no ID → List Todo tasks and ask user to choose
2. **Validate context:** Check dependencies, library versions, recent completed tasks
3. **Track progress:** Create TodoWrite todos with full workflow:
   - Update ONLY the selected task's status to "In Progress" (Linear via update_issue with task ID)
   - Update kanban_board.md (Todo → In Progress) for ONLY the selected task:
     * Find Task in parent Story section under "### Todo"
     * Remove task line: `    - [LINEAR_ID: EP#_## Task Title](link)` (4-space indent)
     * Add task line to same Story section under "### In Progress"
     * Preserve Epic header and Story structure
   - Follow task checkboxes sequentially
   - Implement code using KISS/YAGNI principles
   - Address Existing Code Impact section
   - Quality gates: type checking, linting
   - Update task description with completed checkboxes (replace `- [ ]` with `- [x]`)
   - Add implementation summary comment
   - Update ONLY the selected task's status to "To Review" (Linear via update_issue with task ID)
   - Update kanban_board.md (In Progress → To Review) for ONLY the selected task:
     * Find Task in parent Story section under "### In Progress"
     * Remove task line from In Progress
     * Add task line to same Story section under "### To Review"
4. **Execute first todo:** Update status to "In Progress" in Linear
5. **Execute second todo:** Update kanban_board.md with hierarchical task movement (Epic → Story → Task preserved)

### Phase 4: Implementation

**KISS/YAGNI implementation:**
1. **Follow task checkboxes:** Task description contains checkboxes - follow sequentially and verify completion
2. **Follow task details:** Goal, Technical Approach, Acceptance Criteria
3. **Implement code:** Simplest solution that meets requirements
4. **Code comments (15-20% ratio):**
   - Explain WHY (non-obvious logic), not WHAT (obvious from code)
   - NO Epic/task IDs, NO historical notes, NO code examples
   - Only critical technical details (database query optimizations, API quirks, constraints)
5. **Avoid hardcoded values:**
   - Extract magic numbers to named constants with WHY explanations
   - Move configuration to config files or environment variables
   - Never hardcode: paths, URLs, API endpoints, credentials, API keys
   - Example: Replace `setTimeout(5000)` with `setTimeout(config.timeoutMs) // 5000ms optimal for slow networks`
6. **Document during implementation** (STRUCTURE.md, ARCHITECTURE.md, tests/README.md) following guides
7. **Address Existing Code Impact:**
   - Complete all refactoring from task's "Existing Code Impact" section
   - Update all existing tests (maintain passing status)
   - Update all affected documentation
8. **Adding packages:**
   - Check latest compatible version (verify constraints, install latest)
   - Use `docs/manuals/{package}-{version}.md` if exists
   - Update: package.json, Dockerfile, compose, README

### Phase 5: Quality & Handoff

**Quality gates (all must pass):**
1. **Type checking:** No type errors
2. **Linting:** Code formatting and style checks

**Commands:** See project documentation for specific quality commands.

**Linear update:**
1. Update **this task's** description: Replace all `- [ ]` with `- [x]` to mark checkboxes completed (via `update_issue`)
2. Add summary comment: What was done, key decisions, challenges
3. Move **ONLY this task**: "In Progress" → "To Review"
4. Update kanban_board.md (In Progress → To Review) for **ONLY this task**:
   - Find Task in parent Story section under "### In Progress"
   - Remove task line: `    - [LINEAR_ID: EP#_## Task Title](link)`
   - Add task line to same Story section under "### To Review"

**Note:** Story status management is handled by ln-30-story-executor (orchestrator), not by ln-31-task-executor (worker). See Separation of Concerns principle.

---

## Definition of Done

Before completing work, verify ALL checkpoints:

**✅ Implementation Complete:**
- [ ] All implementation steps from task description completed
- [ ] Code follows KISS/YAGNI principles (no over-engineering, no premature features)
- [ ] Guide patterns applied correctly (from Task Technical Approach links)
- [ ] No code duplication (checked existing codebase)
- [ ] "Existing Code Impact" section addressed: All refactoring completed, no backward compatibility / legacy code left

**✅ Quality Gates Passed:**
- [ ] Type checking: No type errors
- [ ] Linting: Code style compliant

**✅ Documentation Updated:**
- [ ] Inline comments added (15-20% ratio, WHY not WHAT, no Epic/Task IDs, no historical notes)
- [ ] STRUCTURE.md updated (if new components added)
- [ ] ARCHITECTURE.md updated (if architectural changes)
- [ ] tests/README.md updated (for test tasks: new test commands, setup instructions)

**✅ CRITICAL: Single Task Update Verified:**
- [ ] Verified via Linear: ONLY the selected task (input task ID) status was updated
- [ ] Verified via Linear: NO other tasks in the Story were updated
- [ ] Verified via kanban_board.md: ONLY one task line moved between sections

**✅ Linear Updated:**
- [ ] Task description updated: All checkboxes marked [x] (replaced `- [ ]` with `- [x]` via update_issue)
- [ ] Summary comment added to Linear: What done, key decisions, challenges
- [ ] Task status changed: "In Progress" → "To Review"
- [ ] kanban_board.md updated with hierarchical task movement:
  - Task found in parent Story section under "### In Progress"
  - Task line removed: `    - [LINEAR_ID: EP#_## Task Title](link)` (4-space indent)
  - Task line added to same Story section under "### To Review"
  - Epic header and Story structure preserved

**✅ Handoff Ready:**
- [ ] Chat output prefix used: ⚙️ [EXECUTOR] for all messages
- [ ] Final message: "⚙️ [EXECUTOR] Implementation complete. Quality gates passed. Ready for review."

**Output:** Implementation task ready for ln-32-task-reviewer (status "To Review")

---

## Example Usage

**Implementation task:**
```
Execute task API-42
```

## Best Practices

1. **Follow task description** - All details are in task (checkboxes, Technical Approach, AC)
2. **KISS and YAGNI** - Simplest solution that meets requirements
3. **Address Existing Code Impact** - Complete all refactoring, test updates, doc updates from task
4. **Document during implementation** - Never defer to "later" (update STRUCTURE.md, ARCHITECTURE.md, tests/README.md)
5. **Run quality gates continuously** - Don't wait until end (type checking, linting)
6. **Chat output prefix** - Always start chat messages with ⚙️ [EXECUTOR] prefix for user visibility when multiple skills are orchestrated

**Note:** For Story Finalizer test tasks (11 sections with Fix Existing Tests, Infrastructure, Documentation, Legacy Cleanup), use **ln-34-test-executor** instead.

---

**Version:** 10.1.0 (Removed Story status update logic - this is now ln-30-story-executor's responsibility per Separation of Concerns principle)
**Last Updated:** 2025-11-14

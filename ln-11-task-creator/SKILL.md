---
name: ln-11-task-creator
description: Creates ALL task types (implementation, refactoring, test). Generates task documents, validates type-specific rules, creates in Linear. Invoked by orchestrators.
---

# Universal Task Creator

**Universal factory** worker skill for creating ALL 3 task types in Linear. Invoked by orchestrators (ln-10-story-decomposer, ln-40-story-quality-gate, ln-50-story-test-planner) when new tasks needed.

## Overview

### What This Skill Does

**Creates tasks for ALL 3 types** from provided plan/data:
- **Implementation tasks** (from ln-10-story-decomposer): Feature development with Technical Approach
- **Refactoring tasks** (from ln-40-story-quality-gate): Code quality improvements with Regression Testing
- **Test tasks** (from ln-50-story-test-planner): E2E/Integration/Unit tests with Risk Priority Matrix

**Common workflow** for all types:
- Receives task plan/data from orchestrator
- Selects template based on `taskType` parameter
- Generates complete task documents (7/7/11 sections depending on type)
- Validates type-specific rules (NO test creation for impl, Regression testing for refactoring, Priority ≥15 for test)
- Shows preview with task summaries
- Creates tasks in Linear with proper hierarchy (parentId=Story)
- Updates kanban_board.md

### When This Skill Is Invoked

**Invoked by 3 orchestrators:**

1. **ln-10-story-decomposer** (CREATE MODE):
   - Story has NO existing tasks (Linear count = 0)
   - IDEAL plan generated (1-6 implementation tasks, Consumer-First ordered)
   - Parameter: `taskType: "implementation"`

2. **ln-40-story-quality-gate** (Path B - Issues Found):
   - Code quality issues detected (DRY/KISS/YAGNI/Architecture violations)
   - Need ONE refactoring task with all issues consolidated
   - Parameter: `taskType: "refactoring"`

3. **ln-50-story-test-planner** (Pass 1 - Manual Testing Passed):
   - All implementation tasks Done, manual testing successful
   - Need Story's final test task with E2E/Integration/Unit tests
   - Parameter: `taskType: "test"`

**Never invoked directly by users** - always through orchestrators.

### Input from Orchestrators

**Common parameters** (all orchestrators provide):
- **taskType**: `"implementation"` | `"refactoring"` | `"test"` (REQUIRED)
- **Team ID**: Linear team identifier
- **Story Data**: Story ID, title, description (AC, Technical Notes, Context)

**Type-specific parameters**:

**For implementation (from ln-10-story-decomposer):**
- **IDEAL Plan**: Array of 1-6 task specifications:
  ```
  [
    {
      title: "EP#_## Task title",
      description: "Goal description",
      estimate: "Xh",
      ac_scenarios: ["AC1", "AC2"],
      components: ["path/to/file"],
      guide_links: ["docs/guides/..."]
    },
    ...
  ]
  ```
- **Guide Links**: Extracted from Story Technical Notes "Related Guides:" section

**For refactoring (from ln-40-story-quality-gate):**
- **Code Quality Issues**: Array of DRY/KISS/YAGNI/Architecture violations with severity, files affected, before/after examples
- **Refactoring Plan**: Step-by-step fix plan (3 phases)
- **Affected Components**: Files to refactor, tests to update, docs to update

**For test (from ln-50-story-test-planner):**
- **Manual Test Results**: Structured comment (Format v1.0) from ln-40-story-quality-gate Pass 1 with AC, Test Results, Edge Cases, Error Handling, Integration
- **Test Plan**: E2E (2-5), Integration (0-8), Unit (0-15) tests with Priority ≥15 scenarios
- **Infrastructure Changes**: package.json, Dockerfile, docker-compose updates
- **Documentation Updates**: tests/README.md, README.md, CHANGELOG.md updates
- **Legacy Cleanup**: Workarounds, backward compat, deprecated patterns to remove

---

## Workflow

### Phase 1: Generate Task Documents

**Step 1: Select Template Based on taskType**

Read template from `references/` directory:
- `taskType: "implementation"` → Read `task_template_implementation.md` (7 sections, 146 lines)
- `taskType: "refactoring"` → Read `refactoring_task_template.md` (7 sections, 513 lines)
- `taskType: "test"` → Read `test_task_template.md` (11 sections, 542 lines)

**Step 2: Generate Task Documents**

**For EACH task in plan, generate complete document based on taskType:**

| Task Type | Sections | Key Content | Template |
|-----------|----------|-------------|----------|
| **implementation** | 7 | Context, Plan (3 phases), Tech Approach (library/APIs/pattern/guides), AC, Components, Impact, DoD | [task_template_implementation.md](references/) |
| **refactoring** | 7 | Context (DRY/KISS/YAGNI issues), Quality Issues (Category/Severity/Before/After), Goal, Plan (3 phases), Regression Strategy, Principles, AC | [refactoring_task_template.md](references/) |
| **test** | 11 | Context, Risk Matrix, E2E/Integration/Unit (Priority ≥15), Coverage, DoD, Fix Tests, Infra, Docs, Cleanup | [test_task_template.md](references/) |

**Details:** Each template in `references/` directory (owned by ln-11-task-creator). See template files for complete section descriptions.

### Phase 2: Type-Specific Validation

**Validates based on taskType parameter. Stops execution if validation fails.**

| Task Type | HARD RULE | Validation | Error Action |
|-----------|-----------|------------|--------------|
| **implementation** | NO test creation | Scan for: "write tests", "create tests", "add tests" (NOT allowed: unit/E2E/integration tests, test coverage). Allowed: "update existing tests" | Stop → Report error |
| **refactoring** | Regression Strategy REQUIRED | Verify sections: Code Quality Issues, Refactoring Plan (3 phases), Regression Strategy (Baseline + Verify + Failure). Verify: "Preserve Functionality" HARD RULE mentioned | Stop → Report error |
| **test** | Risk-Based Testing (Priority ≥15) | Verify: Risk Matrix exists, Priority ≥15 scenarios present, Test limits (E2E 2-5, Integration 0-8, Unit 0-15, Total 10-28), Anti-Framework (NO library/framework/DB tests) | Stop → Report error |

**Same validation logic as ln-12-task-replanner Phase 5.**

### Phase 3: Show Preview

Display task creation preview:

```
TASK CREATION PREVIEW for [Story ID: Story Title]:

Will create N tasks:

1. EP#_01: [Task Title]
   Goal: [Brief description]
   Estimate: X hours
   AC: [AC scenarios covered]
   Components: [Files to modify]

2. EP#_02: [Task Title]
   Goal: [Brief description]
   Estimate: X hours
   AC: [AC scenarios covered]
   Components: [Files to modify]

...

Total: N tasks, X hours estimated
Consumer-First ordering: ✓
Guide links included: X guide(s)

Type "confirm" to create all tasks in Linear.
```

### Phase 4: User Confirmation

**Check invocation context:**

**If invoked by orchestrator with `autoApprove: true` parameter:**
- ✅ **Skip user confirmation** → Proceed directly to Phase 5
- Rationale: Full pipeline automation mode (ln-00-story-pipeline)

**If invoked by user directly OR autoApprove not provided:**
- Wait for user input:
  - **"confirm"** → Continue to Phase 5
  - **Any other input** → Abort, return to orchestrator

### Phase 5: Create in Linear + Update Kanban

**Step 1: Create Linear Issues**

For EACH task in IDEAL plan:
```
Linear API: mcp__linear-server__create_issue({
  title: task.title,
  description: task.generated_document,
  parentId: Story.id,
  team: teamId,
  state: "Backlog"
})
```

**Capture Linear URLs** for each created task.

**Step 2: Update kanban_board.md**

**Location**: `docs/tasks/kanban_board.md`

**Action**: Add tasks under Story in "### Backlog" section

**Format**:
```markdown
### Backlog

**Epic N: Epic Title**

  📖 [LINEAR_ID: USXXX Story Title](story_url)
    - [TASK_ID: EP#_01 Task 1 Title](task_url)
    - [TASK_ID: EP#_02 Task 2 Title](task_url)
    - [TASK_ID: EP#_03 Task 3 Title](task_url)
```

**Rules**:
- Preserve Epic header (don't duplicate if exists)
- Maintain 2-space indent for Stories (📖)
- Maintain 4-space indent for Tasks (-)
- Preserve existing items in Backlog

**Step 3: Return Summary**

```
TASKS CREATED for [Story ID]:

✓ Created N tasks in Linear:
  1. [TASK_ID: EP#_01 Task Title](url)
  2. [TASK_ID: EP#_02 Task Title](url)
  ...

✓ kanban_board.md updated (Backlog section)

Total: N tasks, X hours estimated

NEXT STEPS:
- Run ln-20-story-validator to verify Story before execution (Backlog → Todo)
- Run ln-30-story-executor to start task execution (Todo → In Progress)
```

---

## Critical Rules

### 1. Type-Specific Validation (Enforced in Phase 2)

**For implementation (taskType="implementation"):**
- NO test creation allowed (scan for "write tests", "create tests")
- ERROR if detected → Stop execution
- Rationale: All new tests created by ln-50-story-test-planner after manual testing

**For refactoring (taskType="refactoring"):**
- Regression Testing Strategy REQUIRED
- Preserve Functionality HARD RULE must be mentioned
- All existing tests MUST pass after refactoring
- ERROR if strategy missing → Stop execution

**For test (taskType="test"):**
- Risk Priority Matrix REQUIRED (Priority ≥15 scenarios)
- Test limits enforced (E2E 2-5, Integration 0-8, Unit 0-15, Total 10-28)
- Anti-Framework compliance (NO tests for libraries/frameworks/databases)
- ERROR if Priority <15 all scenarios OR limits exceeded → Stop execution

### 2. Template Selection Based on taskType

**This skill owns ALL 3 templates** in `references/` directory:
- `task_template_implementation.md` (7 sections, 146 lines)
- `refactoring_task_template.md` (7 sections, 513 lines)
- `test_task_template.md` (11 sections, 542 lines)

**Selection logic** (Phase 1 Step 1):
```
if taskType == "implementation":
    template = read("references/task_template_implementation.md")
elif taskType == "refactoring":
    template = read("references/refactoring_task_template.md")
elif taskType == "test":
    template = read("references/test_task_template.md")
else:
    ERROR: Invalid taskType
```

### 3. Documentation Integration

**For implementation tasks:**
- Documentation REQUIRED in Affected Components section
- At minimum: README.md feature documentation
- Rationale: Documentation atomic with implementation (same task)

**For refactoring tasks:**
- Documentation REQUIRED in Affected Components + Existing Code Impact sections
- Update architecture docs if component structure changed
- Update guides if refactoring changes recommended patterns

**For test tasks:**
- Documentation REQUIRED in section 10 (Documentation Updates)
- tests/README.md (test commands), README.md (testing section), CHANGELOG.md (tested features)

### 4. Consumer-First Ordering (Implementation Tasks Only)

**For implementation tasks:**
- Task order received from orchestrator already has Consumer-First applied
- API endpoint → Service → Repository → Database
- **This skill preserves order** - does NOT reorder

**For refactoring/test tasks:**
- Not applicable (single task per orchestrator invocation)

### 5. No Code in Task Descriptions

Task descriptions contain approach and structure ONLY:
- **Implementation:** Library versions, key APIs, high-level pseudocode (5-10 lines max)
- **Refactoring:** Before/After code examples (for understanding), NOT full implementation
- **Test:** Test flow steps (Setup → Actions → Verify), NOT actual test code

**Rationale**: Code is written during execution (ln-31-task-executor, ln-33-task-rework, ln-34-test-executor), not during planning.

---

## Definition of Done

Before completing work, verify ALL checkpoints:

**✅ Task Documents Generated (Phase 1):**
- [ ] All N tasks have complete 7-section documents
- [ ] Context: Current/Desired state clear
- [ ] Implementation Plan: 3 phases with checkboxes
- [ ] Technical Approach: Library versions, key APIs, pseudocode, guide links included
- [ ] Acceptance Criteria: Given-When-Then scenarios from Story AC
- [ ] Affected Components: Implementation + Documentation files
- [ ] Existing Code Impact: Refactoring + Tests to update + Docs to update
- [ ] Definition of Done: Standard checklist

**✅ NO Test Creation Validated (Phase 2):**
- [ ] All task descriptions scanned for test phrases
- [ ] NO "write tests", "create tests", "add unit tests" found
- [ ] Tests to Update section ONLY lists existing tests (if any)
- [ ] No test creation detected → Validation passed

**✅ Preview Shown (Phase 3):**
- [ ] Task summaries displayed (title, goal, estimate, AC, components)
- [ ] Total count and hours shown
- [ ] Consumer-First ordering confirmed
- [ ] Guide links count displayed

**✅ User Confirmed (Phase 4):**
- [ ] User typed "confirm"
- [ ] Ready to create in Linear

**✅ Linear Issues Created (Phase 5):**
- [ ] All N tasks created in Linear
- [ ] parentId set to Story ID (hierarchy preserved)
- [ ] team, state fields set correctly
- [ ] Linear URLs captured

**✅ kanban_board.md Updated (Phase 5):**
- [ ] Tasks added under Story in Backlog section
- [ ] Epic header preserved (not duplicated)
- [ ] Indentation correct (2-space Story, 4-space Tasks)
- [ ] Existing items preserved

**✅ Summary Returned (Phase 5):**
- [ ] Created tasks list with Linear URLs
- [ ] kanban_board.md update confirmed
- [ ] Total count and hours displayed
- [ ] Next steps provided (ln-20-story-validator, ln-30-story-executor)

**Output**: N Linear Issue URLs + operation summary + next steps

---

## Reference Files

### ALL 3 Templates (Universal Factory Ownership)

**Location**: `references/` directory (owned by this skill)

**1. task_template_implementation.md**
- **Purpose**: Implementation task template (7 sections, 146 lines)
- **Used for**: Feature development tasks (from ln-10-story-decomposer)
- **Key sections**: Technical Approach (Library, APIs, Pattern), Implementation Plan
- **Version**: 6.0.1 (renamed from universal)

**2. refactoring_task_template.md**
- **Purpose**: Refactoring task template (7 sections, 513 lines)
- **Used for**: Code quality improvement tasks (from ln-40-story-quality-gate)
- **Key sections**: Code Quality Issues (DRY/KISS/YAGNI), Refactoring Plan (3 phases), Regression Testing Strategy
- **Version**: 2.0.0 (expanded with regression testing)

**3. test_task_template.md**
- **Purpose**: Test task template (11 sections, 542 lines)
- **Used for**: Story's final test task (from ln-50-story-test-planner)
- **Key sections**: Risk Priority Matrix, E2E/Integration/Unit tests (sections 3-5), Existing Tests to Fix (section 8), Infrastructure/Docs/Cleanup (sections 9-11)
- **Version**: 3.0.0

---

## Integration with Orchestrators

### Called By (3 Orchestrators)

**1. ln-10-story-decomposer (CREATE MODE):**
```javascript
Phase 3: Check Existing Tasks → Count = 0
Phase 4a: Delegate to ln-11-task-creator
  Skill(skill: "ln-11-task-creator", {
    taskType: "implementation",
    teamId: teamId,
    storyData: {...},
    idealPlan: IDEAL_PLAN,
    guideLinks: extractedGuideLinks
  })
```

**2. ln-40-story-quality-gate (Phase 6 Path B - Issues Found):**
```javascript
Phase 5: Code Quality Analysis → Issues found
Phase 6 Path B: Create refactoring task
  Skill(skill: "ln-11-task-creator", {
    taskType: "refactoring",
    teamId: teamId,
    storyData: {...},
    codeQualityIssues: issues,
    refactoringPlan: plan,
    affectedComponents: components
  })
```

**3. ln-50-story-test-planner (Phase 6 - After Manual Testing):**
```javascript
Phase 5: Test Plan Analysis → Priority ≥15 scenarios selected
Phase 6: Invoke ln-11-task-creator
  Skill(skill: "ln-11-task-creator", {
    taskType: "test",
    teamId: teamId,
    storyData: {...},
    manualTestResults: results,
    testPlan: plan,
    infrastructureChanges: infra,
    documentationUpdates: docs,
    legacyCleanup: cleanup
  })
```

### Returns To (3 Orchestrators)

**Success** (all orchestrators):
- Task URLs (Linear issue links)
- Operation summary
- kanban_board.md update confirmation

**Error** (validation failures):
- Implementation: Test creation detected
- Refactoring: Regression testing strategy missing
- Test: Priority ≥15 scenarios missing OR test limits exceeded

### Context Propagation

**Orchestrators provide**:
- taskType (REQUIRED) - determines template selection and validation
- Team ID (auto-discovered by orchestrators from kanban_board.md)
- Story data (loaded from Linear by orchestrators)
- Type-specific parameters (IDEAL plan, code quality issues, test plan)

**Worker (this skill) does NOT**:
- Query Linear for Story (already in context)
- Analyze Story complexity (ln-10-story-decomposer does this)
- Analyze code quality (ln-40-story-quality-gate does this)
- Perform manual testing (ln-40-story-quality-gate does this)
- Build plans (receives pre-built plans from orchestrators)

---

## Best Practices

### Task Generation

**Use Template**: Follow task_template_universal.md structure strictly

**Technical Approach Section**: Focus on KEY APIs (2-5 methods), not exhaustive docs. Keep 200-300 words max.

**Implementation Plan**: 3 phases (Setup → Implementation → Integration/Polish), 2-4 steps each

**Acceptance Criteria**: Map Story AC to task scope (don't copy all Story AC, only relevant ones)

### Validation

**Strict Test Check**: Scan ALL generated text, including Implementation Plan checkboxes

**Error Early**: Stop immediately if test creation detected (don't create any tasks)

### Linear Integration

**parentId Critical**: Always set to Story ID for hierarchy

**State**: Always "Backlog" (tasks move to Todo after ln-20-story-validator approval)

**Labels**: Auto-added by Linear based on components (backend, frontend, database)

### kanban_board.md Updates

**Preserve Structure**: Don't reformat existing content

**Epic Headers**: Reuse if exists, don't duplicate

**Indentation**: 2-space Story, 4-space Tasks (critical for parsing)

---

**Version:** 2.2.0
**Last Updated:** 2025-11-14

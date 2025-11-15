---
name: ln-32-task-reviewer
description: Reviews completed tasks for To Review → Done/Rework transition. Auto-discovers project configuration.
---

# Task Review Skill

Review completed tasks (To Review → Done/Rework) using comprehensive checklist.

## When to Use This Skill

This skill should be used when reviewing completed task (status = To Review) before moving to Done or Rework.

## Zero Tolerance Policy

**IMPORTANT:** No issues can be deferred "for later".

- All found issues are resolved **immediately**
- Either via **Minor Fixes** (reviewer applies)
- Or via **Needs Rework** (author fixes)
- **Cannot Accept task** if ANY unresolved issue remains

No "technical debt", "can improve later", "this is minor, skip it" - everything fixed now.

## How It Works

### Phase 1: Discovery (Automated)

Auto-discovers project configuration:
- **Team ID:** Reads `docs/tasks/readme.md`, `docs/tasks/kanban_board.md` → Linear Configuration
- **Project Docs:** Reads `CLAUDE.md` → Links to `docs/core/`, `docs/guides/`
- **Tracker:** Linear MCP integration

### Phase 2: Preparation

**Steps:**
1. **Select task:**
   - If task ID provided → Fetch specific task
   - If no ID → List "To Review" tasks and ask user to choose
2. **Determine task type:**
   - **Test Task:** Has label "tests" OR created by ln-50-story-test-planner
   - **Implementation Task:** All other tasks
3. **Read task and parent story FULLY:**
   - Read task description COMPLETELY (no truncation)
   - If task has parentId → Read parent User Story COMPLETELY (no truncation)
   - Understand acceptance criteria, context, technical approach from BOTH
4. **Load artifacts:** Changed files, diffs, commit messages
5. **Load affected docs:** STRUCTURE.md, ARCHITECTURE.md, guides/, tests/README.md
6. **Search for code duplication:**
   - Grep for similar function/class names in project
   - Check utils/, helpers/, shared/ directories for existing abstractions
   - Review components from task's "Affected Components" section
   - Search for similar validation/transformation patterns
7. **Study Project Test Files (for test tasks only):**
   If reviewing test task (label "tests"):
   - Read tests/README.md (commands, setup, test requirements)
   - Review test configs (framework type, version)
   - Check existing tests (patterns and conventions)
   - Verify test limits (2-5 E2E, 3-8 Integration, 5-15 Unit, 10-28 total)
   - Ensures Phase 3.2 checks align with project standards

**Reference:** For test tasks, see `ln-50-story-test-planner/references/test_task_template.md` for 11-section Story Finalizer structure and `ln-50-story-test-planner/references/risk_based_testing_guide.md` for Risk Priority methodology and test limits.

### Phase 3: Review Checklist

#### 3.1 Universal Checks (All Tasks)

**Architecture & Design:**
- Layered boundaries respected (no direct DB or cross-layer calls)
- Async/await and error handling consistent
- No hardcoded values:
  - Paths (file paths, URLs, API endpoints)
  - Credentials (passwords, tokens, API keys)
  - Magic numbers (timeouts, limits, thresholds, retry counts, buffer sizes)
  - Configuration values should be in config files or environment variables
  - Named constants must have explanatory comments (WHY this value)

**Code Quality & Principles:**

**DRY (Don't Repeat Yourself):**
- Search existing codebase for similar implementations (use Grep)
- Check if logic duplicates existing helpers/utils directories
- Verify no copy-paste within current changes (2+ similar blocks)
- If duplication found → recommend refactoring (extract to shared method/function, service, or base class)

**KISS (Keep It Simple):**
- Is solution simpler than necessary? (over-engineered)
- Can it be simplified without losing functionality?
- Are there unnecessary abstractions or design patterns?
- Does complexity match task requirements?

**YAGNI (You Aren't Gonna Need It):**
- Is all added code necessary for current task?
- Are there unused parameters/functions/features?
- Is there premature optimization not in requirements?
- Does code add features beyond task scope?

**Red Flags:**
- Copy-pasted code blocks in different files
- Similar validation logic without using existing abstractions
- 3+ similar functions that could be refactored into shared method
- Complex architecture for simple CRUD operations

**Existing Code Impact:**
- All refactoring completed as specified in task
- All existing tests updated and passing
- All affected documentation updated
- No legacy code left: backward compatibility removed, workarounds cleaned up
- **Proactive duplication check:**
  * Search for similar code NOT mentioned in task
  * Verify no duplicate logic introduced
  * Recommend refactoring if 2+ similar blocks found (shared method/function, service, base class)
  * Check if other components need same refactoring

**Documentation:**
- Inline comments concise and necessary (WHY not WHAT)
- Updated: STRUCTURE.md (components), ARCHITECTURE.md (logic)
- For tasks implementing architectural patterns → verify guides/ followed correctly

**Security & Quality:**
- No secrets or PII logged
- Input validation / database injection prevention
- Quality gates pass (tests, types, lint)

#### 3.2 Task Type-Specific Checks

**For Test Tasks:**
- **Run test environment:** `docker-compose -f docker-compose.test.yml up --abort-on-container-exit` → All tests must pass
- E2E (2-5), Integration (3-8), Unit (5-15) tests present and pass, total 10-28
- All Priority ≥15 scenarios from manual testing tested
- "Test OUR code, not frameworks" (business logic: calculations, validations, workflows)
- No test duplication - Each test adds unique business value
- Trivial code skipped (simple CRUD, framework code, getters/setters)
- tests/README.md updated if needed

**For Implementation Tasks:**
- No test requirements (tests in Story's final test task)

### Phase 4: Verdict & Update

**Steps:**
1. **Determine verdict** based on Phase 3 findings: Accept / Minor Fixes / Needs Rework
2. **Create TodoWrite** for chosen verdict workflow
3. **Execute todos** sequentially

**Verdict-specific workflows:**

1. **Accept** ✅
   - **Definition of Done:** Architecture ✓ DRY ✓ KISS ✓ YAGNI ✓ Tests ✓ Refactoring ✓ Docs ✓ Security ✓
   - Create TodoWrite todos:
     * Update task description with completed checkboxes (replace `- [ ]` with `- [x]` via update_issue)
     * Update status to "Done" (Linear)
     * Update kanban_board.md:
       - Move Task from "### To Review" to "### Done (Last 5 tasks)"
       - Preserve hierarchy (Epic header → Story 📖 → Task -)
       - If > 5 tasks in Done: remove oldest task
     * Add approval comment to Linear
     * Commit changes: `[TASK-ID] type: brief description` (type = feat/fix/test/docs/refactor)
   - Execute todos

2. **Minor Fixes** 🔧
   - **Trivial ONLY:** formatting/whitespace, typos in comments/docs, import ordering, renaming for clarity
   - Create TodoWrite todos:
     * Apply trivial fixes
     * Re-run quality gates
     * Update status to "Done" (Linear)
     * Update kanban_board.md:
       - Move Task from "### To Review" to "### Done (Last 5 tasks)"
       - Preserve hierarchy, limit 5 tasks
     * Add "minor fixes applied" comment
     * Commit changes: `[TASK-ID] type: brief description` (type = feat/fix/test/docs/refactor)
   - Execute todos

3. **Needs Rework** ❌
   - **ALL NOT trivial → Rework:** logic bugs, duplication, over-engineering, excess features, failing tests, Priority ≥15 scenarios not tested, test limits violated (>28 tests), architecture issues, security issues
   - Create TodoWrite todos:
     * Add detailed feedback comment to Linear
     * Update status to "To Rework" (Linear)
     * Update kanban_board.md:
       - Move Task from "### To Review" to "### To Rework"
       - Preserve hierarchy (Epic header → Story 📖 → Task -)
   - Execute todos
   - Do NOT commit changes

## Example Usage

**Direct invocation:**
```
Review task API-42
```

---

## Definition of Done

Before completing work, verify ALL checkpoints:

**✅ Review Checklist Complete:**
- [ ] All Phase 3 checklist sections verified:
  - Universal Checks: Architecture, DRY, KISS, YAGNI, Existing Code Impact, Documentation, Security & Quality
  - Task Type-Specific: Test tasks (docker-compose.test.yml run, test limits, Priority ≥15 scenarios) OR Implementation tasks
- [ ] Code diffs reviewed thoroughly (no skipped files)
- [ ] Existing codebase searched for duplication (Grep used)
- [ ] Guide patterns followed correctly (if Task had guide links)

**✅ Verdict Determined:**
- [ ] Verdict chosen based on findings: Accept ✅ / Minor Fixes 🔧 / Needs Rework ❌
- [ ] Verdict aligns with Zero Tolerance Policy (NO issues deferred "for later")
- [ ] If Minor Fixes: Issues are truly trivial (formatting, typos, import ordering ONLY)
- [ ] If Needs Rework: Detailed feedback prepared with specific items to fix

**✅ Verdict Applied:**
- [ ] **For Accept/Minor Fixes:**
  - All implementation steps from task description completed
  - Task description updated: All checkboxes marked [x] (replaced `- [ ]` with `- [x]` via update_issue)
  - Git commit created: `[TASK-ID] type: brief description` (AFTER Linear/kanban updates)
  - Linear status updated to "Done"
  - kanban_board.md updated:
    * Task moved from "### To Review" to "### Done (Last 5 tasks)"
    * Hierarchy preserved (Epic → Story → Task)
    * If > 5 tasks: oldest removed
  - Approval comment added to Linear
- [ ] **For Needs Rework:**
  - Detailed feedback comment added to Linear (specific issues, what to fix, why)
  - Linear status updated to "To Rework"
  - kanban_board.md updated:
    * Task moved from "### To Review" to "### To Rework"
    * Hierarchy preserved (Epic → Story → Task)
  - NO commit made

**✅ Quality Verification (for test tasks):**
- [ ] docker-compose.test.yml run successful (all tests passed)
- [ ] Test limits verified: E2E (2-5), Integration (3-8), Unit (5-15), total 10-28
- [ ] All Priority ≥15 scenarios from manual testing tested
- [ ] No test duplication found

**✅ Handoff Complete:**
- [ ] Chat output prefix used: 🔍 [REVIEWER] for all messages
- [ ] Final message:
  - Accept: "🔍 [REVIEWER] Approved. Task moved to Done."
  - Minor Fixes: "🔍 [REVIEWER] Minor fixes applied. Task moved to Done."
  - Needs Rework: "🔍 [REVIEWER] Needs rework. Feedback added to Linear."

**Output:** Task moved to Done (approved) OR To Rework (with feedback)

---

## Best Practices

1. **Follow checklist completely** - All sections must be verified
2. **Distinguish task types** - Test tasks have different requirements than implementation tasks
3. **Minor fixes only for trivial issues** - Major issues → Rework
4. **Detailed feedback for rework** - Explain what needs fixing and why
5. **Re-run quality gates after fixes** - Ensure nothing broke
6. **For test tasks** - Verify test limits (2-5 E2E, 3-8 Integration, 5-15 Unit, 10-28 total) and Priority ≥15 scenarios tested
7. **Chat output prefix** - Always start chat messages with 🔍 [REVIEWER] prefix for user visibility when multiple skills are orchestrated

### Review Examples

**Example 1: Implementation Task Review**

Task: "Implement user validation service"

**Phase 2 - Determine task type:**
- No label "tests" → Implementation Task
- Review using Universal Checks (3.1) only

**Phase 3 - Universal Checks:**
- Architecture ✓ (Service layer, no direct DB calls)
- DRY → Found issue: Validation logic duplicates `utils/validators.ts`
- KISS ✓
- YAGNI → Found issue: Added caching feature not in requirements
- Existing Code Impact ✓
- Documentation → Found issue: STRUCTURE.md not updated
- Security ✓

**Verdict:** Needs Rework ❌
- Remove caching (YAGNI violation)
- Refactor to use existing `utils/validators.ts` (DRY violation)
- Update STRUCTURE.md

---

**Example 2: Test Task Review**

Task: "Test task for US001: User Authentication"

**Phase 2 - Determine task type:**
- Has label "tests" → Test Task
- Review using Universal Checks (3.1) + Test-specific checks (3.2)

**Phase 3.1 - Universal Checks:**
- Architecture ✓
- DRY ✓
- KISS ✓
- YAGNI ✓
- Existing Code Impact ✓
- Documentation → Found issue: tests/README.md not updated
- Security ✓

**Phase 3.2 - Test-specific checks:**
- Tests pass ✓ (E2E 3, Integration 6, Unit 12, total 21)
- Test limits ✓ (within 10-28 range)
- Priority ≥15 scenarios → Found issue: Payment calculation edge case not tested (Priority 20 from manual testing)
- "Test OUR code" ✓
- No test duplication ✓
- tests/README.md → Missing

**Verdict:** Needs Rework ❌
- Add test for payment calculation edge case (Priority 20 scenario missing)
- Update tests/README.md with new test commands

---

**Version:** 7.3.0 (Hardcoded values expanded)
**Last Updated:** 2025-11-07

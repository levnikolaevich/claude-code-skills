---
name: x-task-rework
description: This skill should be used when addressing review feedback and fixing issues in tasks marked To Rework. Analyzes feedback, applies fixes following KISS/YAGNI/DRY principles, runs quality gates (type checking, linting), and submits task back To Review status. Auto-discovers project configuration. Works with Linear.
---

# Task Rework Skill

Fix issues in tasks (To Rework → In Progress → To Review) based on review feedback.

## When to Use This Skill

This skill should be used when fixing issues in task (status = To Rework) after review feedback.

## How It Works

### Phase 1: Discovery (Automated)

Auto-discovers Team ID and project configuration from `docs/tasks/kanban_board.md` and `CLAUDE.md`.

**Details:** See CLAUDE.md "Configuration Auto-Discovery".

### Phase 2: Preparation

**Steps:**
1. **Select task:**
   - If task ID provided → Fetch specific task
   - If no ID → List "To Rework" tasks and ask user to choose
2. **Read review feedback:** Load all comments with Must-fix items
3. **Identify scope:** Code, tests, documentation, architecture, and Existing Code Impact items
4. **Track progress:** Create TodoWrite todos with full workflow:
   - Update status to "In Progress" (Linear)
   - Update kanban_board.md (To Rework → In Progress):
     * Find Task in parent Story section under "### To Rework"
     * Remove task line: `    - [LINEAR_ID: EP#_## Task Title](link)` (4-space indent)
     * Add task line to same Story section under "### In Progress"
     * Preserve Epic header and Story structure
   - Address each Must-fix item from review feedback
   - Complete Existing Code Impact tasks (refactoring, existing tests, documentation)
   - Quality gates: type checking, linting, [for test tasks] re-run tests + check coverage ≥80%
   - Add rework summary comment
   - Update status to "To Review" (Linear)
   - Update kanban_board.md (In Progress → To Review):
     * Find Task in parent Story section under "### In Progress"
     * Remove task line from In Progress
     * Add task line to same Story section under "### To Review"
5. **Execute first todo:** Update status to "In Progress" in Linear
6. **Execute second todo:** Update kanban_board.md with hierarchical task movement (Epic → Story → Task preserved)

### Phase 3: Implementation

**Process:**
1. **Address each Must-fix item** from review feedback
2. **Follow principles:** KISS / YAGNI / DRY
3. **Apply fixes:** Code changes, test updates, documentation corrections
4. **Complete Existing Code Impact:**
   - Finish all refactoring from task's "Existing Code Impact" section
   - Update all existing tests (maintain passing status)
   - Update all affected documentation
5. **Request clarification:** If new or unclear issues appear, document and ask before proceeding

**Quality validation:**
- Run quality gates (types, lint)
- **For test tasks only:** Run all tests, verify Priority ≥15 scenarios covered, check test limits (10-28 total)
- Re-run specific tests mentioned in review (if applicable)
- Fix all newly surfaced issues immediately

**Documentation updates:**
- Update affected docs (STRUCTURE.md, ARCHITECTURE.md, guides/, tests/README.md)
- Keep concise, link instead of duplicate

### Phase 4: Submit for Re-Review

**Steps:**
1. **Add rework summary comment:**
   - List all fixes applied
   - Reference each Must-fix item addressed
   - **For test tasks only:** Note Priority ≥15 scenarios tested and test limits (10-28 total)
   - Note quality gates status
2. **Update status:** In Progress → To Review
3. **Update kanban_board.md with hierarchical task movement:**
   - Find Task in parent Story section under "### In Progress"
   - Remove task line: `    - [LINEAR_ID: EP#_## Task Title](link)` (4-space indent)
   - Add task line to same Story section under "### To Review"
   - Preserve Epic header and Story structure

**Important:**
- Do NOT commit changes (commits happen after final approval)
- Do NOT close task
- Focus solely on fixes and updates

---

## Definition of Done

Before completing work, verify ALL checkpoints:

**✅ Review Feedback Addressed:**
- [ ] All Must-fix items from reviewer feedback completed
- [ ] Should-fix items completed (if time permits)
- [ ] Root causes fixed (not just symptoms)
- [ ] No additional issues introduced

**✅ Fixes Applied:**
- [ ] Code changes follow KISS/YAGNI principles (no over-engineering)
- [ ] DRY violations removed (refactored to shared method/function/service/base class)
- [ ] Guide patterns applied correctly (if feedback mentioned guide compliance)
- [ ] No code duplication introduced

**✅ Quality Gates Passed:**
- [ ] Type checking: No type errors
- [ ] Linting: Code style compliant
- [ ] **For test tasks:** All tests pass, test limits verified (10-28), Priority ≥15 scenarios tested
- [ ] All quality gates that failed in review now pass

**✅ Linear Updated:**
- [ ] Fixes comment added to Linear:
  - "Rework complete. Addressed feedback:"
  - List of fixed items (what was fixed, how)
  - Reference to review feedback items
- [ ] Task status changed: "To Rework" → "To Review"
- [ ] kanban_board.md updated with hierarchical task movement:
  - Task found in parent Story section under "### To Rework"
  - Task line removed: `    - [LINEAR_ID: EP#_## Task Title](link)`
  - Task line added to same Story section under "### To Review"
  - Epic header and Story structure preserved

**✅ NO Premature Actions:**
- [ ] NO git commit made (commits happen after x-task-reviewer approval)
- [ ] Task NOT closed (remains To Review for re-review)
- [ ] Only fixes applied (no scope creep, no new features)

**Output:** Task ready for re-review by x-task-reviewer (status "To Review")

---

## Example Usage

**Direct invocation:**
```
Rework task API-42 based on review feedback
```

## Best Practices

1. **Address all Must-fix items** - Check each item in review feedback
2. **Request clarification early** - If unclear, ask before coding
3. **Run quality gates continuously** - Don't wait until end
4. **Document all changes** - Clear summary for re-review

---

**Version:** 5.1.0 (Hierarchical kanban_board.md updates)
**Last Updated:** 2025-11-08

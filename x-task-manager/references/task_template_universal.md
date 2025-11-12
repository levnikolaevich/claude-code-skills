# Task Title
<!-- Task Size Guideline: Optimal 3-5 hours development time (atomic, testable unit). Too small < 3h → combine with related work. Too large > 8h → decompose further. -->
<!-- SCOPE: Implementation tasks ONLY. DO NOT create new tests in this task.
     New tests (E2E/Integration/Unit) are created separately by x-story-finalizer after manual testing passes.
     This task may update existing tests if implementation changes break them. -->

**Epic:** [Epic N - Epic Name](link) *(optional)*
**User Story:** [USXXX Story Name](link) *(parent task - this task will have parentId=USXXX)*
**Related:** TEAM-XX, TEAM-YY

---

## Context

### Current State
- What exists now?
- What's the problem or limitation?

### Desired State
- What should exist after completion?
- What benefits will this bring?

---

## Implementation Plan

### Phase 1: [Description]
- [ ] Step 1
- [ ] Step 2

### Phase 2: [Description]
- [ ] Step 1
- [ ] Step 2

### Phase 3: [Description]
- [ ] Step 1
- [ ] Step 2

---

## Technical Approach

**Recommended:** [Approach name]

**Why this approach:**
- Reason 1
- Reason 2

**Patterns Used:**
- Pattern 1
- Pattern 2

**Alternatives Considered:**
- Alternative 1: Why rejected
- Alternative 2: Why rejected

---

## Acceptance Criteria

- [ ] **Given** [context] **When** [action] **Then** [result]
- [ ] **Given** [context] **When** [action] **Then** [result]
- [ ] **Given** [context] **When** [action] **Then** [result]

---

## Affected Components

### Implementation
- `path/to/file` - Changes

### Documentation (REQUIRED in this task)
- `README.md` - Feature documentation
- `docs/api.md` - API updates

---

## Existing Code Impact

### Refactoring Required
- `path/to/file` - What needs refactoring and why

### Tests to Update (ONLY Existing Tests Affected by This Task)
**SCOPE:** ONLY list existing tests that break due to implementation changes (refactoring, logic updates).
DO NOT create new tests here. New tests are created by x-story-finalizer after manual testing.

**Examples of valid updates:**
- Mock/stub changes when function signatures change
- Assertion updates when return values change
- Test data updates when validation logic changes

- `tests/path/test_file` - Why this existing test needs updates

### Documentation to Update
- `docs/file.md` - Existing docs to update

---

## Definition of Done

- [ ] All acceptance criteria met
- [ ] All existing code refactored (no backward compatibility / legacy code left)
- [ ] All existing tests updated (if any were affected by implementation changes)
- [ ] NO new tests created (new tests are in Story's final test task by x-story-finalizer)
- [ ] Documentation updated
- [ ] Code reviewed

---

**Template Version:** 5.1.0 (Task size guideline)
**Last Updated:** 2025-11-07
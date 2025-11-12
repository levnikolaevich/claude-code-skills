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

### Recommended Solution
**Library/Framework:** [name] v[version] ([stability: LTS/stable/beta])
**Documentation:** [official docs URL]

**Standards compliance:** [RFC/spec if applicable, e.g., RFC 6749 for OAuth 2.0]

### Key APIs
**Primary methods:**
- `[method_signature]` - [purpose and when to use]
- `[method_signature]` - [purpose and when to use]
- `[method_signature]` - [purpose and when to use]

**Configuration:**
- `[parameter]`: [value/type] - [purpose and impact]
- `[parameter]`: [value/type] - [purpose and impact]

### Implementation Pattern
**Core logic:**
```pseudocode
[High-level pseudocode showing main integration flow]
[Focus on HOW to integrate library/API, not full business logic]
[5-10 lines maximum - this is a guide, not implementation]
```

**Integration points:**
- **Where:** [file/module path where integration happens]
- **How:** [dependency injection / direct import / middleware / decorator / etc.]
- **When:** [startup / request handler / background task / etc.]

### Why This Approach
- [Reason 1: Standards compliance or industry best practice reference]
- [Reason 2: Performance/Security/Maintainability/Team familiarity benefit]

### Patterns Used
- [Pattern 1] - [purpose in this context]
- [Pattern 2] - [purpose in this context]

### Known Limitations
- [Limitation 1: e.g., no async support, memory constraints] - [workaround or mitigation if any]
- [Limitation 2: e.g., compatibility issue, deprecated feature] - [impact on implementation]

### Alternatives Considered
- **Alternative 1:** [name] - [why rejected: outdated/over-engineered/non-standard/lacking feature]
- **Alternative 2:** [name] - [why rejected: performance/complexity/compatibility]

---

**SCOPE NOTE:** This Technical Approach should be 200-300 words max. Focus on KEY APIs (2-5 methods) and integration points, NOT exhaustive API documentation. This specification guides implementation without prescribing every detail. Executor discovers full implementation specifics during execution.

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

**Template Version:** 6.0.0 (Expanded Technical Approach with library versions, key APIs, pseudocode, limitations)
**Last Updated:** 2025-11-12
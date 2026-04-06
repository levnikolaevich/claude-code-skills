# Task Title
<!-- Task Size Guideline: Optimal 3-5 hours development time (atomic, testable unit). Too small < 3h -> combine with related work. Too large > 8h -> decompose further. -->
<!-- SCOPE: Implementation tasks ONLY. DO NOT create new tests in this task.
     New tests (E2E/Integration/Unit) are created separately by test planner after manual testing passes.
     This task may update existing tests if implementation changes break them. -->

**Epic:** [Epic N - Epic Name](link) *(optional)*
**User Story:** [USXXX Story Name](link-or-path) *(parent story)*
**Related:** T001, T002
**Parallel Group:** {N}

---

## Context

### Current State
- What exists now?
- What's the problem or limitation?

### Desired State
- What should exist after completion?
- What benefits will this bring?

### Inherited Assumptions
- **A1 (FEASIBILITY):** {{relevant assumption from parent Story}}

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

<!-- Include when this task covers ACs where an actor must invoke/consume a mechanism (criterion #17c). Remove if task is pure infrastructure with no consumer. -->
### Scenario Integration
> For each AC this task covers where an actor (user, bot, scheduler, handler, pipeline) must invoke or consume a mechanism, trace all 5 segments.

| AC | Actor Trigger | Entry Point | Discovery | Usage Context | Observable Outcome |
|----|--------------|-------------|-----------|---------------|-------------------|
| [AC ref] | [What initiates: user message, timer fire, webhook arrival, event enqueue] | [Named mechanism: tool/endpoint/command/component/config/prompt section] | [How the actor's system finds it: config registration, route mount, plugin load, system prompt, env var] | [What the actor's system needs to invoke it: instructions, prompts, schemas, param guidance, docs] | [Verifiable result: response, state change, log entry, notification] |

### Why This Approach
- [Reason 1: Standards compliance or industry best practice reference]
- [Reason 2: Performance/Security/Maintainability/Team familiarity benefit]

### Patterns Used
- [Pattern 1] - [purpose in this context]
- [Pattern 2] - [purpose in this context]

### Known Limitations
- [Limitation 1: e.g., no async support, memory constraints] - [workaround or mitigation if any]
- [Limitation 2: e.g., compatibility issue, deprecated feature] - [impact on implementation]

### Error Handling Strategy

**Expected errors (this task):**
| Error Type | HTTP Status | When Occurs | User Message |
|------------|-------------|-------------|--------------|
| [ValidationError] | 400 | [Invalid input] | [Friendly message] |
| [AuthError] | 401/403 | [Token expired/No permission] | [Friendly message] |
| [NotFoundError] | 404 | [Resource missing] | [Friendly message] |

**Retry logic:**
- Retryable: [List transient errors: 503, timeout, connection reset]
- Backoff: [exponential with jitter, max 3 retries, initial 1s]

**Validation approach:**
- Input validation: [Pydantic/Zod schema, fail-fast]
- Error response: [Match Story Error Handling Strategy format]

### Logging Requirements

**Log events (this task):**
| Event | Level | Data Fields | Purpose |
|-------|-------|-------------|---------|
| [request_received] | INFO | [correlation_id, user_id, endpoint] | [Audit] |
| [validation_failed] | WARN | [correlation_id, field, error] | [Debug] |
| [operation_completed] | INFO | [correlation_id, duration_ms] | [Metrics] |
| [unexpected_error] | ERROR | [correlation_id, stack_trace] | [Alerting] |

**Audit trail:**
- Track: [Who, What, When, Outcome for sensitive operations]

**Performance logging:**
- Threshold: [Log WARN if operation > 500ms]

<!-- Include when task has destructive ops per shared/references/destructive_operation_safety.md. Remove if N/A. -->
### Destructive Operation Safety
> **MANDATORY READ:** `shared/references/destructive_operation_safety.md`

**Operations:** [list each destructive operation]
**Severity:** [CRITICAL / HIGH / MEDIUM per shared reference classification]
**Backup plan:** [what + how to verify]
**Rollback plan:** [undo procedure + tested where]
**Blast radius:** [resources + scope + downtime]
**Environment guard:** [env check or admin confirmation]
**Preview / dry-run:** [what-if output, SQL diff, terraform plan — attach or reference]

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
- Side-effects introduced: [DB writes, notifications, events, HTTP calls]
- Side-effect depth: [1-2 = flat, 3+ = document justification]

### Documentation (REQUIRED in this task)
- `README.md` - Feature documentation
- `{{DOCS_PATH}}/api.md` - API updates

---

## Existing Code Impact

### Refactoring Required
- `path/to/file` - What needs refactoring and why

### Tests to Update (ONLY Existing Tests Affected by This Task)
**SCOPE:** ONLY list existing tests that break due to implementation changes (refactoring, logic updates).
DO NOT create new tests here. New tests are created by test planner after manual testing.

**Examples of valid updates:**
- Mock/stub changes when function signatures change
- Assertion updates when return values change
- Test data updates when validation logic changes

- `tests/path/test_file` - Why this existing test needs updates

### Documentation to Update
- `{{DOCS_PATH}}/file.md` - Existing docs to update

---

## Definition of Done

- [ ] All acceptance criteria met
- [ ] All existing code refactored (no backward compatibility / legacy code left)
- [ ] All existing tests updated (if any were affected by implementation changes)
- [ ] NO new tests created (new tests are in Story's final test task by test planner)
- [ ] Documentation updated
- [ ] Code reviewed

---

## Template Placeholders

When copying this template to a project, replace these placeholders:

| Placeholder | Source | Example |
|-------------|--------|---------|
| `{{TEAM_ID}}` | docs/tasks/kanban_board.md | "API" |
| `{{DOCS_PATH}}` | Standard path | "docs" |

---

**Template Version:** 8.0.0 (Moved to shared/templates/, added placeholders, removed skill-specific references)
**Last Updated:** 2025-01-07

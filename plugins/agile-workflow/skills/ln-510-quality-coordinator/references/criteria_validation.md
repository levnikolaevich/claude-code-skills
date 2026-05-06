# Criteria Validation (Phase 3)

<!-- SCOPE: Story-level validation criteria for quality gate (#17, #18, Database schema). -->
<!-- DO NOT add here: Task-level AC validation → ln-402, NFR dimensions → gate_levels.md -->

Story-level validation checks executed in Phase 3 (after code quality, before linters).

---

## Purpose

Validate Story against aggregate-view criteria across all tasks:
- Story Dependencies (criterion #18) - no forward Story deps in Epic
- AC-Task Coverage Quality (criterion #17) - STRONG/WEAK/MISSING scoring across all AC
- Database Creation Principle (criterion #9) - schema scope matches Story

**Why Phase 3 (not after linters)?**
- Structural issues should block testing (fail fast)
- AC coverage quality affects test planning (ln-510 needs STRONG coverage)
- Database schema issues are architectural (detected early)

---

## Check #1: Story Dependencies (Within-Epic)

**Criterion:** Story N does NOT depend on Stories N+1, N+2 (sequential order)

**Method:**
1. Load Epic from Story.project
2. List all Stories in Epic (sorted by creation date or explicit order)
3. For current Story N, scan Technical Notes + Implementation Tasks for references to Stories N+1, N+2
4. Keywords: "Story {N+1}", "requires Story", "depends on", "after Story"

**Verdict:**
- **FAIL** if forward dependency detected → Report DEP- issue (reorder Stories or remove dependency)
- **PASS** otherwise

**Issue Format:**
```yaml
id: DEP-001
severity: high
finding: "Story 1.2 depends on Story 1.3 (forward dependency)"
action: "Refactor Story 1.2 to use only Stories 1.1, or reorder Stories"
```

---

## Check #2: AC-Task Coverage Quality

**Criterion:** Each AC has STRONG coverage (Task mentions HTTP codes + messages + timing)

**Method:**
1. Load Story AC section
2. For each AC, extract requirements:
   - HTTP codes (200, 201, 400, 401, 403, 404, 500)
   - Error messages ("Invalid token", "User not found")
   - Timing (<200ms, <1s)
3. Load all implementation Tasks
4. For each AC, find implementing Task(s) by keyword matching
5. Check if Task description mentions **all** AC requirements

**Scoring:**
- **STRONG:** Task mentions all AC requirements (HTTP code + message + timing)
- **WEAK:** Task exists but missing specific requirements (e.g., mentions validation but no 401/message)
- **MISSING:** No Task for AC

**Verdict:**
- **FAIL** if ANY AC has MISSING coverage → Report BUG- issue (implement missing AC)
- **CONCERNS** if ANY AC has WEAK coverage → Report COV- issue (strengthen implementation)
- **PASS** if ALL AC have STRONG coverage

**Issue Format (WEAK):**
```yaml
id: COV-001
severity: medium
finding: "AC2 'Invalid token → 401 error' has WEAK coverage - Task mentions validation but no 401 code or error message"
action: "Update Task implementation to return HTTP 401 with message 'Invalid token'"
```

**Issue Format (MISSING):**
```yaml
id: BUG-001
severity: high
finding: "AC3 'Timeout <200ms' has NO implementing Task"
action: "Create new Task to implement AC3 performance requirement"
```

---

## Check #3: Database Creation Principle

**Criterion:** Story creates ONLY tables it needs (incremental schema evolution)

**Method:**
1. Load Story Statement + Technical Notes
2. Extract entities mentioned in Story scope (e.g., "User Registration" → Users table)
3. Load all implementation Tasks with "schema", "migration", "CREATE TABLE" keywords
4. Extract table names from Task Technical Approach or implementation
5. Compare: tables created vs entities in Story scope

**Example:**
```markdown
Story: "User Registration"
Expected tables: Users (ONLY)
Actual tables: Users, Products, Orders ← VIOLATION (Products/Orders not in Story scope)
```

**Verdict:**
- **FAIL** if Task creates tables for FUTURE Stories → Report DB- issue (remove premature tables)
- **PASS** if schema matches Story scope

**Issue Format:**
```yaml
id: DB-001
severity: high
finding: "Story 'User Registration' creates Products + Orders tables (not in scope)"
action: "Remove Products/Orders tables from migration - they belong to future Stories"
```

---

## Execution in Phase 3

**Placement:** After ln-511 code quality check, BEFORE linters

**Order:**
1. ln-511-code-quality-checker (existing)
2. **Phase 3 Criteria Validation** (NEW):
   - Check #1: Story Dependencies
   - Check #2: AC-Task Coverage Quality
   - Check #3: Database Creation Principle
3. Run linters from tech_stack.md (existing)
4. ln-513-regression-checker (existing)

**Fail Fast Logic:**
- If Check #1 (Story Dependencies) FAIL → Report DEP- issue to ln-500, STOP
- If Check #2 (AC Coverage) FAIL → Report BUG-/COV- issues to ln-500, STOP
- If Check #3 (Database Creation) FAIL → Report DB- issue to ln-500, STOP
- If ALL checks PASS → Continue to linters

---

## Issue Prefixes (NEW)

| Prefix | Category | Severity | Example |
|--------|----------|----------|---------|
| **DEP-** | Dependencies | HIGH | Story N depends on Story N+1 (forward dep) |
| **COV-** | Coverage Quality | MEDIUM | AC has WEAK coverage (missing HTTP code/message) |
| **DB-** | Database Schema | HIGH | Task creates tables for future Stories |
| **AC-** | AC Validation | HIGH | AC incomplete (missing error/edge cases) |

**Note:** AC- prefix used by ln-500 for AC completeness/specificity validation at Story level.

---

## Skip Validation When

- Story has no child Tasks yet (validation stage)
- Story in Done/Canceled status
- Story type = test/refactoring (not covered by criteria)

---

**Version:** 1.0.0
**Last Updated:** 2026-02-03

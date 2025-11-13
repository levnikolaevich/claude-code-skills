# Task Title: Refactor [Component/Feature Name]

**Epic:** [Epic N - Epic Name](link) *(optional)*
**User Story:** [USXXX Story Name](link) *(parent task - this task will have parentId=USXXX)*
**Related:** TEAM-XX, TEAM-YY

---

## Context

**Story:** [Story ID] [Story Title]

**Problems Found During Code Review:**

Review conducted in x-story-reviewer Phase 5 identified the following code quality issues requiring refactoring.

**Current State:**
- Code has quality issues (DRY/KISS/YAGNI/Architecture violations)
- Functionality works but maintainability/readability/performance affected
- Technical debt accumulating

**Desired State:**
- Same functionality preserved (HARD RULE: no behavior changes)
- Code quality improved (DRY/KISS/YAGNI principles applied)
- Architecture clean (proper layer boundaries)
- All existing tests pass (regression verification)

---

## Code Quality Issues

### Issue 1: [Category] - [Short Description]

**Category:** [DRY Violation / KISS Violation / YAGNI Violation / Architecture Issue / Guide Violation]
**Severity:** [HIGH / MEDIUM / LOW]

**Files Affected:**
- `path/to/file1.py:45-60` - [Brief description of issue location]
- `path/to/file2.py:120-135` - [Brief description of issue location]

**Problem:**
[Detailed description of what's wrong with current implementation]

**Before (Current Code):**
```language
// Example of problematic code
// Show actual code from codebase
```

**After (Proposed Fix):**
```language
// Example of refactored code
// Show how it should look after refactoring
```

**Benefits:**
- [Benefit 1: e.g., "DRY: 45 lines → 21 lines (53% reduction)"]
- [Benefit 2: e.g., "Maintainability: Fix bugs once, not 3 times"]
- [Benefit 3: e.g., "Testability: Unit test validator separately"]

**Why This Violates [Principle]:**
[Explain which principle violated and why it matters]

### Issue 2: [Category] - [Short Description]

**Category:** [DRY / KISS / YAGNI / Architecture / Guide Violation]
**Severity:** [HIGH / MEDIUM / LOW]

**Files Affected:**
- [List files and line numbers]

**Problem:**
[Description]

**Before:**
```language
[Current problematic code]
```

**After (Proposed):**
```language
[Refactored code]
```

**Benefits:**
- [Benefits list]

### Issue 3: [Category] - [Short Description]

**Category:** [DRY / KISS / YAGNI / Architecture / Guide Violation]
**Severity:** [HIGH / MEDIUM / LOW]

**Files Affected:**
- [List files]

**Problem:**
[Description]

**Verification (for YAGNI violations):**
```bash
# Command to verify code is unused
rg "function_name" --type language
# Output: No matches found (confirms dead code)
```

**Action:** [Delete / Simplify / Consolidate]

**Benefits:**
- [Benefits]

---

## Refactoring Goal

**Primary Goal:**
Resolve all identified code quality issues while preserving 100% of existing functionality.

**Specific Objectives:**
- [ ] Fix all DRY violations (eliminate code duplication)
- [ ] Fix all KISS violations (simplify over-engineered solutions)
- [ ] Fix all YAGNI violations (remove unused/premature features)
- [ ] Fix all architecture issues (restore proper layer boundaries)
- [ ] Fix all guide violations (align with project patterns)

**Success Criteria:**
- All issues from Code Quality Issues section resolved
- All existing tests pass (regression verification)
- Functionality unchanged (verified through manual testing)
- Code quality metrics improved (measurable reduction in complexity/duplication)

---

## Refactoring Plan (3 Phases)

### Phase 1: Analysis & Preparation

**Baseline Capture:**
- [ ] Run existing test suite → Record pass/fail count (baseline for Phase 3)
- [ ] Document current behavior:
  - Take screenshots of key UI states (if UI changes)
  - Capture API responses for key endpoints (if backend changes)
  - Record timing benchmarks (if performance-sensitive)
- [ ] Identify all affected tests:
  - `rg "ClassName|functionName" tests/` → Find tests that exercise refactored code
  - Review test files to understand test coverage
- [ ] Create backup branch (git branch backup/refactor-[feature-name])

**Best Practices Research:**
- [ ] Research DRY patterns (MCP Ref, Context7, WebSearch)
  - Query: "DRY principle [language] best practices 2024"
  - Find established patterns for consolidating duplicated code
- [ ] Research KISS simplification (if applicable)
  - Query: "simplify [over-engineered pattern] [language]"
  - Find simpler alternatives to current implementation
- [ ] Review project guides (CLAUDE.md, docs/guides/)
  - Verify patterns referenced in Story Technical Notes
  - Ensure refactoring aligns with project standards

**Risk Assessment:**
- [ ] Identify high-risk refactorings (core business logic, critical paths)
- [ ] Plan incremental approach (small changes, test after each)
- [ ] Document rollback plan (if refactoring fails)

### Phase 2: Refactoring Execution

**Execute refactorings in priority order (HIGH → MEDIUM → LOW):**

**Issue 1: [HIGH Priority]**
- [ ] [Step 1: Specific action - e.g., "Create shared utility function in utils/validators.py"]
- [ ] [Step 2: Specific action - e.g., "Replace 3 duplicates in api/routes/*.py"]
- [ ] [Step 3: Specific action - e.g., "Add unit tests for new utility function"]
- [ ] Run tests after Issue 1 fix (verify no regression)

**Issue 2: [MEDIUM Priority]**
- [ ] [Step 1: Specific action]
- [ ] [Step 2: Specific action]
- [ ] Run tests after Issue 2 fix

**Issue 3: [LOW Priority]**
- [ ] [Step 1: Specific action]
- [ ] [Step 2: Specific action]
- [ ] Run tests after Issue 3 fix

**Incremental Approach:**
- Fix one issue at a time
- Run tests after each fix (catch regressions immediately)
- Commit after each successful fix (git commit -m "refactor: fix [issue]")
- If any test fails → STOP, analyze, fix refactoring (not test)

### Phase 3: Regression Verification

**Verify functionality unchanged:**

- [ ] **Run test suite again:**
  - Compare with Phase 1 baseline
  - MUST match exactly (same pass/fail count, same test names)
  - If ANY test fails → Refactoring introduced bug, MUST fix

- [ ] **Compare behavior with baseline:**
  - API responses MUST be identical (diff outputs)
  - UI screenshots MUST match (visual regression)
  - Timing within 5% of baseline (performance not degraded)

- [ ] **Manual smoke testing:**
  - Test main user flows (verify no behavior change)
  - Use `scripts/tmp_[story_id].sh` if exists (from manual testing)
  - Document any unexpected behavior

- [ ] **Quality gates:**
  - Type checking passes (mypy/TypeScript)
  - Linting passes (ruff/ESLint)
  - No new warnings introduced

**If verification fails:**
- [ ] Analyze failure root cause (refactoring bug vs test bug)
- [ ] Fix refactoring (preferred) OR update test (only if test was wrong)
- [ ] Re-run Phase 3 verification

---

## Regression Testing Strategy

**HARD RULE:** Refactoring NEVER changes functionality. If tests fail after refactoring → Implementation error.

### Baseline Capture (Phase 1)

**Test Suite Baseline:**
```bash
# Run full test suite, capture output
pytest -v > baseline_tests.txt  # or npm test, etc.

# Record metrics
Total tests: [X]
Passed: [X]
Failed: [X]
Skipped: [X]
```

**Behavior Baseline (for critical functionality):**
```bash
# Capture API responses
curl -X GET $BASE_URL/api/endpoint > baseline_api_response.json

# Capture UI state (if applicable)
# Screenshot key pages, record element states
```

**Performance Baseline (if performance-sensitive):**
```bash
# Record timing benchmarks
pytest --benchmark-only > baseline_benchmarks.txt
```

### Verification Protocol (Phase 3)

**Step 1: Test Suite Comparison**
- Run test suite again → Compare with baseline
- **Expected:** Exact match (same tests pass/fail)
- **If mismatch:** STOP, analyze failure, fix refactoring

**Step 2: Behavior Comparison**
- Capture API responses again → Diff with baseline
- **Expected:** Identical responses (diff shows no changes)
- **If different:** STOP, analyze, fix refactoring

**Step 3: Performance Comparison**
- Run benchmarks again → Compare with baseline
- **Expected:** Within 5% of baseline timing
- **If degraded >5%:** Analyze, optimize refactoring

### Failure Handling

**If ANY test fails after refactoring:**

1. **STOP immediately** - Do NOT proceed with additional refactorings
2. **Analyze root cause:**
   - Read test failure message
   - Identify which refactoring caused failure
   - Determine if refactoring introduced bug OR test needs update
3. **Fix refactoring (preferred approach):**
   - Revert last change: `git revert HEAD`
   - Re-analyze issue, apply safer refactoring
   - Run tests again
4. **Update test (only if test was wrong):**
   - Verify test expectation was incorrect (not refactoring bug)
   - Update test assertions/mocks
   - Document why test update needed (in commit message)
5. **Re-run Phase 3 verification**

**Tools:**
- Test framework: pytest/jest/vitest (auto-detected in Phase 1)
- Diff tools: `diff`, `jq` (for JSON), screenshot comparison
- Performance: pytest-benchmark, Lighthouse (if UI)

---

## Code Simplification Principles

Apply these principles during Phase 2 refactoring (from Claude Code PR Toolkit `code-simplifier` agent):

### 1. Preserve Functionality (HARD RULE)

**Rule:** NEVER change what code does - only HOW it does it.

- ❌ **Forbidden:** Change outputs, modify behavior, alter features
- ✅ **Allowed:** Change structure, consolidate logic, rename variables
- ✅ **Verification:** All existing tests MUST pass after refactoring

**Example:**
```python
# WRONG: Changed behavior
def validate_email(email):
    # Before: allowed @gmail.com and @yahoo.com
    # After: ONLY allows @gmail.com (BEHAVIOR CHANGED - FORBIDDEN!)
    return email.endswith('@gmail.com')

# CORRECT: Same behavior, refactored
def validate_email(email):
    # Before: inline validation in 3 places
    # After: extracted to shared function (SAME BEHAVIOR - ALLOWED!)
    allowed_domains = ('@gmail.com', '@yahoo.com')
    return email.endswith(allowed_domains)
```

### 2. Apply Project Standards

**Follow CLAUDE.md coding standards:**
- ES modules with proper imports
- Explicit type annotations
- Proper error handling (avoid try/catch when possible)
- Consistent naming conventions

**Example:**
```typescript
// Before: Non-standard
const getUser = (id) => { ... }

// After: Project standard (explicit types, function keyword)
function getUser(id: string): User | null { ... }
```

### 3. Enhance Clarity

**Reduce complexity, improve readability:**
- ✅ Reduce nesting (extract nested logic to functions)
- ✅ Eliminate redundant code (DRY principle)
- ✅ Clear names (intent-revealing variable/function names)
- ✅ Consolidate related logic (group cohesive operations)
- ✅ Remove unnecessary comments (self-documenting code)
- ✅ Avoid nested ternaries (use switch/if-else for multiple conditions)

**Example:**
```python
# Before: Nested and unclear
if user:
    if user.active:
        if user.verified:
            return user.data
return None

# After: Clear and flat
if not user or not user.active or not user.verified:
    return None
return user.data
```

### 4. Maintain Balance (DON'T Over-Simplify)

**Avoid extreme simplification:**
- ❌ Don't reduce clarity for brevity (explicit > compact)
- ❌ Don't combine too many concerns (single responsibility)
- ❌ Don't remove helpful abstractions
- ❌ Don't prioritize "fewer lines" over readability

**Example:**
```javascript
// WRONG: Over-simplified (hard to understand)
const r = u?.a && u?.v ? u?.d : null;

// CORRECT: Clear and explicit
if (!user || !user.active || !user.verified) {
    return null;
}
return user.data;
```

### 5. Focus Scope

**Only refactor what's in scope:**
- ✅ Refactor code identified in Code Quality Issues section
- ✅ Refactor closely related code (within same module/class)
- ❌ Don't expand scope beyond identified issues
- ❌ Don't refactor unrelated files

**Example:**
```
Issue: Duplicate validation in api/routes/users.py and api/routes/auth.py
✅ Refactor: Extract validation to utils/validators.py
✅ Refactor: Update imports in both route files
❌ Don't refactor: Other unrelated routes (outside scope)
```

---

## Acceptance Criteria

**Given** current implementation has code quality issues
**When** refactoring is applied according to Refactoring Plan
**Then** all issues are resolved AND functionality is preserved

**Specific Checks:**

- [ ] **DRY:** No code duplication remains (verified with grep/rg for repeated patterns)
- [ ] **KISS:** Solutions simplified where possible (removed over-engineering)
- [ ] **YAGNI:** No unused features remain (verified with grep/rg, dead code eliminated)
- [ ] **Architecture:** Clean layer boundaries (no violations of project patterns)
- [ ] **Guides:** Implementation aligns with project guides (CLAUDE.md, docs/guides/)
- [ ] **Regression:** All existing tests pass (Phase 3 verification successful)
- [ ] **Behavior:** Functionality unchanged (manual testing confirms same behavior)
- [ ] **Quality Gates:** Type checking + linting pass (no new warnings)

---

## Affected Components

### Implementation Files to Refactor
- `path/to/component1` - [What will be refactored: e.g., "Extract duplicate validation logic"]
- `path/to/component2` - [What will be refactored: e.g., "Simplify state management"]
- `path/to/component3` - [What will be refactored: e.g., "Remove unused OAuth 1.0 implementation"]

### Tests to Update (ONLY if refactoring breaks them)
- `tests/path/test_file1` - [Why update needed: e.g., "Mock signatures changed"]
- `tests/path/test_file2` - [Why update needed: e.g., "Assertions need adjustment"]

### Documentation to Update
- `README.md` - [What to update: e.g., "Remove references to old pattern"]
- `ARCHITECTURE.md` - [What to update: e.g., "Update component diagram"]
- `docs/guides/[guide].md` - [What to update: e.g., "Update code examples"]

---

## Existing Code Impact

### Refactoring Required

**Component 1: [Component Name]**
- **File:** `path/to/file`
- **What:** [Specific refactoring action - e.g., "Extract duplicate validation to shared utility"]
- **Why:** [Reason - e.g., "DRY violation: same logic in 3 places"]
- **Risk:** [HIGH/MEDIUM/LOW] - [Risk explanation]

**Component 2: [Component Name]**
- **File:** `path/to/file`
- **What:** [Refactoring action]
- **Why:** [Reason]
- **Risk:** [Level]

### Tests to Update (ONLY Existing Tests Affected)

**SCOPE:** ONLY list existing tests that may break due to refactoring (signature changes, mock updates, etc.).
DO NOT create new tests here. New tests were created in Story's final test task by x-test-coordinator.

**Examples of valid test updates:**
- Mock/stub updates when function signatures change
- Assertion updates when internal structure changes
- Import path updates when files moved

**Test Suite 1:**
- **File:** `tests/path/test_file`
- **Why Affected:** [Reason - e.g., "Function signature changed from (a, b) to (config)"]
- **Update Needed:** [Specific change - e.g., "Update mock to use new signature"]

### Documentation to Update
- `docs/file.md` - [Existing docs to update - e.g., "Update architecture diagram"]
- `README.md` - [What to update - e.g., "Remove references to deprecated pattern"]

---

## Definition of Done

### Refactoring Completion
- [ ] All problems from Code Quality Issues section resolved
- [ ] All refactorings from Phase 2 executed successfully
- [ ] Code follows DRY/KISS/YAGNI/SOLID principles
- [ ] Architecture clean (proper layer boundaries)
- [ ] Guides followed (project patterns applied)

### Regression Verification
- [ ] **All existing tests pass** (Phase 3 verification successful)
- [ ] Test suite matches Phase 1 baseline (same pass/fail count)
- [ ] Functionality unchanged (manual testing confirms)
- [ ] Behavior matches baseline (API responses, UI states identical)
- [ ] Performance within 5% of baseline (no degradation)

### Quality Gates
- [ ] Type checking passes (mypy/TypeScript)
- [ ] Linting passes (ruff/ESLint)
- [ ] No new warnings introduced

### Documentation
- [ ] Code changes documented (commit messages describe refactorings)
- [ ] README.md updated (if public API/patterns changed)
- [ ] ARCHITECTURE.md updated (if component structure changed)
- [ ] Guides updated (if refactoring changes recommended patterns)

### Review
- [ ] Code reviewed by team member (if applicable)
- [ ] Refactoring approach approved (architecture alignment)

---

**Template Version:** 2.0.0 (Expanded with Code Quality Issues, Refactoring Plan, Regression Testing Strategy, Code Simplification Principles)
**Last Updated:** 2025-11-13

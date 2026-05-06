# Structural Validation (Criteria #1-#4, #23-#24)

<!-- SCOPE: Structure and template compliance criteria #1-#4, Architecture Considerations #23, Assumption Registry #24. -->
<!-- DO NOT add here: Workflow criteria -> workflow_validation.md, standards -> standards_validation.md -->

Detailed rules for Story/Tasks structure, Story statement, Acceptance Criteria, Architecture Considerations, and Assumption Registry validation.

---

## Criterion #1: Story Structure (Template Compliance)

**Check:** Story description follows template structure with 9 sections in order

**Penalty:** LOW (1 point). Skip when Story is Done/Canceled or older than 30 days.

Request FULL Story description from Linear (not truncated) to validate all 9 sections.

**Required Sections (in order):**
1. **Story** (As a / I want / So that)
2. **Context** (Current Situation + Desired Outcome)
3. **Acceptance Criteria** (Given-When-Then: Main Scenarios + Edge Cases + Error Handling)
4. **Implementation Tasks** (List with links)
5. **Test Strategy** (empty placeholder, testing planned separately)
6. **Technical Notes** (Architecture Considerations + Integration Points + Performance & Security)
7. **Definition of Done** (Functionality + Testing + Code Quality)
8. **Dependencies** (Depends On + Blocks)
9. **Assumptions** (typed table with categories)

**Pass:** All 9 sections present in correct order, each non-empty (except Test Strategy — must be empty), required subsections present.

**Fail:** Missing sections -> add with `_TODO: Fill this section_`. Out of order -> reorder. Empty -> add placeholder.

**Auto-fix actions:**
1. Parse current description, identify missing/misplaced sections
2. Add missing sections with TODO placeholders, reorder to match template, add missing subsections
3. Update Linear issue + add comment explaining changes

---

## Criterion #2: Tasks Structure (Template Compliance — EVERY Task)

**Check:** All child Task descriptions follow template structure

**Penalty:** LOW (1 point per Task). Skip when Task is Done/Canceled or older than 30 days.

Request FULL Task description from Linear (not truncated) for EACH Task.

**Required Sections (in order for EACH Task):**
1. **Context** (Current State + Desired State)
2. **Implementation Plan** (Phase 1-3 with checkboxes)
3. **Technical Approach** (Recommended + Why + Patterns + Alternatives)
4. **Acceptance Criteria** (Given-When-Then with checkboxes)
5. **Affected Components** (Implementation + Documentation)
6. **Existing Code Impact** (Refactoring + Tests to Update + Documentation to Update)
7. **Definition of Done** (Checklist)

> [!NOTE]
> Test Strategy removed from Tasks — all tests in Story's final task

**Pass/Fail:** Same rules as #1 applied to EVERY Task individually.

**Auto-fix actions:** Same as #1 but per-Task. Update each Task individually.

**Template Reference:** `references/templates/task_template_implementation.md`

---

## Criterion #3: Story Statement (User-Focused)

**Check:** Clear, specific, user-focused (As a / I want / So that)

**Penalty:** LOW (1 point)

**Rule:** Statement must have persona, capability, and value. "Improve authentication" (vague, no user context) fails.

**Auto-fix actions:**
1. Extract persona from Context, capability from Technical Notes, value from Desired Outcome
2. Rewrite: `As a [persona] I want to [capability] So that [value]`
3. Update Linear issue + add comment

---

## Criterion #4: Acceptance Criteria (Testable, GWT Format)

**Check:** Specific, testable, Given/When/Then format covering Story goal

**Penalty:** MEDIUM (3 points)

**Requirements:** 3-5 ACs in Given/When/Then format.

**Completeness Check (3 scenario types required):**
1. **Happy Path** (1-2 AC) — main success scenarios
2. **Error Handling** (1-2 AC) — invalid inputs, auth failures, system errors
3. **Edge Cases** (1 AC) — boundary conditions, special states, race conditions

**Specificity Check (measurable outcomes required):**
- HTTP status codes (200, 201, 400, 401, 403, 404, 500)
- Response times (<200ms, <1s, <5s)
- Exact error messages ("Invalid credentials", "Token expired")
- Quantifiable metrics (99% uptime, 1000 req/sec)

**Auto-fix actions:**
1. Parse existing AC, convert to Given/When/Then format
2. Add missing scenarios: no error handling -> add 401/403/404/500 ACs; no edge cases -> add boundary ACs
3. Fix specificity: vague terms ("fast", "secure") -> measurable criteria; missing HTTP codes -> suggest specific codes; missing error messages -> add exact text; performance claims -> add timing
4. Update Linear issue + add comment

**Example transformation:**
- Before: "User can login", "Login fails with wrong password"
- After:
  1. "Given valid credentials, When user submits login form, Then authenticated and redirected to dashboard" (happy path)
  2. "Given invalid password, When user submits, Then 401 with 'Invalid credentials'" (error handling)
  3. "Given account locked, When user submits, Then 403 with 'Account locked'" (edge case)

---

## Criterion #23: Architecture Considerations

**Check:** Story Technical Notes has Architecture Considerations subsection with: layers affected, side-effect boundary, orchestration depth

**Penalty:** MEDIUM (3 points)

**Required fields:**

| Field | Description |
|-------|-------------|
| Layers affected | Which architectural layers this Story touches (DB, Service, API, UI) |
| Side-effect boundary | What external state changes (DB writes, API calls, file system, cache) |
| Orchestration depth | How many services/components coordinate (1 = simple, 3+ = complex) |

**Auto-fix actions:**
1. Check if Architecture Considerations subsection exists in Technical Notes
2. IF missing: add section from `story_template.md` with placeholder fields
3. IF present but incomplete: add missing fields with `_TODO:_` placeholders
4. Update Linear issue + add comment

**Skip when:** Story in Done/Canceled status, or Story has no Technical Notes section.

---

## Criterion #24: Assumption Registry

**Check:** Assumptions section with >=1 typed entry; each has Category, Confidence, Invalidation Impact; LOW confidence entries have validation plan in Tasks; child Tasks inherit parent Story assumptions

**Penalty:** MEDIUM (3 points)

**Required table columns:**

| Column | Values |
|--------|--------|
| ID | A1, A2, ... |
| Assumption | Description text |
| Category | TECHNICAL, DEPENDENCY, FEASIBILITY, TIMELINE |
| Confidence | HIGH, MEDIUM, LOW |
| Invalidation Impact | What happens if wrong |

**Rules:**
- >=1 assumption required (every Story has implicit assumptions)
- LOW confidence → must have validation plan in at least one Task
- Child Tasks with "Inherited Assumptions" section must match parent Story IDs + text

**Detection keywords** (scan Technical Notes for implicit assumptions): `assumes`, `expects`, `requires`, `should be available`, `will be`, `must have`, `depends on`

**Auto-fix actions:**
1. Scan Story Technical Notes + Dependencies for implicit assumptions via keywords
2. Create Assumptions table with detected entries, assign Category/Confidence
3. For LOW confidence: add `_TODO: Validate assumption [ID] before implementation_` to relevant Task
4. Verify child Task "Inherited Assumptions" sync with parent Story
5. Update Linear issue + add comment

**Skip when:** Story in Done/Canceled status.

---

**Version:** 3.0.0
**Last Updated:** 2026-02-03

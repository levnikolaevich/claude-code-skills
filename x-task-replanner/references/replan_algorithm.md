# Task Replan Algorithm

Detailed comparison logic for x-task-coordinator REPLAN MODE. This algorithm determines which operations (KEEP/UPDATE/OBSOLETE/CREATE) to perform when existing tasks are found for a Story.

## Overview

When a Story's requirements change and tasks already exist, x-task-coordinator compares the IDEAL task decomposition (from Phase 2) with existing tasks (from Linear) to determine the minimal set of operations needed.

**Key Principle**: The IDEAL plan from Phase 2 is the source of truth. Existing tasks are compared against this plan.

## Inputs

### Phase 2 Output: IDEAL Task Plan

Result from Story analysis (runs BEFORE checking existing tasks):

**Structure**:
- Task count: 1-4 (based on Story complexity)
- Task titles: Descriptive names (e.g., "Implement token generation endpoint")
- Task goals: Derived from Story AC
- Consumer-First ordering: API → Service → Repository → Database
- Estimate per task: 3-5 hours
- Guide links: From Story Technical Notes

**Example IDEAL Plan**:
```
IDEAL TASK PLAN (3 tasks, 12h total):
1. Implement token generation endpoint
   - Goal: Handle POST /auth/token with credentials
   - AC: AC1 (valid credentials), AC2 (invalid credentials)
   - Estimate: 4h

2. Add token validation middleware
   - Goal: Validate JWT tokens in protected routes
   - AC: AC3 (valid token), AC4 (expired token)
   - Estimate: 3h

3. Create token refresh logic
   - Goal: Implement token refresh mechanism
   - AC: AC5 (refresh with valid refresh token)
   - Estimate: 5h

Consumer-First order: ✓
Guide links: [JWT Best Practices](../../docs/guides/jwt-best-practices.md)
```

### Linear Data: Existing Tasks

From `list_issues(parentId=Story.id)`:

**Structure**:
- Task IDs: Linear issue IDs (e.g., "EP7_01", "EP7_02")
- Titles: Task titles
- Descriptions: Full 7 sections (Context, Implementation Plan, Technical Approach, AC, Components, Existing Code Impact, DoD)
- Status: Todo, In Progress, To Review, Done, Canceled

**Example Existing Tasks**:
```
EXISTING TASKS (3 found):
1. EP7_01: Implement token generation endpoint
   Status: Done
   Created: 2025-11-01
   AC: AC1, AC2

2. EP7_02: Validate JWT tokens
   Status: Todo
   Created: 2025-11-05
   AC: AC3 (missing AC4!)

3. EP7_03: Cache tokens in Redis
   Status: Todo
   Created: 2025-11-06
   AC: AC6 (caching requirement)
```

## Comparison Algorithm

### Step 1: Match by Goal

For EACH task in IDEAL plan:

1. **Extract goal** from IDEAL plan task title and description
2. **Search existing tasks** for similar goal:
   - Fuzzy match on titles (e.g., "token generation" matches "Implement token generation")
   - Check AC overlap (do they cover same Story AC?)
   - Look for key terms (e.g., "validation", "refresh", "generation")
3. **Result**:
   - If **match found** → Candidate for KEEP or UPDATE
   - If **no match** → Mark for CREATE

For EACH existing task:

1. **Extract goal** from existing task title and AC
2. **Search IDEAL plan** for similar goal
3. **Result**:
   - If **match found** → Candidate for KEEP or UPDATE
   - If **no match** → Mark for OBSOLETE

### Step 2: Determine Operations

For EACH existing task:

#### KEEP Operation

**Criteria** (ALL must be true):
- ✅ Task exists in IDEAL plan (goal matches)
- ✅ AC unchanged (compare Story AC sections referenced in task)
- ✅ Implementation approach still valid (guide links, patterns)
- ✅ Status: Any except Done or Canceled
- ✅ No structural changes needed (Affected Components same)

**Action**: None (task is already correct)

**Example**:
```
EP7_01: Implement token generation endpoint
- IDEAL plan has: "Token generation endpoint" (AC1, AC2)
- Existing task has: AC1, AC2
- Status: Done
→ KEEP (task matches IDEAL plan, already complete)
```

#### UPDATE Operation

**Criteria** (ANY must be true):
- ⚠️ Task in IDEAL plan BUT AC changed
  - New AC added to Story
  - Existing AC modified (conditions changed)
  - AC removed from task scope
- ⚠️ Technical approach changed
  - New guide links added to Story
  - Architecture patterns updated
  - Technology stack changed
- ⚠️ Affected components changed
  - New files to modify
  - Different layers involved

**Constraints**:
- ✅ Status: Todo or Backlog ONLY
- ❌ If In Progress/To Review → WARNING, manual review needed (don't auto-update)
- ❌ If Done → WARNING, never update Done tasks

**Action**: `update_issue(id, description=new_description)`

**Example**:
```
EP7_02: Validate JWT tokens
- IDEAL plan has: "Token validation middleware" (AC3, AC4)
- Existing task has: AC3 ONLY (AC4 missing!)
- Status: Todo
→ UPDATE (AC4 "Handle expired tokens" added to Story)

Changes to apply:
- Update AC section: Add AC4 scenario
- Update Implementation Plan: Add expiration check phase
- Update Technical Approach: Reference token expiration guide
```

#### OBSOLETE Operation

**Criteria** (ALL must be true):
- ❌ Task NOT in IDEAL plan (no matching goal)
- ❌ Feature removed from Story AC
- ❌ OR functionality merged into different task

**Constraints**:
- ✅ Status: Todo or Backlog ONLY
- ❌ If In Progress/To Review → WARNING, manual review needed (don't auto-cancel)
- ❌ If Done → WARNING, never obsolete Done tasks (work was completed)

**Action**:
```
update_issue(id, state="Canceled")
```
Add comment: "Task canceled due to Story replan. Feature removed from requirements."

**Example**:
```
EP7_03: Cache tokens in Redis
- IDEAL plan does NOT have: Caching task
- Story AC6 (caching requirement) REMOVED
- Status: Todo
→ OBSOLETE (caching is no longer in scope)

Action: Cancel task, preserve history
```

#### CREATE Operation

**Criteria** (ALL must be true):
- ✨ Task in IDEAL plan
- ✨ No existing task matches goal
- ✨ New requirement added to Story

**Action**: `create_issue(title, description, parentId=Story.id, ...)` (same as CREATE MODE)

**Example**:
```
IDEAL plan has: "Email validation" (NEW AC6)
- No existing task for email validation
- New requirement added to Story
→ CREATE (new task needed)

Generate:
- Title: "EP7_04: Validate email format in registration"
- Description: Full 7 sections
- AC: AC6 from Story
- parentId: Story.id
```

### Step 3: Handle Edge Cases

#### Edge Case 1: Obsolete Task In Progress

**Scenario**: Task is marked OBSOLETE but status is In Progress or To Review.

**Problem**: Someone is actively working on this task, auto-canceling would waste work.

**Action**:
```
WARNING: "Task EP7_03 is In Progress but no longer in IDEAL plan. Manual review needed."
- Do NOT auto-cancel
- Show in operations summary with ⚠️ warning
- Let user decide:
  - Complete the task and cancel later?
  - Cancel now and abandon work?
  - Merge work into different task?
```

#### Edge Case 2: UPDATE Task To Review

**Scenario**: Task needs UPDATE (AC changed) but status is To Review (awaiting review).

**Problem**: Task already completed and awaiting review, updating would invalidate the review.

**Action**:
```
WARNING: "Task EP7_02 is To Review but AC changed. Review may need to restart."
- Show diff (old AC vs new AC)
- Let user decide:
  - Update now (review must restart)?
  - Wait for review to complete, then update?
  - Cancel task and create new one?
```

#### Edge Case 3: IDEAL Plan Differs from Done Tasks

**Scenario**: IDEAL plan significantly differs from completed Done tasks.

**Problem**: Work was completed under old requirements, new requirements are different.

**Action**:
```
WARNING: "Story requirements changed significantly. Done tasks may need follow-up work."
- NEVER update or cancel Done tasks (preserve completed work)
- If new requirements conflict with Done work → CREATE new task to address discrepancy
- Example:
  - Done: "EP7_01: Token generation with JWT"
  - IDEAL: "Token generation with OAuth2" (different approach!)
  - Action: CREATE "EP7_04: Migrate token generation to OAuth2"
```

#### Edge Case 4: Multiple Tasks Match Same IDEAL Goal

**Scenario**: Two existing tasks both match same IDEAL plan goal.

**Problem**: Duplicate work, unclear which to keep.

**Action**:
```
WARNING: "Multiple tasks match same IDEAL goal. Manual consolidation needed."
- EP7_02: "Validate JWT tokens" (Todo)
- EP7_05: "Add token validation" (In Progress)
- Both match IDEAL: "Token validation middleware"

Let user decide:
- Keep EP7_05 (In Progress), obsolete EP7_02?
- Merge both into one task?
```

#### Edge Case 5: AC Count Mismatch

**Scenario**: IDEAL plan has 5 AC, but distributed differently across tasks than existing tasks.

**Problem**: AC reassignment between tasks.

**Action**:
```
EXAMPLE:
IDEAL Plan:
- Task 1: AC1, AC2, AC3 (endpoint)
- Task 2: AC4, AC5 (middleware)

Existing Tasks:
- EP7_01: AC1, AC2 (endpoint) - Done
- EP7_02: AC3, AC4, AC5 (middleware) - Todo

Operations:
- EP7_01: KEEP (Done, matches AC1, AC2)
- EP7_02: UPDATE (AC3 moved to Task 1, remove from EP7_02)
  - BUT AC3 implementation may be in EP7_02 code!
  - WARNING: "AC3 reassigned. Manual code review needed."
```

## Example Scenarios

### Scenario 1: AC Change (UPDATE)

**Story**: US001 OAuth Authentication
**Change**: AC4 "Handle expired tokens" ADDED to Story

**IDEAL Plan** (Phase 2):
```
1. Token generation endpoint (AC1, AC2)
2. Token validation middleware (AC3, AC4) ← AC4 NEW!
3. Token refresh logic (AC5)
```

**Existing Tasks**:
```
1. EP7_01: Token generation (AC1, AC2) - Done
2. EP7_02: Validate tokens (AC3 ONLY) - Todo
3. EP7_03: Token refresh (AC5) - In Progress
```

**Comparison**:
```
EP7_01 vs IDEAL Task 1:
- Goals match: ✓ (token generation)
- AC match: ✓ (AC1, AC2)
- Status: Done
→ KEEP

EP7_02 vs IDEAL Task 2:
- Goals match: ✓ (token validation)
- AC match: ✗ (AC3 only, AC4 missing)
- Status: Todo
→ UPDATE (add AC4)

EP7_03 vs IDEAL Task 3:
- Goals match: ✓ (token refresh)
- AC match: ✓ (AC5)
- Status: In Progress
→ KEEP (In Progress, don't interfere)
```

**Operations Summary**:
```
KEEP: 2 tasks (EP7_01 Done, EP7_03 In Progress)
UPDATE: 1 task (EP7_02 add AC4)
OBSOLETE: 0 tasks
CREATE: 0 tasks
```

**Diff for EP7_02 UPDATE**:
```diff
## Acceptance Criteria

- **Given** valid JWT token in Authorization header
  **When** request is made to protected route
  **Then** request proceeds with authenticated user context

+ **Given** expired JWT token in Authorization header
+   **When** request is made to protected route
+   **Then** return 401 Unauthorized with "Token expired" message
```

### Scenario 2: Feature Removed (OBSOLETE)

**Story**: US001 OAuth Authentication
**Change**: Caching requirement REMOVED from Story (AC6 deleted)

**IDEAL Plan** (Phase 2):
```
1. Token generation endpoint (AC1, AC2)
2. Token validation middleware (AC3, AC4)
3. Token refresh logic (AC5)
# NO caching task (AC6 removed)
```

**Existing Tasks**:
```
1. EP7_01: Token generation (AC1, AC2) - Done
2. EP7_02: Validate tokens (AC3, AC4) - Todo
3. EP7_03: Cache tokens in Redis (AC6) - Todo ← AC6 REMOVED!
```

**Comparison**:
```
EP7_01 → KEEP (matches IDEAL Task 1)
EP7_02 → KEEP (matches IDEAL Task 2)
EP7_03 → OBSOLETE (no matching goal in IDEAL plan, AC6 removed)
```

**Operations Summary**:
```
KEEP: 2 tasks
UPDATE: 0 tasks
OBSOLETE: 1 task (EP7_03 caching)
CREATE: 0 tasks
```

**Action for EP7_03**:
```
update_issue(
  id="EP7_03",
  state="Canceled"
)

Add comment:
"Task canceled due to Story replan. Caching requirement (AC6) removed from Story.
Original AC6: Cache JWT tokens in Redis with 1-hour TTL.
Reason: Simplified authentication flow, removed caching complexity."
```

### Scenario 3: New Feature Added (CREATE)

**Story**: US002 User Profile
**Change**: NEW AC4 "Upload avatar" ADDED to Story

**IDEAL Plan** (Phase 2):
```
1. Create profile endpoint (AC1)
2. Update profile endpoint (AC2, AC3)
3. Upload avatar (AC4) ← NEW!
```

**Existing Tasks**:
```
1. EP8_01: Create profile (AC1) - Done
2. EP8_02: Update profile (AC2, AC3) - In Progress
# NO avatar task
```

**Comparison**:
```
EP8_01 → KEEP (matches IDEAL Task 1, Done)
EP8_02 → KEEP (matches IDEAL Task 2, In Progress)
IDEAL Task 3 → CREATE (no existing task for avatar upload)
```

**Operations Summary**:
```
KEEP: 2 tasks
UPDATE: 0 tasks
OBSOLETE: 0 tasks
CREATE: 1 task (avatar upload)
```

**New Task EP8_03**:
```
Title: "EP8_03: Implement avatar upload for user profile"

Description: (7 sections)
- Context: Users need to upload profile pictures
- Implementation Plan: File upload, validation, storage, URL generation
- Technical Approach: Multipart form data, S3/local storage, image processing
- AC: AC4 from Story (upload, size limits, format validation)
- Affected Components: src/api/profile.ts, src/services/storage.ts
- Existing Code Impact: Add storage service, update profile model
- DoD: Upload works, validation enforced, images stored securely

Estimate: 4 hours
parentId: US002
```

### Scenario 4: Scope Reduction (Multiple OBSOLETE)

**Story**: US003 Payment Integration
**Change**: PayPal and Refund APIs REMOVED from scope (simplify to Stripe only)

**IDEAL Plan** (Phase 2):
```
1. Stripe integration (AC1, AC2)
2. Payment webhook (AC3)
# PayPal removed
# Refund API removed
```

**Existing Tasks**:
```
1. EP9_01: Stripe integration (AC1, AC2) - Todo
2. EP9_02: Payment webhook (AC3) - In Progress
3. EP9_03: PayPal integration (AC4) - Todo ← REMOVED!
4. EP9_04: Refund API (AC5) - Todo ← REMOVED!
```

**Comparison**:
```
EP9_01 → KEEP (matches IDEAL Task 1)
EP9_02 → KEEP (matches IDEAL Task 2, In Progress)
EP9_03 → OBSOLETE (PayPal removed)
EP9_04 → OBSOLETE (Refund removed)
```

**Operations Summary**:
```
KEEP: 2 tasks
UPDATE: 0 tasks
OBSOLETE: 2 tasks (EP9_03 PayPal, EP9_04 Refund)
CREATE: 0 tasks
```

**Warning**:
```
⚠️ EP9_02 (Payment webhook) is In Progress.
   Ensure webhook handler still works with reduced scope (Stripe only, no PayPal events).
   Manual review recommended.
```

### Scenario 5: Complex Reassignment

**Story**: US004 Search Functionality
**Change**: AC3 "Pagination" moved from "Search results" task to "Search API" task

**IDEAL Plan** (Phase 2):
```
1. Search API with pagination (AC1, AC2, AC3) ← AC3 moved here!
2. Search results display (AC4, AC5)
# AC3 was in Task 2, now in Task 1
```

**Existing Tasks**:
```
1. EP10_01: Search API (AC1, AC2) - Done
2. EP10_02: Search results (AC3, AC4, AC5) - Todo ← AC3 should move!
```

**Comparison**:
```
EP10_01 vs IDEAL Task 1:
- Goals match: ✓
- AC match: ✗ (AC3 missing, now required)
- Status: Done
→ KEEP (Done, don't update)
→ WARNING: AC3 pagination should be in API but implemented in results!

EP10_02 vs IDEAL Task 2:
- Goals match: ✓
- AC match: ✗ (AC3 should not be here)
- Status: Todo
→ UPDATE? (remove AC3, keep AC4/AC5)
→ WARNING: AC3 code may be in EP10_02, refactoring needed!
```

**Operations Summary**:
```
KEEP: 1 task (EP10_01 Done)
UPDATE: 1 task (EP10_02 remove AC3 reference)
CREATE: 1 task (NEW: Refactor pagination to API)
OBSOLETE: 0 tasks

WARNINGS:
- AC reassignment detected (AC3: results → API)
- EP10_01 is Done, cannot update
- Code refactoring required (move pagination logic)
- Manual intervention needed
```

**Recommended Action**:
```
Create NEW task:
EP10_03: "Refactor pagination from results to API"
- Goal: Move pagination logic from search results component to search API endpoint
- Reason: AC3 reassignment after EP10_01 completion
- Implementation: Extract pagination from EP10_02, integrate into API
- Testing: Ensure backward compatibility, update existing tests
- Estimate: 3 hours
```

## Best Practices

### 1. Be Conservative with Updates

- **Prefer CREATE over UPDATE** when in doubt
- Updating tasks can invalidate work in progress
- Creating new tasks preserves existing work

### 2. Respect Status

- **Never auto-update In Progress/To Review tasks**
- **Never auto-cancel In Progress/To Review tasks**
- **Never update/cancel Done tasks**
- Show warnings, let user decide

### 3. Preserve History

- Use `state="Canceled"` for obsolete tasks (don't delete)
- Add comments explaining why task was canceled
- Reference removed AC numbers and reasons

### 4. Handle AC Reassignment Carefully

- AC moving between tasks is complex
- Code may be in wrong task
- Requires manual refactoring
- Create explicit refactoring tasks

### 5. Show Clear Diffs

- For UPDATE operations, show before/after
- Highlight added/removed AC
- Show technical approach changes
- Make review easy for user

### 6. Warn About Work Loss

- If canceling task with partial work → warning
- If updating task with code changes → warning
- If Done task conflicts with new requirements → create follow-up task

### 7. Consumer-First Validation

- Ensure IDEAL plan respects Consumer-First order
- If replan changes order → warning
- Dependencies should flow correctly (API before Service before Repository)

## Output Format

### Operations Summary

```
REPLAN SUMMARY for US001:

IDEAL PLAN (from Story analysis):
1. Token generation endpoint (AC1, AC2)
2. Token validation middleware (AC3, AC4) ← AC4 ADDED!
3. Email validation (NEW AC6) ← NEW!

EXISTING TASKS:
✓ EP7_01: Token generation endpoint
   Status: Done
   Operation: KEEP (matches plan, already Done)

⚠ EP7_02: Token validation middleware
   Status: Todo
   Operation: UPDATE (AC4 added to Story)
   Changes:
     - Add AC4: Handle expired token scenario
     - Update Implementation Plan with expiration check
     - Update Technical Approach: Reference token expiration guide

✗ EP7_03: Cache tokens in Redis
   Status: Todo
   Operation: OBSOLETE (caching removed from Story)
   Action: Cancel task (state="Canceled")

NEW TASKS:
+ EP7_04: Email validation
   Goal: Validate email format in registration
   Estimate: 3 hours
   AC: New AC6 from Story

OPERATIONS: 1 keep, 1 update, 1 cancel, 1 create

WARNINGS:
- EP7_02 will be updated (AC changed)

Type "confirm" to execute all operations.
```

---

**Version:** 1.0.0
**Last Updated:** 2025-11-10

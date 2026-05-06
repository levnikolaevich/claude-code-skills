# Story Replan Algorithm

<!-- SCOPE: Story REPLAN algorithm for ln-220-story-coordinator ONLY. Contains comparison logic, Decompose-First Pattern, operation determination. -->
<!-- DO NOT add here: Story creation → ln-221-story-creator SKILL.md, worker implementation → ln-222-story-replanner SKILL.md -->

Detailed documentation of the Story comparison and operation determination logic used in ln-220-story-coordinator REPLAN MODE.

## Overview

When ln-220-story-coordinator is invoked on an Epic that already has Stories, it enters REPLAN MODE. This algorithm determines how to reconcile the IDEAL Story plan (built from current Epic requirements) with existing Stories in Linear.

**Key Principle:** Decompose-First Pattern ensures we always build the IDEAL plan based on current Epic state BEFORE checking existing Stories, preventing "anchoring bias" to potentially outdated Story structure.

## Algorithm Steps

### Step 1: Match by Goal

**Objective:** Identify which existing Stories correspond to which Stories in IDEAL plan.

**Matching Criteria (Fuzzy Match):**
1. **Story Title Similarity:**
   - Extract keywords from both titles
   - Calculate similarity score (Levenshtein distance or keyword overlap)
   - Match threshold: >70% similarity

2. **Persona Match:**
   - Extract persona from Story Statement ("As a [persona]")
   - Exact match required (e.g., "API client" matches "API client")

3. **Capability Match:**
   - Extract capability from Story Statement ("I want [capability]")
   - Fuzzy match on action verbs + objects
   - Match threshold: >60% similarity
   - Example: "register OAuth client" matches "create OAuth registration"

**Matching Process:**
```
For each Story in IDEAL plan:
  For each existing Story:
    Calculate similarity_score = (
      0.4 * title_similarity +
      0.3 * persona_match +
      0.3 * capability_similarity
    )
    If similarity_score > 0.7:
      Mark as MATCHED
```

**Output:**
- Matched pairs: (IDEAL Story, Existing Story)
- Unmatched IDEAL Stories → Candidates for CREATE
- Unmatched existing Stories → Candidates for OBSOLETE

### Step 2: Determine Operations

For each matched pair and unmatched Story, determine the appropriate operation.

#### KEEP Operation
**Criteria** (ALL must be true):
- ✅ Story exists in IDEAL plan (matched)
- ✅ Story Statement unchanged (persona + capability + value)
- ✅ AC unchanged (same Given-When-Then scenarios)
- ✅ Technical Notes still valid (no new integrations/patterns)
- ✅ Status: Any except Done or Canceled

**Action:** None (no Linear API calls)

**Example:**
```
IDEAL:
  Title: US004: Register OAuth client
  Persona: API client
  Capability: Register new OAuth application
  AC: [3 scenarios unchanged]

Existing:
  Title: US004: Register OAuth client
  Status: Todo
  [Same Story Statement, AC, Technical Notes]

→ KEEP (no changes needed)
```

#### UPDATE Operation
**Criteria** (ANY must be true):
- ⚠️ AC changed (new AC added, existing modified, AC removed)
- ⚠️ Story Statement refined (same capability, clearer phrasing)
- ⚠️ Technical Notes changed (new guide links, integration approach)

**Constraints:**
- Status: Backlog or Todo ONLY
- If `In Progress`, `To Review`, or `Done` → show warning, no auto-update

**Action:** `update_issue(id, description=new_description)`

**Example:**
```
IDEAL:
  Title: US006: Validate access token
  AC:
    - Given token with valid signature, When validated, Then return claims
    - Given token with invalid signature, When validated, Then reject
    - Given expired token, When validated, Then return specific error ← NEW

Existing:
  Title: US006: Validate access token
  Status: Todo
  AC: [Only first 2 scenarios]

→ UPDATE (new AC scenario added)
```

#### OBSOLETE Operation
**Criteria:**
- ❌ Story NOT in IDEAL plan (no match found)
- ❌ Feature removed from Epic Scope
- ❌ Capability no longer needed

**Constraints:**
- Status: Backlog or Todo ONLY
- If In Progress → Show warning "Story in progress, manual review needed"
- If To Review → Show warning "Story under review, manual review needed"
- If Done → Show warning "Story completed, cannot cancel - will remain in Epic"

**Action:** `update_issue(id, state="Canceled")`

**Rationale:** Use Canceled state (not deletion) to preserve history and reference.

**Example:**
```
Existing:
  Title: US008: Custom token formats
  Status: Todo
  [Feature removed from Epic Scope]

IDEAL plan:
  [No matching Story - custom formats feature removed]

→ OBSOLETE (cancel Story in Linear)
```

#### CREATE Operation
**Criteria:**
- ➕ Story in IDEAL plan (no match in existing)
- ➕ New capability added to Epic
- ➕ New user need identified

**Action:** `create_issue()` (same as CREATE MODE)

**Example:**
```
IDEAL:
  Title: US009: Manage token scopes
  Persona: API client
  Capability: Define access scopes for tokens
  [New Epic requirement]

Existing Stories:
  [No matching Story - new capability]

→ CREATE (create new Story in Linear)
```

### Step 3: Handle Edge Cases

#### Case 1: Story In Progress with Changes
**Situation:** IDEAL plan shows AC changes for Story currently In Progress

**Resolution:**
- Do NOT auto-update (developers actively working on it)
- Show warning: "⚠️ US006 (In Progress): AC changed but cannot auto-update - manual review needed"
- Include diff in warning (show before/after AC)
- Recommend: Manual review after current work completes

**Example:**
```
IDEAL:
  US006: New AC added (token expiry validation)

Existing:
  US006: Status = In Progress (developer working on it)

→ WARNING (show diff, no auto-update)
```

#### Case 2: Story Done with Scope Changes
**Situation:** IDEAL plan shows Story should be removed, but it's already Done

**Resolution:**
- Do NOT cancel (work already completed and delivered)
- Show warning: "⚠️ US008 (Done): Feature removed from Epic scope, but Story already completed - will remain in Epic"
- Recommend: Keep for historical reference, do not revert

**Example:**
```
IDEAL:
  [US008 not in plan - feature removed]

Existing:
  US008: Status = Done

→ WARNING (cannot cancel Done Story)
```

#### Case 3: Multiple Matches (Ambiguous)
**Situation:** One IDEAL Story matches multiple existing Stories (similarity_score > 0.7 for multiple)

**Resolution:**
- Pick highest similarity_score match
- For other existing Stories → Mark as OBSOLETE candidates
- Show warning: "⚠️ Ambiguous match: US007 matches both 'Token refresh' and 'Token renewal' - selected 'Token refresh' (85% match)"

#### Case 4: No Matches (Complete Redesign)
**Situation:** Epic requirements completely changed, no existing Stories match IDEAL plan

**Resolution:**
- All existing Stories → OBSOLETE (if Backlog/Todo) or WARNING (if In Progress/Done)
- All IDEAL Stories → CREATE
- Show summary: "Complete Epic redesign detected: 5 Stories to obsolete, 7 new Stories to create"
- Require explicit user confirmation

#### Case 5: Story Split (1 → 2)
**Situation:** One existing Story matches 2 IDEAL Stories (capability split into smaller Stories)

**Resolution:**
- First IDEAL Story → UPDATE existing Story
- Second IDEAL Story → CREATE new Story
- Show explanation: "US004 'User authentication' split into US004 'Login' (update existing) and US009 'Password reset' (create new)"

#### Case 6: Story Merge (2 → 1)
**Situation:** Two existing Stories match 1 IDEAL Story (capabilities merged)

**Resolution:**
- Primary existing Story (higher similarity) → UPDATE
- Secondary existing Story → OBSOLETE
- Show explanation: "US004 'Login' and US005 'Session management' merged into US004 'User authentication' (update US004, obsolete US005)"

## Best Practices

### 1. Always Show Diffs
For UPDATE operations, show before/after comparison:
```
US006: Validate access token

Changes:
📋 Acceptance Criteria:
  + Given expired token, When validated, Then return specific error code
  + Given token from revoked client, When validated, Then reject

📝 Technical Notes:
  + Add guide link: Token Validation Best Practices
```

### 2. Group Operations by Type
Present operations in consistent order:
1. ✅ KEEP: N stories (list titles)
2. 🔧 UPDATE: M stories (show diffs)
3. ❌ OBSOLETE: K stories (show reasoning)
4. ➕ CREATE: L stories (show new capabilities)
5. ⚠️ WARNINGS: Edge cases requiring manual review

### 3. Preserve Story Continuity
- Keep existing Story IDs when updating (don't create new + delete old)
- Maintain Story numbering sequence (US004, US005, US006...)
- Update Epic Story Counters only for CREATE operations

### 4. Respect Status Transitions
Linear workflow:
```
Backlog → Todo → In Progress → To Review → Done
         └─→ Canceled (OBSOLETE only)
```

**Safe to auto-update:** Backlog, Todo
**Warnings only:** In Progress, To Review, Done

### 5. Require User Confirmation
**Always** show complete summary before executing:
- Total operation count
- All diffs for UPDATE operations
- All warnings for edge cases
- Estimated impact (Stories affected)

**Never** execute operations without explicit "confirm" from user.

## Implementation Checklist

Before implementing replan in ln-220-story-coordinator, verify:

**✅ Data Loading:**
- [ ] Fetch all existing Stories from Epic: `list_issues(project=Epic.id, label="user-story")`
- [ ] Load FULL descriptions (all 9 sections) for each Story
- [ ] Note Story status (`Backlog | Todo | In Progress | To Review | Done`)

**✅ IDEAL Plan Building:**
- [ ] Build IDEAL plan from Epic Scope (Phase 4)
- [ ] IDEAL plan has 5-10 Stories
- [ ] Each IDEAL Story has: title, persona, capability, value, AC (3-5), Technical Notes

**✅ Matching:**
- [ ] Implement fuzzy matching (title + persona + capability)
- [ ] Similarity threshold: >70%
- [ ] Handle ambiguous matches (multiple existing match one IDEAL)

**✅ Operation Determination:**
- [ ] Implement KEEP logic (all unchanged)
- [ ] Implement UPDATE logic (AC/Tech changed, status=Backlog/Todo only)
- [ ] Implement OBSOLETE logic (not in IDEAL, status=Backlog/Todo only, use state="Canceled")
- [ ] Implement CREATE logic (new in IDEAL, no existing match)

**✅ Edge Cases:**
- [ ] Handle In Progress Stories with changes (warning, no auto-update)
- [ ] Handle Done Stories removed from Epic (warning, no cancel)
- [ ] Handle ambiguous matches (pick highest score, warn)
- [ ] Handle Story splits (UPDATE + CREATE)
- [ ] Handle Story merges (UPDATE + OBSOLETE)

**✅ User Experience:**
- [ ] Show grouped operations (KEEP/UPDATE/OBSOLETE/CREATE)
- [ ] Show diffs for UPDATE operations
- [ ] Show warnings with explanations
- [ ] Require explicit "confirm" before execution
- [ ] Show progress during execution ("Updating US006...")
- [ ] Show final summary (operations executed + warnings)

**✅ Linear API:**
- [ ] Use `update_issue(id, description)` for UPDATE
- [ ] Use `update_issue(id, state="Canceled")` for OBSOLETE
- [ ] Use `create_issue()` for CREATE
- [ ] Handle API errors gracefully

**✅ kanban_board.md:**
- [ ] Remove Canceled Stories from all sections
- [ ] Update modified Stories (keep in current section)
- [ ] Add new Stories to "### Backlog"
- [ ] Update Epic Story Counters (Last Story, Next Story)

## Scenarios

### Scenario 1: Minor AC Refinement

**Context:** Epic 7 OAuth Authentication, existing 5 Stories, refined AC for 2 Stories

**IDEAL Plan (5 Stories):**
- US004: Register OAuth client (unchanged)
- US005: Request access token (AC refined: add token expiry)
- US006: Validate token (AC refined: add signature validation details)
- US007: Refresh expired token (unchanged)
- US008: Revoke token (unchanged)

**Existing Stories (5 Stories):**
- US004: Register OAuth client (Backlog)
- US005: Request access token (Todo)
- US006: Validate token (In Progress)
- US007: Refresh expired token (Todo)
- US008: Revoke token (Backlog)

**Operations:**
- ✅ KEEP: US004, US007, US008 (3 Stories unchanged)
- 🔧 UPDATE: US005 (AC refined, status=Todo, safe to update)
- ⚠️ WARNING: US006 (AC refined, but status=In Progress, cannot auto-update)

**Summary:**
```
✅ KEEP: 3 stories unchanged
🔧 UPDATE: 1 story (US005)
⚠️ Manual Review Needed: 1 story
  - US006 (In Progress): AC changed - review manually after current work completes

Operations: 1 update, 0 obsolete, 0 create
```

### Scenario 2: Feature Removed

**Context:** Epic 7, "Custom token formats" feature removed from scope

**IDEAL Plan (4 Stories):**
- US004: Register OAuth client
- US005: Request access token
- US006: Validate token
- US007: Refresh expired token

**Existing Stories (5 Stories):**
- US004: Register OAuth client (Todo)
- US005: Request access token (Todo)
- US006: Validate token (Done)
- US007: Refresh expired token (Todo)
- US008: Custom token formats (Todo)

**Operations:**
- ✅ KEEP: US004, US005, US006, US007 (4 Stories unchanged)
- ❌ OBSOLETE: US008 (feature removed, status=Todo, safe to cancel)

**Summary:**
```
✅ KEEP: 4 stories unchanged
❌ OBSOLETE: 1 story (US008 - Custom token formats)

Operations: 0 update, 1 obsolete, 0 create
```

### Scenario 3: New Feature Added

**Context:** Epic 7, "Token scope management" feature added to scope

**IDEAL Plan (6 Stories):**
- US004: Register OAuth client (unchanged)
- US005: Request access token (unchanged)
- US006: Validate token (unchanged)
- US007: Refresh expired token (unchanged)
- US008: Revoke token (unchanged)
- US009: Manage token scopes (NEW)

**Existing Stories (5 Stories):**
- US004: Register OAuth client (Backlog)
- US005: Request access token (Todo)
- US006: Validate token (Todo)
- US007: Refresh expired token (Todo)
- US008: Revoke token (Backlog)

**Operations:**
- ✅ KEEP: US004, US005, US006, US007, US008 (5 Stories unchanged)
- ➕ CREATE: US009 (new capability added)

**Summary:**
```
✅ KEEP: 5 stories unchanged
➕ CREATE: 1 new story (US009 - Manage token scopes)

Operations: 0 update, 0 obsolete, 1 create
```

### Scenario 4: Complete Epic Redesign

**Context:** Epic 7 scope completely changed from "OAuth Authentication" to "API Key Authentication"

**IDEAL Plan (4 Stories):**
- US009: Generate API key (NEW)
- US010: Validate API key (NEW)
- US011: Rotate API key (NEW)
- US012: Revoke API key (NEW)

**Existing Stories (5 Stories):**
- US004: Register OAuth client (Todo)
- US005: Request access token (Todo)
- US006: Validate token (In Progress)
- US007: Refresh expired token (Done)
- US008: Revoke token (Todo)

**Operations:**
- ❌ OBSOLETE: US004, US005, US008 (3 Stories, status=Todo, safe to cancel)
- ⚠️ WARNING: US006 (In Progress, cannot auto-cancel)
- ⚠️ WARNING: US007 (Done, cannot cancel)
- ➕ CREATE: US009, US010, US011, US012 (4 new Stories)

**Summary:**
```
Complete Epic redesign detected

❌ OBSOLETE: 3 stories (OAuth features removed)
⚠️ Manual Review Needed: 2 stories
  - US006 (In Progress): Feature removed but work in progress - review manually
  - US007 (Done): Feature removed but Story completed - will remain for historical reference
➕ CREATE: 4 new stories (API Key features)

Operations: 0 update, 3 obsolete, 4 create
⚠️ High impact - requires manual review of in-progress work
```

### Scenario 5: Story Split

**Context:** Epic 7, "User authentication" Story too large, split into "Login" and "Password reset"

**IDEAL Plan (6 Stories):**
- US004: Register OAuth client (unchanged)
- US005: User login (SPLIT from US006)
- US006: Request access token (unchanged from old US007)
- US007: Password reset (SPLIT from old US006)
- US008: Validate token (unchanged from old US008)
- US009: Refresh token (unchanged from old US009)

**Existing Stories (5 Stories):**
- US004: Register OAuth client (Todo)
- US006: User authentication (Todo, covers both login + password reset)
- US007: Request access token (Todo)
- US008: Validate token (Todo)
- US009: Refresh token (Todo)

**Operations:**
- ✅ KEEP: US004, US007, US008, US009 (4 Stories unchanged)
- 🔧 UPDATE: US006 → "User login" (narrow scope to just login)
- ➕ CREATE: US007 (new) → "Password reset" (split from US006)

**Summary:**
```
✅ KEEP: 4 stories unchanged
🔧 UPDATE: 1 story (US006 scope narrowed to "User login")
➕ CREATE: 1 new story (US007 - Password reset, split from US006)

Note: Story split detected - US006 "User authentication" → US006 "User login" + US007 "Password reset"

Operations: 1 update, 0 obsolete, 1 create
```

---

**Version:** 1.0.0 (Story replan algorithm with Epic extraction)
**Last Updated:** 2025-11-10

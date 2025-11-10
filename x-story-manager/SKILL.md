---
name: x-story-manager
description: Universal Story operations (create/replan) with automatic Epic decomposition. Decompose-First Pattern - Build IDEAL plan ALWAYS, then check existing and create or replan. Auto-discovers team ID and Epic.
---

# Linear Story Manager

Universal Story management skill that handles both creation and replanning through Epic decomposition.

## When to Use This Skill

This skill should be used when:
- Decompose Epic into User Stories (5-10 Stories covering Epic scope)
- Update existing Stories when Epic requirements change
- Rebalance Story scopes within an Epic
- Add new Stories to existing Epic structure

## Core Pattern: Decompose-First

**Key principle:** ALWAYS analyze Epic and build IDEAL Story plan FIRST, THEN check existing Stories to determine mode:
- **No existing Stories** → CREATE MODE (generate and create all Stories)
- **Has existing Stories** → REPLAN MODE (compare, determine operations: KEEP/UPDATE/OBSOLETE/CREATE)

**Rationale:** Ensures consistent Story decomposition based on current Epic requirements, independent of existing Story structure (which may be outdated or suboptimal).

## How It Works

### Phase 1: Discovery (Automated)

Auto-discovers configuration from `docs/tasks/kanban_board.md`:

1. **Team ID:** Reads Linear Configuration table
2. **Epic:** Parses Epic number from user request → Validates exists in Linear → Loads Epic description (Goal, Scope In/Out, Success Criteria, Technical Notes)
3. **Next Story Number:** Reads Epic Story Counters table → Gets next sequential number (US001, US002, etc.)

**Details:** See CLAUDE.md "Configuration Auto-Discovery".

### Phase 2: Extract from Epic (Automated)

Parses Epic structure to extract answers to Story planning questions:

1. **Q1 - Who is the user/persona?**
   - Extract from Epic Goal ("Enable [persona] to...")
   - Extract from Epic Scope In (user roles mentioned)

2. **Q2 - What do they want to do?**
   - Extract from Epic Scope In (capabilities listed)
   - Parse functional requirements

3. **Q3 - Why does it matter?**
   - Extract from Epic Success Criteria (business metrics)
   - Extract from Epic Goal (business value statement)

4. **Q4 - Which Epic?**
   - Already have Epic ID from Phase 1

5. **Q5 - Main acceptance criteria?**
   - Derive from Epic Scope In features
   - Identify testable scenarios for each capability

6. **Q6 - Application type?**
   - Extract from Epic Technical Notes (UI/API mentioned)
   - Infer from project context
   - Default: API (backend only)

**Output:** Partial or complete answers to 6 questions

### Phase 3: Gather Missing Information (Interactive)

**Only ask user for questions where Epic did not provide information.**

For each question with no answer from Phase 2:
1. Show what was extracted: "From Epic, I found: [extracted info]"
2. Ask user to confirm or provide missing details
3. Build complete Story planning context

**If all questions answered from Epic:** Skip this phase entirely and proceed to Phase 4.

### Phase 4: Build IDEAL Story Plan (Automated)

**This phase ALWAYS runs, regardless of whether Stories exist.**

1. **Analyze Epic Scope:**
   - Review all features in Epic Scope In
   - Identify distinct user capabilities
   - Group related functionality

2. **Determine Optimal Story Count:**
   - **Simple Epic** (1-3 features, single module): 3-5 Stories
   - **Medium Epic** (4-7 features, 2-3 modules): 6-8 Stories
   - **Complex Epic** (8+ features, multiple modules): 8-10 Stories
   - **Max 10 Stories per Epic** (enforced)

3. **Build IDEAL Plan** "in mind":
   - Each Story focuses on one user capability
   - Each Story has clear persona + capability + business value
   - Each Story has 3-5 testable AC (Given-When-Then)
   - Stories ordered by dependency (foundational capabilities first)
   - Each Story includes Test Strategy (Risk-Based Testing: 2-5 E2E, 3-8 Integration, 5-15 Unit, 10-28 total)
   - Each Story includes Technical Notes (architecture, integrations, guide links)

**Output:** IDEAL Story plan (5-10 Stories) with:
- Story titles
- Story statements (As a/I want/So that)
- Core AC for each
- Story ordering (dependency-aware)

**Note:** This plan exists "in mind" before checking existing Stories.

### Phase 5: Check Existing Stories

Query Linear for existing Stories in Epic:

```
list_issues(project=Epic.id, label="user-story")
```

**Decision Point:**
- **Count = 0** → No existing Stories → **Proceed to Phase 6a (CREATE MODE)**
- **Count ≥ 1** → Existing Stories found → **Proceed to Phase 6b (REPLAN MODE)**

### Phase 6a: Create Mode (No Existing Stories)

**Trigger:** Epic has no Stories yet (first time decomposition)

**Process:**

1. **Generate Story Documents:**
   - For each Story in IDEAL plan (Phase 4)
   - Use story_template_universal.md structure
   - Generate complete 8 sections:
     - Story Statement (As a/I want/So that)
     - Context
     - Acceptance Criteria (Given-When-Then, 3-5 AC)
     - Test Strategy (Risk-Based Testing: 2-5 E2E, 3-8 Integration, 5-15 Unit, 10-28 total)
     - Implementation Tasks (placeholder: "Tasks will be created via x-task-manager after Story verification")
     - Technical Notes (architecture, integrations, guide links)
     - Definition of Done
     - Revision History

2. **Show Preview:**
   - Display all Stories to be created
   - Show numbering (e.g., US004, US005, US006...)
   - Show Story ordering (dependency-aware)
   - Total count (e.g., "5 Stories to create")

3. **User Confirmation:**
   - Wait for user to type "confirm"
   - If user provides feedback → Adjust Stories and show updated preview

4. **Create All Stories in Linear:**
   - Sequential creation using `create_issue()`:
     - Title: "USXXX: [Title]"
     - Description: Complete Story markdown
     - Team: Team ID from Phase 1
     - Project: Epic ID from Phase 1
     - Labels: ["user-story"]
     - parentId: null (Stories are top-level)
   - Collect all Linear Issue URLs

5. **Update kanban_board.md:**
   - Add ALL Stories to "### Backlog" section under Epic header:
     ```markdown
     **Epic N: Epic Title**

       📖 [LINEAR_ID: USXXX Story Title](link)
         _(tasks not created yet)_
       📖 [LINEAR_ID: USYYY Story Title](link)
         _(tasks not created yet)_
     ```
   - Update Epic Story Counters table (Last Story → last created, Next Story → next number)

**Output:** Summary message with all created Story URLs

### Phase 6b: Replan Mode (Existing Stories Found)

**Trigger:** Epic already has Stories (requirements changed, need to replan)

**Process:**

1. **Load Existing Stories:**
   - Fetch all Stories from Linear: `get_issue(id)` for each
   - Load FULL description (all 8 sections) for each Story
   - Note Story status (Backlog/Todo/In Progress/To Review/Done)
   - **Total:** N existing Stories

2. **Compare IDEAL Plan vs Existing:**
   - **Algorithm:** See `references/replan_algorithm.md` for detailed matching logic
   - **Match by goal:** Fuzzy match Story titles + persona + capability
   - **Identify operations needed:**
     - **KEEP:** Story in IDEAL + existing, AC unchanged → No action
     - **UPDATE:** Story in IDEAL + existing, AC/approach changed → Update description
     - **OBSOLETE:** Story in existing, NOT in IDEAL → Cancel (state="Canceled")
     - **CREATE:** Story in IDEAL, NOT in existing → Create new

3. **Categorize Operations:**
   ```
   ✅ KEEP (N stories): No changes needed
   - US004: OAuth client registration
   - US005: Token validation

   🔧 UPDATE (M stories): AC or approach changed
   - US006: Token refresh (AC modified: add expiry validation)
   - US007: Token revocation (Technical Notes: add audit logging)

   ❌ OBSOLETE (K stories): No longer in Epic scope
   - US008: Custom token formats (feature removed from Epic)

   ➕ CREATE (L stories): New capabilities added
   - US009: Token scope management (new Epic requirement)
   ```

4. **Show Replan Summary:**
   - Display operations for all Stories
   - Show diffs for UPDATE operations (before/after AC)
   - Show warnings for edge cases:
     - ⚠️ "US006 is In Progress - cannot auto-update, manual review needed"
     - ⚠️ "US008 is Done - cannot cancel, will remain in Epic"
   - Total operation count

5. **User Confirmation:**
   - Wait for user to type "confirm"
   - If user provides feedback → Adjust operations and show updated summary

6. **Execute Operations:**
   - **KEEP:** Skip (no Linear API calls)
   - **UPDATE:** Call `update_issue(id, description=new_description)` (Backlog/Todo only)
   - **OBSOLETE:** Call `update_issue(id, state="Canceled")` (Backlog/Todo only)
   - **CREATE:** Call `create_issue()` (same as Phase 6a)

7. **Update kanban_board.md:**
   - Remove OBSOLETE Stories (Canceled) from all sections
   - Update modified Stories (UPDATE operations) - keep in current section
   - Add new Stories (CREATE operations) to "### Backlog"
   - Update Epic Story Counters table

**Output:** Summary message with operation results + affected Story URLs

**Important Constraints:**
- **Never auto-update Stories with status:** In Progress, To Review, Done (show warnings only)
- **Never delete Stories:** Use state="Canceled" to preserve history
- **Always require user confirmation** before executing operations

### Phase 7: Post-Execution (Automated)

Display completion summary:

**CREATE MODE:**
```
✅ Created 5 Stories for Epic 7: OAuth Authentication

Stories created:
- US004: Register OAuth client (link)
- US005: Request access token (link)
- US006: Validate token (link)
- US007: Refresh expired token (link)
- US008: Revoke token (link)

Next Steps:
1. Run x-story-verifier to validate Stories before approval
2. Use x-task-manager to create tasks for each Story
```

**REPLAN MODE:**
```
✅ Replanned Epic 7: OAuth Authentication

Operations executed:
- ✅ KEEP: 3 stories unchanged
- 🔧 UPDATE: 2 stories modified (link)
- ❌ OBSOLETE: 1 story canceled (link)
- ➕ CREATE: 2 new stories created (link)

⚠️ Manual Review Needed:
- US006 (In Progress): AC changed but cannot auto-update - review manually

Next Steps:
1. Review warnings for Stories in progress
2. Run x-story-verifier on updated/created Stories
3. Use x-task-manager to create/replan tasks
```

---

## Definition of Done

Before completing work, verify ALL checkpoints:

**✅ Discovery Complete:**
- [ ] Team ID loaded from kanban_board.md
- [ ] Epic number parsed from request
- [ ] Epic exists in Linear and description loaded
- [ ] Next Story number determined from Epic Story Counters

**✅ Epic Extraction Complete:**
- [ ] Attempted to extract all 6 question answers from Epic
- [ ] Missing information requested from user (if needed)
- [ ] Complete Story planning context assembled

**✅ IDEAL Plan Built:**
- [ ] Epic Scope analyzed
- [ ] Optimal Story count determined (5-10 Stories)
- [ ] IDEAL Story plan created with titles, statements, core AC
- [ ] Stories ordered by dependency

**✅ Mode Determined:**
- [ ] Checked for existing Stories in Epic
- [ ] Selected CREATE MODE or REPLAN MODE based on count

**✅ CREATE MODE Executed (if Count = 0):**
- [ ] Story documents generated (8 sections each)
- [ ] Preview shown to user
- [ ] User typed "confirm"
- [ ] All Stories created in Linear (label "user-story", parentId=null)
- [ ] kanban_board.md updated (Stories added to Backlog, counters updated)
- [ ] Linear Issue URLs returned

**✅ REPLAN MODE Executed (if Count ≥ 1):**
- [ ] Existing Stories loaded (full descriptions)
- [ ] IDEAL plan compared with existing
- [ ] Operations categorized (KEEP/UPDATE/OBSOLETE/CREATE)
- [ ] Replan summary with diffs shown to user
- [ ] User typed "confirm"
- [ ] Operations executed in Linear (respecting status constraints)
- [ ] kanban_board.md updated (remove Canceled, add new, update modified)
- [ ] Operation results returned

**✅ Constraints Respected:**
- [ ] Never auto-updated Stories with status In Progress/To Review/Done
- [ ] Never deleted Stories (used state="Canceled" for obsolete)
- [ ] Showed warnings for edge cases (In Progress Stories with changes)
- [ ] Required user confirmation before all operations

**Output:**
- CREATE MODE: List of created Story URLs + summary
- REPLAN MODE: Operation results + warnings + affected Story URLs

---

## Example Usage

**CREATE MODE (First Time):**
```
"Create stories for Epic 7: OAuth Authentication"
```

**Process:**
1. Discovery → Team "API", Epic 7, Next Story: US004
2. Extract from Epic → Persona: API client, Value: secure API access
3. Gather Missing → Ask about AC specifics (Epic had high-level features)
4. Build IDEAL → 5 Stories: "Register client", "Request token", "Validate token", "Refresh token", "Revoke token"
5. Check Existing → Count = 0 → CREATE MODE
6. Create Mode → Generate 5 Stories, show preview, user confirms, create in Linear
7. Post-Execution → US004-US008 created

**REPLAN MODE (Requirements Changed):**
```
"Replan stories for Epic 7 - we removed custom token formats and added scope management"
```

**Process:**
1. Discovery → Team "API", Epic 7 (already has US004-US008)
2. Extract from Epic → New requirements: removed custom formats, added scopes
3. Gather Missing → Epic had all info needed
4. Build IDEAL → 5 Stories: "Register client", "Request token", "Validate token", "Refresh token", "Manage scopes"
5. Check Existing → Count = 5 → REPLAN MODE
6. Replan Mode → Compare: KEEP 4 Stories, OBSOLETE "Custom formats" (US008), CREATE "Manage scopes" (US009)
7. Post-Execution → US008 canceled, US009 created

## Reference Files

- **story_template_universal.md:** User Story template structure (8 sections)
- **replan_algorithm.md:** Detailed Story comparison and operation determination logic
- **../x-epic-creator/references/linear_integration.md:** Shared discovery patterns and Linear API

## Best Practices

- **Decompose-First:** Always build IDEAL plan before checking existing - prevents anchoring to suboptimal structure
- **Epic extraction:** Try to extract all planning info from Epic before asking user - reduces user input burden
- **One capability per Story:** Each Story should have clear, focused persona + capability + value
- **Testable AC:** Use Given-When-Then format, 3-5 AC per Story, specific criteria ("<200ms" not "fast")
- **Test Strategy:** Include Risk-Based Testing section - guides final test task creation via x-story-finalizer
- **Status respect:** Never auto-update Stories In Progress/Done - show warnings instead
- **Preserve history:** Use state="Canceled" for obsolete Stories, never delete
- **User confirmation:** Always show preview/summary and require "confirm" before operations

---

**Version:** 7.0.0 (Universal operations with Decompose-First pattern + Epic extraction)
**Last Updated:** 2025-11-10

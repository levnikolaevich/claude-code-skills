---
name: x-story-creator
description: Create user stories with As a/I want/So that format and Given-When-Then acceptance criteria through interactive dialog. Captures persona, capability, business value, and scenarios. Supports Single Mode (one story) and Batch Mode (Epic decomposition). Auto-discovers team ID and Epic.
---

# Linear Story Creator

Creates comprehensive User Stories using industry-standard formats (As a/I want/So that + Given-When-Then).

## When to Use This Skill

This skill should be used when:
- Define user-facing functionality with clear user value
- Create stories linked to an existing Epic (Linear Project)
- Specify testable acceptance criteria in Given-When-Then format
- Plan features from user perspective (not technical implementation)

## Operating Modes

This skill supports two operating modes:

### Single Mode (Default)
Creates **ONE User Story** from a specific user need.

**Use when:**
- Adding one Story to existing Epic
- User requirement is clear and focused
- Request uses singular: "Create story for..."

**Output:** 1 Linear Issue with label "user-story"

### Batch Mode
Creates **MULTIPLE User Stories** from Epic decomposition.

**Use when:**
- Starting new Epic and need to break it into user stories
- Decomposing Epic's functional requirements
- Request uses plural: "Create stories for..."

**Output:** 5-10 Linear Issues (complete Epic coverage)

**Mode Detection:** Automatically detected by request phrasing (singular vs plural).

## How It Works: Single Mode

### Phase 1: Discovery (Automated)

Auto-discovers Team ID, Epic (from user), and Next Story Number from `docs/tasks/kanban_board.md`.

**Details:** See CLAUDE.md "Configuration Auto-Discovery".

### Phase 2: Planning Dialog (Interactive)

6 key questions:

1. **"Who is the user/persona?"** - Role making request
2. **"What do they want to do?"** - Capability needed
3. **"Why does it matter?"** - Business value
4. **"Which Epic?"** - Epic number (validates exists)
5. **"Main acceptance criteria?"** - 2-3 key scenarios in natural language
6. **"Application type?"** - UI (has user interface) or API (backend only) - determines E2E test type

### Phase 3: Package & Guide Validation (If External Packages Mentioned)

**Skip if:** Story uses only standard project code

**If user mentions external packages in responses:**

1. **Latest Version Check:**
   - Use MCP Ref to verify latest stable version (2025)
   - Check compatibility with project framework/language version
2. **Guide Existence:**
   - Check `docs/guides/` for package usage guide
   - If missing → Prompt to create guide via guide-creator skill before Story creation
3. **Usage Clarity:**
   - Ensure Story will include in Technical Notes:
     - How to use package (algorithm/pattern)
     - Package limitations/constraints
     - Integration approach

**Block Story creation if:**
- ❌ Outdated package version specified
- ❌ No guide exists for new external package
- ❌ Package usage algorithm unclear

### Phase 4: Generation (Automated)

Generates complete User Story with:
- **Story Statement:** As a [role] I want [capability] So that [value]
- **Context:** Current situation + Desired outcome
- **Acceptance Criteria:** Given-When-Then format (main + edge cases + errors)
- **Implementation Tasks:** Placeholder for tasks (final task will be tests)
- **Test Strategy:** Plan for Unit/Integration/E2E tests (Risk-Based Testing: 2-5 E2E, 3-8 Integration, 5-15 Unit, 10-28 total)
- **Technical Notes:** Architecture considerations, integration points
- **Definition of Done:** Functionality, Testing, Code Quality checklists

**Note:** Test Strategy section guides x-story-finalizer when creating final test task after manual testing. See `x-story-finalizer/references/risk_based_testing_guide.md` for Risk-Based Testing methodology.

Shows markdown preview for review.

### Phase 5: Confirmation & Creation

1. User reviews generated story
2. Type "confirm" to proceed
3. Creates Linear Issue with:
   - Title: "USXXX: [Title]"
   - Description: Complete story markdown
   - Project: Linked to specified Epic
   - Labels: ["user-story"]
   - parentId: null (parent for tasks)
4. Update kanban_board.md:
   - Add Story to "### Backlog" section under Epic header:
     ```
     **Epic N: Epic Title**

       📖 [LINEAR_ID: USXXX Story Title](link)
         _(tasks not created yet)_
     ```
   - Update Epic Story Counters table (Last Story → USXXX, Next Story → US{XXX+1})
5. Returns Linear issue URL

## How It Works: Batch Mode

### Phase 1: Discovery (Automated)

Same as Single Mode:
- **Team ID:** Reads `docs/tasks/kanban_board.md` → Linear Configuration → Team ID
- **Epic:** User specifies Epic number → Validates exists in Linear
- **Next Story:** Reads `docs/tasks/kanban_board.md` → Epic Story Counters → Next Available (US001, US002, etc.)

### Phase 2: Epic Analysis (Interactive)

Analyzes Epic and identifies user stories:

1. **Epic understanding:**
   - Reads Epic description from Linear (Goal, Scope, Success Criteria)
   - Identifies functional requirements and capabilities
   - Determines target user personas

2. **Story identification:**
   - Automatically identifies 5-10 user stories covering Epic scope
   - Each story focuses on one user capability
   - Examples: "Login with email", "View order history", "Export report to PDF"

3. **Confirmation:**
   - Shows identified stories to user
   - User can adjust/refine story list
   - Confirms application type for each: UI or API (determines E2E test type)

### Phase 3: Package & Guide Validation (If Needed)

Same as Single Mode - validates external packages mentioned in any story:
- Latest version check (2025)
- Guide existence in `docs/guides/`
- Usage clarity (algorithm, limitations, integration)

Blocks batch creation if any story has package issues.

### Phase 4: Batch Generation (Automated)

For each identified story:

1. **Story planning** (same elements as Single Mode):
   - Persona, capability, business value
   - Acceptance criteria (Given-When-Then)
   - Test Strategy (Risk-Based Testing: 2-5 E2E, 3-8 Integration, 5-15 Unit, 10-28 total)
   - Technical Notes

2. **Generate Story document:**
   - Story Statement (As a/I want/So that)
   - Context, AC, Test Strategy
   - Implementation Tasks placeholder
   - Technical Notes, DoD

3. **Show batch preview:**
   - Display all generated Stories
   - Show Story numbering (e.g., US004, US005, US006...)

### Phase 5: Confirmation & Batch Creation

1. User reviews all generated Stories
2. Type "confirm" to proceed with batch creation
3. Creates all Linear Issues sequentially with:
   - Title: "USXXX: [Title]"
   - Description: Complete story markdown
   - Project: Linked to specified Epic
   - Labels: ["user-story"]
   - parentId: null
4. Update kanban_board.md:
   - Add ALL Stories to "### Backlog" section under Epic header (each with `_(tasks not created yet)_`)
   - Update Epic Story Counters table (Last Story → last created, Next Story → next number)
5. Returns all Linear issue URLs

**Output:** 5-10 Linear Issues covering complete Epic scope

---

## Definition of Done

Before completing work, verify ALL checkpoints:

**✅ Object Created in Linear:**
- [ ] Linear Story Issue created successfully
- [ ] All required fields populated (title, description, team, label "user-story")
- [ ] parentId set to null (Story is top-level, not sub-issue)
- [ ] Epic linked correctly (if Epic number provided)

**✅ Description Complete (8 sections):**
- [ ] Story statement: "As a [persona], I want [capability], So that [business value]"
- [ ] Context: Background information provided
- [ ] Acceptance Criteria: Given-When-Then format (3-5 AC)
- [ ] Test Strategy: Risk-Based Testing mentioned (2-5 E2E, 3-8 Integration, 5-15 Unit, 10-28 total)
- [ ] Implementation Tasks: Placeholder present (tasks created later via x-task-manager)
- [ ] Technical Notes: Architectural considerations, integration points
- [ ] Definition of Done: Functionality/Testing/Code Quality checklists
- [ ] Revision History: Created timestamp with version number

**✅ Tracking Updated:**
- [ ] kanban_board.md updated:
  - Story added to "### Backlog" section under Epic header with format:
    ```
    **Epic N: Epic Title**

      📖 [LINEAR_ID: USXXX Story Title](link)
        _(tasks not created yet)_
    ```
  - Epic Story Counters table updated (Last Story, Next Story)
- [ ] Linear Issue URL returned to user

**✅ User Confirmation:**
- [ ] User reviewed generated Story before creation
- [ ] User typed "confirm" to proceed with creation

**Output:** Linear Issue URL + confirmation message ("Created Story US00X: [title]")

---

## Example Usage

**Single Mode:**
```
"Create user story for authenticating API requests with tokens"
```

**Process:**
1. Discovery → Team "API", Epic 7, Next Story: US004
2. Dialog → Captures persona, capability, value, Epic, criteria, app type (API)
3. Package Validation → Verify external packages (if mentioned)
4. Generation → Complete story with AC, Test Strategy (API E2E tests)
5. Creation → "US004: OAuth Token Authentication" in Linear Epic 7

**Batch Mode:**
```
"Create stories for Epic 7 OAuth Authentication"
```

**Process:**
1. Discovery → Team "API", Epic 7, Next Story: US004-US009
2. Epic Analysis → Reads Epic 7, identifies stories: "Register OAuth client", "Request access token", "Validate token", "Refresh expired token", "Revoke token", "Manage token scopes"
3. Package Validation → Verifies OAuth libraries mentioned
4. Batch Generation → 6 Story documents with sequential numbering
5. Batch Creation → US004-US009 created in Linear Epic 7

## Reference Files

- **story_template_universal.md:** User Story template structure
- **../epic-creator/references/linear_integration.md:** Shared discovery patterns and Linear API

## Best Practices

- Focus on user value: Story describes WHAT and WHY, not HOW
- One capability per story: Keep focused and testable
- Specific acceptance criteria: "<200ms" not "fast"
- Cover edge cases: Anticipate error scenarios
- **No code snippets:** Never include actual code in Story descriptions - only behavior and acceptance criteria
- **Test Strategy:** Include Test Strategy section - guides final test task creation via x-story-finalizer
- **Application type:** Always ask about UI vs API - determines E2E test type (UI E2E or API E2E)
- **Package validation:** Verify external packages are latest version, compatible, and have guides before Story creation

---

**Version:** 6.0.0 (Batch Mode: Epic → Multiple Stories)
**Last Updated:** 2025-10-28

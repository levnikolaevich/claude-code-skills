# Story Verification Checklist

Complete checklist for verifying Story and all its Tasks before approval.

**CRITICAL PRINCIPLE:** This skill ALWAYS auto-fixes all issues detected. Never leave Story in Backlog with feedback - fix and approve.

## Mandatory Checks (Auto-Fix Actions)

### 1. Story Structure Format (Template Compliance)
**Check:** Story description follows template structure

⚠️ **Important:** Request FULL Story description from Linear (not truncated) to validate all 8 sections.

**Required Sections (in order):**
1. **Story** (As a / I want / So that)
2. **Context** (Current Situation + Desired Outcome)
3. **Acceptance Criteria** (Given-When-Then: Main Scenarios + Edge Cases + Error Handling)
4. **Implementation Tasks** (List with links including final test task)
5. **Test Strategy** (Unit 70% / Integration 20% / E2E 10%)
6. **Technical Notes** (Architecture Considerations + Integration Points + Performance & Security)
7. **Definition of Done** (Functionality + Testing + Code Quality)
8. **Dependencies** (Depends On + Blocks)

✅ All 8 sections present in correct order
✅ Each section has non-empty content
✅ Required subsections present (Context: Current Situation/Desired Outcome)
❌ Missing sections → Add with template placeholders
❌ Sections out of order → Reorder to match template
❌ Empty sections → Add placeholder text

**Fix Actions:**
When structure violations detected:
1. Parse current Story description
2. Identify missing/misplaced sections
3. Restructure:
   - Add missing sections with placeholders (_TODO: Fill this section_)
   - Reorder sections to match template
   - Add missing subsections (Current Situation, Desired Outcome, etc.)
4. Update Linear issue via `mcp__linear-server__update_issue`
5. Add comment to Linear explaining changes

**Template Reference:** `../story-creator/references/story_template_universal.md` (v5.0.0)

**Skip Fix When:**
- Story in Done/Canceled status
- Story older than 30 days (legacy, don't touch)

### 2. Tasks Structure Format (Template Compliance - EVERY Task)
**Check:** All child Task descriptions follow template structure

**Equally Critical:** This check is as important as Story validation (#1). EVERY Task must comply with task_template_universal.md.

⚠️ **Important:** Request FULL Task description from Linear (not truncated) for EACH Task to validate all 7 sections.

**Required Sections (in order for EACH Task):**
1. **Context** (Current State + Desired State)
2. **Implementation Plan** (Phase 1-3 with checkboxes)
3. **Technical Approach** (Recommended + Why + Patterns + Alternatives)
4. **Acceptance Criteria** (Given-When-Then with checkboxes)
5. **Affected Components** (Implementation + Documentation)
6. **Existing Code Impact** (Refactoring + Tests to Update + Documentation to Update)
7. **Definition of Done** (Checklist)

**Note:** Test Strategy removed from Tasks - all tests in Story's final task

✅ All 7 sections present in correct order in EVERY Task
✅ Each section has non-empty content in every Task
✅ Required subsections present in every Task
❌ Missing sections in any Task → Add with template placeholders
❌ Sections out of order in any Task → Reorder to match template

**Fix Actions:**
For each Task with structure violations:
1. Parse Task description
2. Identify missing/misplaced sections
3. Restructure each Task
4. Update Linear issue for each Task via `mcp__linear-server__update_issue`
5. Add comment to Linear for each fixed Task

**Template Reference:** `../task-creator/references/task_template_universal.md` (v5.0.0)

**Skip Fix When:**
- Task in Done/Canceled status
- Task older than 30 days (legacy, don't touch)

### 3. Story Statement
**Check:** Clear, specific, user-focused (As a / I want / So that)

✅ "As a API client, I want to authenticate with OAuth2 tokens, So that users can securely access their data"
❌ "Improve authentication" (vague, no user context)

### 4. Acceptance Criteria (Story Level)
**Check:** Specific, testable, Given/When/Then format covering Story goal

✅ "Given valid OAuth2 token, When API request sent, Then user authenticated and data returned"
✅ "Given invalid token, When API request sent, Then 401 error returned"
❌ "Authentication should work correctly" (not testable)

### 5. Technical Approach (Story Level)
**Check:** Follows project architecture patterns, not over-engineered, consistent with previous Story

✅ "Use OAuth2 library (authlib 1.3+) for token validation, integrate with existing User model"
❌ "Implement custom JWT parser and validation" (library exists, YAGNI violation)

**Questions:**
- Does standard library solve Story goal?
- Is there simpler architectural approach? (KISS)
- Does Story duplicate existing functionality? (DRY)
- Which guide covers this architectural pattern?
- Are all layers properly involved? (API → Service → Repository)

**If previous Story context loaded (Phase 2 step 7):**
- ✅ Current Story uses same guides as previous Story (consistency)
- ✅ Current Story reuses components from previous Story (no reinvention)
- ✅ Current Story integrations compatible with previous Story
- ❌ Current Story creates duplicate component that exists in previous Story → Add TODO
- ❌ Current Story conflicts with previous Story integrations → Add TODO

**Auto-fix actions:**
- Add missing guides from previous Story to Technical Notes
- Add TODO if duplicate components detected
- Add TODO if conflicting integrations detected
- Add context reference: "Related to previous Story [US00X]"

### 6. Library & Version Research (Story Level)
**Check:** Story uses latest stable libraries and current architectural practices

✅ "Use authentication library 1.3+" (current stable version)
✅ "Follow web framework security patterns" (verified via MCP Ref)
❌ "Use custom token implementation" (library exists, reinventing wheel)
❌ "Implement custom session management" (framework has built-in)
❌ "Implement helper for email validation when library has validator.isEmail()" (library provides method, reinventing)
❌ "Use library 3.0.0-beta when stable 2.5.x exists" (bleeding edge, not production-ready)

**Process:**
1. Search MCP Ref for library documentation matching Story domain
2. Verify latest stable versions with production track record (prefer LTS, avoid bleeding edge)
3. Check if well-known libraries solve Story goal
4. Confirm Story architectural approach matches 2025 best practices
5. Verify package compatibility with project framework and language version
6. Check if guide exists in `docs/guides/` for each external package
7. Validate Tasks describe correct usage algorithm and limitations

**Red Flags:**
❌ Package incompatible with project framework version
❌ No guide for external package in `docs/guides/`
❌ Tasks don't describe package usage algorithm
❌ Package limitations not mentioned in Technical Notes
❌ Tasks implement custom helpers for functionality library already provides via built-in methods
❌ Tasks use bleeding edge versions (alpha/beta/RC) instead of proven stable releases

**Tools:** MCP Ref (`ref_search_documentation`), WebSearch (if needed)

**Critical packages:** Save to `docs/manuals/{package}-{major.minor}.md`
(ORM/Framework/State/Testing only, skip utils/formatters)
Fetch via MCP Ref: install + core + 2-3 examples

### 7. Tests Integration (Story Level)
**Check:** Story has Test Strategy section, final Task dedicated to tests

✅ Story has Test Strategy section (Risk-Based Testing: 2-5 E2E, 3-8 Integration, 5-15 Unit, 10-28 total, Priority ≥15) focusing on business logic (not frameworks/libraries/trivial getters)
✅ Final Task in Implementation Tasks list is test task
✅ Story DoD includes: "All tests passing (Unit/Integration/E2E)"
✅ Test Strategy specifies E2E type (API or UI based on application)
✅ No duplicate test coverage - Each behavior tested once at appropriate level
❌ Story missing Test Strategy section
❌ No final test task planned
❌ Implementation Tasks include test sections (should be test-free)

### 8. Documentation Integration (Story + Tasks Level)
**Check:** Docs integrated across Story Tasks, not separate

✅ Story DoD includes: "Documentation updated"
✅ Tasks include doc updates in Affected Components
❌ Separate Task: "Document Story implementation" (creates stale docs)
❌ Story without documentation plan in Tasks

### 9. Story Size
**Check:** Reasonable scope (3-8 Tasks, ~1-2 weeks) AND each task is optimal size (3-5 hours)

**Story-level check:**
✅ 4-6 Tasks covering API → Service → Repository → Tests
❌ Too large: "Implement complete auth + authorization + audit" → Split into multiple Stories
❌ Too small: Single trivial change → Combine or make it a standalone Task

**Task-level check (granularity):**
✅ Each task 3-5 hours development time (atomic, testable unit)
✅ Task: "Implement token validation middleware" (~4 hours: logic + error handling + integration)
❌ Too granular (< 3h): "Add import statement", "Create empty function" → Combine with related work
❌ Too large (> 8h): "Implement complete OAuth2 flow" → Decompose into smaller tasks (generation + validation + refresh + revocation)

**Red flags:**
- Tasks with overly detailed decomposition (< 3h each) - sign of over-planning
- Tasks with vague scope (> 8h estimated) - needs further breakdown

### 10. YAGNI Compliance (Story Level)
**Check:** Story delivers only what is needed NOW

✅ "OAuth2 token authentication" (current requirement)
❌ "Add multi-factor authentication" (not in current requirements)
❌ "Support 5 OAuth providers" (only 1 provider needed now)

### 11. KISS Compliance (Story Level)
**Check:** Simplest architectural solution that delivers Story goal

✅ "Use existing OAuth2 library with standard flow" (simple, proven)
❌ "Implement distributed auth microservice with event sourcing" (over-engineered for auth)

### 12. Guide References (Story Level)
**Check:** Story Technical Notes reference existing guides or propose new

✅ "Follow [Guide 05: Authentication Pattern](link) for OAuth2 flow"
✅ "Create new guide: Multi-Tenant Authentication Strategy"
❌ No guide references in Story Technical Notes (architectural pattern not documented)

### 13. Consumer-First Principle (Story Level)
**Check:** Story implements consumer before provider

✅ Task order: 1. API endpoint (consumer) → 2. Auth Service → 3. Token Repository (provider)
✅ Consumer Tasks use mocks until provider Tasks complete
❌ Task order: 1. Token Repository → 2. Auth Service → 3. API endpoint (backwards)

**Detection Keywords:**
- Consumer: endpoint, route, controller, API, UI component
- Service: service, business logic, use case
- Provider: repository, database, schema, migration

**Exceptions:** Foundation layer, standard infrastructure, generic utilities

### 14. Code Quality Fundamentals (Story Level)
**Check:** Story Tasks avoid hardcoded values and use proper configuration management

✅ "Store API timeout in config: `config.api.timeout = 5000`" (configurable)
✅ "Use environment variable: `const maxRetries = process.env.MAX_RETRY_COUNT || 3`"
✅ "Named constant with explanation: `const BUFFER_SIZE = 1024 // Optimal for 4KB page size`"
❌ "Set timeout to 5000ms in code" (magic number without explanation)
❌ "`const API_URL = 'https://api.example.com'`" (hardcoded URL, should be env var)
❌ "`const MAX_ITEMS = 100`" (magic number without WHY explanation)

**Must check:**
- Magic numbers extracted to named constants or configuration
- Hardcoded paths/URLs moved to config files or environment variables
- API keys and credentials use environment variables (never in code)
- Timeouts, limits, thresholds are configurable
- Named constants have explanatory comments (WHY this value)

**Note:** This check is performed at Story level (review Technical Notes and Implementation Tasks descriptions), not code inspection.

### 15. Industry Standards Compliance (Story Level)
**Check:** Story solution follows industry standards and RFCs (checked BEFORE applying KISS/YAGNI)

**Hierarchy:** Industry Standards (Level 1) > Security Standards (Level 2) > KISS/YAGNI/DRY (Level 3)

✅ "Implement POST /auth/token with grant_type parameter per OAuth 2.0 RFC 6749" (standard-compliant)
✅ "Use OpenAPI 3.1 spec for API documentation" (follows industry standard)
✅ "REST API follows RESTful principles (resource-based URLs, proper HTTP methods)" (standard design)
✅ "WebSocket handshake per RFC 6455" (protocol compliance)
❌ "Create separate /tokens and /refresh endpoints for simplicity" (non-standard OAuth flow, KISS conflicts with RFC 6749)
❌ "Custom authentication flow instead of OAuth 2.0" (reinventing standard, integration issues)
❌ "Non-RESTful API design (e.g., GET /api/deleteUser)" (violates REST principles)

**Common standards to check (examples - not exhaustive):**
- **OAuth 2.0:** RFC 6749 compliance (unified /token endpoint, grant_type parameter, standard flows)
- **REST API:** RESTful principles (resource-based URLs, proper HTTP methods, status codes)
- **OpenAPI:** API documentation follows OpenAPI 3.x specification
- **Protocols:** HTTP/HTTPS, WebSocket, GraphQL standards compliance
- **Data formats:** JSON (RFC 8259), XML, YAML standard compliance

**Process:**
1. Identify relevant industry standard for Story domain (OAuth, REST, OpenAPI, protocols)
2. Research standard via MCP Ref (`ref_search_documentation`) or WebSearch
3. Verify Story Technical Notes and Tasks comply with standard
4. If KISS/YAGNI conflicts with standard → Standard wins
5. Document standard compliance in Technical Notes with RFC/spec references

**Red Flags:**
❌ Custom implementation when industry standard exists (OAuth, REST, OpenAPI)
❌ Non-standard endpoints/flows for "simplicity" (KISS overriding RFC compliance)
❌ "Proprietary" protocols when standard protocol available
❌ Non-compliant API design (e.g., mixing REST and RPC styles)

**Auto-fix actions (#15):**
- Research RFC/standard via MCP Ref or WebSearch
- Rewrite Story Technical Notes to comply with standard
- Update Tasks with standard-compliant implementation
- Add RFC/spec references in Technical Notes
- Update Linear issues
- Add comment: "Solution updated to comply with [Standard Name] [RFC/Spec Number]"

**Tools:** MCP Ref (`ref_search_documentation`), Context7 (`get-library-docs`), WebSearch (if needed)

---

## Quick Verification Matrix

| Criterion | Pass | Notes |
|-----------|------|-------|
| Story follows template? | ☐ | 8 sections in order |
| All Tasks follow template? | ☐ | 7 sections each |
| Clear Story statement? | ☐ | As a/I want/So that |
| Testable AC? | ☐ | Given/When/Then at Story level |
| Test Strategy present? | ☐ | Story has Test Strategy (Risk-Based Testing: 2-5 E2E, 3-8 Integration, 5-15 Unit, 10-28 total, Priority ≥15) |
| Final test task planned? | ☐ | Last task in Implementation Tasks |
| **Standards compliant?** | ☐ | **OAuth 2.0, REST, RFCs (Level 1) - checked FIRST** |
| Follows patterns? | ☐ | References guides in Technical Notes |
| Library research? | ☐ | Latest versions, no reinventing |
| Docs integrated? | ☐ | Story DoD + Tasks include docs |
| Size 3-8 Tasks? | ☐ | Not too small/large |
| YAGNI? | ☐ | No premature features (within standard boundaries) |
| KISS? | ☐ | Simplest solution (within standard boundaries) |
| Guides referenced? | ☐ | Links to patterns |
| Consumer-first? | ☐ | Task order correct |
| No hardcoded values? | ☐ | Config management, no magic numbers |

**Result:** ALL criteria auto-fixed → ALWAYS Approve → Todo
**Note:** No "Keep in Backlog" path exists - all issues auto-fixed before approval
**Hierarchy:** Industry Standards (#15) checked BEFORE KISS/YAGNI (#11/#10)

---

## Common Issues & Auto-Fix Actions

**All issues are AUTO-FIXED automatically. No manual intervention required.**

1. **Incorrect Story Structure** - Missing/misplaced sections
   - **Auto-fix:** Restructure Story per template, add missing sections with placeholders, reorder sections, update Linear

2. **Incorrect Task Structure** - Missing/misplaced sections in Tasks
   - **Auto-fix:** Restructure each Task per template, add missing sections with placeholders, update Linear for each Task

3. **Vague Story** - "Improve X" instead of As a/I want/So that
   - **Auto-fix:** Extract persona from Context, identify capability from Technical Notes, rewrite Story statement, update Linear

4. **Non-Testable AC** - Vague acceptance criteria
   - **Auto-fix:** Convert to Given/When/Then format, add edge cases from Context, ensure 3-5 AC, update Linear

5. **Outdated Solution** - Not using 2025 best practices
   - **Auto-fix:** Rewrite Story Technical Notes with modern approach, update Tasks with optimized plan, update Linear

6. **Outdated Libraries** - Old package versions
   - **Auto-fix:** Replace with current stable versions, update Story Technical Notes and Tasks, update Linear

7. **Missing Test Strategy** - No Risk-Based Testing section
   - **Auto-fix:** Add Test Strategy section (2-5 E2E, 3-8 Integration, 5-15 Unit, 10-28 total, Priority ≥15), update Story DoD, update Linear

8. **Standalone Doc Task** - Separate documentation task
   - **Auto-fix:** Remove doc task, integrate docs into Affected Components of implementation tasks, update Linear

9. **Wrong Story/Task Size** - Too large (> 8 tasks) or too small (< 3 tasks), wrong task granularity (> 8h or < 3h)
   - **Auto-fix:** Add TODO placeholders flagging size issues for user review, update Linear

10. **YAGNI Violations** - Premature features in scope
    - **Auto-fix:** Move to Story "Out of Scope" or "Future Enhancements", remove from Tasks, update Linear

11. **KISS Violations** - Over-engineered solution
    - **Auto-fix:** Simplify architectural approach in Technical Notes, update Tasks with simplified implementation, update Linear

12. **Missing Guide Links** - No guides referenced
    - **Auto-fix:** Insert auto-created and existing guide links in Story Technical Notes "Related Guides:" subsection, update Linear

13. **Provider-First Tasks** - Wrong task order
    - **Auto-fix:** Reorder Tasks (Consumer → Service → Provider), update Story Implementation Tasks section, update Linear

14. **Hardcoded Values** - Magic numbers, hardcoded URLs/paths, credentials in code
    - **Auto-fix:** Add TODO placeholders for extracting magic numbers, moving URLs to config, using env vars for credentials, update Linear

15. **Non-standard Implementations** - Custom solutions when industry standards exist (OAuth, REST, RFCs)
    - **Auto-fix:** Research RFC/standard via MCP Ref, rewrite Story Technical Notes to comply with standard, update Tasks with standard-compliant implementation, add RFC/spec references, update Linear, add comment with standard name and RFC/spec number

---

## Post-Verification (Always Approve)

**Result:** ALWAYS Approve → Todo (after ALL auto-fixes applied)
- Story: Backlog → Todo
- All child Tasks: Backlog → Todo
- kanban_board.md: Updated
- Optional warning comment if TODO placeholders exist (user review needed but don't block execution)

---

**Version:** 6.1.0 (Added #15 Industry Standards Compliance)
**Last Updated:** 2025-11-08

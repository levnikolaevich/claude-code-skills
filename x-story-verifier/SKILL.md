---
name: x-story-verifier
description: This skill should be used when critically reviewing Stories and Tasks against 2025 industry standards and project-specific architecture before approval (Backlog → Todo transition). Proactively optimizes solutions, validates structure compliance, ensures YAGNI/KISS/SOLID principles. Auto-discovers team ID and project configuration.
---

# Story Verification Skill

Critically review and auto-fix Stories and Tasks against 2025 industry standards and project architecture before execution.

## Purpose & Scope

**What it does:**
- Validates Story and all child Tasks against industry standards and project patterns
- Auto-fixes ALL detected issues (structure, solution, workflow, quality)
- ALWAYS approves Story after fixes (Backlog → Todo transition)
- Auto-creates missing guides and links them in Story Technical Notes

**What it doesn't do:**
- Does NOT reject Stories (no "Needs Work" path exists)
- Does NOT execute implementation (delegates to x-story-executor)
- Does NOT create/update ADRs (delegates to x-adr-creator)

## When to Use

Use this skill when:
- Reviewing Stories before approval (Backlog → Todo)
- Validating implementation path (Story + all child Tasks)
- Ensuring 2025 best practices and project patterns compliance
- Checking architectural approach and technology choices
- Optimizing proposed solutions proactively

## Workflow Overview

### Phase 1: Discovery & Loading

**Auto-discover configuration and load Story context.**

**Discovery:**
- Team ID from `docs/tasks/kanban_board.md` (Linear Configuration table)
- Project documentation from `CLAUDE.md`
- Epic context from Story's project field

**Loading:**
1. Fetch Story from Linear (FULL description, all 8 sections)
2. Parse Story: statement, Context, AC, Test Strategy, Technical Notes
3. Extract Story.id (UUID) for parentId filtering
4. Fetch child Tasks metadata (ID, title, status, labels - NO descriptions yet)
5. Validate task breakdown (3-8 implementation tasks, no test task)
6. Load previous Story context if available (for guide consistency checks)

**Technical Details:** See CLAUDE.md "Configuration Auto-Discovery" and "Linear Integration".

### Phase 2: Critical Solution Review

**Challenge proposed approach and verify standards compliance.**

**Standards Hierarchy (priority order):**
1. **Industry Standards & RFCs** (OAuth 2.0, REST, OpenAPI, WebSocket, JSON) - PRIORITY 1
2. **Security Standards** (OWASP Top 10, NIST guidelines) - PRIORITY 2
3. **2025 Best Practices** (modern patterns, current libraries) - PRIORITY 3
4. **Development Principles** (KISS/YAGNI/DRY within standard boundaries) - PRIORITY 4

**Process:**
1. **Check industry standards FIRST:**
   - Research relevant standard for Story domain (OAuth 2.0, REST, OpenAPI, etc.)
   - Verify Story Technical Notes and Tasks comply with standard
   - **Rule:** If KISS/YAGNI conflicts with standard → Standard wins
   - Document compliance with RFC/spec references

2. **Challenge the approach:**
   - Question: "Is this the best way in 2025?"
   - Don't accept custom implementation if standard exists
   - Identify better solutions proactively

3. **Check existing guides:**
   - Verify `docs/guides/` for architectural patterns
   - If missing → Auto-create via x-guide-creator Skill tool
   - Save guide paths for linking in Story Technical Notes

4. **Task-level validation:**
   - Verify implementation approaches align with Story architecture
   - Ensure tasks reference appropriate guides

**Decision Outcomes:**
- ✅ Better solution found → Rewrite Story/Tasks
- ✅ Pattern missing → Auto-create guide and link
- ❌ Non-standard solution → Replace with RFC-compliant approach
- ❌ Outdated approach → Update to 2025 best practices

### Phase 3: Comprehensive Auto-Fix

**Auto-fix ALL issues across 16 verification criteria in logical execution order.**

**Critical Principle:** This skill ALWAYS fixes issues automatically. Never leave Story in Backlog with feedback.

**Execution Order:**

**A. Structural Fixes (Execute First - Dependencies for Other Fixes):**

1. **Story Structure (#1)** - Validate 8 sections per story_template_universal.md
2. **Tasks Structure (#2)** - Sequential validation: load each Task description one-by-one, validate 7 sections per task_template_universal.md
3. **Story Statement (#3)** - Clarify As a/I want/So that format
4. **Acceptance Criteria (#4)** - Standardize Given/When/Then format, 3-5 AC

**B. Solution Optimization (Core Technical Improvements):**

5. **Industry Standards Compliance (#16)** - Rewrite to comply with RFC/protocol (OAuth 2.0, REST, OpenAPI)
6. **Solution Optimization (#5)** - Apply 2025 best practices, validate against previous Story context
7. **Library & Version (#6)** - Update outdated packages to current stable
8. **Guide Links Insertion (#13)** - Link auto-created and existing guides in Story Technical Notes

**C. Workflow Optimization (Process and Ordering):**

9. **Test Strategy (#7)** - Add Risk-Based Testing (2-5 E2E, 3-8 Integration, 5-15 Unit, 10-28 total, Priority ≥15)
10. **Test Task Cleanup (#10)** - Remove premature test tasks (created later by x-story-finalizer)
11. **Documentation Integration (#8)** - Remove standalone doc tasks, integrate into implementation
12. **Consumer-First Principle (#14)** - Reorder tasks: Consumer → Service → Repository

**D. Scope & Quality (Final Polish):**

13. **Story Size & Task Granularity (#9)** - Check 3-8 tasks, 3-5h each; invoke x-task-manager if < 3 tasks
14. **YAGNI Violations (#11)** - Move premature features to future scope
15. **KISS Violations (#12)** - Simplify over-engineering within standard boundaries
16. **Code Quality Fundamentals (#15)** - Flag hardcoded values with TODO placeholders

**Result:** ALL 16 criteria auto-fixed. Story ready for approval.

**See "Auto-Fix Actions Reference" section below for detailed fix actions.**

### Phase 4: Approve & Notify

**Always approve Story and display summary.**

**Critical Principle:** This skill ALWAYS approves Story after auto-fixes. No "Needs Work" path exists.

**Approval Workflow:**
1. Update Story status: Backlog → Todo (Linear)
2. Update ALL child Tasks status: Backlog → Todo (Linear, one-by-one)
3. Update kanban_board.md:
   - Add ✅ APPROVED marker to Story in Backlog section first
   - Move Story + ALL Tasks from "### Backlog" to "### Todo"
   - Preserve hierarchy: Epic header → Story (📖 ✅ APPROVED) → Tasks (-)
4. Add approval comment to Linear Story with summary of fixes
5. Optional warning comment if TODO placeholders exist (user review needed, don't block execution)

**Verification Summary Display:**
- **Story section:** ID, Title, Verdict (✅ ALWAYS Approved → Todo), Changes made, Related Guides (full paths), Warnings (TODO placeholders if any)
- **Tasks table:** ID, Title, Changes, Guide (../../guides/XX-pattern.md for implementation tasks, "-" for test tasks)

**Output:**
- Auto-fixed Story + ALL Tasks (structure, AC, solution, guides)
- Status: Story and Tasks → Todo
- Summary table for user visibility
- Optional warning if TODOs exist

## Auto-Fix Actions Reference

**Purpose:** Technical reference for each auto-fix criterion. This section provides implementation details for fixes applied in Phase 3.

### #1: Story Structure Format

**What it checks:**
- Story has all 8 required sections per story_template_universal.md
- Sections are in correct order
- Subsections are present (Current Situation, Desired Outcome, Success Metrics, etc.)

**Auto-fix actions:**
- Add missing sections with placeholders: `_TODO: Fill this section_`
- Reorder sections to match template
- Add missing subsections
- Update Linear issue: `mcp__linear-server__update_issue(id, description)`
- Add comment: "Story structure fixed per template v5.0.0"
- **Language preservation:** Keep original Story language (EN/RU)

**Skip if:** Story Done/Canceled or older than 30 days

### #2: Tasks Structure Format

**What it checks:**
- EACH Task has all 7 required sections per task_template_universal.md
- Sections are in correct order for each Task

**Auto-fix actions (Sequential - One Task at a Time):**
1. Fetch FULL description for current Task from Linear
2. Parse description into sections
3. Compare with task_template_universal.md (7 sections)
4. Add missing sections with placeholders
5. Reorder sections to match template
6. Update Linear issue for this Task
7. Add comment: "Task structure fixed per template v5.0.0"
8. **Language preservation:** Keep original Task language (EN/RU)
9. Move to next Task (repeat from step 1)

**Skip if:** Task Done/Canceled or older than 30 days

**Rationale:** Sequential validation prevents token waste and truncation issues.

### #3: Story Statement

**What it checks:**
- Story statement follows "As a [persona] I want [capability] So that [value]" format
- Statement is clear and not vague

**Auto-fix actions:**
- Extract persona from Context section
- Identify capability from Technical Notes
- Determine value from Success Metrics
- Rewrite Story statement in proper format
- Update Linear issue
- Add comment: "Story statement clarified"

### #4: Acceptance Criteria

**What it checks:**
- AC are testable and in Given/When/Then format
- 3-5 AC covering main flows
- Edge cases and error handling included

**Auto-fix actions:**
- Convert vague AC to Given/When/Then format
- Add edge cases and error handling from Context
- Ensure 3-5 AC minimum
- Update Linear issue
- Add comment: "Acceptance Criteria standardized to Given/When/Then format"

### #5: Solution Optimization

**What it checks:**
- Proposed solution uses 2025 best practices
- Solution aligns with previous Story patterns (if available)
- Modern patterns and libraries are referenced

**Auto-fix actions:**
- Rewrite Story Technical Notes with improved approach (if better solution found in Phase 2)
- Update Tasks with optimized implementation plan
- Reference modern patterns/libraries (2025 standards)
- Update Linear issues (Story + all affected Tasks)
- Add comment: "Solution optimized per 2025 best practices"
- **If previous Story context loaded:**
  - Add missing guides from previous Story to current Story
  - Check for duplicate components, add TODO if reinventing
  - Check for conflicting integrations, add TODO if incompatible
  - Add reference: "Related to previous Story [US00X]"

**Language preservation:** Keep original language (EN/RU)

### #6: Library & Version

**What it checks:**
- Libraries are current stable versions (2025 standards)
- No outdated packages
- Library built-ins preferred over custom helpers

**Auto-fix actions:**
- Replace outdated library versions with current stable
- Update Story Technical Notes with correct package versions
- Update Tasks with correct import/usage examples
- Replace custom helpers with library built-in methods
- Update Linear issues
- Add comment: "Libraries updated to current stable versions"

### #7: Test Strategy

**What it checks:**
- Story has Test Strategy section
- Risk-Based Testing specified (2-5 E2E, 3-8 Integration, 5-15 Unit, 10-28 total, Priority ≥15)
- E2E type specified (API/UI based on application)

**Auto-fix actions:**
- Add Test Strategy section with Risk-Based Testing
- Specify E2E type (API/UI)
- Focus on business logic, not frameworks
- Ensure final test task in Implementation Tasks list
- Update Story DoD with "All tests passing"
- Update Linear issue
- Add comment: "Test Strategy added with Risk-Based Testing approach"

**Reference:** See `x-story-finalizer/references/risk_based_testing_guide.md` for complete methodology.

### #8: Documentation Integration

**What it checks:**
- No standalone documentation tasks exist
- Documentation updates integrated into implementation tasks

**Auto-fix actions:**
- Remove standalone documentation task
- Add documentation updates to "Affected Components" in implementation tasks
- Update Story DoD with "Documentation updated"
- Update Linear issues (Story + Tasks)
- Add comment: "Documentation integrated into implementation tasks"

### #9: Story Size & Task Granularity

**What it checks:**
- Task count is 3-8 implementation tasks (optimal range)
- Each task is 3-5 hours (atomic, testable units)
- No test task exists (created later by x-story-finalizer)

**Auto-fix actions:**
- **If < 3 tasks:**
  - Analyze Story Context and Technical Notes
  - Check Consumer-First gaps (Consumer → Service → Repository)
  - Invoke x-task-manager via Skill tool: `Skill(skill: "x-task-manager")`
  - Wait for completion (new tasks created in Linear with status = Backlog)
  - Reload task metadata to include new tasks
  - Update kanban_board.md (add to Backlog section)
  - Add comment: "Missing implementation tasks created via x-task-manager"
- **If > 8 tasks:** Add TODO: `_TODO: Consider splitting into multiple Stories_`
- **If task < 3h:** Add TODO: `_TODO: Consider combining with related tasks_`
- **If task > 8h:** Add TODO: `_TODO: Consider decomposing into smaller tasks (3-5h each)_`
- Update Linear issues
- Add comment: "Story/Task size issues flagged for review"

**Rationale:** 3-8 tasks × 3-5h = 9-40h total (optimal Story size for planning and tracking).

### #10: Test Task Cleanup

**What it checks:**
- No test tasks exist before Story execution
- Test tasks are NOT created prematurely

**Auto-fix actions:**
- Identify test tasks by label "tests" OR title contains "test"/"tests"/"comprehensive"/"final"
- For EACH test task found:
  - Update task state to "Canceled": `mcp__linear-server__update_issue(id, state="Canceled")`
  - Add comment: "Test task removed - will be created by x-story-finalizer after manual testing (Pass 1)"
  - Remove from kanban_board.md (delete line from Backlog)
  - Remove from Story "Implementation Tasks" section
- Update Story description in Linear
- Add comment to Story: "Premature test task(s) removed - test task created after manual testing"

**Rationale:** Test task created AFTER manual testing (by x-story-finalizer), not before. Manual testing reveals real scenarios for comprehensive test coverage.

### #11: YAGNI Violations

**What it checks:**
- No premature features in Story scope
- No "future-proofing" or speculative work

**Auto-fix actions:**
- Remove premature features from Story scope
- Add to "Out of Scope" or "Future Enhancements" section
- Update Technical Notes
- Update Tasks to remove premature work
- Update Linear issues
- Add comment: "Premature features moved to future scope (YAGNI)"

### #12: KISS Violations

**What it checks:**
- Solution is not over-engineered
- Simplest approach is used (within standard boundaries)

**Auto-fix actions:**
- Simplify architectural approach in Technical Notes
- Replace complex patterns with simpler alternatives (if no standard conflict)
- Update Tasks with simplified implementation
- Update Linear issues
- Add comment: "Solution simplified per KISS principle"

**Important:** If KISS conflicts with industry standard → Standard wins.

### #13: Guide Links Insertion

**What it checks:**
- Story Technical Notes has "Related Guides:" subsection
- All auto-created and existing guides are linked

**Auto-fix actions:**
- Add "Related Guides:" subsection in Technical Notes
- Insert guide links: `[Guide XX: Pattern Name](../../guides/XX-pattern.md)`
  - Auto-created guides from Phase 2
  - Existing guides referenced in Story
- Update Story in Linear with guide links

**Purpose:** x-task-manager reads these links when generating implementation tasks.

### #14: Consumer-First Principle

**What it checks:**
- Tasks are ordered: Consumer (API/UI) → Service → Repository (provider)
- Consumer needs drive implementation order

**Auto-fix actions:**
- Reorder Tasks: Consumer first, then Service, then Repository
- Update Story "Implementation Tasks" section
- Add note in Technical Notes about consumer-first approach
- Update Linear issue
- Add comment: "Task order corrected per Consumer-First principle"

### #15: Code Quality Fundamentals

**What it checks:**
- No hardcoded values (magic numbers, URLs, credentials)
- Configuration management approach defined

**Auto-fix actions:**
- Add TODO placeholders in Tasks:
  - `_TODO: Extract magic numbers to named constants with WHY comments_`
  - `_TODO: Move hardcoded URLs/paths to config files_`
  - `_TODO: Use environment variables for credentials_`
- Add configuration management approach in Technical Notes
- Update Linear issues
- Add comment: "Configuration management requirements added"

### #16: Industry Standards Compliance

**What it checks:**
- Solution complies with industry standards (OAuth 2.0, REST, OpenAPI, WebSocket, JSON)
- No custom implementations of standardized protocols

**Auto-fix actions:**
- Research RFC/standard via MCP Ref (`ref_search_documentation`) or WebSearch
- Identify relevant standard: OAuth 2.0 (RFC 6749), REST API design, OpenAPI 3.x, etc.
- Rewrite Story Technical Notes to comply with standard
- Update Tasks with standard-compliant implementation
  - Example: Unified `/token` endpoint instead of separate `/tokens` and `/refresh`
- Add RFC/spec references in Technical Notes
- Update Linear issues (Story + all affected Tasks)
- Add comment: "Solution updated to comply with [Standard Name] [RFC/Spec Number]"

**Rule:** If KISS/YAGNI conflicts with standard → Standard wins (integration, security, maintainability > short-term simplicity).

**See:** `references/verification_checklist.md` for complete checklist.

## Example Workflows

### Scenario 1: Story with Outdated Libraries

**Input:**
- Story US005 uses library 1.0.0 from 2023
- Library has major version 2.5.0 with breaking changes

**Auto-fix Process:**
- Phase 1: Load Story + Tasks metadata
- Phase 2: Identify outdated library
- Phase 3 (#6): Update to library 2.5.0 (current stable)
  - Update Story Technical Notes with new version
  - Update Tasks with correct import statements
  - Update Linear issues
  - Add comment: "Libraries updated to current stable versions"
- Phase 4: Approve Story → Todo

**Output:**
- Story approved with library 2.5.0
- Tasks updated with correct imports
- Comment in Linear explaining library update

### Scenario 2: Story Violates OAuth 2.0 Standard

**Input:**
- Story proposes separate `/tokens` and `/refresh` endpoints for simplicity
- Uses custom auth flow instead of OAuth 2.0

**Auto-fix Process:**
- Phase 1: Load Story + Tasks metadata
- Phase 2: Research OAuth 2.0 (RFC 6749)
  - Identify standard requires unified `/token` endpoint with grant_type parameter
  - Challenge custom approach: "Is this the best way in 2025?" → NO
- Phase 3 (#16): Rewrite to comply with RFC 6749
  - Unified `/token` endpoint with grant_type
  - Update Story Technical Notes with RFC reference
  - Update all affected Tasks
  - Add comment: "Solution updated to comply with OAuth 2.0 (RFC 6749)"
- Phase 4: Approve Story → Todo

**Output:**
- Story approved with RFC-compliant OAuth 2.0 implementation
- Tasks updated with unified `/token` endpoint
- Comment explaining standard compliance

### Scenario 3: Missing Implementation Tasks

**Input:**
- Story US007 has only 2 tasks (too small for scope)
- Missing Service layer and Repository tasks

**Auto-fix Process:**
- Phase 1: Load Story + 2 Tasks metadata
- Phase 2: Check existing guides for architecture patterns
- Phase 3 (#9): Detect < 3 tasks violation
  - Analyze Story Context: requires API endpoint, business logic, database access
  - Identify Consumer-First gaps: Service and Repository missing
  - Invoke x-task-manager: `Skill(skill: "x-task-manager")`
  - x-task-manager creates 2 missing tasks (Service, Repository)
  - Reload task metadata (now 4 tasks total)
  - Update kanban_board.md with new tasks
  - Add comment: "Missing implementation tasks created via x-task-manager"
- Phase 4: Approve Story → Todo

**Output:**
- Story approved with 4 tasks (Consumer → Service → Repository + Test)
- Tasks in correct Consumer-First order
- Comment explaining task creation

## Reference Files

**Templates (Structure Validation):**
- `../x-story-creator/references/story_template_universal.md` - Story structure (8 sections)
- `../x-task-manager/references/task_template_universal.md` - Task structure (7 sections)

**Checklists (Verification):**
- `verification_checklist.md` - Complete 16-criteria checklist with detailed checks

**Methodology (Testing):**
- `../x-story-finalizer/references/risk_based_testing_guide.md` - Risk-Based Testing approach (Priority ≥15 scenarios)

**Integration (Linear API):**
- `../x-epic-creator/references/linear_integration.md` - Linear MCP usage patterns

## Best Practices

1. **Always auto-fix and approve** - No "Needs Work" path exists; fix all issues in Phase 3
2. **Standards first, simplicity second** - RFC/protocol compliance > KISS/YAGNI when conflicts arise
3. **Sequential task validation** - Load task metadata first (Phase 1), then fetch full descriptions one-by-one (Phase 3 #2)
4. **Delegate task creation** - Use x-task-manager Skill tool (Phase 3 #9), never create tasks directly
5. **Preserve language** - Keep Story/Tasks in original language (EN/RU) when updating
6. **Bold corrections** - Rewrite Story/Tasks if better solution exists, don't just comment
7. **Check guides before approve** - Auto-create missing guides via x-guide-creator (Phase 2)
8. **Trust auto-discovery** - Let skill find Team ID and project structure automatically

## Definition of Done

**Phase 1: Discovery & Loading**
- [ ] Team ID and project configuration auto-discovered
- [ ] Story fetched from Linear (FULL description, all 8 sections)
- [ ] Story parsed: statement, Context, AC, Test Strategy, Technical Notes
- [ ] Story.id (UUID) extracted for parentId filtering
- [ ] Child Tasks metadata loaded (ID, title, status, labels - NO descriptions)
- [ ] Task breakdown validated (3-8 implementation tasks, no test task)
- [ ] Epic context identified
- [ ] Previous Story context loaded if available

**Phase 2: Critical Solution Review**
- [ ] Industry standards identified (OAuth 2.0, REST, OpenAPI, WebSocket, JSON)
- [ ] Standards researched via MCP Ref or WebSearch
- [ ] Story compliance verified (KISS/YAGNI conflicts → Standard wins)
- [ ] Proposed solution critically evaluated ("Best way in 2025?")
- [ ] Existing guides checked in `docs/guides/`
- [ ] Missing guides auto-created via x-guide-creator
- [ ] Guide paths saved for linking
- [ ] Task approaches validated against Story architecture

**Phase 3: Comprehensive Auto-Fix**
- [ ] **Structural Fixes (1-4):**
  - Story structure validated (8 sections, correct order)
  - Tasks structure validated sequentially (7 sections each)
  - Story statement clarified (As a/I want/So that)
  - Acceptance Criteria standardized (Given/When/Then, 3-5 AC)
- [ ] **Solution Optimization (5-8):**
  - Industry standards compliance verified (#16)
  - Solution optimized per 2025 best practices (#5)
  - Libraries updated to current stable (#6)
  - Guide links inserted in Story Technical Notes (#13)
- [ ] **Workflow Optimization (9-12):**
  - Test Strategy added (Risk-Based Testing: 2-5 E2E, 3-8 Integration, 5-15 Unit, Priority ≥15) (#7)
  - Test tasks removed (created later by x-story-finalizer) (#10)
  - Documentation integrated into implementation tasks (#8)
  - Tasks reordered per Consumer-First principle (#14)
- [ ] **Scope & Quality (13-16):**
  - Story size validated (3-8 tasks, x-task-manager invoked if < 3) (#9)
  - YAGNI violations removed (#11)
  - KISS violations simplified (within standard boundaries) (#12)
  - Code quality requirements added (config management, TODO placeholders) (#15)

**Phase 4: Approve & Notify**
- [ ] Story status updated: Backlog → Todo (Linear)
- [ ] ALL Tasks status updated: Backlog → Todo (Linear, one-by-one)
- [ ] kanban_board.md updated:
  - ✅ APPROVED marker added to Story
  - Story + ALL Tasks moved from "### Backlog" to "### Todo"
  - Hierarchy preserved (Epic → Story → Tasks)
- [ ] Approval comment added to Linear Story with fixes summary
- [ ] Optional warning comment if TODO placeholders exist
- [ ] Verification summary table displayed:
  - Story section (ID, Title, Verdict, Changes, Guides, Warnings)
  - Tasks table (ID, Title, Changes, Guide paths)

**Output:**
- ALWAYS Approved Story (status: Todo)
- Auto-fixed Story + ALL Tasks (structure, solution, guides)
- Guide links in Story Technical Notes
- Verification summary table
- Optional warning if TODOs exist

---

**Version:** 10.0.0
**Last Updated:** 2025-11-12

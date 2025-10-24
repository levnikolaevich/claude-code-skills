---
name: x-story-verifier
description: This skill should be used when critically reviewing Stories and Tasks against 2025 industry standards and project-specific architecture before approval (Backlog → Todo transition). Proactively optimizes solutions, validates structure compliance, ensures YAGNI/KISS/SOLID principles. Auto-discovers team ID and project configuration.
---

# Story Verification Skill

Critically review Story and all its Tasks against 2025 industry best practices and project architecture, proactively optimize solution before approval (Backlog → Todo).

## When to Use This Skill

This skill should be used when:
- Review Stories before approval (Backlog → Todo transition)
- Validate entire implementation path (Story + all child Tasks)
- Critically evaluate architectural approach and propose better solutions
- Ensure solutions follow 2025 industry best practices AND project-specific patterns
- Challenge assumptions and optimize proposed implementations
- Ensure YAGNI/KISS/SOLID compliance at Story level
- Check architectural approach and technology choices
- Verify structure of Story and all Tasks
- **Ensure EVERY Task complies with task_template_universal.md (7 sections)**

## How It Works

### Phase 1: Discovery (Automated)

Auto-discovers Team ID from `docs/tasks/kanban_board.md` and project documentation from `CLAUDE.md`.

**Details:** See CLAUDE.md "Configuration Auto-Discovery" and "Linear Integration".

### Phase 2: Story + Tasks Overview

**Input:** Story ID (e.g., US001 or API-42 if Story)

**Steps:**
1. Fetch **Story** from Linear via MCP (must have label "user-story")
   - ⚠️ **Request FULL description**, not truncated version
   - Ensure all 8 sections are loaded completely
2. Parse Story: Story statement, Context, AC, Technical Notes
3. Extract **Story.id** (UUID) from loaded Story object
   - ⚠️ **Critical:** Use Story.id (UUID), NOT short ID (e.g., "API-97")
   - Linear API requires UUID for parentId filter in list_issues
4. Fetch **child Tasks metadata** (parentId = Story.id) from Linear
   - ⚠️ **Request metadata ONLY:** ID, title, status, labels (NO description)
   - Purpose: Validate task breakdown before loading full descriptions
5. **Validate task breakdown:**
   - Check count (3-4 implementation tasks ONLY)
   - ⚠️ **Test task MUST NOT exist** (created later by x-story-finalizer after manual testing)
   - Verify NO label "tests" on any tasks (if found → will be removed in Phase 4)
   - Confirm logical order and naming
6. Identify Epic context from Story's project field
7. **Load previous Story context** (if not first Story in Epic):
   - Extract current Story number from identifier (e.g., US003 → 3)
   - Calculate previous Story number: N-1 (e.g., US003 → US002)
   - Search for previous Story in Linear by identifier (e.g., US002)
   - **If previous Story exists and status = Done:**
     * Fetch full Story description (all 8 sections)
     * Fetch all Done implementation tasks (parentId=previous_story.id, status=Done, no "tests" label)
     * Fetch final test task (parentId=previous_story.id, label="tests", status=Done)
     * Read Linear comments from previous Story (manual testing results Format v1.0)
     * Store previous Story context for Phase 4 validation
   - **If first Story (US001) or previous Story not Done:** Skip loading, proceed without previous Story context

### Phase 3: Standards Compliance & Critical Solution Review

**Critically evaluate and optimize proposed solution with standards-first approach:**

**Mindset:** Don't just validate - actively search for better approaches. Challenge assumptions. **Hierarchy of principles:**
1. **Industry Standards & RFCs** (OAuth 2.0, REST API design, OpenAPI, protocol standards) - **PRIORITY 1**
2. **Security Standards** (OWASP Top 10, NIST guidelines) - **PRIORITY 2**
3. **2025 Best Practices & Project Architecture** - **PRIORITY 3**
4. **Development Principles** (KISS/YAGNI/DRY apply WITHIN standard boundaries) - **PRIORITY 4**

**Process:**

1. **Step 3.0: Check industry standards FIRST (BEFORE guides):**
   - Question: "Does relevant industry standard exist for this Story domain?"
   - Common standards: OAuth 2.0 (RFC 6749), REST API design, OpenAPI 3.x, WebSocket (RFC 6455), JSON (RFC 8259)
   - If standard exists:
     * Research via MCP Ref (`ref_search_documentation`) or WebSearch
     * Verify Story Technical Notes and Tasks comply with standard
     * **If KISS/YAGNI conflicts with standard → Standard wins**
     * Document standard compliance in Technical Notes with RFC/spec references
   - Red flags: "7 endpoints for simplicity" when OAuth 2.0 requires unified `/token`, custom auth flow instead of OAuth 2.0
2. **Challenge the approach:**
   - Question: "Is this the best way to solve this in 2025?"
   - Conceptually evaluate if industry has standardized solution
   - Don't accept "custom implementation" if standard exists
3. **Check existing guides** (`docs/guides/`) for architectural patterns
4. **Auto-create guide if missing:**
   - Check if guide exists in `docs/guides/` for each pattern/package
   - If guide missing → Detect pattern type:
     * **Architectural pattern** (reusable across multiple tasks/stories) → **Auto-create guide:** `Skill(command: "x-guide-creator")` with pattern name
       - x-guide-creator will automatically research best practices (MCP Ref, Context7, WebSearch)
       - x-guide-creator will return guide path
     * **Technical decision** (one-off choice between alternatives) → Recommend ADR creation via x-adr-creator
   - Save returned guide path for linking in Story Technical Notes
5. **Task-level validation:**
   - For each Task: verify implementation approach aligns with Story architecture
   - Verify tasks reference appropriate guides/ADRs

**Decision:**
- ✅ Pattern exists in project guides → Reference it in Story
- ✅ **Pattern missing → Auto-create guide** via x-guide-creator → Link in Story
- ✅ **Better solution found → Rewrite Story/Tasks with improved approach**
- ❌ Custom implementation when library exists → YAGNI violation → Replace
- ❌ **Proposed solution outdated → Replace with 2025 best practices**
- ❌ **Overengineered approach → Simplify per KISS/YAGNI**

### Phase 4: Comprehensive Auto-Fix & Optimization

**Auto-fix ALL issues detected across 16 verification criteria:**

**Critical Principle:** This skill ALWAYS fixes issues automatically. Never leave Story in Backlog with feedback - fix and approve.

**1. Story Structure Format (Template Compliance):**
   - Parse Story description → Extract sections
   - Compare with story_template_universal.md (8 required sections)
   - **Auto-fix violations:**
     - Add missing sections with placeholders (_TODO: Fill this section_)
     - Reorder sections to match template
     - Add missing subsections (Current Situation, Desired Outcome, etc.)
     - Update Linear issue: `mcp__linear-server__update_issue(id, description)`
     - Add comment: "Story structure fixed per template v5.0.0"
     - **⚠️ Language Preservation:** Always preserve the original Story language (English/Russian) when updating descriptions. Do not translate content.
   - Skip fix if: Story Done/Canceled or older than 30 days

**2. Tasks Structure Format (Template Compliance - Sequential Auto-Fix):**
   - **Equally critical as Story validation** - check ALL child Tasks
   - **FOR EACH task sequentially** (one at a time to avoid token waste):
     1. **Fetch FULL description** for current task only from Linear via MCP
     2. **Parse description** → Extract sections
     3. **Compare** with task_template_universal.md (7 required sections)
     4. **Auto-fix violations:**
        - Add missing sections with placeholders
        - Reorder sections to match template
        - Update Linear issue for this Task
        - Add comment: "Task structure fixed per template v5.0.0"
        - **⚠️ Language Preservation:** Always preserve the original Task language
     5. **Move to next task** (repeat from step 1)
   - Skip fix if: Task Done/Canceled or older than 30 days

**3. Story Statement (As a/I want/So that):**
   - **Auto-fix if vague:**
     - Extract persona from Context section
     - Identify capability from Technical Notes
     - Determine value from Success Metrics
     - Rewrite Story statement in proper format
     - Update Linear issue
     - Add comment: "Story statement clarified"

**4. Acceptance Criteria (Given/When/Then):**
   - **Auto-fix if not testable:**
     - Convert vague AC to Given/When/Then format
     - Add edge cases and error handling scenarios from Context
     - Ensure 3-5 AC covering main flows
     - Update Linear issue
     - Add comment: "Acceptance Criteria standardized to Given/When/Then format"

**5. Solution Optimization (2025 Best Practices + Previous Story Context):**
   - **Auto-fix if better solution identified in Phase 3:**
     - Rewrite Story Technical Notes with improved approach
     - Update Tasks with optimized implementation plan
     - Reference modern patterns/libraries (2025 standards)
     - Update Linear issues for Story + all affected Tasks
     - Add comment: "Solution optimized per 2025 best practices"
   - **Auto-fix if previous Story context loaded (Phase 2 step 7):**
     - **Guide consistency:** Add missing guides from previous Story to current Story Technical Notes
     - **Component reuse:** Check for duplicate components, add TODO if current Story reinvents existing component
     - **Integration compatibility:** Check for conflicting integrations, add TODO if incompatible with previous Story
     - Update Story Technical Notes with context reference: "Related to previous Story [US00X]"
     - Update Linear issue
     - Add comment: "Validated against previous Story [US00X]"
   - **Right to improve:** Don't hesitate to rewrite if better solution exists
   - **Language Preservation:** Keep original language (EN/RU) when rewriting

**6. Library & Version (Current Stable):**
   - **Auto-fix if outdated:**
     - Replace outdated library versions with current stable
     - Update Story Technical Notes with correct package versions
     - Update Tasks with correct import/usage examples
     - Update Linear issues
     - Add comment: "Libraries updated to current stable versions"

**7. Test Strategy:**
   - **Auto-fix if missing or incomplete:**
     - Add Test Strategy section with Risk-Based Testing (2-5 E2E, 3-8 Integration, 5-15 Unit, 10-28 total, Priority ≥15)
     - Specify E2E type (API/UI based on application)
     - Focus on business logic, not frameworks
     - Ensure final test task in Implementation Tasks list
     - Update Story DoD with "All tests passing"
     - Update Linear issue
     - Add comment: "Test Strategy added with Risk-Based Testing approach"

**Reference:** See `x-story-finalizer/references/risk_based_testing_guide.md` for Risk-Based Testing methodology that x-story-finalizer will apply when creating final test task after manual testing.

**8. Documentation Integration:**
   - **Auto-fix if separate doc task exists:**
     - Remove standalone documentation task
     - Add documentation updates to Affected Components in implementation tasks
     - Update Story DoD with "Documentation updated"
     - Update Linear issues for Story + Tasks
     - Add comment: "Documentation integrated into implementation tasks"

**9. Story Size & Task Granularity:**
   - **Auto-fix if task count < 3:**
     - Analyze Story Context and Technical Notes to identify missing task types
     - Check Consumer-First principle: Consumer (API/UI) → Service → Repository gaps
     - Invoke **x-task-manager** via Skill tool: `Skill(skill: "x-task-manager")`
     - Pass Story ID to generate missing implementation tasks (1-4 total, auto-decomposed)
     - Wait for x-task-manager completion (new tasks created in Linear with status = Backlog)
     - Reload task metadata to include newly created tasks
     - Update kanban_board.md with new tasks (add to Backlog section under Story)
     - Add comment to Story: "Missing implementation tasks created via x-task-manager"
   - **Auto-fix if too large/small:**
     - **Story too large (> 4 tasks):** Add TODO placeholder: "_TODO: Consider splitting into multiple Stories_"
     - **Task too granular (< 3h):** Add TODO placeholder in Task: "_TODO: Consider combining with related tasks_"
     - **Task too large (> 8h):** Add TODO placeholder in Task: "_TODO: Consider decomposing into smaller tasks (3-5h each)_"
     - Update Linear issues
     - Add comment: "Story/Task size issues flagged for review"

**10. Test Task Cleanup:**
   - **Auto-fix if test task exists (created prematurely):**
     - Identify test tasks by label "tests" OR title contains "test"/"tests"/"comprehensive"/"final"
     - For EACH test task found:
       * Update task state to "Canceled" via `mcp__linear-server__update_issue(id, state="Canceled")`
       * Add comment: "Test task removed - will be created by x-story-finalizer after manual testing (Pass 1)"
       * Remove test task from kanban_board.md (delete line from Backlog section)
       * Remove test task mentions from Story "Implementation Tasks" section
     - Update Story description in Linear
     - Add comment to Story: "Premature test task(s) removed - test task created after manual testing"
   - **Rationale:** Test task created AFTER manual testing (x-story-finalizer), not before. Manual testing reveals real scenarios and edge cases for comprehensive test coverage.

**11. YAGNI Violations:**
   - **Auto-fix if premature features:**
     - Remove premature features from Story scope
     - Add to Story "Out of Scope" or "Future Enhancements"
     - Update Technical Notes
     - Update Tasks to remove premature work
     - Update Linear issues
     - Add comment: "Premature features moved to future scope (YAGNI)"

**12. KISS Violations:**
   - **Auto-fix if over-engineered:**
     - Simplify architectural approach in Technical Notes
     - Replace complex patterns with simpler alternatives
     - Update Tasks with simplified implementation
     - Update Linear issues
     - Add comment: "Solution simplified per KISS principle"

**13. Guide Links Insertion:**
   - **Always insert guide links in Story Technical Notes section:**
     - Auto-created guides from Phase 3: `[Guide XX: Pattern Name](../../guides/XX-pattern.md)`
     - Existing guides referenced in Story
   - **Format:** Add "Related Guides:" subsection in Technical Notes
   - Update Story in Linear with guide links
   - **Purpose:** x-task-manager will read these links when generating implementation tasks

**14. Consumer-First Principle:**
   - **Auto-fix if task order wrong:**
     - Reorder Tasks: Consumer (API endpoint) → Service → Repository (provider)
     - Update Story Implementation Tasks section
     - Add note in Technical Notes about consumer-first approach
     - Update Linear issue
     - Add comment: "Task order corrected per Consumer-First principle"

**15. Code Quality Fundamentals (Hardcoded Values):**
   - **Auto-fix if hardcoded values detected:**
     - Add TODO placeholders in Tasks: "_TODO: Extract magic numbers to named constants with WHY comments_"
     - Add TODO placeholders: "_TODO: Move hardcoded URLs/paths to config files_"
     - Add TODO placeholders: "_TODO: Use environment variables for credentials_"
     - Update Technical Notes with configuration management approach
     - Update Linear issues
     - Add comment: "Configuration management requirements added"

**16. Industry Standards Compliance:**
   - **Auto-fix if non-standard solution detected (checked in Phase 3 Step 3.0):**
     - Research RFC/standard via MCP Ref (`ref_search_documentation`) or WebSearch
     - Identify relevant standard: OAuth 2.0 (RFC 6749), REST API design, OpenAPI 3.x, WebSocket (RFC 6455), JSON (RFC 8259)
     - Rewrite Story Technical Notes to comply with standard
     - Update Tasks with standard-compliant implementation (e.g., unified `/token` endpoint instead of separate `/tokens` and `/refresh`)
     - Add RFC/spec references in Technical Notes
     - Update Linear issues for Story + all affected Tasks
     - Add comment: "Solution updated to comply with [Standard Name] [RFC/Spec Number]"
   - **Rule:** If KISS/YAGNI conflicts with standard → Standard wins (integration, security, maintainability > short-term simplicity)

**Result:** ALL 15 verification criteria are auto-fixed. Story always ready for approval.

See `references/verification_checklist.md` for complete checklist.

### Phase 5: Always Approve & Update

**Critical Principle:** This skill ALWAYS approves Story after auto-fixing all issues. There is no "Needs Work" path.

**Steps:**
1. **Create TodoWrite** for approval workflow
2. **Execute todos** sequentially

**Single Workflow: Always Approve → Todo** ✅

All checks auto-fixed in Phase 4. Story is ready for execution.

**Todos to execute:**
- Update Story status to "Todo" (Linear via update_issue)
- Update ALL child Tasks status to "Todo" (Linear) - FOR EACH Task call update_issue
- Update kanban_board.md:
  * Add ✅ APPROVED marker to Story in Backlog section first
  * Move Story + ALL Tasks from "### Backlog" to "### Todo" section
  * Preserve hierarchy: Epic header → Story (📖 with ✅ APPROVED) → Tasks (-)
- Add approval comment to Linear Story with summary of fixes applied

**Optional Warning Comment:**
- If TODO placeholders were added (e.g., "_TODO: Consider splitting Story_", "_TODO: Extract magic numbers_"):
  - Add warning comment to Linear Story listing all TODO items requiring user review
  - Still approve and transition to Todo (don't block execution)
  - User can address TODOs before x-story-executor starts work

**Output:**
- **Auto-fixed Story description** (structure, AC, Test Strategy, solution optimization, guide links)
- **Auto-fixed Tasks descriptions** (structure for EACH Task, implementation plan, consumer-first order)
- **Justification for changes** (comment in Linear explaining what was fixed and why)
- **Final verdict:** ALWAYS **Approve → Todo**
- **Status updates:**
  - Story: Backlog → Todo
  - All child Tasks: Backlog → Todo
  - kanban_board.md: Story + all Tasks updated
- **Optional warning** if TODO placeholders exist (user review needed but don't block execution)

### Phase 6: Verification Summary

**Display summary table to user:**

**Story section:**
- Story ID + Title
- Verdict: ✅ ALWAYS Approved → Todo (after auto-fixes)
- Changes: List what was fixed (or "No changes")
- Related Guides: Full paths to all guides (../../guides/XX-pattern.md)
- Warnings: List of TODO placeholders if any (user review needed)

**Tasks table:**

| ID | Title | Changes | Guide |
|----|-------|---------|-------|
| API-42 | Task title | Changes description | ../../guides/XX-pattern.md |
| API-45 | Test task | No changes | - |

**Rules:**
- Test tasks (label "tests") → Guide column = "-"
- Implementation tasks → Guide column = full path to guide
- Changes column: "No changes" or specific changes made
- Always show table (Story always approved after auto-fixes)

## Example Usage

**Direct invocation:**
```
Critically review and optimize story US001
```

**From user request:**
```
Review story US003 - optimize solution if better approach exists
```

## Reference Files

- **verification_checklist.md:** Checklist for Story + Tasks verification
- **../story-creator/references/story_template_universal.md:** Story structure template reference (8 sections)
- **../task-creator/references/task_template_universal.md:** Task structure template reference (7 sections)

## Best Practices

1. **Trust auto-discovery:** Let skill find project structure
2. **Sequential task validation:** Load task metadata first (Phase 2), then fetch full descriptions one by one (Phase 4 п.2) to avoid truncation and token waste
3. **Critical mindset:** Don't accept proposed approach blindly - question if it's truly optimal
4. **Dual validation:** Check against BOTH 2025 industry standards AND project-specific architecture
5. **Modern practices first:** Prefer 2025 industry standards over legacy/custom patterns
6. **Bold corrections:** Rewrite Story/Tasks if significantly better solution exists - don't just leave comments
7. **Always fix and approve:** Auto-fix ALL issues in Phase 4, never leave Story in Backlog with feedback - ALWAYS approve and transition to Todo after fixes applied
8. **Task creation delegation:** ALWAYS use Skill tool to invoke x-task-manager for creating missing tasks (Phase 4 п.9). NEVER create tasks directly via Linear API (`mcp__linear-server__create_issue`) in x-story-verifier. x-task-manager ensures proper task structure, automatic decomposition, and Consumer-First ordering.
9. **Verify at Story level:** Check architectural approach, not implementation details
10. **Test Strategy in Story:** Story must have Test Strategy section with Risk-Based Testing (2-5 E2E, 3-8 Integration, 5-15 Unit, 10-28 total, Priority ≥15)
11. **Final test task planned:** Story Implementation Tasks should include final test task
12. **Link to guides:** Reference existing patterns in Story Technical Notes
13. **Sequential structure validation:** Validate EVERY Task against task_template_universal.md sequentially (one task at a time with full description) - equally critical as Story validation
14. **Consumer-first:** Verify Story delivers user value
15. **Check guides before approve:** Verify guides exist for all patterns at Story level, auto-create via x-guide-creator if missing (guide-creator handles all research)
16. **Auto-create guides:** If architectural pattern missing → automatically create guide via `Skill(command: "x-guide-creator")`, then link in Story Technical Notes
17. **Preserve language:** Always keep Story + Tasks in their original language (EN/RU) - never translate when updating
18. **No code snippets:** Never include actual code in Story or Tasks descriptions - only structural descriptions and patterns
19. **Summary table:** Always display verification summary table (Story + Tasks) for user visibility
20. **Always Approve = Always Ready:** This skill ALWAYS approves Story after auto-fixes. Story AND all child Tasks ALWAYS transition from Backlog → Todo (ready for x-story-executor). No "Needs Work" path exists.
21. **Standards First, Simplicity Second:** Check industry standards (OAuth 2.0, REST, RFCs) BEFORE applying KISS/YAGNI. When KISS conflicts with standard → Standard wins. Rationale: Integration, security, maintainability > short-term simplicity.

---

## Definition of Done

Before completing work, verify ALL checkpoints:

**✅ Story + Tasks Overview Complete (Phase 2):**
- [ ] Story fetched from Linear (FULL description, not truncated, all 8 sections loaded)
- [ ] Story parsed: Story statement, Context, AC (Given-When-Then), Test Strategy, Technical Notes extracted
- [ ] Story.id (UUID) extracted from Story object for parentId filter
- [ ] Child Tasks metadata loaded from Linear using Story.id (UUID) as parentId (ID, title, status, labels - NO full descriptions yet)
- [ ] Task breakdown validated:
  - Count: 3-8 implementation tasks + 0-1 test task (within allowed range)
  - Label "tests" present on test tasks only
  - Logical order and naming verified
- [ ] Epic context identified from Story's project field
- [ ] Similar completed Stories reviewed (if available)

**✅ Standards Compliance & Critical Solution Review Complete (Phase 3):**
- [ ] **Industry standards checked FIRST (Step 3.0 - PRIORITY 1):**
  - Relevant industry standard identified for Story domain (OAuth 2.0, REST, OpenAPI, WebSocket, JSON)
  - Standard researched via MCP Ref (`ref_search_documentation`) or WebSearch
  - Story Technical Notes and Tasks verified to comply with standard
  - **If KISS/YAGNI conflicts with standard → Standard wins**
  - Standard compliance documented in Technical Notes with RFC/spec references
  - Red flags checked: Non-standard endpoints/flows for "simplicity" (e.g., 2 auth endpoints instead of unified `/token`)
- [ ] Proposed solution critically evaluated:
  - Questioned: "Is this the best way to solve this in 2025?"
  - Industry best practices checked (2025 patterns)
  - Custom implementations challenged (prefer standard libraries)
- [ ] Existing guides checked in `docs/guides/` for architectural patterns
- [ ] Missing guides auto-created:
  - Architectural patterns identified (reusable across tasks/stories)
  - x-guide-creator invoked via Skill tool for each missing pattern
  - Guide paths saved for linking in Story Technical Notes
- [ ] Task-level validation: Implementation approaches align with Story architecture
- [ ] Decision made:
  - ✅ Better solution found → Story/Tasks rewritten with optimized approach
  - ✅ Pattern missing → Guide auto-created and linked
  - ❌ YAGNI/KISS violations → Replaced with simplified approach
  - ❌ Outdated solution → Replaced with 2025 best practices

**✅ Story Structure Validated (Phase 4 п.1):**
- [ ] Story description parsed into sections
- [ ] Compared with story_template_universal.md (8 required sections):
  1. Story statement (As a/I want/So that)
  2. Context (Current Situation, Desired Outcome, Success Metrics)
  3. Acceptance Criteria (Given-When-Then format, 3-5 AC)
  4. Test Strategy (Risk-Based Testing: 2-5 E2E, 3-8 Integration, 5-15 Unit, 10-28 total, Priority ≥15)
  5. Implementation Tasks (placeholder or breakdown)
  6. Technical Notes (architectural considerations, integration points, Related Guides subsection)
  7. Definition of Done (Functionality, Testing, Code Quality checklists)
  8. Revision History (version tracking)
- [ ] If violations detected:
  - Missing sections added with placeholders
  - Sections reordered to match template
  - Missing subsections added
  - Updated in Linear via update_issue
  - Comment added: "Story structure fixed per template v5.0.0"
- [ ] Language preserved (EN/RU, no translation)
- [ ] Skip fix if: Story Done/Canceled or older than 30 days

**✅ All Tasks Structure Validated (Phase 4 п.2 - Sequential Validation):**
- [ ] FOR EACH task sequentially (one at a time):
  - Full description fetched from Linear
  - Description parsed into sections
  - Compared with task_template_universal.md (7 required sections):
    1. Context (Story context, implementation goal, dependencies)
    2. Implementation Plan (Step-by-step plan, affected files)
    3. Technical Approach (Design decisions, patterns, Related Guides subsection)
    4. Acceptance Criteria (Functional, Technical, Quality checkpoints)
    5. Affected Components (List of components/files to modify)
    6. Existing Code Impact (Refactoring, existing tests, documentation updates)
    7. Definition of Done (Implementation, Quality, Documentation checklists)
  - If violations detected:
    - Missing sections added with placeholders
    - Sections reordered to match template
    - Updated in Linear for this Task
    - Comment added: "Task structure fixed per template v5.0.0"
  - Language preserved (EN/RU, no translation)
  - Skip fix if: Task Done/Canceled or older than 30 days
- [ ] All child Tasks validated (no Task skipped)

**✅ Solution Optimized (Phase 4 п.3, if applicable):**
- [ ] If better solution identified in Phase 3:
  - Story Technical Notes rewritten with improved approach
  - Tasks updated with optimized implementation plan
  - Modern patterns/libraries referenced (2025 standards)
  - Linear issues updated (Story + all affected Tasks)
  - Comment added: "Solution optimized per 2025 best practices"
  - Language preserved (EN/RU)

**✅ Guide Links Inserted (Phase 4 п.4):**
- [ ] "Related Guides:" subsection added to Story Technical Notes section
- [ ] All guide links inserted in format: `[Guide XX: Pattern Name](../../guides/XX-pattern.md)`
  - Auto-created guides from Phase 3
  - Existing guides referenced in Story
- [ ] Story updated in Linear with guide links
- [ ] Links accessible for x-task-manager to read when generating implementation tasks

**✅ All 16 Verification Criteria Auto-Fixed (Phase 4):**
- [ ] п.1 Story Structure Format: Template compliance (8 sections, proper order)
- [ ] п.2 Tasks Structure Format: Sequential validation, template compliance (7 sections each)
- [ ] п.3 Story Statement: As a/I want/So that format clarified
- [ ] п.4 Acceptance Criteria: Given/When/Then format, 3-5 AC covering main flows
- [ ] п.5 Solution Optimization: Better approach applied if identified, 2025 best practices
- [ ] п.6 Library & Version: Current stable versions, outdated packages updated
- [ ] п.7 Test Strategy: Risk-Based Testing added (2-5 E2E, 3-8 Integration, 5-15 Unit, 10-28 total, Priority ≥15)
- [ ] п.8 Documentation Integration: Standalone doc tasks removed, docs integrated into implementation
- [ ] п.9 Story Size & Task Granularity:
  - If task count < 3 → x-task-manager invoked via Skill tool, missing implementation tasks created (1-4 total, auto-decomposed)
  - Task metadata reloaded to include newly created tasks
  - kanban_board.md updated with new tasks (Backlog section)
  - TODO placeholders added if too large/small (> 4 tasks, > 8h or < 3h per task)
- [ ] п.10 Test Task Cleanup:
  - Test tasks identified (label "tests" OR title contains "test"/"tests"/"comprehensive"/"final")
  - Test tasks deleted from Linear (state = Canceled) with comment explaining removal
  - Test tasks removed from kanban_board.md (Backlog section)
  - Test task mentions removed from Story "Implementation Tasks" section
  - Comment added to Story explaining test task removal
- [ ] п.11 YAGNI Violations: Premature features moved to future scope
- [ ] п.12 KISS Violations: Over-engineered solutions simplified (within standard boundaries)
- [ ] п.13 Guide Links Insertion: Auto-created and existing guides linked in Story Technical Notes
- [ ] п.14 Consumer-First Principle: Task order corrected (Consumer → Service → Provider)
- [ ] п.15 Code Quality Fundamentals: Configuration management requirements added, TODO placeholders for hardcoded values
- [ ] п.16 Industry Standards Compliance: RFC/protocol compliance verified, non-standard solutions rewritten (OAuth 2.0, REST, OpenAPI), standard wins when KISS conflicts

**✅ Always Approve Applied (Phase 5):**
- [ ] **ALWAYS Approve → Todo** (no "Needs Work" path exists)
- [ ] Story status updated to "Todo" in Linear (via update_issue)
- [ ] ALL child Tasks status updated to "Todo" in Linear (via update_issue for each Task)
- [ ] kanban_board.md updated:
  - ✅ APPROVED marker added to Story
  - Story + ALL Tasks moved from "### Backlog" to "### Todo"
  - Hierarchy preserved (Epic header → Story 📖 ✅ APPROVED → Tasks -)
- [ ] Approval comment added to Linear Story with summary of fixes applied
- [ ] Optional warning comment added if TODO placeholders exist (user review needed but don't block execution)

**✅ Verification Summary Displayed (Phase 6):**
- [ ] Summary table displayed to user with:
  - **Story section:** Story ID + Title, Verdict (✅ ALWAYS Approved → Todo after auto-fixes), Changes made, Related Guides (full paths), Warnings (TODO placeholders if any)
  - **Tasks table:** ID, Title, Changes, Guide (format: `../../guides/XX-pattern.md` for implementation tasks, "-" for test tasks)
- [ ] All implementation tasks show guide paths in Guide column
- [ ] Test tasks (label "tests") show "-" in Guide column

**Output:**
- ALWAYS Approved Story (status: Todo)
- Auto-fixed Story + ALL Tasks (structure, AC, Test Strategy, solution optimization, guide links)
- Guide links in Story Technical Notes
- Verification summary table with auto-fixes summary
- Optional warning if TODO placeholders exist

---

**Version:** 9.3.0 (Story task limit reduced to max 4 tasks)
**Last Updated:** 2025-11-09

# Task Management Documentation Questions

**Purpose:** Define validation questions for task management system (tasks/README.md, kanban_board.md). Used in CREATE mode (user answers questions) and VALIDATE mode (check document compliance).

**Format:** Document → Questions (with target sections) → Validation Heuristics → Auto-Discovery → Special Handling

---

## Table of Contents

| Document | Questions | Auto-Discovery | Priority | Line |
|----------|-----------|----------------|----------|------|
| [tasks/README.md](#tasksreadmemd) | 3 | None | High | L35 |
| [kanban_board.md](#kanban_boardmd) | 2 | Placeholder Detection | Critical | L110 |

**Priority Legend:**
- **Critical:** Must answer all questions (Linear Configuration required for workflow)
- **High:** Strongly recommended (standard workflow content)

**Auto-Discovery Legend:**
- **None:** No auto-discovery needed (workflow is standardized)
- **Placeholder Detection:** Detect and replace placeholders with user input

---

<!-- DOCUMENT_START: tasks/README.md -->
## tasks/README.md

**File:** docs/tasks/README.md
**Target Sections:** Linear Integration, Task Workflow, Task Templates

**Rules for this document:**
- Must have SCOPE tag in first 10 lines
- Must explain Linear MCP integration
- Must document state transitions and review criteria
- Must list available task templates

---

<!-- QUESTION_START: 1 -->
### Question 1: How is Linear integrated into the task management system?

**Expected Answer:** Team ID location, issue statuses (Backlog, Todo, In Progress, To Review, Done), label conventions, Linear MCP methods reference, workflow configuration

**Target Section:** ## Core Concepts, ## Critical Rules, ## Linear MCP Methods Reference

**Validation Heuristics:**
- ✅ Contains "Linear" or "MCP" → pass
- ✅ Mentions team ID or team UUID → pass
- ✅ Has workflow states: Backlog, Todo, In Progress, To Review, Done → pass
- ✅ Has "Linear MCP Methods" section with examples → pass
- ✅ Length > 100 words → pass

**Auto-Discovery:**
- None needed (standardized workflow provided by template)

**MCP Ref Hints:**
- Research "Linear API MCP integration"
- Search "Linear issue workflow states"
<!-- QUESTION_END: 1 -->

---

<!-- QUESTION_START: 2 -->
### Question 2: What are the task state transitions and review criteria?

**Expected Answer:** State transition rules (Backlog → Todo → In Progress → To Review → Done), review criteria, rework process, Epic Grouping Pattern

**Target Section:** ## Task Workflow, ## Core Concepts

**Validation Heuristics:**
- ✅ Contains "Backlog" or "Todo" or "In Progress" → pass
- ✅ Mentions "Review" or "To Review" → pass
- ✅ Mentions "Done" or "Completed" → pass
- ✅ Has workflow states diagram or table → pass
- ✅ Mentions "Epic Grouping" → pass
- ✅ Length > 60 words → pass

**Auto-Discovery:**
- None needed (standard workflow states)

**MCP Ref Hints:**
- None needed
<!-- QUESTION_END: 2 -->

---

<!-- QUESTION_START: 3 -->
### Question 3: What task templates are available and how to use them?

**Expected Answer:** List of templates (Epic, Story, Task, Test Task), usage guidelines, required sections, links to template files

**Target Section:** ## Task Workflow, ## Critical Rules

**Validation Heuristics:**
- ✅ Contains "template" (case insensitive) → pass
- ✅ Mentions "Epic" or "Story" or "Task" → pass
- ✅ Has links to template files or references → pass
- ✅ Mentions "Story-Level Test Strategy" or testing → pass
- ✅ Length > 40 words → pass

**Auto-Discovery:**
- None needed (templates provided by other skills)

**MCP Ref Hints:**
- None needed
<!-- QUESTION_END: 3 -->

---

**Overall File Validation:**
- ✅ Has SCOPE tag in first 10 lines: `<!-- SCOPE: Task tracking system workflow and rules ONLY -->`
- ✅ Total length > 200 words (meaningful content)
- ✅ Has Maintenance section at end

<!-- DOCUMENT_END: tasks/README.md -->

---

<!-- DOCUMENT_START: kanban_board.md -->
## kanban_board.md

**File:** docs/tasks/kanban_board.md
**Target Sections:** Linear Configuration, Work in Progress (Epic Tracking)

**Rules for this document:**
- Must have SCOPE tag in first 10 lines
- Must have Linear Configuration section with Team Name, Team UUID, Team Key
- Must have Epic tracking table or placeholder
- Single Source of Truth for Next Epic/Story Numbers

---

<!-- QUESTION_START: 1 -->
### Question 1: What is the Linear team configuration?

**Expected Answer:** Team Name, Team UUID (valid format), Team Key (2-4 uppercase letters), Workspace URL, Next Epic Number (≥1), Next Story Number (≥1)

**Target Section:** ## Linear Configuration, ## Epic Story Counters

**Validation Heuristics:**
- ✅ Has Team Name (not placeholder `[TEAM_NAME]`) → pass
- ✅ Has valid UUID format (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx) → pass
- ✅ Has Team Key (2-4 uppercase letters, e.g., PROJ, WEB, API) → pass
- ✅ Has Next Epic Number (integer ≥ 1) → pass
- ✅ Has Next Story Number (integer ≥ 1) → pass
- ✅ Has Workspace URL or Team ID → pass

**Auto-Discovery:**
- **Placeholder Detection Pattern:**
  - Check for: `[TEAM_NAME]`, `[TEAM_UUID]`, `[TEAM_KEY]`
  - If placeholders found → Trigger interactive user prompt (see Special Handling)
  - If real values present → Validate format only

**Special Handling (Phase 3 VALIDATE CONTENT):**

**Placeholder Detection:**
```
Pattern: [TEAM_NAME], [TEAM_UUID], [TEAM_KEY]
If ANY placeholder present → Interactive Setup Mode
If NO placeholders → Validation Mode
```

**Interactive Setup Mode (if placeholders detected):**

1. **Prompt user for Team Name:**
   - Question: "What is your Linear Team Name?"
   - Validation: Non-empty string
   - Example: "My Project Team"

2. **Prompt user for Team UUID:**
   - Question: "What is your Linear Team UUID?"
   - Format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
   - Validation Regex: `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/`
   - If invalid → Re-prompt with error: "Invalid UUID format. Expected: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx (lowercase hex)"
   - Example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"

3. **Prompt user for Team Key:**
   - Question: "What is your Linear Team Key (2-4 uppercase letters)?"
   - Format: 2-4 uppercase letters
   - Validation Regex: `/^[A-Z]{2,4}$/`
   - If invalid → Re-prompt with error: "Invalid Team Key format. Expected: 2-4 uppercase letters (e.g., PROJ, WEB, API)"
   - Example: "PROJ"

4. **Replace placeholders:**
   - Replace `[TEAM_NAME]` → `{user_team_name}`
   - Replace `[TEAM_UUID]` → `{user_team_uuid}`
   - Replace `[TEAM_KEY]` → `{user_team_key}`
   - Replace `[WORKSPACE_URL]` → `https://linear.app/{workspace_slug}` (if placeholder exists)

5. **Set initial counters:**
   - Set "Next Epic Number" → 1
   - Set "Next Story Number" → 1

6. **Update Last Updated date:**
   - Replace `[YYYY-MM-DD]` → `{current_date}`

7. **Save updated kanban_board.md**

8. **Log success:**
   ```
   ✓ Linear configuration updated:
     - Team Name: {user_team_name}
     - Team UUID: {user_team_uuid}
     - Team Key: {user_team_key}
     - Next Epic Number: 1
     - Next Story Number: 1
   ```

**Validation Mode (if real values present):**

1. **Extract existing values:**
   - Extract Team UUID from line matching: `Team UUID: {value}`
   - Extract Team Key from line matching: `Team Key: {value}`

2. **Validate formats:**
   - UUID: `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/`
   - Team Key: `/^[A-Z]{2,4}$/`

3. **If validation fails:**
   ```
   ⚠ Invalid format detected in Linear Configuration:
     - Team UUID: {uuid} (expected: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
     - Team Key: {key} (expected: 2-4 uppercase letters)

   Fix manually or re-run skill to replace with correct values.
   ```

4. **If validation passes:**
   ```
   ✓ Linear Configuration valid (Team: {name}, UUID: {uuid}, Key: {key})
   ```

**MCP Ref Hints:**
- Research "Linear team UUID format"
- Search "Linear workspace configuration"
<!-- QUESTION_END: 1 -->

---

<!-- QUESTION_START: 2 -->
### Question 2: Are Epics being tracked in the board?

**Expected Answer:** Table with Epic data (Epic ID, Name, Status, Progress) or placeholder ("No active epics")

**Target Section:** ## Work in Progress (Epics Overview subsection)

**Validation Heuristics:**
- ✅ Has "Epic" or "Epics Overview" section header → pass
- ✅ Has table with columns: Epic, Name, Status, Progress (or similar) → pass
- ✅ OR has placeholder: "No active epics" or "No epics yet" → pass
- ✅ Length > 20 words → pass

**Auto-Discovery:**
- None needed (Epics are populated by workflow skills or manual creation)

**MCP Ref Hints:**
- None needed
<!-- QUESTION_END: 2 -->

---

**Overall File Validation:**
- ✅ Has SCOPE tag in first 10 lines: `<!-- SCOPE: Quick navigation to active tasks in Linear -->`
- ✅ Has Linear Configuration section with valid Team Name, UUID, Key
- ✅ Has Epic Story Counters table
- ✅ Has Maintenance section at end

<!-- DOCUMENT_END: kanban_board.md -->

---

**Version:** 1.0
**Last Updated:** 2025-11-18

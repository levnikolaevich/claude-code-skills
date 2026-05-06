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
- **Critical:** Must answer all questions (Provider configuration required for workflow)
- **High:** Strongly recommended (standard workflow content)

**Auto-Discovery Legend:**
- **None:** No auto-discovery needed (workflow is standardized)
- **Placeholder Detection:** Detect and replace placeholders with user input

---

<!-- DOCUMENT_START: tasks/README.md -->
## tasks/README.md

**File:** docs/tasks/README.md
**Target Sections:** Task Provider Integration, Task Workflow, Task Templates

**Rules for this document:**
- Must have SCOPE tag in first 10 lines
- Must explain task provider integration (per .hex-skills/environment_state.json)
- Must document state transitions and review criteria
- Must list available task templates

---

<!-- QUESTION_START: 1 -->
### Question 1: How is the task provider integrated into the task management system?

**Expected Answer:** Provider configuration (per .hex-skills/environment_state.json), issue statuses (Backlog, Todo, In Progress, To Review, Done), label conventions, task provider operations reference, workflow configuration

**Target Section:** ## Core Concepts, ## Critical Rules, ## Task Provider Operations Reference

**Validation Heuristics:**
- ✅ Contains "task provider" or "environment_state" → pass
- ✅ Has workflow states: Backlog, Todo, In Progress, To Review, Done → pass
- ✅ Has "Task Provider Operations" section with operation tables → pass
- ✅ Length > 100 words → pass

**Auto-Discovery:**
- None needed (standardized workflow provided by template)

**MCP Ref Hints:**
- None needed (operations defined in template)
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
**Target Sections:** Provider Configuration, Work in Progress (Epic Tracking)

**Rules for this document:**
- Must have SCOPE tag in first 10 lines
- Must have Tracker Configuration section (provider-conditional: linear → Team Name/UUID/Key; github → repository + project_number; file → no config needed)
- Must have Epic tracking table or placeholder
- Single Source of Truth for Next Epic/Story Numbers

---

<!-- QUESTION_START: 1 -->
### Question 1: What is the task provider configuration?

**Expected Answer:** Provider type (linear/file per environment_state.json). If Linear: Team Name, Team UUID, Team Key, Workspace URL. Always: Next Epic Number (≥1), Next Story Number (≥1)

**Target Section:** ## Tracker Configuration, ## Epic Story Counters

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

**Provider Detection:**
```
1. Read .hex-skills/environment_state.json → task_provider
2. IF task_provider == "linear":
   - Check for placeholders: [TEAM_NAME], [TEAM_UUID], [TEAM_KEY]
   - If ANY placeholder → Interactive Setup Mode (Linear)
   - If real values → Validation Mode (Linear)
3. IF task_provider == "file":
   - Skip Linear Configuration validation
   - Validate Epic Story Counters only
```

**Interactive Setup Mode (Linear only, if placeholders detected):**

1. **Prompt user for Team Name, Team UUID, Team Key** (validate formats)
2. **Replace placeholders** in kanban_board.md
3. **Set initial counters:** Next Epic Number → 1, Next Story Number → 1
4. **Update Last Updated date**

**Validation Mode (Linear only, if real values present):**

1. **Validate formats:** UUID (`/^[0-9a-f]{8}-...-[0-9a-f]{12}$/`), Team Key (`/^[A-Z]{2,4}$/`)
2. **Report** pass/fail

**MCP Ref Hints:**
- None needed
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
- None needed (Epics are populated by workflow skills: ln-210, ln-220, ln-300)

**MCP Ref Hints:**
- None needed
<!-- QUESTION_END: 2 -->

---

**Overall File Validation:**
- ✅ Has SCOPE tag in first 10 lines: `<!-- SCOPE: Quick navigation to active tasks -->`
- ✅ Has Tracker Configuration section (linear: valid Team Name/UUID/Key; github: repository/project_number; file: section may be absent)
- ✅ Has Epic Story Counters table
- ✅ Has Maintenance section at end

<!-- DOCUMENT_END: kanban_board.md -->

---

**Version:** 1.0
**Last Updated:** 2025-11-18

<!-- SOURCE-OF-TRUTH: shared/references/plan_mode_pattern.md. Edit ONLY here; run `node tools/marketplace/shared.mjs sync` -->

# Plan Mode Pattern

Standard behavior when skill runs in Plan Mode (read-only).

## Detection

Plan Mode active when:
- Agent running with `--plan` flag
- Context indicates read-only mode
- Cannot execute modifications

## Two Workflows

### Workflow A: Preview-Only (Coordinators)

For skills that delegate to workers (coordinators, executors):

```
Phases 1-N: Execute normally (discovery, analysis, planning)
Phase N+1: Instead of delegating → Generate PREVIEW
  - Show: Task list, worker assignments, sequence
  - Format: Table with planned work
  - NO: Linear API calls, file writes, worker invocations
Phase N+2: Write plan summary, call ExitPlanMode
```

**Example output:**
```
IDEAL Plan for Story US001:
| # | Task | Type | Estimate | Worker |
|---|------|------|----------|--------|
| 1 | DB schema | impl | 5h | task executor |
| 2 | Service | impl | 8h | task executor |

Mode: CREATE (0 existing)
Would invoke: task creator
```

### Workflow B: Interactive (Validators)

For skills that modify and need approval (validators):

```
Phases 1-N: Full analysis (audit, scoring)
Phase N+1: Show results + WAIT for approval
  - Display: Findings, fix plan, penalties
  - Prompt: Implicit wait for user input
Phase N+2: On approval → Execute fixes
```

**Example output:**
```
Audit Results:
- Penalty Points: 18 total
- Fixes proposed: 5 items

After approval, fixes will be applied.
```

## TodoWrite Format (Mandatory)

Before starting, add phases showing Plan Mode awareness.
These are TodoWrite tool-local statuses, not runtime status enums:

```
- Phase 1: Discovery (in_progress → completed)
- Phase 2: Analysis (in_progress → completed)
- Phase 3: Generate plan preview (in_progress → completed)
- Phase 4: Execute (leave pending or annotate "not executed in Plan Mode")
```

## Output Requirements

| Workflow | Must Include |
|----------|-------------|
| A (Preview) | Table of planned work, sequence, workers |
| B (Interactive) | Analysis results, proposed changes |

## Which Skills Use Which

| Workflow | Skills |
|----------|--------|
| **A (Preview)** | Coordinators (scope, epic, story, task), executors, reviewers |
| **B (Interactive)** | Validators, universal context reviewer |

## Preview Format Standards

### Story Preview (Story Creator)
```
STORY CREATION PREVIEW for Epic 7: OAuth Authentication

Will create 5 Stories:

| # | ID | Title | Persona | Value | AC | Hours | Tests |
|---|-----|-------|---------|-------|----|----|------|
| 1 | US004 | Register OAuth client | Developer | API access | 4 | 12h | 18 |
| 2 | US005 | Request access token | API client | Authenticate | 5 | 18h | 24 |

Total: 5 Stories, 62h, 90 tests
Standards Research: OAuth 2.0 (RFC 6749), PKCE (RFC 7636)

Type "confirm" to create.
```

### Task Preview (Task Creator)
```
TASK CREATION PREVIEW for Story US001

Will create 4 Tasks:

| # | ID | Title | Approach | Hours | Components |
|---|-----|-------|----------|-------|------------|
| 1 | T001 | Create Users table | Migration + Prisma | 3h | db/migrations |
| 2 | T002 | Implement UserService | CRUD + validation | 5h | services/ |
| 3 | T003 | Create API endpoints | Express routes | 4h | routes/ |
| 4 | T004 | Add validation | Zod schemas | 2h | schemas/ |

Total: 4 Tasks, 14h
Order: Foundation-First (DB → Service → API → Validation)

Type "confirm" to create.
```

### Epic Preview (Epic Coordinator)
```
EPIC BATCH PREVIEW (6 Epics)

| # | Index | Title | Scope In | Success Criteria |
|---|-------|-------|----------|------------------|
| 1 | Epic 0 | Infrastructure | CI/CD, Logging | 99.9% uptime |
| 2 | Epic 1 | User Management | Registration, Auth | <2s response |

Total: 6 Epics (1 Infrastructure + 5 Business)

Type "confirm" to create.
```

### Review Preview (Task Reviewer)
```
REVIEW PLAN for Task T003: Create API endpoints

| Field | Value |
|-------|-------|
| Task | T003: Create API endpoints |
| Type | impl |
| Story | US001: User Management |

Files to review:
- src/routes/users.ts (deliverable)
- src/services/UserService.ts (affected)

| # | Check | Will Verify |
|---|-------|-------------|
| 1 | Approach | Express routes per Story spec |
| 2 | Config | No hardcoded URLs |
| ... | ... | ... |
| 10 | Side-effects | Pre-existing bugs in touched files |

Expected output: `Done | To Rework` + Issues list
```

### Replan Preview (Replanners)
```
REPLAN PREVIEW for [Entity]

| Operation | Item | Change |
|-----------|------|--------|
| KEEP | US002 | (unchanged) |
| UPDATE | US003 | +AC3, Technical Notes |
| OBSOLETE | US004 | Feature removed |
| CREATE | US006 | New requirement |

⚠️ WARNINGS: US005 is In Progress - will KEEP

Type "confirm" to execute.
```

## Confirmation Pattern

```javascript
IF autoApprove === true:
  // Skip prompt, proceed
ELSE:
  // Show preview
  // Wait for: "confirm" | feedback | cancel
```

## Usage

```markdown
## Plan Mode Support

Follows `references/plan_mode_pattern.md`:
- Workflow [A/B]: [Preview-Only / Interactive]
- Phase N+1: [Generate preview / Show results + wait]
```

---
**Version:** 1.0.0
**Last Updated:** 2026-02-05

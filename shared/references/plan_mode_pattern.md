# Plan Mode Pattern

Standard behavior when skill runs in Plan Mode (read-only).

## Detection

Plan Mode active when:
- Agent running with `--plan` flag
- Context indicates read-only mode
- Cannot execute modifications

## Two Workflows

### Workflow A: Preview-Only (Coordinators)

For skills that delegate to workers:

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
| 1 | DB schema | impl | 5h | ln-401 |
| 2 | Service | impl | 8h | ln-401 |

Mode: CREATE (0 existing)
```

### Workflow B: Interactive (Validators)

For skills that validate and may modify:

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

Before starting, add phases showing Plan Mode awareness:

```
- Phase 1: Discovery (in_progress → completed)
- Phase 2: Analysis (pending → completed)
- Phase 3: Generate plan preview (pending → completed)
- Phase 4: Execute (marked "skipped - Plan Mode")
```

## Output Requirements

| Workflow | Must Include |
|----------|-------------|
| A (Preview) | Table of planned work, sequence, workers |
| B (Interactive) | Analysis results, proposed changes |

## Which Skills Use Which

| Workflow | Skills |
|----------|--------|
| **A (Preview)** | ln-401, ln-402 |

## Preview Format Standards

### Review Preview (ln-402)
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

Expected output: Done/To Rework + Issues list
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

Follows `shared/references/plan_mode_pattern.md`:
- Workflow [A/B]: [Preview-Only / Interactive]
- Phase N+1: [Generate preview / Show results + wait]
```

---
**Version:** 1.0.0
**Last Updated:** 2026-02-05

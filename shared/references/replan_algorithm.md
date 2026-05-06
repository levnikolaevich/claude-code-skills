# Replan Algorithm Pattern

Universal comparison logic for REPLAN operations across Epic, Story, and Task levels.

## Core Principle

> **IDEAL plan = Source of Truth.** Existing items are compared AGAINST the IDEAL plan, not vice versa.

## Operations Matrix

| Operation | Criteria | When to Use |
|-----------|----------|-------------|
| **KEEP** | Goal match + Content identical | No changes needed |
| **UPDATE** | Goal match + Content changed | Scope/AC/Technical Notes differ |
| **OBSOLETE** | Existing not in IDEAL | Feature removed from scope |
| **CREATE** | IDEAL not in existing | New requirement added |

## Matching Algorithm

### For EACH item in IDEAL plan:
1. Extract goal from title and description
2. Search existing items for similar goal (fuzzy match)
3. Check overlap (AC coverage, persona, capability)
4. If match is Done: compare ideal task requirements against Done task scope. If current ACs require capabilities the Done task did not deliver → Done conflict (KEEP + CREATE follow-up for delta)
5. **Result:** Match found → KEEP/UPDATE candidate | No match → CREATE

### For EACH existing item:
1. Extract goal from title and AC
2. Search IDEAL plan for similar goal
3. **Result:** Match found → KEEP/UPDATE candidate | No match → OBSOLETE

## Status Constraints

| Status | Safe to Modify? | Action |
|--------|-----------------|--------|
| **Backlog** | ✅ Yes | Apply operation |
| **Todo** | ✅ Yes | Apply operation |
| **In Progress** | ⚠️ Warning | Ask user, default KEEP |
| **To Review** | ⚠️ Warning | Ask user, default KEEP |
| **Done** | ❌ No | KEEP always, CREATE follow-up if needed |

**Rule:** Never auto-modify `In Progress`, `To Review`, or `Done` items. Show warning, require explicit user confirmation.

## Edge Cases

| Case | Detection | Resolution |
|------|-----------|------------|
| **Split** | 1 existing → 2+ IDEAL (same persona, split capabilities) | UPDATE first + CREATE new |
| **Merge** | 2+ existing → 1 IDEAL (combined capabilities) | UPDATE survivor + OBSOLETE rest |
| **Ambiguous match** | >1 existing matches IDEAL (>70% similarity) | Show all options, pick highest |
| **Done conflicts** | IDEAL requires capabilities the Done task did not deliver (revised ACs, new segments, expanded scope) | Preserve Done, CREATE follow-up task scoped to the delta only |
| **In Progress OBSOLETE** | Existing not in IDEAL + status In Progress | ⚠️ NO auto-cancel, show warning |

## Output Format

```
REPLAN SUMMARY:
- KEEP: 3 items (unchanged)
- UPDATE: 2 items (scope changes)
- OBSOLETE: 1 item (removed from scope)
- CREATE: 1 item (new requirement)

WARNINGS:
- ⚠️ T-005 is In Progress - recommend KEEP (will not auto-cancel)

OPERATIONS:
1. UPDATE T-002: Add AC3 for edge case handling
2. OBSOLETE T-004: Feature removed from Epic scope
3. CREATE T-007: New requirement from updated AC
```

## Best Practices

1. **Show diffs** — Display what changes for UPDATE operations
2. **Group by operation** — Present KEEP/UPDATE/OBSOLETE/CREATE separately
3. **Warnings first** — Show `In Progress | To Review | Done` conflicts before proceeding
4. **Preserve history** — Add comments explaining why items were OBSOLETEd
5. **Atomic execution** — All operations succeed or none (rollback on failure)

## 5-Phase Replan Workflow

### Phase 1: LOAD
```
1. Fetch existing items from Linear (or files)
2. Load FULL descriptions (not just metadata)
3. Parse structure: title, AC, Technical Notes
4. Count by status: Backlog, Todo, In Progress, Done
```

### Phase 2: COMPARE
```
FOR EACH item in IDEAL plan:
  1. Search existing for matching goal (fuzzy)
  2. IF match found:
     - Compare content (AC, Technical Notes)
     - IF identical → KEEP
     - IF different → UPDATE
  3. IF no match → CREATE

FOR EACH item in existing:
  1. IF not matched above → OBSOLETE
```

### Phase 3: SHOW Summary
```
REPLAN SUMMARY for [Entity Type]:

Operations:
- KEEP: N items (unchanged)
- UPDATE: N items (details below)
- OBSOLETE: N items (removed)
- CREATE: N items (new)

UPDATES:
| Item | What Changes |
|------|--------------|
| US002 | AC3 added, Technical Notes updated |

WARNINGS:
- ⚠️ US005 is In Progress - will KEEP (no auto-modify)

Type "confirm" to execute.
```

### Phase 4: CONFIRM
```
IF autoApprove=true → Proceed to Phase 5
ELSE → Wait for user "confirm"
  - User can modify plan
  - User can cancel
```

### Phase 5: EXECUTE
```
FOR EACH operation (in order: UPDATE → OBSOLETE → CREATE):
  1. Execute Linear API call
  2. Verify success
  3. Update kanban_board.md
  4. Add comment explaining change

ROLLBACK if any operation fails.
```

## Level-Specific Details

| Level | Items | Match Criteria | Primary Reference |
|-------|-------|----------------|-------------------|
| **Epic** | 3-7 Epics | Business domain, Goal | ln-210-epic-coordinator |
| **Story** | 5-10 Stories | Persona, Capability, AC | ln-222-story-replanner |
| **Task** | 1-8 Tasks | Goal, Implementation approach | ln-302-task-replanner |

For level-specific examples and scenarios, see:
- `ln-210-epic-coordinator/references/replan_workflow.md`
- `ln-222-story-replanner/references/replan_algorithm_stories.md`
- `ln-302-task-replanner/references/replan_algorithm.md`

---
**Version:** 1.1.0
**Last Updated:** 2026-02-05

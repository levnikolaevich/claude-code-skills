# Dependency Validation (Criteria #18-#19)

<!-- SCOPE: Story/Task dependency validation criteria #18-#19 ONLY. Contains forward dependency detection, sequential completability checks. -->
<!-- DO NOT add here: Structural validation → structural_validation.md, workflow → workflow_validation.md -->

Detailed rules for Story and Task independence validation (no forward dependencies).

---

## Criterion #18: Story Dependencies (Within-Epic)

**Check:** No Story depends on FUTURE Stories (only previous Stories allowed)

**Penalty:** CRITICAL (10 points)

**Rule:** Story N may reference only Stories 1..N-1. Forward references (N+1, N+2...) violate sequential executability and INVEST Independence.

---

### Auto-fix Actions #18

1. Load all Stories in Epic, sort by number (US001, US002...)
2. Parse each Story's "Depends On" field, normalize refs to numbers
3. Detect forward deps:
   ```
   FOR Story N: IF any dep D.number > N.number → CRITICAL violation (+10 pts)
   ```
4. Build dependency graph:
   ```
   Story 1.1 → (none)
   Story 1.2 → 1.1 ✅
   Story 1.3 → 1.5 ❌ FORWARD
   ```
5. Suggest fixes:
   - **Option A:** Reorder Stories (move depended Story before dependent)
   - **Option B:** Split Epic (move dependent Stories to separate Epic)
   - **Option C:** Remove dependency (make Stories independent)
6. Update Linear: comment on Story + Epic about detected forward deps

---

## Criterion #19: Task Dependencies (Within-Story)

**Check:** No Task depends on FUTURE Tasks (only previous Tasks allowed)

**Penalty:** MEDIUM (3 points)

**Rule:** Task N may reference only Tasks 1..N-1. Tasks follow Foundation-First order (DB -> Service -> API -> UI). Skip check if Story has only 1 task.

---

### Auto-fix Actions #19

1. Load all implementation Tasks in Story, sort by number
2. Parse deps from description: keywords "requires", "depends on", "needs", "uses output from"
3. Detect forward deps:
   ```
   FOR Task N: IF any dep refs Task M where M > N → MEDIUM violation (+3 pts)
   ```
4. Check Foundation-First order: DB tasks before Service before API before UI
5. Suggest fixes:
   - **Option A:** Reorder Tasks (move depended Task before dependent)
   - **Option B:** Remove dependency (refactor to use only previous Tasks)
   - **Option C:** Split Task (extract dependent part to new Task after depended)
6. Build corrected order:
   ```
   Before: 1.API(→T3) 2.Repo 3.Service(→T2)
   After:  1.Repo     2.Service(→T1) 3.API(→T2)
   ```

---

## Criterion #19b: Parallel Group Validity (Within-Story)

**Check:** Parallel Groups assigned correctly (no intra-group dependencies, sequential numbering)

**Penalty:** MEDIUM (3 points)

**What it checks:**
- Tasks in same Parallel Group do NOT reference each other
- All deps of group N tasks point to groups 1..N-1 only
- Group numbers are sequential (1, 2, 3...) with no gaps
- Every task has `**Parallel Group:**` field (or all lack it — backward compatible)

Skip if no tasks have `**Parallel Group:**` field or Story has only 1 task.

### DAG Detection Algorithm

Valid parallel groups form a DAG where edges go only from lower to higher groups:

```
GOOD:
  T1(G1): DB migration — no deps
  T2(G2): UserRepo — dep T1 ✅ (G1 < G2)
  T3(G2): ProductRepo — dep T1 ✅ (G1 < G2)
  T4(G3): UserService — dep T2 ✅ (G2 < G3)

BAD:
  T2(G2): UserRepo — dep T1 ✅
  T3(G2): ProductRepo — dep T2 ❌ (same group = mutual dependency!)
```

### Auto-fix Actions #19b

1. Parse `**Parallel Group:**` from each task
2. Build group->tasks mapping
3. For each group: verify no task refs another task in same group
4. Verify all deps point to earlier groups
5. If violation: reassign task to next group (increment)
6. If gaps in numbering: renumber sequentially

---

## Dependency Detection Patterns

**Story Dependencies (Criterion #18):**

Search in Story "Dependencies" section:
```
## Dependencies
**Depends On:**
- Story 1.3: Token validation  → extract "1.3"
- US005: User profile          → extract "005" → Story 1.5
```

Keywords for implicit deps:
`requires Story N` | `depends on Story N` | `needs Story N` | `blocked by Story N` | `waits for Story N`

**Task Dependencies (Criterion #19):**

Search ALL sections of Task description:
```
## Context
Requires Task 3 to generate tokens        → FORWARD if current < 3

## Implementation Plan
Uses output from Task 4                    → FORWARD if current < 4

## Technical Approach
Depends on validation middleware from Task 5 → FORWARD if current < 5
```

Keywords: `requires Task N` | `depends on Task N` | `needs Task N output` | `uses Task N result` | `waits for Task N`

---

**Version:** 1.0.0
**Last Updated:** 2026-02-03

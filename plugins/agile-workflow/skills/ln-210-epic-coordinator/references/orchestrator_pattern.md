# Orchestrator Pattern

Generic L2 coordinator lifecycle for skills that delegate to L3 workers.

## Core Lifecycle

```
Phase 1: DISCOVERY
    │
    ▼
Phase 2: PLAN (build IDEAL)
    │
    ▼
Phase 3: MODE DETECTION
    │
    ├─ CREATE → Phase 4a
    ├─ REPLAN → Phase 4b
    └─ ADD → Phase 4c
    │
    ▼
Phase 4: DELEGATE to workers
    │
    ▼
Phase 5: AGGREGATE results
    │
    ▼
Phase 6: REPORT
```

## Phase Details

### Phase 1: DISCOVERY

| Action | Source |
|--------|--------|
| Load Team ID | `docs/tasks/kanban_board.md` |
| Load project config | `CLAUDE.md`, `docs/` |
| Parse user request | Extract entity ID, keywords |
| Detect storage mode | Linear (default) vs File Mode |

**MANDATORY READ:** Load `references/auto_discovery_pattern.md`

### Phase 2: PLAN

| Action | Output |
|--------|--------|
| **Articulate REAL GOAL** | **1-sentence: what this orchestration delivers (see `goal_articulation_gate.md`)** |
| Analyze scope | Entity structure, constraints |
| Build IDEAL plan | Optimal decomposition |
| Apply guidelines | Size limits, ordering rules |

**MANDATORY READ:** Load `references/decompose_first_pattern.md`

### Phase 3: MODE DETECTION

| Condition | Mode | Next Phase |
|-----------|------|------------|
| Count = 0 | CREATE | 4a |
| Count ≥ 1 + "replan" keyword | REPLAN | 4b |
| Count ≥ 1 + "add" keyword | ADD | 4c |
| Count ≥ 1 + ambiguous | ASK USER | Wait |

### Phase 4: DELEGATE

| Mode | Worker | Payload |
|------|--------|---------|
| CREATE | Creator (ln-X01) | IDEAL plan, context |
| REPLAN | Replanner (ln-X02) | IDEAL plan, existing IDs |
| ADD | Creator (appendMode) | Single item description |

**MANDATORY READ:** Load `references/task_delegation_pattern.md`

### Phase 5: AGGREGATE

| Worker Type | Aggregation |
|-------------|-------------|
| Creators | Collect URLs, update counters |
| Audit workers | Sum severity, calculate overall score |
| Replanners | Merge operations, warnings |

### Phase 6: REPORT

```
SUMMARY for [Entity]:

Created/Updated: N items
- [Item 1] (URL)
- [Item 2] (URL)

Next Steps:
1. [Next skill to run]
2. [Validation step]
```

## Orchestrator vs Worker Responsibilities

| Orchestrator (L2) | Worker (L3) |
|-------------------|-------------|
| Load metadata only | Load full descriptions |
| Build IDEAL plan | Execute plan |
| Detect mode | Handle single mode |
| Aggregate results | Return structured output |
| Update counters | Update Linear/kanban |

## Mode-Specific Variations

### CREATE Mode
```
1. Generate IDEAL plan (Phase 2)
2. Show preview
3. User confirmation
4. Delegate to Creator worker
5. Worker creates in Linear + updates kanban
```

### REPLAN Mode
```
1. Generate IDEAL plan (Phase 2)
2. Load existing items
3. Compare: KEEP/UPDATE/OBSOLETE/CREATE
4. Show replan summary
5. User confirmation
6. Delegate to Replanner worker
```

### ADD Mode
```
1. Parse user's new item request
2. Skip full IDEAL plan
3. Delegate to Creator (appendMode=true)
4. Worker creates single item
```

## Usage in SKILL.md

```markdown
## Workflow

Follows `references/orchestrator_pattern.md`:
- Phase 1-2: Discovery + Planning
- Phase 3: Mode Detection (CREATE/REPLAN/ADD)
- Phase 4-6: Delegate + Aggregate + Report
```

---
**Version:** 1.0.0
**Last Updated:** 2026-02-05

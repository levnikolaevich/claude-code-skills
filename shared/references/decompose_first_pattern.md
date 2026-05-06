# Decompose-First Pattern

Build IDEAL plan FIRST, then check existing state to determine mode.

## Core Principle

> **IDEAL plan = Source of Truth.** Design optimal structure based on current requirements, independent of existing state (which may be outdated).

## Algorithm

```
Phase N: BUILD IDEAL PLAN
  0. State REAL GOAL: What is this decomposition actually producing? (Not "create items" — the business capability being enabled). See `goal_articulation_gate.md`.
  1. Analyze current scope/requirements
  2. Design optimal structure (Epics/Stories/Tasks)
  3. Validate against constraints (size, count, INVEST)
  4. NO consideration of existing state yet

Phase N+1: CHECK EXISTING
  1. Query Linear/files for existing items
  2. Count existing items

Phase N+2: DETECT MODE
  IF count = 0 → CREATE MODE (generate all new)
  IF count ≥ 1 AND "add" keyword → ADD MODE (append new)
  IF count ≥ 1 AND "replan" keyword → REPLAN MODE (compare & update)
  IF count ≥ 1 AND ambiguous → ASK USER
```

## Mode Detection Keywords

| Mode | Keywords | Action |
|------|----------|--------|
| CREATE | — | Generate all items from IDEAL |
| ADD | "add", "append", "one more", "additional" | Append to existing |
| REPLAN | "update", "revise", "replan", "requirements changed" | Compare IDEAL vs existing |

## Why Decompose-First?

1. **Prevents anchoring bias** — Existing structure may be suboptimal
2. **Ensures consistency** — Same decomposition logic regardless of history
3. **Handles requirements change** — New IDEAL reflects current needs
4. **Enables clean replanning** — Clear comparison basis

## Level-Specific Counts

| Level | IDEAL Count | Coordinator |
|-------|-------------|-------------|
| Epic | 3-7 Epics | ln-210-epic-coordinator |
| Story | 5-10 Stories per Epic | ln-220-story-coordinator |
| Task | 1-8 Tasks per Story | ln-300-task-coordinator |

## Usage

```markdown
## Phase 3: Decompose-First

Follows `references/decompose_first_pattern.md`:

1. Build IDEAL plan (N items based on scope)
2. Query existing items
3. Detect mode: CREATE/ADD/REPLAN
```

---
**Version:** 1.0.0
**Last Updated:** 2026-02-05

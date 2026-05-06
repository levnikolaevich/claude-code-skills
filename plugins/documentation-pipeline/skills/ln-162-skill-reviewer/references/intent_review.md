# Intent Review Dimensions (M1-M6)

<!-- DO NOT add here: Workflow phases -> ln-162-skill-reviewer SKILL.md -->

Evaluate DESIGN INTENT of changes. Applies to primary skills only (affected/dependency skills have no changed intent).

For each primary skill, read the git diff (`git diff HEAD -- {skill_dir}/`).

## M1: Goal Clarity
- REAL GOAL evident from diff + commit message alone (apply `references/goal_articulation_gate.md`)
- NOT THE GOAL identified -- surface-level reading would NOT produce same answer as REAL GOAL
- Goal unclear from diff alone -> `UNCLEAR_GOAL` (RETHINK); warn that Phase 5 fixes may address wrong intent

## M2: Approach Optimality (scope: NEW changes only)
- New abstractions count <= 3 (phases, reference files, shared patterns)
- No Red Flags triggered from SKILL_ARCHITECTURE_GUIDE table
- KISS/YAGNI criteria pass per `references/creation_quality_checklist.md` (#11, #12)
- No simpler approach achieves same goal with fewer lines/phases/files
- Simpler alternative exists -> finding with specific description (SIMPLIFY or RETHINK)
- **Downstream verification:** When a primary skill changes behavior, enumerate ALL downstream skills in its delegation tree (Worker Invocation table). For each: verify the change is compatible with downstream input contracts (D10)
- **Upstream verification:** Check all skills that delegate TO the changed skill. Verify their expectations still hold
- **Concrete trace test:** For each behavioral change, formulate: "If I call this skill with {input}, will it produce {expected output}?" Trace through the delegation chain. If any step breaks -- finding

## M3: Ecosystem Consistency
- 2-3 peer skills in same category (same NXX prefix) use consistent delegation pattern, hierarchy level, workflow pattern
- No existing `references/` file that changed skill should reuse but doesn't
- Divergence from peers has documented rationale
- Missed shared/ reuse -> finding with specific file path (SIMPLIFY)

## M4: Rewrite Delta (scope: WHOLE skill-as-changed)
- SRP Decision Tree applied to skill-as-changed (not just the diff)
- Tree does NOT suggest different structure (split/combine/re-level)
- If delta HIGH (>30% different from clean-slate design) -> 1-3 sentence structural recommendation (RETHINK)

## M5: Necessity (YAGNI Classification)

Classify each diff hunk against M1's REAL GOAL:

| Label | Definition | Action |
|-------|-----------|--------|
| REQUESTED | Directly implements REAL GOAL | KEEP |
| DERIVED | Necessary side-effect of REAL GOAL | KEEP |
| SPECULATIVE | Not requested, model-generated addition | ASK user |

**SPECULATIVE detection signals:**
- Content keywords: `future-proof`, `might need`, `prepare for`, `extensible`, `scalable for`, `in case`, `optional`, `configurable`, `placeholder`, `eventually`
- Structural: new files/phases/sections absent from request; error handling outside stated scope; config with single consumer; abstractions with single implementation; fallback paths for non-existent conditions

**Additional checks (all hunks):**
- No backward-compat shims or unused artifacts per `references/clean_code_checklist.md`
- Research-to-Action Gate: change inspired by external research -- what specific defect does it fix? No defect -> REVERT

**Output:** build classification table:

| # | File:Lines | Label | Rationale |
|---|-----------|-------|-----------|

**Speculative Change Gate:** if SPECULATIVE items exist, present ALL via single AskUserQuestion:
```
M5 found {N} speculative additions not traced to REAL GOAL:
1. {file:lines} -- {rationale}
2. {file:lines} -- {rationale}
Reply KEEP or REVERT per item (e.g., '1:KEEP 2:REVERT'). Default: REVERT all.
```
User KEEP -> reclassify as REQUESTED. Remaining SPECULATIVE -> REVERT finding for Phase 5.

**Finding categories:**
- **SIMPLIFY** -- concrete reduction possible, may be auto-fixed
- **RETHINK** -- design decision needed, NOT auto-fixable, advisory only
- **REVERT** -- change does not fix concrete defect, must be rolled back

## M6: Performance Baseline (ADVISORY -- non-blocking)
- Compare SKILL.md line count before/after change
- If change adds >50 lines without new phases/features -> flag for compaction review
- If change adds new MANDATORY READ files -> verify they're loaded conditionally, not always
- Advisory only: findings are NOTE severity, never FAIL

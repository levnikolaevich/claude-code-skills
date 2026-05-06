# Goal Articulation Gate

Mandatory micro-step before execution/review/analysis. Forces explicit statement of the REAL goal to prevent surface-level reasoning failures.

## Why

Models latch onto the most salient feature (70% of failures) instead of the actual constraint. Articulating the real goal surfaces hidden requirements. Structured reasoning > context injection by 2.83x ([STAR framework](https://arxiv.org/abs/2602.21814), 2025).

## Gate (4 questions, <=25 tokens each, ~100 tokens total)

Before starting work, state in 1-2 sentences each:

| # | Question | Guards Against |
|---|----------|---------------|
| 1 | **REAL GOAL:** What is the actual deliverable? (Name the primary subject — the thing being changed) | Distance heuristic — latching onto salient but wrong target |
| 2 | **DONE LOOKS LIKE:** What does success look like concretely? | Vague completion — "it works" without measurable outcome |
| 3 | **NOT THE GOAL:** What would a surface-level shortcut produce? What would over-engineering produce? | Environmental rationalization — plausible but wrong answer. Over-engineering: benchmark-driven scope inflation, bundling multiple features as "unified", adding industry patterns not in Epic Scope |
| 4 | **INVARIANTS & HIDDEN CONSTRAINTS:** What implicit requirement isn't stated? What surrounding systems must stay unchanged? | Ironic self-awareness — knowing the constraint but ignoring it |

## Anti-Hallucination Rule

If evidence for HIDDEN CONSTRAINTS is missing, write `UNKNOWN` and list assumptions explicitly. Do NOT invent constraints without a source anchor (task description, story AC, doc reference, or code path).

## Example

**Task:** "Add authentication to API endpoints"

| # | Answer |
|---|--------|
| 1 | REAL GOAL: Every non-public endpoint rejects requests without valid JWT |
| 2 | DONE: 401 on unauthorized, valid tokens pass, refresh works, tests cover all 3 |
| 3 | NOT THE GOAL: Adding auth middleware to one route and calling it done |
| 4 | HIDDEN: Existing integration tests break without test fixtures update. UNKNOWN: rate limiting requirements (assumption: not in scope) |

**Anti-pattern example (over-engineering):**

| # | Answer |
|---|--------|
| 1 | REAL GOAL: Translate user input using stored translations, cache repeated responses |
| 2 | DONE: Two Stories — TM lookup returns stored translation; Response cache returns cached response. 3-4 ACs each |
| 3 | NOT THE GOAL (shortcut): Single endpoint with no cache. NOT THE GOAL (over-engineering): "Unified Intelligent Memory" with 5-level lookup priority, 11 endpoints, industry benchmark tables, architecture in ACs |
| 4 | HIDDEN: TM and Cache are distinct capabilities — bundling them inflates scope. ACs must describe what USER sees, not system internals |

## Self-Check

If your REAL GOAL statement does not name the **primary subject** (the thing being changed/delivered), rewrite it. The research found 100% of failures framed the goal around a secondary subject.

## When to Use

- **Every start:** Use this gate before execution, review, analysis, or decomposition
- **Rework tasks:** Combine with 5 Whys (`problem_solving.md`) to ensure root cause is articulated alongside the rework goal

## Usage in SKILL.md

```markdown
**MANDATORY READ:** `references/goal_articulation_gate.md`
Before starting work, complete the Goal Articulation Gate (4 questions, <=25 tokens each).
```

---
**Version:** 1.0.0
**Last Updated:** 2026-02-27

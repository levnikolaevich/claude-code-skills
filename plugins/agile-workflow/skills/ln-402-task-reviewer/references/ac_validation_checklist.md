# AC Validation Checklist

<!-- SCOPE: ln-402-specific execution order, verdict logic, skip conditions for AC validation. -->
<!-- DO NOT add here: Criteria details → references/ac_validation_rules.md -->

AC validation criteria for task review. For 4 Core Criteria definitions (Completeness, Specificity, Dependencies, Database Scope), examples, and HTTP codes, see [ac_validation_rules.md](../../references/ac_validation_rules.md).

---

## Execution in ln-402 Review

**Integration Point:** Add to review checks (SKILL.md step 3) AFTER existing checks, BEFORE decision (step 5)

**Order:**
1. Existing checks (approach, hardcoded values, error handling, logging, comments, naming, docs, tests)
2. **AC Completeness** - all scenarios covered?
3. **AC Specificity** - exact HTTP codes/messages/timing?
4. **Task Dependencies** - no forward deps?
5. **Database Creation** - schema scope correct?
6. Decision (Done vs To Rework)

**Verdict Logic:**
- If ALL 4 criteria pass → Continue to Decision (step 5)
- If ANY criterion fails → To Rework with specific guidance

---

## Skip Validation When

- Task type = test (label "tests") - tested by test executor/test planner, not AC validation
- Task has no parent Story (orphan) - warn user, skip validation
- Story has no AC section - warn user, suggest fixing Story first

---

**Version:** 2.0.0 (BREAKING: Removed duplicated criteria — now references references/ac_validation_rules.md)
**Last Updated:** 2026-02-07

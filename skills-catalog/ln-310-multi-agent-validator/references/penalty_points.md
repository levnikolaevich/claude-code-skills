# Penalty Points System

<!-- SCOPE: Calculation rules, report format, and edge cases ONLY. -->

Details that expand on SKILL.md: multiple violations, report format, edge cases.

For severity levels and 30-criteria mapping, see [SKILL.md §Phase 4](../SKILL.md#phase-4-auto-fix) and [phase2_research_audit.md](phase2_research_audit.md).

---

## Calculation Rules

### Multiple Violations per Criterion

Some criteria can have multiple violations (points multiply):

| Criterion | Multiple Violations | Calculation |
|-----------|---------------------|-------------|
| #2 Tasks Structure | Per Task | 1 point * violated_tasks_count |
| #4 Acceptance Criteria | Per missing AC | 3 points * missing_ac_count (max 3x = 9) |
| #9 Story Size | Per issue | 3 points * size_issues_count |
| #16 Story-Task Alignment | Per misaligned Task | 3 points * misaligned_tasks_count (max 3x = 9) |
| #17 AC-Task Coverage | Per uncovered AC | 3 points * uncovered_ac_count (max 3x = 9) |
| #17b AC Invocability | Per invocable AC without concrete mechanism | 5 points * violating_ac_count (uncapped) |
| #17c Scenario Completeness | Per invocable AC with incomplete segments | 5 points * incomplete_ac_count (uncapped) |
| #18 Story Dependencies | Per forward dep | 10 points * forward_dep_count |
| #19 Task Dependencies | Per forward dep | 3 points * forward_dep_count (max 3x = 9) |
| #20 Risk Analysis | Per unmitigated risk | 5 points * risk_count (Priority >= 15) or 3 points (Priority 9-14), max 15 |
| #24 Assumption Registry | Single | 3 points (includes assumption sync sub-check) |
| #25 AC Cross-Story Overlap | Per overlap + cap | 3 points (overlap) or 10 points (conflict); max 1 CRITICAL = 10 points total |
| #26 Task Cross-Story Duplication | Per duplication | 1 point * duplication_count (max 3) |
| #27 Pre-mortem Analysis | Single | 3 points if skipped for complex Story |
| #28 Library Feature Utilization | Single | 3 points (all findings combined into one advisory) |
| Others | Single | Fixed points per criterion |

**Examples:**
- Story has 5 Tasks, 2 violate structure → 1 * 2 = 2 points
- AC missing 2 edge cases → 3 * 2 = 6 points (capped at 9)
- 2 Tasks don't align with Story → 3 * 2 = 6 points (capped at 9)
- 1 Story has forward dependency → 10 * 1 = 10 points

---

## Report Format

### Phase 3 Output (Audit Results)

```
PENALTY POINTS AUDIT
====================

| # | Criterion               | Severity | Points | Issue                          |
|---|-------------------------|----------|--------|--------------------------------|
| 4 | Acceptance Criteria     | MEDIUM   | 3      | Missing edge case for empty    |
| 5 | Standards Compliance    | CRITICAL | 10     | No RFC 7231/OWASP compliance   |
| 6 | Library & Version       | HIGH     | 5      | Express v4.17 -> v4.19         |
|17 | AC-Task Coverage        | MEDIUM   | 3      | AC "Error 401" has no Task     |

TOTAL: 21 penalty points

FIX PLAN:
- #4: Add Given/When/Then for empty input case
- #5: Add RFC 7231 error response + OWASP checklist
- #6: Update Express version in Technical Notes
- #17: Add TODO for missing token validation Task
```

### Phase 6 Output (Final Report)

```
VALIDATION COMPLETE
===================

PENALTY POINTS: 21 -> 0

| # | Criterion               | Before | After | Fixed |
|---|-------------------------|--------|-------|-------|
| 4 | Acceptance Criteria     | 3      | 0     | Yes   |
| 5 | Standards Compliance    | 10     | 0     | Yes   |
| 6 | Library & Version       | 5      | 0     | Yes   |
|17 | AC-Task Coverage        | 3      | 0     | Yes   |

TOTAL: 21 -> 0 (100% fixed)

Story approved: Backlog -> Todo
```

---

## Edge Cases

### Zero Violations

```
PENALTY POINTS AUDIT
====================

No violations detected.

TOTAL: 0 penalty points

Story approved: Backlog -> Todo
```

### Maximum Violations

If total > 30 points (max possible: 123+ with all 30 criteria; #17b and #17c are HIGH per AC, uncapped; #20 capped at 15, #25 max 1 CRITICAL = 10), add warning:

```
WARNING: High violation count (42 points)
Consider Story scope review before approval.
```

---

**Version:** 3.0.0
**Last Updated:** 2026-02-07

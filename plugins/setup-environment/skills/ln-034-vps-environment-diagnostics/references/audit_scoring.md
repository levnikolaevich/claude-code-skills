# Audit Scoring Algorithm

Unified scoring formula for audit workers.

## Penalty Formula

```text
penalty = (critical x 2.0) + (high x 1.0) + (medium x 0.5) + (low x 0.2)
score = max(0, 10 - penalty)
```

## Score Interpretation

| Score | Meaning | Action |
|-------|---------|--------|
| 10/10 | No issues | None required |
| 8-9/10 | Minor issues | Low priority fixes |
| 6-7/10 | Moderate issues | Address in next sprint |
| 4-5/10 | Significant issues | Prioritize fixes |
| 1-3/10 | Critical issues | Immediate action required |

## Severity Guidelines

| Severity | Weight | Typical Issues |
|----------|--------|----------------|
| CRITICAL | 2.0 | Security vulnerabilities, data loss risks, RFC/standard violations |
| HIGH | 1.0 | Architecture violations, outdated dependencies with CVEs, blocking bugs |
| MEDIUM | 0.5 | Best practice violations, code smells, minor performance issues |
| LOW | 0.2 | Style issues, minor inconsistencies, cosmetic problems |

## Calculation Example

**Input:** 1 CRITICAL + 2 HIGH + 3 MEDIUM + 2 LOW

```text
penalty = (1 x 2.0) + (2 x 1.0) + (3 x 0.5) + (2 x 0.2)
        = 2.0 + 2.0 + 1.5 + 0.4
        = 5.9

score = max(0, 10 - 5.9) = 4.1
```

**Result:** 4.1/10 (Significant issues)

## Diagnostic Sub-Scores

Some workers additionally report 4 diagnostic sub-scores (0-100 each):
- **Compliance** - How well implementation follows the documented pattern
- **Completeness** - Whether required components are present
- **Quality** - Code quality of the implementation
- **Implementation** - Technical correctness of the implementation

These sub-scores are informational only. The primary `score` field still uses the penalty formula above.

## Usage in SKILL.md

Prefer one `**MANDATORY READ:**` block in the scoring section instead of restating the formula.

---
**Version:** 2.0.0
**Last Updated:** 2026-03-01

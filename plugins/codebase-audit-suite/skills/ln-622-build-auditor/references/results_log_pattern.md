<!-- SOURCE-OF-TRUTH: shared/references/results_log_pattern.md. Edit ONLY here; run `node tools/marketplace/shared.mjs sync` -->

# Results Log Pattern

Append-only trend tracking for audit coordinators. Inspired by autoresearch `results.tsv`.

## Target File

`docs/project/.audit/results_log.md` in target project (created on first append if missing).

## Schema

```markdown
# Audit Results Log

| Date | Skill | Metric | Scale | Score | Status | Delta | Key Finding | Commit |
|------|-------|--------|-------|-------|--------|-------|-------------|--------|
```

## Column Definitions

| Column | Description | Example |
|--------|-------------|---------|
| Date | ISO date YYYY-MM-DD | 2026-03-08 |
| Skill | Coordinator skill ID | codebase-auditor |
| Metric | Score name from coordinator output | `overall_score` |
| Scale | Score range | `0-10` or `0-100` |
| Score | Numeric value | 7.2 |
| Status | Trend vs previous run of SAME skill | improving / stable / declining |
| Delta | Numeric difference from previous | +0.6 |
| Key Finding | Highest-severity issue (1 line) | 2 HIGH security |
| Commit | Short git hash at time of audit | abc1234 |

## Metric Registration

Each coordinator defines its own metric in its SKILL.md (name, scale, source). When appending to the log, use the metric defined in own workflow. Common patterns:

- `overall_score` (0-10) — penalty formula from `audit_scoring.md`
- `{domain}_health_score` (0-100) — derived from worker scores

## Status Thresholds

| Scale | Improving | Stable | Declining |
|-------|-----------|--------|-----------|
| 0-10 | delta > +0.3 | abs(delta) <= 0.3 | delta < -0.3 |
| 0-100 | delta > +3 | abs(delta) <= 3 | delta < -3 |

## Append Protocol

After generating the audit report:

1. IF `docs/project/.audit/results_log.md` missing: create with header from Schema above
2. Grep last row matching own coordinator ID
3. Extract previous Score, calculate Delta and Status
4. IF no previous row: Delta = `N/A`, Status = `baseline`
5. Append new row
6. **Rolling window:** IF total data rows > 50, delete the oldest row (preserve header)

## Usage in SKILL.md

Reference this file instead of duplicating protocol:

```markdown
**MANDATORY READ:** Load `references/results_log_pattern.md`
```

---
**Version:** 1.0.0
**Last Updated:** 2026-03-08

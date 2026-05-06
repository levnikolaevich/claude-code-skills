# Code Metrics Reference

Quantitative thresholds and penalties based on goodcodeguide methodology.

## Cyclomatic Complexity

| Range | Status | Interpretation |
|-------|--------|----------------|
| 1-10 | Good | Maintainable, easily testable |
| 11-20 | Warning | Moderate complexity, consider refactoring |
| 21-50 | High | Difficult to test, should refactor |
| >50 | Critical | Untestable, must refactor |

**Penalty calculation:**
- 11-20: -5 points per function
- >20: -10 points per function

**How to estimate CC:**
- Count decision points: `if`, `else if`, `case`, `while`, `for`, `&&`, `||`, `?:`
- Base complexity = 1
- CC = base + decision_points

## Function Size

| Lines | Status | Interpretation |
|-------|--------|----------------|
| ≤20 | Optimal | Single responsibility, easy to understand |
| 21-50 | Acceptable | May need review |
| 51-100 | Warning | Consider splitting |
| >100 | Critical | Must split |

**Penalty:** -3 points per function >50 lines

## File Size

| Lines | Status | Interpretation |
|-------|--------|----------------|
| ≤200 | Optimal | Focused, single module |
| 201-500 | Acceptable | May contain related functionality |
| 501-1000 | Warning | Consider splitting |
| >1000 | Critical | God file, must split |

**Penalty:** -5 points per file >500 lines

## Nesting Depth

| Depth | Status | Interpretation |
|-------|--------|----------------|
| ≤2 | Optimal | Easy to follow |
| 3 | Acceptable | Manageable |
| 4 | Warning | Getting complex |
| >4 | Critical | Arrow anti-pattern |

**Penalty:** -3 points per instance >3 levels deep

## Parameter Count

| Count | Status | Interpretation |
|-------|--------|----------------|
| 0-2 | Optimal | Clear purpose |
| 3-4 | Acceptable | May need options object |
| 5-7 | Warning | Consider refactoring |
| >7 | Critical | Use options pattern |

**Penalty:** -2 points per function >4 parameters

## Code Quality Score Formula

```
Score = 100 - metric_penalties - issue_penalties

Where:
  metric_penalties = sum of all metric violations
  issue_penalties = (high_count × 20) + (medium_count × 10) + (low_count × 3)
```

## Issue Categories

| Prefix | Category | Severity | Penalty |
|--------|----------|----------|---------|
| SEC- | Security | high | -20 |
| PERF- | Performance | medium | -10 |
| MNT- | Maintainability | medium | -10 |
| ARCH- | Architecture | medium | -10 |

### SEC- (Security)

| Issue | Severity |
|-------|----------|
| Hardcoded credentials/secrets | high |
| SQL injection vulnerability | high |
| Unvalidated user input | high |
| Race condition | high |
| Insecure deserialization | high |
| Missing authentication | high |
| Missing authorization | medium |
| SEC-DESTR-DB: DROP/TRUNCATE/DELETE without WHERE, no confirmation gate | high |
| SEC-DESTR-FS: rm/unlink with user-controlled or unbounded path | high |
| SEC-DESTR-MIG: Migration without DOWN, DROP COLUMN without backup | medium |
| SEC-DESTR-ENV: Destructive op without environment guard | high |
| SEC-DESTR-FORCE: --force/--no-verify without justification | medium |

### PERF- (Performance)

| Issue | Severity |
|-------|----------|
| N+1 query | medium |
| O(n^2) algorithm in loop | medium |
| Missing index usage | medium |
| Unbounded memory allocation | high |
| Missing pagination | medium |
| Synchronous blocking call | medium |

### MNT- (Maintainability)

| Issue | Severity |
|-------|----------|
| DRY violation (>10 duplicate lines) | medium |
| Dead/unreachable code | low |
| Commented-out code | low |
| Magic numbers/strings | low |
| Poor naming conventions | low |
| Missing error handling | medium |
| Generic catch-all | medium |

### ARCH- (Architecture)

| Issue | Severity |
|-------|----------|
| Layer violation (UI → DB direct) | medium |
| Circular dependency | medium |
| God class/file | medium |
| Missing abstraction | low |
| Guide non-compliance | medium |

## Score Interpretation

| Score | Verdict | Action |
|-------|---------|--------|
| 90-100 | PASS | No issues, proceed |
| 70-89 | CONCERNS | Minor issues noted, can proceed |
| 50-69 | ISSUES_FOUND | Must fix before proceeding |
| <50 | CRITICAL | Urgent refactoring required |

---
**Version:** 1.0.0

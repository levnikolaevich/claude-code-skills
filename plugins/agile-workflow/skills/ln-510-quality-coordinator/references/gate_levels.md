# Gate Levels Reference

4-level Gate Model based on BMAD qa-gate methodology.

## Gate Levels

| Level | Quality Score | Meaning | Action |
|-------|---------------|---------|--------|
| **PASS** | 90-100 | All checks pass, no issues | Story → Done |
| **CONCERNS** | 70-89 | Minor issues, acceptable risk | Story → Done with concerns documented |
| **FAIL** | <70 | Blocking issues found | Create fix tasks, return to ln-400 |
| **WAIVED** | Any | Issues acknowledged by user | Story → Done with waiver reason |

## Quality Score Calculation

```
Quality Score = 100 - (20 × FAIL_count) - (10 × CONCERN_count)
```

| Check Result | Penalty |
|--------------|---------|
| FAIL (blocking issue) | -20 points |
| CONCERN (minor issue) | -10 points |
| PASS | 0 points |

**Examples:**
- All clean: 100 - 0 - 0 = 100 (PASS)
- 1 FAIL: 100 - 20 - 0 = 80 (CONCERNS)
- 2 FAILs: 100 - 40 - 0 = 60 (FAIL)
- 1 FAIL + 2 CONCERNs: 100 - 20 - 20 = 60 (FAIL)

## NFR Dimensions

| NFR | What to Check | FAIL if | CONCERN if |
|-----|---------------|---------|------------|
| **Security** | Auth, input validation, secrets | Unvalidated input, exposed secrets | Missing rate limiting, weak auth |
| **Performance** | Queries, caching, response time | N+1 queries, no caching on hot path | Unoptimized queries, large payloads |
| **Reliability** | Error handling, retries, timeouts | No error handling, no timeouts | Missing retry logic, generic catch |
| **Maintainability** | DRY, SOLID, complexity | God class, cyclomatic >20 | Duplicate code, complexity >10 |

## Issue ID Prefixes

| Prefix | Category | Priority |
|--------|----------|----------|
| SEC- | Security | 1 (Urgent) |
| PERF- | Performance | 2 (High) |
| REL- | Reliability | 2 (High) |
| MNT- | Maintainability | 3 (Normal) |
| TEST- | Testing gaps | 3 (Normal) |
| ARCH- | Architecture | 3 (Normal) |
| DOC- | Documentation | 4 (Low) |

## Issue Severity

| Severity | Description | Action |
|----------|-------------|--------|
| **high** | Blocking, must fix before merge | Creates FAIL verdict |
| **medium** | Should fix, acceptable risk | Creates CONCERN verdict |
| **low** | Nice to fix, not blocking | Noted in comment only |

## Waiver Process

WAIVED status requires:
1. User explicitly requests waiver
2. Specific issue IDs listed
3. Reason documented
4. Approver name (user)

**Waiver format:**
```yaml
waived_issues:
  - id: SEC-001
    reason: "Rate limiting handled at API Gateway level"
    approver: "user"
```

## Gate Output Format

```yaml
gate: PASS | CONCERNS | FAIL | WAIVED
quality_score: 85
status_reason: "Minor performance concerns in batch processing"
top_issues:
  - id: PERF-001
    severity: medium
    finding: "No pagination on large dataset query"
    suggested_action: "Add cursor-based pagination"
nfr_validation:
  security: PASS
  performance: CONCERNS
  reliability: PASS
  maintainability: PASS
```

---
**Version:** 1.0.0

# Context Validation Rules (Post-Filter)

Apply in coordinator aggregation phase after collecting worker findings.
Uses data already loaded in coordinator Phase 1 (ADRs, tech_stack, architecture.md, principles.md).

## Exempt Findings (never filter)

Security (ln-621), N+1 queries, CRITICAL build errors, concurrency issues (ln-628) — always valid regardless of context.

## 6 Post-Filter Rules

### Rule 1: ADR/Planned Override

```
IF finding.location OR finding.issue matches an ADR title/description
  OR matches a documented planned item (roadmap, architecture.md TODO):
  → Downgrade to advisory: "[Planned: ADR-XXX]"
Source: ADR list from docs/reference/adrs/ or docs/decisions/ (loaded in Phase 1)
```

### Rule 2: Trivial Pattern Suppression

```
IF DRY finding AND duplicated_lines < 5:
  → Remove finding (too small to extract — extraction adds indirection with no benefit)
```

### Rule 3: Cohesion Check (size-based findings only)

```
IF finding.check IN (god_classes, long_methods, large_file):
  Read flagged file ONCE (reuse for all size findings in same file):
  cohesion = 0
  - public_function_count <= 2           → cohesion += 1  (single entry point)
  - has subdirectory modules imported     → cohesion += 1  (already decomposed)
  - >60% methods share self/this state   → cohesion += 1  (shared mutable state)
  - CC = 1 (data declaration, not logic) → cohesion += 1  (registry/config, not code)
  IF cohesion >= 3: → Downgrade to advisory: "[High cohesion module]"
```

### Rule 4: Already-Latest Version Check

```
IF finding.check IN (outdated_dependency, vulnerable_dependency):
  Cross-check: version audit tool output (pip-audit, npm audit)
  IF version matches latest stable AND 0 CVEs:
    → Remove finding
```

### Rule 5: Locality/Single-Consumer Check

```
IF DRY finding OR "shared schema" suggestion:
  Grep: count files that import the flagged module
  IF import_count == 1:
    → Downgrade to advisory: "[Single consumer, locality correct]"
  IF import_count <= 3 AND each consumer serves different API contract:
    → Downgrade to advisory: "[API contract isolation]"
```

### Rule 6: Execution Context (performance findings only)

```
IF finding.check IN (blocking_io, redundant_fetch, transaction_wide, cpu_bound, resource_scope_mismatch, streaming_resource_holding):
  context = 0
  - Function in __init__/setup/bootstrap/migrate  → context += 1
  - File in tasks/jobs/cron/                       → context += 1
  - Has timeout/safeguard nearby                   → context += 1
  - Small data (<100KB file, <100 items dataset)   → context += 1
  IF context >= 3: → Downgrade to advisory
  IF context >= 1: → severity -= 1 level
```

## Advisory Findings

Downgraded findings go to "Advisory Findings" section in report. They are **excluded from penalty scoring** but listed for transparency. Each advisory includes: original severity, rule applied, evidence.

## Per-Coordinator Applicability

| Coordinator | Applicable Rules | Notes |
|---|---|---|
| ln-620 | 1, 2, 3, 4, 5 | All except Rule 6 |
| ln-640 | 1, 3 | ADR + cohesion for pattern anti-patterns |
| ln-630 | 1, 5 | ADR + single-consumer for test relevance |
| ln-650 | 1, 6 | ADR + execution context |
| ln-610 | 1 + inline | ADR + doc-type/density + file-category/complexity + fact-checker (example/template paths, planned features, authority hierarchy) inline checks |

---
**Version:** 1.0.0
**Last Updated:** 2026-02-28

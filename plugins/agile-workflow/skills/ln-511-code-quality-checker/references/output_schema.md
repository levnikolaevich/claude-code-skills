# Output Schema

<!-- SCOPE: YAML output format for code quality checker results. -->
<!-- DO NOT add here: workflow → ln-511 SKILL.md; metrics → references/code_metrics.md -->

```yaml
verdict: PASS | CONCERNS | ISSUES_FOUND
code_quality_score: {0-100}
metrics:
  avg_cyclomatic_complexity: {value}
  functions_over_50_lines: {count}
  files_over_500_lines: {count}
issues:
  - id: "{PREFIX}-{NNN}"        # OPT-, BP-, PERF-ALG-, SEC-, ARCH-DTO-, MNT-DRY-, etc.
    severity: high | medium | low
    file: "src/path/file.ts:line"
    finding: "Description of the issue"
    # Additional fields vary by prefix:
    # OPT-: goal, chosen, recommended, reason, source
    # OPT-OSS-: goal, chosen, recommended, reason, source (from audit data)
    # BP-: best_practice, source
    # PERF-ALG-: current, optimal, source
    # PERF-CFG-: current_config, recommended, source
    # PERF-DB-: issue, solution, source
    # ARCH-*: issue, fix
    # SEC-*: risk, fix
    # MNT-DRY-: suggested_action
    # MNT-DC-: dead_code, action
    # MNT-GOD-: issue, fix
```

---

**Version:** 1.0.0
**Last Updated:** 2026-03-15

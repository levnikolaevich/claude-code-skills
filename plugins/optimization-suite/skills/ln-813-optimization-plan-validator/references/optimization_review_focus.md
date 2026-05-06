# Optimization Plan Review — Focus Areas

<!-- SCOPE: Focus areas for agent review of optimization plans. Replaces default plan_review focus areas. -->

## Focus Areas (replace {focus_areas} in prompt)

- **bottleneck_alignment** — Do hypotheses target the TOP bottlenecks from performance_map? Are time shares proportional to effort?
- **file_feasibility** — Do all `files_to_modify` exist? Are they the right files for the proposed change?
- **conflict_correctness** — Are `conflicts_with` mappings accurate? Does H1 truly make H3 unnecessary?
- **dependency_order** — Are `dependencies` correct? Would applying H2 before H1 break anything?
- **suspicion_coverage** — Does every CONFIRMED suspicion from `suspicion_stack` have a corresponding hypothesis? Any gaps?
- **strike_safety** — Is it safe to apply ALL uncontested hypotheses at once? Any hidden interactions?
- **measurement_validity** — Is `test_command` adequate for measuring improvement? Does baseline seem stable?
- **cross_service** — If multi-service topology: do hypotheses account for cross-service impacts?

## Review Goal Template

```
Review this optimization plan for a {target_type} with {observed_metric} performance.
The profiler identified {bottleneck_type} as primary bottleneck ({share}% of wall time).
The researcher generated {N} hypotheses. Validate feasibility before we apply code changes.
```

---
**Version:** 1.0.0
**Last Updated:** 2026-03-15

<!-- SOURCE-OF-TRUTH: shared/templates/audit_worker_report_template.md. Edit ONLY here; run `node tools/marketplace/shared.mjs sync` -->

# Audit Worker Report Template

Markdown report envelope for audit workers. Coordinators consume the JSON summary first; this report is supporting evidence.

## Location

Write reports under:

```text
.hex-skills/runtime-artifacts/runs/{run_id}/audit-report/
```

Use stable names such as `{worker-id}-{slug}.md` or `{worker-id}-{slug}-{domain}.md`.

## Required Markdown

```markdown
# {Category Name} Audit Report

<!-- AUDIT-META
worker: ln-62X
category: {Category Name}
domain: {domain_name|global}
scan_path: {scan_path|.}
score: {X.X}
total_issues: {N}
critical: {N}
high: {N}
medium: {N}
low: {N}
status: completed
-->

## Checks

| ID | Check | Status | Details |
|----|-------|--------|---------|
| {check_id} | {name} | {passed|failed|warning|skipped} | {brief evidence} |

## Findings

| Severity | Location | Issue | Principle | Recommendation | Effort |
|----------|----------|-------|-----------|----------------|--------|
| HIGH | path/file.ts:42 | What is wrong | Rule | How to fix | M |
```

## Optional Machine Blocks

Add only when the local worker or coordinator needs extra structured data:
- `FINDINGS-EXTENDED` for pattern signatures, domain grouping, or evidence metadata.
- `DATA-EXTENDED` for worker-specific aggregate payloads.
- extra informational score fields beside the primary penalty-based `score`.

## Writing Rules

- Build the full report before writing; never leave partial reports.
- Sort findings by severity: CRITICAL, HIGH, MEDIUM, LOW.
- Keep recommendations actionable and effort as `S`, `M`, or `L`.
- Also write the JSON summary to the path required by `audit_worker_core_contract.md`.

---
**Version:** 2.0.0
**Last Updated:** 2026-02-15

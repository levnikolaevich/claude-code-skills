# Audit Worker Output Schema

Standard output format for all L3 audit workers in the stateful 6XX runtime.

Delivery is split between:
- JSON summary transport for coordinators
- markdown evidence reports for detailed findings

## Runtime Output Layout

Workers write markdown reports to `.hex-skills/runtime-artifacts/runs/{run_id}/audit-report/` and JSON summaries to `.hex-skills/runtime-artifacts/runs/{run_id}/audit-worker/`.

**Contracts:**
- JSON transport: `shared/references/audit_summary_contract.md`
- markdown evidence template: `shared/templates/audit_worker_report_template.md`
- runtime orchestration: `shared/references/audit_runtime_contract.md`

### Worker Return (Fallback)

When structured output cannot be preserved in-context, worker may return a compact fallback:

```
Report written: .hex-skills/runtime-artifacts/runs/{run_id}/audit-report/ln-621--global.md
Score: 7.5/10 | Issues: 5 (C:0 H:2 M:2 L:1)
```

Extended workers (ln-641, ln-643) include diagnostic sub-scores:

```
Report written: .hex-skills/runtime-artifacts/runs/{run_id}/audit-report/ln-641--job-processing.md
Score: 6.0/10 (C:72 K:85 Q:68 I:90) | Issues: 3 (H:1 M:2 L:0)
```

### All Coordinators Use Run-Scoped Runtime Artifacts

| Coordinator | Workers | Report Dir | Summary Dir |
|-------------|---------|------------|-------------|
| ln-610 (4 workers) | ln-611..ln-614 | `.hex-skills/runtime-artifacts/runs/{run_id}/audit-report/` | `.hex-skills/runtime-artifacts/runs/{run_id}/audit-worker/` |
| ln-620 (9 workers) | ln-621..ln-629 | `.hex-skills/runtime-artifacts/runs/{run_id}/audit-report/` | `.hex-skills/runtime-artifacts/runs/{run_id}/audit-worker/` |
| ln-630 (7 workers) | ln-631..ln-637 | `.hex-skills/runtime-artifacts/runs/{run_id}/audit-report/` | `.hex-skills/runtime-artifacts/runs/{run_id}/audit-worker/` |
| ln-640 (7 workers) | ln-641..ln-647 | `.hex-skills/runtime-artifacts/runs/{run_id}/audit-report/` | `.hex-skills/runtime-artifacts/runs/{run_id}/audit-worker/` |
| ln-650 (4 workers) | ln-651..ln-654 | `.hex-skills/runtime-artifacts/runs/{run_id}/audit-report/` | `.hex-skills/runtime-artifacts/runs/{run_id}/audit-worker/` |

Public history is preserved in consolidated outputs such as `docs/project/.audit/results_log.md`, not in dated worker staging folders.

## Field Descriptions

### JSON Summary Payload

See `shared/references/audit_summary_contract.md` for the canonical envelope and payload schema.

Key payload fields:

| Field | Type | Description |
|-------|------|-------------|
| `status` | string | `completed`, `skipped`, or `error` |
| `category` | string | Audit category name (for example `Security`, `Build Health`) |
| `report_path` | string | Markdown evidence report path |
| `score` | number | 0-10 scale, calculated per `audit_scoring.md` |
| `issues_total` | integer | Sum of all severity counts |
| `severity_counts` | object | Issue counts by severity |
| `warnings` | array | Transport-safe warnings for coordinator aggregation |

### Checks Array

Inside the markdown report, each check represents a discrete audit rule:

| Status | Meaning |
|--------|---------|
| `passed` | No issues found |
| `failed` | Issues found and findings emitted |
| `warning` | Minor issues or incomplete check |
| `skipped` | Check not applicable for this codebase |

### Findings Table

| Column | Required | Description |
|--------|----------|-------------|
| Severity | Yes | CRITICAL, HIGH, MEDIUM, or LOW |
| Location | Yes | File path with line number (`path:line`) |
| Issue | Yes | What is wrong |
| Principle | Yes | Which rule or principle is violated |
| Recommendation | Yes | How to fix it |
| Effort | Yes | S (`< 1h`), M (`1-4h`), L (`> 4h`) |

## Domain-Aware Worker Output

For workers that scan per-domain, keep domain metadata both in the report and in the JSON payload:

```json
{
  "status": "completed",
  "category": "Architecture & Design",
  "report_path": ".hex-skills/runtime-artifacts/runs/demo/audit-report/ln-623--users.md",
  "score": 6,
  "issues_total": 4,
  "severity_counts": {
    "critical": 1,
    "high": 2,
    "medium": 1,
    "low": 0
  },
  "warnings": [],
  "domain_name": "users",
  "scan_scope": "src/users"
}
```

## Usage in SKILL.md

Reference this file instead of duplicating worker output expectations:

```markdown
## Output Format

See `shared/references/audit_output_schema.md` and `shared/references/audit_summary_contract.md`.

Write:
- markdown report to `output_dir`
- JSON summary to `summaryArtifactPath` when present
- compact fallback text summary only if structured output cannot be preserved
```

---
**Version:** 2.0.0
**Last Updated:** 2026-02-15

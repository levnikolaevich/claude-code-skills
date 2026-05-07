<!-- SOURCE-OF-TRUTH: shared/templates/audit_worker_report_template.md. Edit ONLY here; run `node tools/marketplace/shared.mjs sync` -->

# Audit Worker Report Template

Standardized markdown format for audit workers writing evidence reports.

## Runtime Layout

Workers write markdown evidence to run-scoped runtime artifacts, while coordinators consume JSON summaries first.

**Output directory convention:**
```text
.hex-skills/runtime-artifacts/runs/{run_id}/audit-report/
```

**JSON summary convention:**
```text
.hex-skills/runtime-artifacts/runs/{run_id}/evaluation-worker/
```

Run-scoped runtime artifacts can be cleaned up after the coordinator writes the public consolidated report.

## File Naming

Choose one file naming convention per coordinator and keep it stable across workers.

Recommended patterns:
- Global worker: `{worker-id}-{slug}.md`
- Domain-aware worker: `{worker-id}-{slug}-{domain}.md`
- Worker with one analyzed object: `{worker-id}-{slug}-{item}.md`

Examples:
- `621-security.md`
- `623-principles-users.md`
- `641-pattern-job-processing.md`

## Report Structure

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
| {check_id} | {Human-Readable Name} | {passed/failed/warning/skipped} | {Brief explanation} |

## Findings

| Severity | Location | Issue | Principle | Recommendation | Effort |
|----------|----------|-------|-----------|----------------|--------|
| CRITICAL | path/file.ts:42 | What is wrong | Rule / Sub-rule | How to fix | S |
| HIGH | path/file.ts:88 | What is wrong | Rule / Sub-rule | How to fix | M |
```

## Field Reference

### AUDIT-META Block

HTML comment block parsed by the coordinator. One key-value pair per line.

| Field | Type | Description |
|-------|------|-------------|
| `worker` | string | Worker skill ID |
| `category` | string | Audit category used in the final report |
| `domain` | string | Domain name or `global` |
| `scan_path` | string | Path scanned or `.` for global |
| `score` | number | 0-10 scale per `audit_scoring.md` |
| `total_issues` | integer | Sum of all severity counts |
| `critical` | integer | CRITICAL count |
| `high` | integer | HIGH count |
| `medium` | integer | MEDIUM count |
| `low` | integer | LOW count |
| `status` | string | `completed`, `skipped`, or `error` |

### Checks Table

Matches `audit_output_schema.md` checks array. Status values: `passed`, `failed`, `warning`, `skipped`.

### Findings Table

| Column | Required | Description |
|--------|----------|-------------|
| Severity | Yes | CRITICAL, HIGH, MEDIUM, LOW |
| Location | Yes | `path/to/file.ts:42` |
| Issue | Yes | Concise problem description |
| Principle | Yes | Category / Specific Rule |
| Recommendation | Yes | Actionable fix |
| Effort | Yes | S (`<1h`), M (`1-4h`), L (`>4h`) |

## Optional Extension Blocks

Add these blocks only when the worker's local workflow requires them.

### FINDINGS-EXTENDED

Use when the coordinator needs machine-readable fields beyond the visible findings table, for example pattern signatures or cross-domain grouping keys.

```markdown
<!-- FINDINGS-EXTENDED
[{"severity":"HIGH","location":"src/users/validators/email.ts:12","issue":"Email validation duplicated","principle":"DRY","pattern_signature":"validation_email","domain":"users"}]
-->
```

### AUDIT-META: Extended Variant

Workers with diagnostic sub-scores add informational fields alongside the primary penalty-based `score`:

```markdown
<!-- AUDIT-META
worker: ln-641
category: Pattern Analysis
pattern: Job Processing
domain: global
scan_path: .
score: 6.0
score_compliance: 72
score_completeness: 85
score_quality: 68
score_implementation: 90
total_issues: 3
critical: 0
high: 1
medium: 2
low: 0
status: completed
-->
```

Any worker using this variant still uses the standard penalty-based primary score.

### DATA-EXTENDED

Use when the coordinator needs structured machine-readable payloads for cross-domain or cross-worker aggregation.

Pattern analysis:
```json
{"pattern":"Job Processing","codeReferences":["src/jobs/processor.ts","src/workers/base.ts"],"gaps":{"missingComponents":["Dead letter queue"],"inconsistencies":["Retry config exists but no backoff strategy"]},"recommendations":["Add DLQ configuration for failed jobs"]}
```

Layer boundary:
```json
{"architecture":{"type":"Layered","layers":["api","services","domain","infrastructure"]},"coverage":{"http_abstraction":75,"error_centralization":false,"transaction_boundary_consistent":false,"session_ownership_consistent":true}}
```

API contract:
```json
[{"severity":"HIGH","location":"app/services/user/service.py:23","issue":"Service accepts parsed_body","principle":"API Contract / Layer Leakage","domain":"users"}]
```

Dependency graph:
```json
{"graph_stats":{"modules_analyzed":12,"edges":34,"cycles_detected":2,"ccd":42,"nccd":1.3},"cycles":[{"type":"transitive","path":["auth","billing","notify","auth"],"severity":"CRITICAL"}],"boundary_violations":[{"rule_type":"forbidden","from":"domain","to":"infrastructure","severity":"CRITICAL"}],"sdp_violations":[{"from":"domain","to":"utils","I_from":0.2,"I_to":0.8,"severity":"HIGH"}],"metrics":{"users":{"Ca":3,"Ce":5,"I":0.625}},"baseline":{"new":3,"resolved":1,"frozen":4}}
```

Replacement analysis:
```json
{"modules_scanned":15,"modules_with_alternatives":8,"reuse_opportunity_score":6.5,"replacements":[{"module":"src/utils/email-validator.ts","lines":245,"classification":"utility","goal":"Email validation with MX checking","alternative":"zod + zod-email","confidence":"HIGH","stars":28000,"license":"MIT","license_class":"PERMISSIVE","security_status":"CLEAN","ecosystem_match":true,"feature_coverage":95,"effort":"M","migration_steps":["Install","Create schema","Replace calls","Remove module","Test"]}],"no_replacement_found":[{"module":"src/lib/domain-scorer.ts","reason":"Domain-specific business logic","classification":"domain-specific"}]}
```

Structure analysis:
```json
{"tech_stack":{"language":"typescript","framework":"react","structure":"monolith"},"dimensions":{"file_hygiene":{"checks":6,"issues":2},"ignore_files":{"checks":4,"issues":1},"framework_conventions":{"checks":3,"issues":0},"domain_organization":{"checks":3,"issues":1},"naming_conventions":{"checks":3,"issues":0}},"junk_drawers":[{"path":"src/utils","file_count":23}],"naming_dominant_case":"PascalCase","naming_violations_pct":5}
```

## Worker Return Value (Fallback)

After writing the report file, also write the JSON summary to `summaryArtifactPath` when provided, then return a compact fallback summary:

```text
Report written: .hex-skills/runtime-artifacts/runs/{run_id}/audit-report/{worker-file}.md
Score: 7.5/10 | Issues: 5 (C:0 H:2 M:2 L:1)
```

Workers with diagnostic sub-scores return:

```text
Report written: .hex-skills/runtime-artifacts/runs/{run_id}/audit-report/{worker-file}.md
Score: 6.0/10 (C:72 K:85 Q:68 I:90) | Issues: 3 (H:1 M:2 L:0)
```

## Writing Rules

- Build the entire report in memory before writing.
- If the worker fails before completion, do not write a partial file.
- Sort findings by severity: CRITICAL, HIGH, MEDIUM, LOW.

---
**Version:** 2.0.0
**Last Updated:** 2026-02-15

# Audit Worker Core Contract

Shared contract for audit workers that analyze one category, write one report file, and return a machine-readable summary to a coordinator.

## Required Inputs

Workers receive the minimum context needed to stay decision-complete:

```json
{
  "codebase_root": ".",
  "runId": "ln-620-global--ln-621--global",
  "output_dir": ".hex-skills/runtime-artifacts/runs/{run_id}/audit-report",
  "summaryArtifactPath": ".hex-skills/runtime-artifacts/runs/{run_id}/audit-worker/{worker}--{identifier}.json",
  "tech_stack": {},
  "best_practices": {},
  "principles": {},
  "domain_mode": "global|domain-aware",
  "current_domain": {
    "name": "users",
    "path": "src/users"
  },
  "scan_path": "src/users"
}
```

Rules:
- Pass only the fields the worker actually uses.
- `output_dir` is a run-scoped runtime artifact directory, not a public project docs directory.
- In managed mode, pass both `runId` and `summaryArtifactPath`.
- In standalone mode, pass neither and let the worker runtime create them.
- If `summaryArtifactPath` is present, write the worker JSON summary there per `shared/references/audit_summary_contract.md`.
- If `domain_mode="domain-aware"`, scope scanning to `scan_path` and tag findings with the domain.
- If `domain_mode="global"`, use `codebase_root` unless the skill defines a narrower scan target.

## Runtime Contract

**MANDATORY READ:** Load `shared/references/audit_worker_runtime_contract.md`.

Workers remain standalone-capable, but coordinator-invoked runs must be backed by `shared/scripts/audit-worker-runtime/cli.mjs`.

## Scoring

**MANDATORY READ:** Load `shared/references/audit_scoring.md`.

Use the shared penalty formula unless the worker adds a diagnostic score that is explicitly informational only.

## Report Contract

**MANDATORY READ:** Load `shared/templates/audit_worker_report_template.md`.

Rules:
- Build the full markdown report in memory, then write it in one call.
- Use the template's `AUDIT-META`, `Checks`, and `Findings` structure.
- Add optional blocks such as `FINDINGS-EXTENDED` or `DATA-EXTENDED` only when the worker's local workflow requires them.

## Summary Contract

**MANDATORY READ:** Load `shared/references/audit_summary_contract.md`.

Workers must produce the JSON summary envelope in both modes:
- managed mode -> write to the exact `summaryArtifactPath`
- standalone mode -> write to the canonical run-scoped path from the runtime contract

Required JSON fields:
- `schema_version`
- `summary_kind`
- `run_id`
- `identifier`
- `producer_skill`
- `produced_at`
- `payload.status`
- `payload.category`
- `payload.report_path`
- `payload.score`
- `payload.issues_total`
- `payload.severity_counts`
- `payload.warnings`

Diagnostic sub-scores never replace the primary penalty-based score.

## Generic Critical Rules

- Report only. Do not auto-fix unless the skill explicitly says otherwise.
- Use precise locations (`file:line`) for findings.
- Apply worker-specific false-positive filters before reporting.
- Keep effort estimates realistic: `S` = `<1h`, `M` = `1-4h`, `L` = `>4h`.
- If the worker uses two-layer detection, no Layer 1 match is a valid finding without Layer 2 verification.

## Generic Definition of Done

- Input parsed successfully, including `output_dir`.
- Scan scope resolved correctly (`scan_path` or equivalent).
- All worker-specific checks completed.
- Findings collected with severity, location, recommendation, and effort.
- Score calculated via the shared scoring reference.
- Report written to `{output_dir}/...` using the shared report template.
- JSON summary written to the managed or standalone runtime path.

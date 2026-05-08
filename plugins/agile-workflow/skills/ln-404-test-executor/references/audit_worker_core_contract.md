<!-- SOURCE-OF-TRUTH: shared/references/audit_worker_core_contract.md. Edit ONLY here; run `node tools/marketplace/shared.mjs sync` -->

# Audit Worker Core Contract

Compact envelope for audit workers that analyze one category, write one run-scoped report, and produce one machine-readable summary.

## Inputs

Workers receive only the fields they use:

```json
{
  "codebase_root": ".",
  "runId": "ln-620-global--ln-621--global",
  "output_dir": ".hex-skills/runtime-artifacts/runs/{run_id}/audit-report",
  "summaryArtifactPath": ".hex-skills/runtime-artifacts/runs/{run_id}/evaluation-worker/{worker}--{identifier}.json",
  "tech_stack": {},
  "best_practices": {},
  "domain_mode": "global|domain-aware",
  "current_domain": {"name": "users", "path": "src/users"},
  "scan_path": "src/users"
}
```

- `output_dir` is a run-scoped runtime artifact directory, not public docs.
- Managed mode passes `runId` and `summaryArtifactPath`; standalone mode lets the worker runtime create them.
- Domain-aware runs scan only `scan_path` and tag findings with the domain.

## Required Runtime Shape

**MANDATORY READ:** Load `references/evaluation_worker_runtime_contract.md`, `references/evaluation_summary_contract.md`, `references/audit_summary_contract.md`, `references/audit_scoring.md`, and `references/templates/audit_worker_report_template.md`.

Workers must:
- report only unless the skill explicitly allows fixes
- verify Layer 1 candidates before reporting
- use precise `file:line` locations
- apply worker-specific false-positive filters
- score with the shared audit scoring formula
- write the markdown report in one complete write
- write the evaluation-worker JSON summary to `summaryArtifactPath` or the standalone runtime path

## Summary Payload

Minimum audit payload fields:
- `payload.worker`
- `payload.status`
- `payload.operation=auditing`
- `payload.warnings`
- `payload.audit.category`
- `payload.audit.report_path`
- `payload.audit.score`
- `payload.audit.issues_total`
- `payload.audit.severity_counts`
- optional `payload.evidence_basis_counts`

Evidence basis defaults to `code_evidence` when omitted for audit findings.

## Definition of Done

- Input parsed, including `output_dir`.
- Scan scope resolved.
- Worker-specific checks completed.
- Findings include severity, location, recommendation, and effort.
- Report written under `output_dir`.
- JSON summary written through the worker runtime contract.

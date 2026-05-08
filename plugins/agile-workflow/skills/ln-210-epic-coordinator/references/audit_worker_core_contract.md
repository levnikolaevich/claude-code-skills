<!-- SOURCE-OF-TRUTH: shared/references/audit_worker_core_contract.md. Edit ONLY here; run `node tools/marketplace/shared.mjs sync` -->

# Audit Worker Core Contract

Small envelope for audit workers that analyze one category, write one run-scoped markdown report, and emit one machine-readable summary.

## Inputs

Workers receive only fields they use: `codebase_root`, `runId`, `output_dir`, `summaryArtifactPath`, `tech_stack`, `best_practices`, `domain_mode`, `current_domain`, `scan_path`.

`output_dir` is a run-scoped runtime artifact directory, not public docs. Managed mode passes `runId` and `summaryArtifactPath`; standalone mode lets the worker runtime create them. Domain-aware runs scan only `scan_path` and tag findings with the domain.

## Runtime Shape

**MANDATORY READ:** Load `references/audit_summary_contract.md`, `references/audit_scoring.md`, and `references/templates/audit_worker_report_template.md`. Load separate evaluation runtime refs only when the worker invokes that runtime directly.

Workers must report only unless fixes are explicitly allowed, verify Layer 1 candidates before reporting, use precise `file:line` locations, apply worker-specific false-positive filters, score with the shared formula, write the markdown report once under `output_dir`, and write the JSON summary to `summaryArtifactPath` or the standalone runtime path.

## Summary Payload

Minimum audit payload fields: `payload.worker`, `payload.status`, `payload.operation=auditing`, `payload.warnings`, `payload.audit.category`, `payload.audit.report_path`, `payload.audit.score`, `payload.audit.issues_total`, `payload.audit.severity_counts`, optional `payload.evidence_basis_counts`.

Evidence basis defaults to `code_evidence` when omitted for audit findings.

## Definition of Done

Input parsed; scan scope resolved; worker-specific checks completed; findings include severity, location, recommendation, and effort; report written under `output_dir`; JSON summary written through the worker runtime contract.

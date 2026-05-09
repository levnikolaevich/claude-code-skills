<!-- SOURCE-OF-TRUTH: shared/references/audit_final_report_contract.md. Edit ONLY here; run `node tools/marketplace/shared.mjs sync` -->

# Audit Final Report Contract

Runtime contract for 6XX audit coordinators that consolidate worker evidence into one durable markdown report.

## Output Ownership

Coordinator runs produce one durable markdown report:

- path: `.hex-skills/runtime-artifacts/runs/{run_id}/audit-report/{coordinator}--final-report.md`
- summary: `evaluation-coordinator.payload.report_path` points to this final report
- retention: worker markdown reports are temporary evidence inputs and must be removed after consolidation

Worker JSON summaries and runtime checkpoints remain internal transport artifacts. Do not delete them as part of markdown report cleanup.

## Required Inputs

Before writing the final report, the coordinator must:

1. read every completed worker JSON summary
2. read every worker `report_path` markdown file referenced by those summaries
3. normalize findings into a shared issue shape
4. deduplicate repeated findings across workers, domains, and report files
5. validate each actionable issue against current best-practice evidence

Use the already-loaded `evaluation_research_contract.md` for source order and actionability. For every confirmed issue, prefer official documentation or standards, then MCP Ref, Context7 when a concrete framework/library is involved, and current web research for recent best practices.

## Final Report Shape

The durable final report must include:

- Executive summary and overall verdict
- Prioritized remediation plan
- Deduplicated issue table
- Per issue: severity, affected locations, source worker(s), validated best-practice source, concrete fix steps, effort, risk, and acceptance check
- Deduplication notes for repeated findings across workers/domains
- Warnings or open questions when research or evidence is inconclusive
- Cleanup note listing removed temporary worker markdown report paths

## Cleanup Rules

After the final report is written:

- delete every temporary worker markdown report under the run's `audit-report/` directory
- keep the final coordinator report
- keep JSON summaries, checkpoints, manifests, and logs
- checkpoint cleanup evidence with `cleanup_verified=true`

If a worker report cannot be removed, keep the run incomplete and record the path plus reason in warnings.

## Definition of Done

Final report written; coordinator summary points to final report; worker markdown reports removed; JSON transport artifacts retained; cleanup evidence recorded.

**Version:** 1.0.0
**Last Updated:** 2026-05-09

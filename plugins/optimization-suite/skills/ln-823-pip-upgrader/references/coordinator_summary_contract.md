<!-- SOURCE-OF-TRUTH: shared/references/coordinator_summary_contract.md. Edit ONLY here; run `node tools/marketplace/shared.mjs sync` -->

# Coordinator Summary Contract

Runtime summary envelope shared by coordinators and workers. Domain-specific fields live in the family runtime or summary contract loaded by the active skill.

## General Rules

- Write summaries only under the active run output directory or the explicit summary path provided by the caller.
- Never write summary artifacts outside `.hex-skills/runtime-artifacts/` unless the skill contract names another path.
- Use the shared envelope below for cross-skill routing; add family fields from the active runtime contract.
- If a domain contract conflicts with this file, this envelope remains required and the domain contract owns its specialized fields.

### Output Path Guard

Before writing a summary, resolve the target path and verify it is under the intended run directory. Reject absolute or traversal paths from user input.

## Shared Envelope

Required fields for every coordinator or worker summary:

```json
{
  "schema_version": "1.0",
  "run_id": "string",
  "skill": "string",
  "status": "completed|partial|failed|skipped",
  "summary_type": "string",
  "artifacts": [],
  "findings": [],
  "next_actions": []
}
```

## Domain Contract Routing

| Family | Load domain contract |
| --- | --- |
| Agile planning and execution | Family runtime contract plus matching summary contract when present |
| Evaluation and review | Evaluation coordinator, worker, research, and summary contracts |
| Documentation pipeline | Docs runtime and docs generation summary contracts |
| Optimization | Optimization, dependency, modernization, or benchmark runtime contracts |
| Setup environment and VPS | Environment runtime contracts plus the VPS runtime contract |
| Codebase audit | Audit worker, scoring, output, and summary contracts |

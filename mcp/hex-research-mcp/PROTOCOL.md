# hex-research-mcp Protocol

## Wire Format

Every tool returns structured-first MCP output:

```json
{
  "content": [{ "type": "text", "text": "{\"status\":\"OK\"}" }],
  "structuredContent": { "status": "OK" }
}
```

`content[0].text` is always `JSON.stringify(structuredContent)`.

`index_hypotheses` returns `isError: true` for `INVALID`, `UNSUPPORTED`, and `ERROR`. `verify_index` may return diagnostic `INVALID` without `isError`.

## Statuses

- `OK`: request completed with usable results.
- `CHANGED`: request wrote an artifact.
- `NO_CHANGES`: request completed without changes.
- `STALE`: request completed and found drift or stale graph state.
- `INVALID`: inputs were parsed but violate the researchgraph contract.
- `UNSUPPORTED`: request cannot run in the current project state.
- `ERROR`: unexpected tool failure.

## Warning Codes

Wire values for `reason` and `warnings[].code` are lowercase snake_case. Uppercase labels may be used only as prose mnemonics in documentation.

Common warning codes:

- `missing_required_field`
- `invalid_field`
- `frontmatter_validation_failed`
- `implementation_gap`
- `status_verdict_drift`
- `task_drift`
- `task_status_stale`
- `missing_goal`
- `no_comprehensive_run_for_goal`

## Selectors

Hypotheses and goals can be selected by canonical id:

```json
{ "id": "H01" }
{ "id": "G1" }
```

Inspection tools also accept `claim_substring` as a fallback selector when an id is unknown.

## Lifecycle Invariants

- `pending_implementation` requires at least one `implementation` task with `state` equal to `open` or `in_progress`.
- `live` requires at least one done `implementation` task and no open or in-progress task.
- `in_progress` plus `last_verdict.decision: refine` requires at least one `refinement` task with `state` equal to `open` or `in_progress`.
- `in_progress` plus `last_verdict.decision` equal to `proceed`, `reject`, or `hold` reports `status_verdict_drift`.
- `validated_branch` plus `last_verdict.decision` equal to `proceed`, `refine`, `reject`, or `hold` reports `status_verdict_drift`.
- `status_snapshot.at` is never defaulted to current time. If it is omitted, `created_at` is used; if both are omitted, `missing_required_field` is reported.

## Run Manifests

Targeted run:

```yaml
id: R-target-h01
type: targeted
hypothesis: H01
goals: [G1]
results_path: results.json
```

Comprehensive run:

```yaml
id: R-comprehensive-g1
type: comprehensive
comprehensive: true
hypothesis: null
goals: [G1]
included_hypotheses: [H01]
results_path: results.json
```

`runner_environment` is stored as opaque manifest metadata. The MCP runtime does not depend on a benchmark runner or Python.

## Human Rendering

Clients can render `summary` first, then show bounded arrays such as `hypotheses`, `issues`, `runs`, or `edges`. Heavy tools provide `follow_ups` instead of dumping the full graph.


## Quality Snapshot

Release readiness: Server MVP verified on deterministic fixtures with npm packaging enabled. btc-trader migration, Phase 7 pull-up, and skill packaging remain out of scope for this snapshot.

| Metric | Value |
|---|---:|
| MCP tools covered | 16/16 |
| Eval scenarios | 16 |
| Benchmark workflows | 5 |
| Avg estimated benchmark savings | 78.2% |

Methodology: evals call every registered tool against test/fixtures/project with deterministic assertions and structuredContent/text mirror checks. Benchmark token counts are rough ceil(chars / 4) estimates, not production tokenizer measurements.

| Tool | Risk | Eval | Test source |
|---|---|---|---|
| index_hypotheses | high | verified | test/indexing.mjs |
| verify_index | medium | verified | test/schema-contract.mjs |
| find_hypotheses | low | verified | test/tools.mjs |
| inspect_hypothesis | low | verified | test/tools.mjs |
| find_evidence | low | verified | test/tools.mjs |
| find_runs | low | verified | test/tools.mjs |
| trace_lineage | medium | verified | test/tools.mjs |
| analyze_topology | low | verified | evals/index.mjs |
| audit_orphans | medium | verified | test/audit.mjs |
| analyze_progress | low | verified | evals/index.mjs |
| analyze_proposed | medium | verified | evals/index.mjs |
| inspect_goal | low | verified | test/tools.mjs |
| trace_goal_tree | medium | verified | test/tools.mjs |
| audit_goal_alignment | medium | verified | test/audit.mjs |
| export_canvas | high | verified | test/export.mjs |
| export_research_map | high | verified | test/export.mjs |

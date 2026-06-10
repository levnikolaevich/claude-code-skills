# hex-research-mcp

Markdown-first MCP server for indexing research hypotheses, goals, tasks, sources, and benchmark run manifests into a SQLite research graph.

[![npm](https://img.shields.io/npm/v/@levnikolaevich/hex-research-mcp)](https://www.npmjs.com/package/@levnikolaevich/hex-research-mcp)
[![downloads](https://img.shields.io/npm/dm/@levnikolaevich/hex-research-mcp)](https://www.npmjs.com/package/@levnikolaevich/hex-research-mcp)
[![license](https://img.shields.io/npm/l/@levnikolaevich/hex-research-mcp)](./LICENSE)
![node](https://img.shields.io/node/v/@levnikolaevich/hex-research-mcp)

## Install

```powershell
claude mcp add -s user hex-research -- npx -y @levnikolaevich/hex-research-mcp
```

## Local Use

```powershell
npm --prefix mcp install
npm --prefix mcp --workspace @levnikolaevich/hex-research-mcp run build
node mcp/hex-research-mcp/server.mjs
```

The server indexes a target project root with this layout:

```text
docs/hypotheses/*.md
docs/goals/*.md
docs/sources/lib.yaml
benchmark/runs/*/manifest.yaml
```

The SQLite index is written to:

```text
.hex-skills/researchgraph/index.db
```

## Tools

- `index_hypotheses`: rebuild the SQLite index.
- `verify_index`: validate frontmatter and manifests without rebuilding.
- `find_hypotheses`: search hypotheses by status, goal, task state, source, priority, or claim.
- `inspect_hypothesis`: inspect one hypothesis and its linked graph data.
- `find_evidence`: search evidence entries and cited sources.
- `find_runs`: search targeted and explicit comprehensive benchmark runs.
- `trace_lineage`: trace hypothesis lineage and dependency edges.
- `analyze_topology`: summarize node/edge counts and hubs.
- `audit_orphans`: report orphan, stale, evidence, source, task, and goal-run gaps.
- `inspect_goal`: inspect one goal and linked hypotheses.
- `trace_goal_tree`: trace goal decomposition.
- `audit_goal_alignment`: audit hypothesis-goal coverage, explicit comprehensive-run metrics, and coverage candidates.
- `analyze_progress`: inspect changed research files and field-level frontmatter deltas from git diff.
- `analyze_proposed`: check readiness gaps for one hypothesis.
- `export_canvas`: export a JSON Canvas graph.
- `export_research_map`: generate `docs/research-map.md` from canonical split files.

## Validation and Sources

Goal `metrics_current` is derived during indexing from explicit comprehensive run manifests. Do not write `metrics_current`, `children`, or `achievement_status` in goal frontmatter; `verify_index` reports those as source drift.

Projects may deduplicate citations in `docs/sources/lib.yaml`:

```yaml
sources:
  carver-2015-systematic-trading:
    type: book
    title: Systematic Trading
    isbn: "9780857194459"
    year: 2015
```

Hypotheses and goals can then cite by id:

```yaml
sources:
  - id: carver-2015-systematic-trading
    pages: "12-14"
```

Use the validator in Git hooks or CI:

```powershell
npx -y --package @levnikolaevich/hex-research-mcp hex-research-validate --strict --path .
```

Example `.pre-commit-config.yaml`:

```yaml
repos:
  - repo: local
    hooks:
      - id: hex-research-validate
        name: hex research graph validation
        entry: npx -y --package @levnikolaevich/hex-research-mcp hex-research-validate --strict --path .
        language: system
        pass_filenames: false
```

## Fixture Example

```powershell
npm --prefix mcp --workspace @levnikolaevich/hex-research-mcp test
npm --prefix mcp --workspace @levnikolaevich/hex-research-mcp run evals
npm --prefix mcp --workspace @levnikolaevich/hex-research-mcp run benchmark
npm --prefix mcp --workspace @levnikolaevich/hex-research-mcp run docs:quality:check
```

The test fixture covers live, pending implementation, valid refine, refine gap, status-verdict drift, comprehensive runs, targeted runs, cited sources, and opaque `runner_environment` manifest metadata.

<!-- HEX_RESEARCH_QUALITY_START -->
## Quality Snapshot

Release readiness: Server MVP verified on deterministic fixtures with npm packaging enabled. btc-trader migration, Phase 7 pull-up, and skill packaging remain out of scope for this snapshot.

| Metric | Value |
|---|---:|
| MCP tools covered | 16/16 |
| Eval scenarios | 16 |
| Benchmark workflows | 5 |
| Avg estimated benchmark savings | 76.2% |

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
<!-- HEX_RESEARCH_QUALITY_END -->

## Goal-Directed Workflow

1. Run `verify_index` before changing research files.
2. Run `index_hypotheses` after edits.
3. Use `audit_goal_alignment` to find active goals without live hypotheses or comprehensive metrics.
4. Use `find_hypotheses` and `inspect_hypothesis` for scoped execution.
5. Use `analyze_progress` for field-level frontmatter deltas in current git diff.
6. Use `export_canvas` or `export_research_map` with `dry_run: true` before writing generated graph artifacts.

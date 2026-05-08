# hex-research-mcp

Local MCP server for indexing research hypotheses, goals, tasks, sources, and benchmark run manifests into a SQLite research graph.

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
- `find_runs`: search targeted and comprehensive benchmark runs.
- `trace_lineage`: trace hypothesis lineage and dependency edges.
- `analyze_topology`: summarize node/edge counts and hubs.
- `audit_orphans`: report orphan, stale, evidence, source, task, and goal-run gaps.
- `inspect_goal`: inspect one goal and linked hypotheses.
- `trace_goal_tree`: trace goal decomposition.
- `audit_goal_alignment`: audit hypothesis-goal coverage and comprehensive-run metrics.
- `analyze_progress`: inspect changed research files from git diff.
- `analyze_proposed`: check readiness gaps for one hypothesis.
- `export_canvas`: export a JSON Canvas graph.

## Fixture Example

```powershell
npm --prefix mcp --workspace @levnikolaevich/hex-research-mcp test
```

The test fixture covers live, pending implementation, valid refine, refine gap, status-verdict drift, comprehensive runs, targeted runs, cited sources, and opaque `runner_environment` manifest metadata.

## Goal-Directed Workflow

1. Run `verify_index` before changing research files.
2. Run `index_hypotheses` after edits.
3. Use `audit_goal_alignment` to find active goals without live hypotheses or comprehensive metrics.
4. Use `find_hypotheses` and `inspect_hypothesis` for scoped execution.
5. Use `export_canvas` with `dry_run: true` before writing a graph canvas.


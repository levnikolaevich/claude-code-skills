# hex-graph-mcp

Deterministic layered code graph MCP server. Indexes codebases into a SQLite graph via tree-sitter AST parsing, canonical symbol identities, semantic edges, precise overlays, framework-aware overlays, and hash-based incrementality.

[![npm](https://img.shields.io/npm/v/@levnikolaevich/hex-graph-mcp)](https://www.npmjs.com/package/@levnikolaevich/hex-graph-mcp)
[![downloads](https://img.shields.io/npm/dm/@levnikolaevich/hex-graph-mcp)](https://www.npmjs.com/package/@levnikolaevich/hex-graph-mcp)
[![license](https://img.shields.io/npm/l/@levnikolaevich/hex-graph-mcp)](./LICENSE)
![node](https://img.shields.io/node/v/@levnikolaevich/hex-graph-mcp)

### 14 MCP Tools

`hex-graph-mcp` now exposes a use-case-first contract instead of every internal primitive. The public surface is split into setup, symbol navigation, review/edit analysis, architecture/maintenance, and interop.

| Domain | Tool | Use Case |
|------|------|----------|
| Setup | `index_project` | Build or refresh the graph index |
| Setup | `install_graph_providers` | Detect or install graph-specific providers and SCIP exporters |
| Symbol | `find_symbols` | Discover candidate symbols by name |
| Symbol | `inspect_symbol` | Get canonical resolution plus symbol context |
| Symbol | `find_references` | See semantic usages and framework wiring |
| Symbol | `find_implementations` | See overrides, extends, and implements relations |
| Symbol | `trace_paths` | Follow dependency and blast-radius paths |
| Flow | `trace_dataflow` | Follow deterministic source-to-sink propagation |
| Review | `analyze_changes` | Review PR / commit / worktree semantic risk |
| Review | `analyze_edit_region` | Evaluate what a concrete file range change affects |
| Architecture | `analyze_architecture` | Summarize modules, cycles, coupling, and framework surfaces |
| Maintenance | `audit_workspace` | Find unused exports, hotspots, and clone groups |
| Interop | `export_scip` | Export the graph to a `.scip` artifact |
| Interop | `import_scip_overlay` | Import a `.scip` artifact as overlay evidence |

## Install

```bash
npm i -g @levnikolaevich/hex-graph-mcp
claude mcp add -s user hex-graph -- hex-graph-mcp
```

Or add to `.claude/settings.json` directly:

```json
{
  "mcpServers": {
    "hex-graph": {
      "command": "node",
      "args": ["path/to/mcp/hex-graph-mcp/server.mjs"]
    }
  }
}
```

## Tools Reference

All symbol-oriented tools use canonical selectors. Pass exactly one of:

- `symbol_id`
- `workspace_qualified_name`
- `qualified_name`
- `name` + `file`

Plain `name` on its own belongs in `find_symbols`. Ambiguous semantic selectors return `AMBIGUOUS_SYMBOL` instead of silently choosing the first match.

All symbol/query tools also require `path` as the project anchor. Pass the indexed project root, or a file/subdirectory inside that indexed project. Agents should auto-fill it from the active project; the server does not fall back to another open store or another repository when `path` is missing or ambiguous.

`find_symbols` is name-oriented discovery, not free-form code search. If the input looks like `export function`, `server.tool()`, `app.get(...)`, or another raw code fragment, use `grep_search` or a framework-aware graph query instead.

All public responses now use the same top-level shape:

- `status`
- `query`
- `summary`
- `reason`
- `result`
- `quality` when language/framework support matters
- `warnings`
- `next_actions`

`next_action` / `next_actions` use short canonical labels, not English sentences. Typical values:

- `inspect_symbol`
- `find_references`
- `find_implementations`
- `trace_paths`
- `trace_dataflow`
- `analyze_changes`
- `audit_workspace`
- `analyze_edit_region`
- `index_project`
- `widen_query`
- `widen_range`
- `review_deleted_api`
- `review_duplicates`

Errors use a compact top-level shape:

- `status: "ERROR"`
- `code`
- `summary`
- `next_action`
- `recovery`

### Setup

| Tool | What it returns |
|------|-----------------|
| `index_project` | Index summary, languages, providers, framework overlays, warnings, and next actions |
| `install_graph_providers` | Detected stack, provider status, SCIP exporter status, install plan, remediation steps, and agent-ready instructions |

### Symbol Navigation

| Tool | Best for | Key result sections |
|------|----------|---------------------|
| `find_symbols` | Discovery before you know the exact identity | `candidates`, `disambiguation_hints` |
| `inspect_symbol` | One-stop symbol briefing | `symbol`, `resolution`, `context`, `references_summary`, `implementations_summary`, `framework_roles` |
| `find_references` | All semantic usages of one symbol | `references`, `total_by_kind`, framework wiring, inline `quality` |
| `find_implementations` | Override / implementation search | `implementations`, `summary`, `next_actions` |
| `trace_paths` | Blast radius and dependency paths from a concrete symbol | `paths`, `summary`, `warnings`, inline `quality` |
| `trace_dataflow` | Source-to-sink propagation | `flows`, `anchors`, `summary` |

### Review and Editing

| Tool | Best for | Key result sections |
|------|----------|---------------------|
| `analyze_changes` | PR / commit / worktree review | `diff_summary`, `changed_files`, `changed_symbols`, `high_risk_items`, `deleted_api_warnings` |
| `analyze_edit_region` | What a file range edit affects | `edited_symbols`, `impact_summary`, `external_callers`, `downstream_flow`, `clone_siblings`, `similar_symbols`, `duplicate_risk`, `public_api_risk`, `framework_entrypoint_risk` |

### Architecture and Maintenance

| Tool | Best for | Key result sections |
|------|----------|---------------------|
| `analyze_architecture` | Workspace overview | `workspace_summary`, `modules`, `module_boundaries`, `cycles`, `coupling`, `framework_surfaces`, `top_risks` |
| `audit_workspace` | Cleanup / maintainability review | `unused_exports`, `uncertain_unused_exports`, `hotspots`, `clones`, `risk_summary`, `suppressed_items` |

### Interop

| Tool | Best for | Key result sections |
|------|----------|---------------------|
| `export_scip` | Send graph facts to external tooling | `artifact`, `language`, `documents`, `symbols`, `relationships`, `warnings` |
| `import_scip_overlay` | Merge external SCIP evidence without replacing the native graph | `documents_processed`, `mapped_symbols`, `imported_edges`, `skipped_documents`, `warnings` |

### Architectural Notes

- Stage 2 precise overlay is additive: parser/workspace facts stay canonical; stronger provider facts use `confidence: "precise"`.
- Stage 4 framework overlay is additive: framework-created facts keep explicit `origin` and structured evidence; mixed traces and review/audit tools consume that evidence.
- Stage 5 quality is artifact-driven: `test/` is correctness, `evals/` is capability/status, `benchmark/` is workflow efficiency only.
- Stage 6 SCIP interop is adapter-only: native SQLite storage stays canonical; imported facts use `origin: "scip_import"` and do not replace native flow semantics.

## Supported Languages

| Language | Extensions | Definitions & Calls | Exports | Imports (structured) | Type Layer | Framework Overlay | `audit_workspace` |
|----------|-----------|---------------------|---------|---------------------|-----------|-------------------|------------------------|
| JavaScript | .js .mjs .cjs .jsx | Full | ESM named/default/reexport | Full (relative, workspace package, alias, default, namespace) | Basic explicit syntax | React JSX renders, Express routes/middleware | Proven unused + uncertain split + framework suppression |
| TypeScript | .ts .tsx | Full | ESM named/default/reexport | Full (relative, workspace package, alias, default, namespace) | Basic explicit syntax | React JSX renders, Next.js App Router, Express, NestJS | Proven unused + uncertain split + framework suppression |
| Python | .py | Full | `__all__` or underscore convention | Workspace-aware absolute + relative imports | Basic explicit syntax | Django urls/middleware, FastAPI routes/Depends/middleware, Flask routes/hooks | Proven unused + uncertain split + framework suppression |
| C# | .cs | Full | `public` access modifier | Project/namespace ownership + references | Basic explicit syntax | ASP.NET Core MVC routes, minimal APIs, DI, middleware | Proven unused + uncertain split + framework suppression |
| PHP | .php | Full | Top-level + `public` methods | PSR-4 namespace resolution | Basic explicit syntax | Laravel routes, route middleware, container bindings | Proven unused + uncertain split + framework suppression |

**Note:** Architecture, cycle detection, and coupling reports are workspace-first. File-level edges remain raw evidence in the graph, but module/package ownership is the primary reporting layer.

```
hex-graph-mcp/
  server.mjs          MCP server (stdio transport)
  package.json
  lib/
    indexer.mjs       Shared indexing pipeline
    framework.mjs     Framework-aware overlay extraction
    parser.mjs        Tree-sitter parsing and language extraction
    scip/             Optional Stage 6 SCIP import/export adapter layer
    store.mjs         SQLite graph storage and query layer
    watcher.mjs       Chokidar-based incremental updates
    clones.mjs        Clone detection engine
    cycles.mjs        Module cycle detection
    unused.mjs        Unused export analysis
```

### Storage

- **SQLite** via `better-sqlite3`
- **Query lifecycle** uses readonly query stores that auto-close after a short idle window
- **Write lifecycle** opens writable stores only for `index_project`, reindex, and SCIP import work, then checkpoints and closes them
- **Lock behavior** on Windows is therefore normally caused by another live `hex-graph-mcp` / editor session for the same project, not by cross-project reuse
- **Nodes** for symbols, module pseudo-nodes, and synthetic framework entrypoints
- **Edges** as the semantic source of truth across syntax, symbol, module, type, flow, precise, and framework layers
- **FTS5** for symbol discovery
- **Hashes** for incremental invalidation and clone analysis

### Parsing

- **tree-sitter WASM** via `web-tree-sitter` and repo-owned grammar artifacts from `hex-common/artifacts/tree-sitter`
- Extracts definitions, imports, exports, calls, references, and explicit inheritance syntax
- Feeds a shared pipeline used by both full indexing and watcher-driven reindexing

### File Watching

- **Chokidar** for cross-platform file system events
- Full index and incremental updates share the same indexing pipeline
- On file delete: associated graph state is removed and overlays are rebuilt as needed

## Use Cases

| Scenario | Tool | Example |
|----------|------|---------|
| Find candidate symbols | `find_symbols` | `path: "/project", query: "handleAuth"` |
| Search raw method-call pattern like `server.tool(...)` | `grep_search` | `path: "/project", pattern: "server\\.tool\\("` |
| Inspect one exact symbol | `inspect_symbol` | `path: "/project", name: "UserService", file: "src/services/user.ts"` |
| Find semantic usages of one symbol | `find_references` | `path: "/project", workspace_qualified_name: "...", kind: "all"` |
| Find implementations / overrides | `find_implementations` | `path: "/project", workspace_qualified_name: "..."` |
| Trace callers, callees, and framework edges | `trace_paths` | `path: "/project", workspace_qualified_name: "...", path_kind: "mixed"` |
| Follow source-to-sink propagation | `trace_dataflow` | `path: "/project", source: { symbol: ..., anchor: ... }` |
| Review a PR or worktree diff | `analyze_changes` | `base_ref: "origin/main"` |
| Evaluate a planned edit in one file range | `analyze_edit_region` | `file: "src/auth.ts", line_start: 40, line_end: 78` |
| Inspect architecture and coupling | `analyze_architecture` | First high-level call after `index_project` |
| Audit cleanup and duplicate risk | `audit_workspace` | `scope: "src/"` |
| Repair graph environment before indexing/export | `install_graph_providers` | `path: "/project", mode: "check"` |

## Quality System

`hex-graph-mcp` keeps the quality pipeline internal and artifact-driven:

- `test/` handles correctness and regressions
- `evals/` stores generated capability matrices, targets, and quality reports
- `benchmark/` tracks workflow efficiency against built-in approaches
- runtime tools expose compact inline `quality` metadata where support/coverage matters

Inline `quality` metadata is currently surfaced by:

- `inspect_symbol`
- `find_references`
- `trace_paths`
- `analyze_changes`
- `analyze_edit_region`
- `analyze_architecture`
- `audit_workspace`

<!-- GENERATED:HEX_GRAPH_MCP_QUALITY:START -->
### Generated Snapshot

- MCP tools registered in server contract: `14`
- Semantic suite: `90/90` passing
- Corpora: `1` curated, `1` pinned external
- Lanes: parser-first `green`, precise overlay `provider_conditional`

| Query Family | JS | TS | PY | PHP | C# | Framework overlays |
|--------------|----|----|----|-----|----|--------------------|
| `find_references` | verified | verified | verified | verified | verified | 9 supported |
| `trace_paths` | verified | verified | supported | supported | supported | n/a |
| `audit_workspace` | verified | verified | verified | supported | supported | n/a |
| `analyze_architecture` | verified | verified | supported | supported | supported | n/a |

Public targets:
- Parser-first semantic fixtures: `100%`
- Parser-first steady-state query p50: `<=200ms`
- Precise-overlay incremental reindex p50: `<=2s`
- Workflow token savings target: `>=50%`

Workflow baseline (`benchmark/workflow-summary.json`):

| ID | Workflow | Built-in | hex-graph | Savings | Ops | Steps |
|----|----------|---------:|----------:|--------:|----:|------:|
| W1 | Explore unfamiliar MCP before refactor | 144,687 chars | 117,320 chars | 19% | 12->3 | 12->3 |
| W2 | Estimate blast radius before refactor | 192,510 chars | 157,609 chars | 18% | 7->3 | 5->3 |
| W3 | Audit cycles, dead exports, hotspots | 61,754 chars | 4,184 chars | 93% | 22->4 | 22->4 |
| W4 | Review PR semantic risk snapshot | 4,221 chars | 1,518 chars | 64% | 4->1 | 4->1 |

Workflow summary: `49%` average token savings, `45->11` ops, `43->11` steps.
<!-- GENERATED:HEX_GRAPH_MCP_QUALITY:END -->

Run the artifact snapshot locally:

```bash
npm run evals
```

Sync the generated README regions from those artifacts:

```bash
npm run docs:quality
```

Fail verification if docs drift from the artifacts:

```bash
npm run docs:quality:check
```

Public benchmark mode reports only comparative workflow scenarios:

```bash
npm run benchmark -- --repo /path/to/repo
```

Optional diagnostics stay available separately:

```bash
npm run benchmark:diagnostic -- --repo /path/to/repo
```

The workflow benchmark focuses on graph-native developer tasks derived from recent real sessions:

- exploring an unfamiliar MCP before refactoring
- estimating semantic blast radius before a risky change
- auditing cycles, dead exports, hotspots, and module metrics
- reviewing PR risk through references and trace paths

Atomic query comparisons and index-cost output still live under `benchmark/`, but they are diagnostics only and should not be used as headline benchmark claims.

## Dependencies

| Package | Purpose |
|---------|---------|
| `@modelcontextprotocol/sdk` | MCP protocol implementation |
| `better-sqlite3` | SQLite storage engine |
| `web-tree-sitter` + first-party grammar artifacts | AST parsing |
| `chokidar` | File system watcher |
| `picomatch` | Scope/glob matching |
| `zod` | Input schema validation |

Requires Node.js >= 20.19.0.

## FAQ

<details>
<summary><b>How large a codebase can it handle?</b></summary>

It is designed for local-to-mid-sized repositories and monorepo slices where deterministic indexing and fast requery matter more than cloud-scale storage. Incremental updates are hash-aware and avoid full reindex when possible.

</details>

<details>
<summary><b>Does it support monorepos?</b></summary>

Yes. Point `index_project` at the monorepo root or at a package subtree. Use `analyze_architecture` with `scope` filters to focus analysis. In JavaScript and TypeScript, workspace module grouping follows the nearest `package.json`, so a single-package repo can appear as one workspace module. Use symbol-level traces or manual search when you need finer intra-package structure.

</details>

<details>
<summary><b>Where is the database stored?</b></summary>

The graph database is stored under the indexed project at `.hex-skills/codegraph/index.db`. It is rebuildable cache state and should not be committed.

</details>

## Hex Family

| Package | Purpose | npm |
|---------|---------|-----|
| [hex-line-mcp](https://www.npmjs.com/package/@levnikolaevich/hex-line-mcp) | Local file editing with hash verification + hooks | [![npm](https://img.shields.io/npm/v/@levnikolaevich/hex-line-mcp)](https://www.npmjs.com/package/@levnikolaevich/hex-line-mcp) |
| [hex-ssh-mcp](https://www.npmjs.com/package/@levnikolaevich/hex-ssh-mcp) | Remote file editing over SSH | [![npm](https://img.shields.io/npm/v/@levnikolaevich/hex-ssh-mcp)](https://www.npmjs.com/package/@levnikolaevich/hex-ssh-mcp) |
| [hex-graph-mcp](https://www.npmjs.com/package/@levnikolaevich/hex-graph-mcp) | Layered code graph with AST indexing, framework-aware references, clones, and architecture analysis | [![npm](https://img.shields.io/npm/v/@levnikolaevich/hex-graph-mcp)](https://www.npmjs.com/package/@levnikolaevich/hex-graph-mcp) |

## License

MIT

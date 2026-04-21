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

`find_symbols` is also intentionally compact for overloaded names. The default detailed slice is `8`; when more candidates exist, the action-line reports `partial ... total=N returned=M truncated=1` and the body carries warning/detail rows so the next call narrows with `path`, `name + file`, or `workspace_qualified_name`.

Heavy tools use summary-first output. They return counts, bounded previews, provenance sections, quality metadata, and executable `>` follow-up pointers first, so the client sees upfront how much a deeper expansion will return and which layer the current answer comes from. Use `expand`, `expand_limit`, `limit`, `clone_member_limit`, `depth`, `max_hops`, `kind`, and `min_confidence` to request a bounded deeper slice instead of dumping the whole graph in one call.

All responses use the text-only grammar defined in [`PROTOCOL.md`](PROTOCOL.md). The MCP envelope carries a single `content[0].text` string; there is **no** `structuredContent` mirror and **no** `outputSchema` declaration. Line 1 is the action-line:

    <status> <next_action> [key=val ...]

Body lines use single-char prefixes:

- `#section-name kv=v kv=v` — section header (e.g. `#evidence tier_1=5 tier_2=3`, `#location src/a.ts:42-58 exported=1 kind=function`, `#refs total=8`, `#flow in=2 out=3`, `#summary unused=2 hotspots=1 clone_groups=3`).
- `.name file:line kv=v` — primary entry (symbol, ref, impl, clone member). Path rows use `.A->B->C file:line depth=N`.
- `>mcp__hex-graph__<tool> k=v ...` — executable follow-up pointer. Paste the literal string into the next tool call.
- `!code=... !message=... !reason=... !warning=...` — error and advisory details.
- `?hint=...` — verbosity=full only.

Example `find_references` response:

    ok keep_using total=8 conf=exact
    #evidence precise_provider=5 parser_or_workspace=3
    .ref src/a.ts:42 kind=calls conf=exact origin=typescript
    .ref src/b.ts:18 kind=calls conf=medium origin=parser
    >mcp__hex-graph__find_references path=/tmp/project symbol_id=42 expand=references expand_limit=10

Example `audit_workspace` (clone members are flat rows, not an indent tree):

    ok review_duplicates path=/tmp/project
    #summary unused=2 hotspots=1 clone_groups=1
    .clone_group id=g1 type=normalized members=12 shown=3 impact=medium
    .clone_member group=g1 file=src/foo.ts lines=42-58 name=foo callers=3
    .clone_member group=g1 file=src/bar.ts lines=70-86 name=bar callers=1
    .clone_member group=g1 file=src/baz.ts lines=21-37 name=baz callers=1
    .clone_members_more group=g1 omitted=9

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

Errors use the same grammar, not a JSON error envelope:

    error fix_path path=/tmp/project
    !code=PATH_NOT_FOUND
    !message=/tmp/project does not exist

### Setup

| Tool | What it returns |
|------|-----------------|
| `index_project` | Gitignore-aware index summary, languages, providers, framework overlays, warnings, and next actions |
| `install_graph_providers` | Detected stack, provider status, SCIP exporter status, install plan, remediation steps, and agent-ready instructions |

### Symbol Navigation

| Tool | Best for | Key result sections |
|------|----------|---------------------|
| `find_symbols` | Discovery before you know the exact identity | action-line counts, `.symbol` rows, `!warning` overflow groups, `>` inspect pointers |
| `inspect_symbol` | One-stop symbol briefing | `#location`, `#refs`, `#flow`, `.ref` rows, `>expansion` pointers |
| `find_references` | All semantic usages of one symbol | `#evidence`, `.ref` rows, `>mcp__hex-graph__find_references` pointer, `#quality` in full output |
| `find_implementations` | Override / implementation search | `#evidence`, `.impl` rows, `>mcp__hex-graph__find_implementations` pointer |
| `trace_paths` | Blast radius and dependency paths from a concrete symbol | `.A->B->C` path rows, `#provenance`, `>mcp__hex-graph__trace_paths` pointer, `#quality` in full output |
| `trace_dataflow` | Source-to-sink propagation | `.A->B->C kind=...` rows, `#provenance`, `>mcp__hex-graph__trace_dataflow` pointer |

### Review and Editing

| Tool | Best for | Key result sections |
|------|----------|---------------------|
| `analyze_changes` | PR / commit / worktree review | `#summary`, `.changed_symbol`, `.deleted_api`, `#quality`, `>` review pointers |
| `analyze_edit_region` | What a file range edit affects | `#summary`, `.edited_symbol`, `.caller`, `.flow`, `.clone`, `.similar`, `!warning` risk details |

### Architecture and Maintenance

| Tool | Best for | Key result sections |
|------|----------|---------------------|
| `analyze_architecture` | Workspace overview | `#summary`, `.module`, `.cycle`, `.coupling`, `.framework`, `.risk` |
| `audit_workspace` | Cleanup / maintainability review | `#summary`, bounded `.unused`, `.hotspot`, `.clone_group`, `.clone_member`, `.clone_members_more`, `!warning` suppressed/uncertain items |

### Interop

| Tool | Best for | Key result sections |
|------|----------|---------------------|
| `export_scip` | Send graph facts to external tooling | `#summary`, `.artifact`, `!warning` exporter gaps |
| `import_scip_overlay` | Merge external SCIP evidence without replacing the native graph | `#summary`, `.mapped_symbol`, `.imported_edge`, `!warning` skipped documents |

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

- File discovery honors Git excludes by default. Git repositories use `git ls-files -co --exclude-standard`; non-Git directories use the deterministic fallback walker with root `.gitignore` rules and generated-directory exclusions.
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
| Find candidate symbols | `find_symbols` | `path: "/project/src/auth", query: "handleAuth"` |
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
- Semantic suite: `103/103` passing
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
- Summary-first default preview: `<=5 rows`
- Resolution/provenance surface coverage: `100% / 100%`

Workflow baseline (`benchmark/workflow-summary.json`):

| ID | Workflow | Built-in | hex-graph | Savings | Ops | Steps |
|----|----------|---------:|----------:|--------:|----:|------:|
| W1 | Explore unfamiliar MCP before refactor | 153,580 chars | 609 chars | 100% | 12->3 | 12->3 |
| W2 | Estimate blast radius before refactor | 166,672 chars | 609 chars | 100% | 7->3 | 5->3 |
| W3 | Audit cycles, dead exports, hotspots | 175,063 chars | 7,196 chars | 96% | 22->4 | 22->4 |
| W4 | Review PR semantic risk snapshot | 72,053 chars | 23,504 chars | 67% | 4->1 | 4->1 |

Workflow summary: `91%` average token savings, `45->11` ops, `43->11` steps.
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

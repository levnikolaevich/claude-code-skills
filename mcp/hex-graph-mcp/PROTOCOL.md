# Hex-Graph Protocol

> **SCOPE:** Canonical response protocol for `hex-graph-mcp`. Defines the action-line grammar, body prefixes, envelope-field mapping, per-tool response shapes, and removed-noise invariants. Does not contain benchmark data or release notes.

## Summary

`hex-graph-mcp` is a symbol/reference/flow/architecture MCP server for AI coding agents. All tool responses share one text grammar emitted as `content[0].text`. No `structuredContent`. No JSON envelope. No `outputSchema` declaration.

This matches the design direction of `hex-line-mcp` and extends it one step further: hex-line compacted the `content` field inside an existing JSON+mirror envelope; hex-graph drops the envelope entirely.

## Source of truth

`hex-graph` owns:
- symbol identity (kind, scope, signature, export flag)
- reference edges (caller → callee, kind, confidence, tier)
- implementation relations (interface → impl)
- path tracing (reachability, depth, weight)
- flow analysis (data-flow in/out/through)
- architecture overview (modules, cycles, hotspots)
- change analysis (PR impact, edit-region risk)
- workspace audit (unused, clones, dead exports)

`hex-graph` does NOT own:
- file content bytes (that is `hex-line`'s domain)
- raw line-level edit anchors
- edit transactions
- file-hash integrity

Graph advisory into `hex-line` is through the SQLite views contract, NOT through MCP tool responses. The hex-line / hex-graph interface is stable across this protocol.

## MCP envelope policy

- Every tool returns `{ content: [{ type: "text", text: <grammar string> }] }`.
- NO `structuredContent` field.
- NO `outputSchema` declaration on any tool registration.
- `isError: true` only for genuine protocol errors; business-level errors (`not_found`, `stale`, `error`) are expressed in the grammar body.

Spec compliance: per MCP 2025-11-25 / SEP-1624, emitting only `content` is valid. Dropping `outputSchema` is necessary because the spec requires `structuredContent` whenever `outputSchema` is declared.

## Response grammar

All tools share one grammar.

### Header (action-line)

First line of every response:

    <status> <next_action> [key=val ...]

- `status` ∈ `ok | partial | not_found | stale | error`
- `next_action` is a short canonical label. It may be a tool-like next step (`find_references`, `trace_paths`, `audit_workspace`) or a recovery/action label (`expand`, `widen_query`, `index_project`, `fix_path`, `review_deleted_api`, `review_duplicates`, `none`).
- `key=val` carries minimal context: `rev=idx-<ts>`, `total=42`, `returned=20`, `truncated=1`, `cov=0.87`, `tier=t1`, `mode=compact|evidence`, `path=...`, `limit=N`, `expand_limit=N`, `conf=<level>` (only non-default)

`reason=<code>` appears only as `!reason=<code>` in body for `status ∈ {not_found, stale, error}`. For success variants (`ok`, `partial`) use explicit `key=val` on the action-line.

### Body (line-prefix)

After the action-line, each body line starts with one of:

| Prefix | Semantics |
|--------|-----------|
| `#` | section header / block label (one line): `#evidence`, `#provenance`, `#location`, `#refs`, `#callers`, `#flow`, `#paths`, `#clones`, `#summary`, `#shapes`, `#consumers`, `#mismatches`, `#processes`, `#graph`, `#overlays`, `#quality` |
| `.` | primary entry: symbol, reference, path, edge, clone group, unused export, hotspot |
| `>` | pointer - literal follow-up tool call with `path` and selector when symbol-scoped: `>mcp__hex-graph__find_references path=/repo symbol_id=42 expand=references` |
| `!` | warning / error / stale detail: `!code=DB_LOCK`, `!reason=no_matches`, `!index_built=<ts>` |
| `?` | advisory — emitted only under `verbosity=full`: stale-index hint, coverage gap |

Canonical `.`-prefix rows are kv-oriented: `.calculateTotal src/a.ts:42 kind=call tier=t1`. Path rows use `A->B->C` arrow notation with trailing kv.

### Legacy Envelope Field To Grammar Mapping

Historical JSON envelope fields map to the following grammar locations. New code emits only the grammar.

| Envelope field | Grammar location | Condition |
|---|---|---|
| `status` | action-line position 1 | always |
| `next_action` | action-line position 2 | always |
| `query` (request echo) | **dropped** | derivable — agent knows its own request |
| `result` (payload body) | `.`/`#` body entries | unfolded per tool |
| `confidence` | action-line kv `conf=<level>` | only when non-default |
| `reason` | `!reason=<code>` body line | only when `status ∈ {not_found, stale, error}` |
| `evidence` | `#evidence` section + `.` rows | always when available |
| `limits_applied.limit` | action-line kv `limit=N` | only when set |
| `limits_applied.truncated` | action-line kv `truncated=1` | only when truthy |
| `limits_applied.expand_limit` | action-line kv `expand_limit=N` | only when set |
| `quality` | `#quality` section | only under `verbosity=full` |
| `summary` | **dropped** | prose incompatible with grammar |
| `code` | `!code=<CODE>` body line | error only |
| `recovery` | `>mcp__hex-graph__<action>` | parseable literal tool-call |
| `error.code` | `!code=<CODE>` | error only |
| `error.message` | `!message=<text>` | error only |
| `error.recovery` | `>mcp__hex-graph__<action>` | error only |
| `path` | action-line kv `path=...` | when tool-primary scope |
| `pattern` | action-line kv `pattern=...` | grep-like tools |
| `symbol` | action-line kv `sym=<name>` | symbol-scoped tools |
| `provenance_summary.*` | `#provenance tier_1=N tier_2=N cov=X.Y` | replaces all derivable fields |
| `expansion_hints[].suggested_params` | `>mcp__hex-graph__<tool> k=v ...` literal | replaces procedural params |
| `available_expansions` | **dropped** | derivable from `next_action` + pointers |
| `analyzed_rows`, `remaining_rows`, `coverage_ratio`, `strongest_confidence`, `strongest_tier` | **dropped as derivable** | agent computes from tiers/confidences |

### Universal variants

- **Success**: `ok keep_using rev=idx-<ts> total=N [returned=M]`
- **Partial/truncated**: `partial expand rev=<ts> total=50 returned=20 truncated=1 expand_limit=50` + `>mcp__hex-graph__<tool> path=/repo symbol_id=42 expand_limit=50`
- **Not found**: `not_found widen_query` + `!reason=no_matches` + `>mcp__hex-graph__<tool> path=/repo name=calculateTotal fuzzy=1`
- **Stale**: `stale index_project` + `!index_built=<ts> latest_change=<ts>` + `>mcp__hex-graph__index_project path=...`
- **Error**: `error none` + `!code=<CODE> message=<text>` + `>mcp__hex-graph__<recovery_action>`

## Per-tool grammar

All tools share the universal header + prefix body. Per-tool body differences are purely in `#section` labels and `.row` kv fields.

| Tool | Body shape | Primary `#section`s |
|------|------------|---------------------|
| `index_project` | status + metadata | `#index rev=... files=... symbols=...` |
| `find_symbols` | `.sym` rows | `#evidence` when grouped |
| `inspect_symbol` | `#location`, `#refs`, `#callers`, `#flow` | all four always |
| `find_references` | `.ref` rows | `#evidence tier_1=N tier_2=N cov=X.Y` |
| `find_implementations` | `.impl` rows | `#evidence` optional |
| `trace_paths` | `.A->B->C depth=N weight=X` rows | `#provenance` summary |
| `trace_dataflow` | `.A->B->C depth=N kind=in\|out\|thru` rows | `#provenance` |
| `analyze_architecture` | `.module` rows + `#cycles` | `#hotspots` optional |
| `analyze_changes` | `.change`, `.impact` rows | `#summary` |
| `analyze_edit_region` | `.region kind=...` rows | `#impact` |
| `api_impact` | `.route`, `.shape`, `.consumer`, `.mismatch`, `.process` rows | `#shapes`, `#consumers`, `#mismatches`, `#processes` |
| `diagnose_graph` | `.check`, `.provider` rows | `#graph`, `#overlays` |
| `audit_workspace` | `.unused`, `.hotspot`, `.clone_group`, `.clone_member` rows | `#summary` |
| `export_scip` | status-only: path to artifact | `#scip rev=... path=...` |
| `import_scip_overlay` | status-only: overlay applied count | `#overlay applied=N` |
| `install_graph_providers` | `.provider` rows with install state | `#providers` |

### Example: `find_references` (ok, typical)

```
ok keep_using rev=idx-2026-04-20 total=8 returned=8
#evidence tier_1=5 tier_2=3 cov=1.0
.calculateTotal src/a.ts:42 kind=call tier=t1
.calculateTotal src/b.ts:18 kind=call tier=t2 chain=2
.calculateTotal src/c.ts:55 kind=inherit tier=t1
```

### Example: `inspect_symbol`

```
ok keep_using rev=idx-2026-04-20 sym=calculateTotal kind=function
#location src/a.ts:42-58 exported=1
#refs total=8 def_sites=1
#callers total=4 entrypoints=1
#flow in=2 out=3 thru=1
>mcp__hex-graph__find_references path=/repo symbol_id=42
>mcp__hex-graph__trace_paths path=/repo symbol_id=42
```

### Example: `audit_workspace`

```
ok review_duplicates rev=idx-2026-04-20 files=342
#summary unused=2 hotspots=1 clone_groups=3
.unused src/legacy.ts:42 fn=oldHelper exported=1
.hotspot src/core.ts:150 churn=42 callers=18
.clone_group id=g1 type=exact hash=ab12ef34 members=3 avg_stmts=12 impact=medium
.clone_member group=g1 file=src/foo.ts lines=42-58 name=foo callers=3
.clone_member group=g1 file=src/bar.ts lines=70-86 name=bar callers=1
.clone_member group=g1 file=src/baz.ts lines=10-26 name=baz callers=2
```

Note: clone members are flat `.clone_member` rows with `group=<id>` back-reference. NO indent-tree.

## Removed noise

The following are forbidden by grammar and must not appear in any tool payload:

- `structuredContent` mirror (dropped — spec allows content-only)
- `outputSchema` declaration on tool registration (dropped — required coordinately with structuredContent)
- Prose `"Found N X"` headers in `find_symbols`, `find_references`, `find_implementations`, `trace_paths`, `trace_dataflow`
- `provenance_summary` JSON object with derivable fields (`analyzed_rows`, `remaining_rows`, `coverage_ratio`, `strongest_confidence`, `strongest_tier`)
- `expansion_hints[]` with `suggested_params` object (replace with literal `>mcp__hex-graph__<tool> k=v` pointer)
- `available_expansions: []` array (dropped — derivable from `next_action` + pointers)
- Pipe-delimited `.join(", ")` prose: `"2 unused exports, 1 hotspot, 3 clone groups"`
- Prose advice: `"should review before deleting"`, `"may indicate duplicate logic"`
- Indent-based trees (including 4-space clone-member indent under group header)
- Emoji, ASCII art, status glyphs other than `+/-/~` in `analyze_changes`
- Prose `summary` fields in `inspect_symbol`, `trace_paths`, `audit_workspace`

## Invariants

- Every tool response is a single `content[0].text` string conforming to the grammar above.
- First line of response is always a valid action-line.
- Body lines never appear before the action-line.
- `#section` labels are always one line, never multi-line.
- `.row` entries are always kv-oriented after the leading symbol name or span, never prose.
- `>` pointers are always parseable as literal MCP tool calls and always name a registered `mcp__hex-graph__*` tool.
- Derivable fields (`total - returned`, `coverage_ratio`, `strongest_tier`) are NEVER emitted — the agent computes them.
- No field reflects the request (`query` echo) — the agent already knows what it sent.
- Hex-line SQLite views contract is unchanged — hex-line and hex-graph release cycles remain independent.

## Non-goals

- Backward compatibility with the JSON envelope shape
- `structuredContent` emission
- `outputSchema` declaration
- Prose human-readable summaries
- Multiple response formats per tool
- Shared helper change in `hex-common/src/runtime/results.mjs` (local `textResult` only)

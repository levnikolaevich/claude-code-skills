# Hex-Line Protocol

> **SCOPE:** Canonical protocol and implementation invariants for `hex-line-mcp`. Defines the editing model, block model, graph boundary, and persistence rules. Does not contain benchmark data or release notes.

## Summary

`hex-line-mcp` is an edit-ready protocol for AI coding agents.

`revision` tracks logical file content, not raw line-ending bytes alone. `hex-line` normalizes line endings for comparison and hashing, then preserves the existing line-ending and trailing-newline shape when it writes the file back.

The protocol is built around three concepts:
- `DocumentSnapshot` — current file truth: lines, hashes, checksums, revision
- `EditReadyBlock` — canonical payload emitted by read and search workflows
- `EditResolutionPipeline` — single validation/apply path for single-edit and multi-edit

## Source of truth

`hex-line` owns all correctness-critical state:
- normalized file content
- raw line-ending metadata
- absolute line numbers
- per-line hashes
- range and file checksums
- revisions
- anchor resolution
- checksum coverage validation
- overlap/conflict detection
- deterministic edit application

`hex-graph` is advisory only:
- symbol annotations
- ranking hints
- outline enrichment
- call impact
- semantic summaries

If graph data is missing, `hex-line` remains fully correct.
If graph data is stale, `hex-line` suppresses it rather than pretending it is fresh.

## Graph freshness policy

- Stale graph never changes the canonical read, search, edit, or verify protocol.
- One stale file schedules a best-effort background `reindexFile(...)` for that file.
- A short stale burst escalates to one best-effort background `indexProject(...)` for the project.
- The threshold-crossing file still keeps its point refresh so the system does not create a blind window before project refresh completes.
- `edit_file` may still use stale graph facts as same-response advisory context after a local edit, but edit correctness never depends on graph freshness.
- `grep_search` only pulls line-level graph annotations for edit-ready content mode. Discovery-only search modes do not spend payload on graph hints.
- `read_file` only emits the top-line `Graph:` header in `verbosity=full`.

## Persistence policy

- Semantic graph cache may be persistent and rebuildable.
- Edit snapshots are in-memory only.
- `hex-line` does not persist edit-state across server restarts.

Rationale:
- persistent semantic cache improves discovery
- persistent edit-state creates false freshness and complicates stale handling

## Canonical block model

Every edit-ready block has:
- file identity
- block kind: `read_range` or `search_hunk`
- absolute line span
- canonical line entries in format `<tag>.<N>\t<text>\n`
- checksum covering exactly the emitted line span
- optional summary metadata outside the canonical line payload

Diagnostic blocks are explicit and never pretend to be edit-ready.

## Response grammar

All tool responses share one grammar over `content[0].text`. No `structuredContent` envelope is introduced.

### Header (action-line)

First line of every response:

    <status> <next_action> [key=val ...]

- `status` ∈ `ok | stale | conflict | auto_rebased | invalid | error`
- `next_action` ∈ `keep_using | reread_ranges | reread_then_retry | fix_input | inspect_raw_diff | review_risks | none`
- `key=val` carries minimal context: `rev=r19-c9df1e2c`, `mode=summary`, `changed=3:3`, `total=42`, `file_count=7`, `dry_run=1`, `capped=1`, `eol=lf`, `span=1-41`, `parser=tree_sitter`

`reason=<code>` appears only when `status != ok`. For success variants use explicit `key=val` (`dry_run=1`, `mode=content`, `changed=3:3`), never reuse `reason` as a success classifier.

### Body (line-prefix)

After the action-line, each body line starts with one of:

| Prefix | Semantics |
|--------|-----------|
| `#` | section header / block label (one line) |
| `.` | primary entry (match, change, file listing) |
| `>` | pointer — literal follow-up tool call (`>read_file file=X ranges=10-20`) |
| `!` | warning / error / stale detail |
| `?` | advisory — graph hint, emitted only under `verbosity=full` or `edit_ready=true` |

Canonical line entries keep the existing format `<tag>.<N>\t<text>\n` and are emitted unprefixed inside a `#`-delimited block.

### Removed noise

The following are forbidden by grammar and must not appear in any tool payload:
- `payload_sections`, `boundary_echo_stripped` debug markers
- raw `Diff:` or unified-diff blocks in `edit_file` / `bulk_replace` (opt-in only via `changes` with `mode=raw_diff`)
- prose metadata such as `"200 lines, 5.2KB, 2 hours ago"`, `relativeTime()` output
- `snippets:` prose in `grep_search summary`
- pipe-delimited strings such as `idx|status|span|checksum|summary`
- `"File: <path>"` or `"Found N in <root>/"` prose headers
- emoji, indent-based trees, ASCII art, status glyphs other than `+/-/~` in `changes`

### Graph enrichment

Graph hints follow [Graph freshness policy](#graph-freshness-policy). No `include_graph` input flag is introduced; existing `verbosity=full` and `edit_ready=true` gates stay authoritative. When graph data is absent or stale, the `?` advisory line is simply omitted — never emitted as `null` or placeholder.


## Invariants

- Anchors resolve against the current snapshot only.
- Checksums always cover exactly the emitted block.
- EOL normalization is for comparison only, not for silently rewriting existing user data.
- `read_file` and `grep_search` emit the same class of edit-ready blocks.
- Ranking changes order only, never payload semantics.
- Graph enrichment changes summaries only, never correctness.
- Diagnostics never include fake edit-ready checksums.
- Multi-edit correctness does not depend on output presentation.

## Editing model

All edits go through one resolution pipeline:
1. parse request
2. bind against snapshot
3. validate anchors
4. validate checksum coverage
5. detect overlap/conflicts
6. compute deterministic apply order
7. apply once
8. emit next snapshot and revision

This model applies equally to:
- single edit
- multi-edit
- read-derived edits
- search-derived edits

## Non-goals

- Backward compatibility with legacy payload shapes
- Graph-dependent correctness
- Multiple incompatible edit-ready formats
- Persistent edit-state across restarts

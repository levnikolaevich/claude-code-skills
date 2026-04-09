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
- canonical line entries
- checksum covering exactly the emitted line span
- optional summary metadata outside the canonical line payload

Diagnostic blocks are explicit and never pretend to be edit-ready.

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

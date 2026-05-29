---
name: hex-line
description: hex-line MCP tool preferences with compact coding style
keep-coding-instructions: true
---

# MCP Tool Preferences

Prefer `hex-line` for text files you may inspect or modify. Hash-annotated reads and verified edits keep context cheap and safe, and graph hints enrich the same flow when available.

| Instead of | Use | Why |
|-----------|-----|-----|
| Read | `mcp__hex-line__read_file` | Hash-annotated, revision-aware |
| Edit | `mcp__hex-line__edit_file` | Hash-verified anchors + conservative auto-rebase |
| Write | `mcp__hex-line__write_file` | No prior Read needed |
| Grep | `mcp__hex-line__grep_search` | Summary-first discovery with edit-ready escalation |
| Glob | `mcp__hex-line__inspect_path` | Project file discovery and name/path globbing |
| Text rename across files | `mcp__hex-line__bulk_replace` | Multi-file text rename/refactor inside an explicit root path |
| Path/tree/stat Bash | `mcp__hex-line__inspect_path` | Compact path info and pattern search |
| Large code read | `mcp__hex-line__outline` then `read_file` with ranges | Structure first, targeted reads |
| Re-check freshness | `mcp__hex-line__verify` | Avoid unnecessary rereads |
| Git diff review | `mcp__hex-line__changes` | Compact semantic diff |

**Bootstrap**: if hex-line schemas are not loaded, run `ToolSearch('+hex-line read edit')`.

## Workflow Paths

| Path | Flow |
|------|------|
| Surgical | `grep_search(output_mode="summary") -> grep_search(output_mode="content", edit_ready=true) if needed -> edit_file` |
| Exploratory | `outline -> read_file (ranges) -> edit_file(base_revision)` |
| Multi-file | `bulk_replace(path=<project root>)` |
| Follow-up after delay | `verify(base_revision) -> reread only if STALE -> retry with returned helpers` |

## Scope Discipline

- Auto-fill `path` instead of leaving scope implicit.
- For file tools (`read_file`, `edit_file`, `outline`, `changes` on one file), use the target file path.
- Read-only file tools may target explicit temp-file paths outside the repo when you intentionally inspect a scratch file.
- For repo-wide tools (`bulk_replace`, directory `inspect_path`, broad `grep_search`), use the resolved project root or intended directory scope, then narrow further before requesting rich output.
- Mutating tools stay inside the current project root by default. Add `allow_external=true` only when you intentionally edit a temp or external path.
- Treat missing or ambiguous scope as an error to fix, not as a reason to guess across repositories.

## Edit Discipline

- Prefer a real `range_checksum` copied from a fresh `read_file` or `grep_search(output_mode:"content", edit_ready=true)` block. If you don't have one for the exact range, pass `"auto"` and the server computes it for the current anchor range.
- First mutation in a file: use `grep_search(output_mode="summary")` for narrow targets, or `outline -> read_file(ranges)` for structural edits. Escalate to `grep_search(output_mode="content", edit_ready=true)` only when the next edit needs canonical hunks.
- Preserve file conventions mentally: `hex-line` hashes normalized logical text, but `edit_file` preserves the file's existing line endings and trailing-newline shape on write.
- Prefer `set_line` or `insert_after` for small local changes. Prefer `replace_between` for larger bounded block rewrites.
- When either anchor of `replace_between` is a lone delimiter (`}`, `)`, `]`, `});`), switch to `replace_lines` with `range_checksum`, or pass `range_checksum` to `replace_between` directly. `replace_between` anchors use short line-content hashes and may fuzzy-match a sibling closing delimiter.
- For inclusive `replace_between`: enumerate every `{`, `(`, `[` opened inside the replaced range and ensure `new_text` closes them all. If the range crosses a method/class/namespace boundary, prefer `set_line` + `insert_after` for each hunk.
- After `replace_between` on C#/Java/Go/C++/Rust files, run the language build or type-check once before proceeding. Brace drift is invisible at edit time.
- Use `replace_lines` for bounded block replacement; supply its inclusive `range_checksum`, or pass `"auto"` to have the server compute it.
- Batch ALL hunks for the same file into ONE `edit_file` call (the `edits` array). Separate sequential edits on one file go stale and conflict — this is the single most common edit failure. Use `base_revision` only for a genuinely later follow-up after the file already changed.
- Before a delayed follow-up edit, a formatter pass, or any mixed-tool workflow on the same file, run `verify` with the last checksums and `base_revision`.
- If `edit_file` returns `retry_edit`, `retry_edits`, or `retry_plan`, reuse those directly instead of rebuilding anchors/checksums by hand.
- Reuse `retry_checksum` when it is returned for the exact same target range.
- Once `hex-line` owns a file edit session, avoid mixing built-in `Edit`/`Write` on that file unless you intentionally want a new baseline.
- Follow `next_action` first. Treat `summary` and `snippet` as the compact local context, not as prose to reinterpret.
- If broad `grep_search(output_mode="content")` or pattern `inspect_path` truncates, narrow `path`, `glob`, or query shape before retrying. Use `allow_large_output=true` only when you intentionally accept a larger payload.

## Exceptions

- Built-in `Read`/`Edit`/`Write`/`Grep`/`Glob` are fallback only by preference. With the hook active, project-scoped text calls and file discovery receive hex-line guidance by default and hard-route only when `hooks.mode` is `blocking`. Built-in OK for images, PDFs, notebooks, plan files in Plan Mode, and text paths outside the current project root.
- Bash is still fine for npm, node, git, docker, curl, non-inspection pipelines, and other runtime workflows. Project file inspection commands receive hex-line guidance, including Windows-native readers/searchers/listing commands.

## hex-graph

Use `hex-graph` only for semantic code questions:
- `index_project` once per session before graph queries
- `find_symbols` and `inspect_symbol` for symbol identity
- `find_references` and `trace_paths` for usage and blast radius
- `analyze_changes`, `audit_workspace`, and `analyze_architecture` for review and audit work
- Always include `path` for `hex-graph` queries, using the active project root by default.
- For `audit_workspace`, start bounded: `verbosity="minimal"`, add `scope` when known, and increase `limit` or `clone_member_limit` only for intentional deeper review.

# Response Style

Keep responses compact and operational. Explain only what is needed to complete the task or justify a non-obvious decision.

Prefer:
- short progress updates
- direct tool calls without discovery chatter
- concise summaries of edits and verification

Avoid:
- mandatory educational blocks
- long prose around tool usage
- repeating obvious implementation details

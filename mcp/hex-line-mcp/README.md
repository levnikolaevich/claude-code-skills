# hex-line-mcp

Hash-verified file editing MCP + token efficiency hook for AI coding agents.

[![npm](https://img.shields.io/npm/v/@levnikolaevich/hex-line-mcp)](https://www.npmjs.com/package/@levnikolaevich/hex-line-mcp)
[![downloads](https://img.shields.io/npm/dm/@levnikolaevich/hex-line-mcp)](https://www.npmjs.com/package/@levnikolaevich/hex-line-mcp)
[![license](https://img.shields.io/npm/l/@levnikolaevich/hex-line-mcp)](./LICENSE)
![node](https://img.shields.io/node/v/@levnikolaevich/hex-line-mcp)

Every line carries an FNV-1a content hash. Every edit must present those hashes back -- proving the agent is editing what it thinks it's editing. No stale context, no silent corruption. Hashing works on normalized logical text; writes preserve the file's existing line endings and trailing-newline shape.

By default, mutating tools stay inside the current project root. If you intentionally need to edit a temp or external path, pass `allow_external: true` on `edit_file`, `write_file`, or `bulk_replace`.

## Features

### 9 MCP Tools

Core day-to-day tools:

- `read_file`
- `edit_file`
- `grep_search`
- `outline`
- `verify`
- `bulk_replace`

Advanced / occasional:

- `write_file`
- `inspect_path`
- `changes`

| Tool | Description | Key Feature |
|------|-------------|-------------|
| `read_file` | Read file with progressive disclosure, optional edit-ready metadata, and automatic graph hints when available | Minimal plain discovery by default, explicit `edit_ready` for verified edits |
| `edit_file` | Revision-aware anchor edits (`set_line`, `replace_lines`, `insert_after`, `replace_between`) | Batched same-file edits + conservative auto-rebase |
| `write_file` | Create new file or overwrite, auto-creates parent dirs | Path validation, no hash overhead |
| `grep_search` | Search with ripgrep, summary-first discovery, and optional edit-ready hunks | `summary` by default, explicit `content` + `edit_ready` for verified edits |
| `outline` | AST-based structural overview with hash anchors via tree-sitter WASM. Supports JavaScript/TypeScript, Python, C#, PHP, and fence-aware markdown headings | 95% token reduction, direct edit anchors |
| `verify` | Check if held checksums / revision are still current | Staleness check without full re-read |
| `inspect_path` | Unified file-or-directory inspection | Minimal tree discovery by default, deeper traversal on demand |
| `changes` | Compare file against git ref, shows added/removed/modified symbols | AST-level semantic diff |
| `bulk_replace` | Search-and-replace across multiple files inside an explicit root path | Compact summary (default) or capped diffs via `format`, dry_run, max_files |

### Hooks (SessionStart + PreToolUse + PostToolUse)

| Event | Trigger | Action |
|-------|---------|--------|
| **PreToolUse** | Read/Edit/Write/Grep on text files | Redirect-first policy for text files; built-in tools stay reserved for binary/media and `.claude/settings*.json` exceptions |
| **PreToolUse** | Bash with dangerous commands | Blocks `rm -rf /`, `git push --force`, etc. Agent must confirm with user |
| **PostToolUse** | Bash with 50+ lines output | RTK: deduplicates, truncates, shows filtered summary to Claude as feedback |
| **SessionStart** | Session begins | Injects a short bootstrap hint; defers to the active output style when `hex-line` style is enabled |


### Bash Redirects

PreToolUse also intercepts simple Bash commands: cat, head, tail, tree, find, stat, wc -l, grep, rg, sed -i — redirects to hex-line equivalents. `ls`/`dir` only redirected for recursive listing (`ls -R`, `dir /s`); simple `ls path` is allowed. Compound commands with pipes are allowed.
## Install

### MCP Server

```bash
npm i -g @levnikolaevich/hex-line-mcp
claude mcp add -s user hex-line -- hex-line-mcp
```

ripgrep is bundled via `@vscode/ripgrep` — no manual install needed for `grep_search`.

Requires Node.js >= 20.19.0.

### Hooks

Hooks and output style are auto-synced on every MCP server startup. The server compares installed files with bundled versions and updates only when content differs. First run after `npm i -g` triggers full install automatically.

Hooks are written to global `~/.claude/settings.json` with absolute path to `hook.mjs`. Output style is installed to `~/.claude/output-styles/hex-line.md` and activated if no other style is set. To activate manually: `/config` > Output style > hex-line.

No extra manual setup is required after install. The startup sync uses the current Node runtime and a stable hook path under `~/.claude/hex-line`, so the hook command survives spaces in the home directory on Windows, macOS, and Linux.

## Validation

Use the normal package checks:

```bash
npm test
npm run lint
npm run check
```

Maintainers can also run the internal scenario harness when they want reproducible repo-local workflow regressions:

```bash
npm run scenarios -- --repo /path/to/repo
npm run scenarios:diagnostic -- --repo /path/to/repo
```

Comparative built-in vs hex-line benchmarks are maintained outside this package.

### Optional Graph Enrichment

If a project already has `.hex-skills/codegraph/index.db`, `hex-line` automatically adds lightweight graph hints to `read_file`, `outline`, `grep_search`, `edit_file`, and `changes`.

- Graph enrichment is optional. If `.hex-skills/codegraph/index.db` is missing, stale, or unreadable, `hex-line` falls back to standard behavior silently.
- Graph enrichment is project-deterministic. `hex-line` only uses the graph database that belongs to the resolved current project scope.
- Nested projects do not inherit graph hints from a parent repo index once a nested project boundary is detected.
- `better-sqlite3` is optional. If it is unavailable, `hex-line` still works without graph hints.
- `read_file`, `outline`, and `grep_search` stay compact: they only surface high-signal local facts such as `api`, framework entrypoints, callers, flow, and clone hints.
- `edit_file` and `changes` surface the deeper review layer: external callers, downstream return/property flow, clone peers, public API risk, framework entrypoint risk, and same-name sibling warnings when present.

`hex-line` does not read `hex-graph` internals directly anymore. The integration uses a small read-only contract exposed by `hex-graph-mcp`:

- `hex_line_symbols`
- `hex_line_line_facts`
- `hex_line_edit_impacts`
- `hex_line_edit_impact_facts`
- `hex_line_clone_siblings`

## Tools Reference

## Common Workflows

### Local code edit in one file

1. `outline` for large code files
2. `read_file` for the exact range you need
3. `edit_file` with all known hunks in one call

### Follow-up edit on the same file

1. Carry `revision` from the earlier `read_file` or `edit_file`
2. Pass it back as `base_revision`
3. Use `verify` before delayed or mixed-tool follow-up edits
4. If the server returns `retry_edit`, `retry_edits`, `retry_checksum`, or `retry_plan`, reuse those directly

### Rewrite a long block

Use `replace_between` inside `edit_file` when you know stable start/end anchors and want to replace a large function, class, or config block without reciting the old body.

### Literal rename / refactor

Use `bulk_replace` for text rename patterns across one or more files inside a known project root or directory scope. Pass `path` explicitly. In normal agent workflows that scope should be auto-filled from the current project root, not typed manually. Returns compact summary by default; pass `format: "full"` for capped diffs. Do not use it as a substitute for structured block rewrites.

### read_file

Read a file with progressive disclosure. Default mode is discovery-first: plain partial lines, low token cost, and optional continuation hints. When you need verified edits, pass `edit_ready: true` with `verbosity: "full"` to get canonical `read_range` blocks with anchors and checksums. Directories go through `inspect_path`.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `path` | string | yes | File path |
| `paths` | string[] | no | Array of file paths to read (batch mode) |
| `offset` | number | no | Start line, 1-indexed (default: 1) |
| `limit` | number | no | Max lines to return (default: 200 for discovery, 2000 for edit-ready, 0 = all) |
| `ranges` | array | no | Explicit line ranges, e.g. `[{ "start": 10, "end": 30 }]` |
| `plain` | boolean | no | Omit hashes, output `lineNum\|content` instead |
| `verbosity` | enum | no | `minimal`, `compact`, or `full` |
| `edit_ready` | boolean | no | Include hash/checksum edit protocol blocks explicitly |

Default output is discovery-first:

```text
File: lib/search.mjs
meta: 282 lines, 10.2KB, 2 hours ago
continuation: {"kind":"offset","offset":4,"limit":200}

1|import { resolve } from "node:path";
2|import { readFileSync } from "node:fs";
3|...
```

Explicit edit-ready output:

```
File: lib/search.mjs
meta: 282 lines, 10.2KB, 2 hours ago
revision: rev-12-a1b2c3d4
file: 1-282:beefcafe
eol: lf
trailing_newline: true

block: read_range
span: 1-3
eol: lf
trailing_newline: true
ab.1    import { resolve } from "node:path";
cd.2    import { readFileSync } from "node:fs";
ef.3    ...
checksum: 1-3:f7e2a1b0
```

### edit_file

Edit using revision-aware hash-verified anchors. Prefer one batched call per file. For text rename use bulk_replace.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `path` | string | yes | File to edit |
| `edits` | string | yes | JSON array of edit operations (see below) |
| `dry_run` | boolean | no | Preview changes without writing |
| `restore_indent` | boolean | no | Auto-fix indentation to match anchor context (default: false) |
| `base_revision` | string | no | Prior revision from `read_file` / `edit_file` for same-file follow-up edits |
| `conflict_policy` | enum | no | `conservative` or `strict` (default: `conservative`) |
| `allow_external` | boolean | no | Allow editing a path outside the current project root |

Edit operations (JSON array):

```json
[
  {"set_line": {"anchor": "ab.12", "new_text": "replacement line"}},
  {"replace_lines": {"start_anchor": "ab.10", "end_anchor": "cd.15", "new_text": "...", "range_checksum": "10-15:a1b2c3d4"}},
  {"insert_after": {"anchor": "ab.20", "text": "inserted line"}},
  {"replace_between": {"start_anchor": "ab.30", "end_anchor": "cd.80", "new_text": "...", "boundary_mode": "inclusive"}}
]
```

Discipline:

- Never invent `range_checksum`. Copy it from `read_file` or `grep_search(output:"content")`.
- First mutation in a file: prefer `grep_search` for narrow targets, or `outline -> read_file(ranges)` for structural edits.
- Prefer 1-2 hunks on the first pass. Once `edit_file` returns a fresh `revision`, continue from that state as `base_revision`.
- `hex-line` preserves existing file line endings on write; repo-level line-ending cleanup should be a separate deliberate operation, not a side effect of `edit_file`.

Result footer includes:

- `status: OK | AUTO_REBASED | CONFLICT`
- `reason: ...` as the canonical machine-readable cause for the current status
- `revision: ...`
- `file: ...`
- `changed_ranges: ...` when relevant
- `recovery_ranges: ...` with the narrowest recommended `read_file` ranges for retry
- `next_action: ...` as the canonical immediate choice: `apply_retry_edit`, `apply_retry_batch`, or `reread_then_retry`
- `remapped_refs: ...` when stale anchors were uniquely relocated
- `retry_checksum: ...` on local conflicts, narrowed to the exact target range when possible
- `retry_edit: ...` when the server can synthesize a ready-to-retry edit skeleton from current local state
- `retry_edits: ...` on conservative batch conflicts when every conflicted edit can be retried directly
- `suggested_read_call: ...` when rereading is the safest next step
- `retry_plan: ...` with a compact machine-readable next-call plan
- `summary: ...` and `snippet: ...` instead of long prose blocks
- `edit_conflicts: N` on conservative multi-edit preflight conflicts

### write_file

Create a new file or overwrite an existing one. Creates parent directories automatically.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `path` | string | yes | File path |
| `content` | string | yes | File content |
| `allow_external` | boolean | no | Allow writing a path outside the current project root |

### grep_search

Search file contents using ripgrep. Default mode is `summary` for discovery. Use `content` with `edit_ready: true` when you need canonical `search_hunk` blocks for verified edits. `files` and `count` stay plain list modes.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `pattern` | string | yes | Search pattern (regex by default, literal if `literal:true`) |
| `path` | string | no | Directory or file to search (default: cwd) |
| `glob` | string | no | Glob filter, e.g. `"*.ts"` |
| `type` | string | no | File type filter, e.g. `"js"`, `"py"` |
| `output` | enum | no | Output format: `"summary"` (default), `"content"`, `"files"`, `"count"` |
| `case_insensitive` | boolean | no | Ignore case |
| `smart_case` | boolean | no | CI when lowercase, CS when uppercase (`-S`) |
| `literal` | boolean | no | Literal string search, no regex (`-F`) |
| `multiline` | boolean | no | Pattern can span multiple lines (`-U`) |
| `context` | number | no | Symmetric context lines around matches (`-C`) |
| `context_before` | number | no | Context lines BEFORE match (`-B`) |
| `context_after` | number | no | Context lines AFTER match (`-A`) |
| `limit` | number | no | Max matches per file (default: 20 for `summary`, 100 for `content`) |
| `total_limit` | number | no | Total match events across all files; multiline matches count as 1 (default: 50 for `summary`, 200 for `content`, 1000 for `files`/`count`, 0 = unlimited) |
| `plain` | boolean | no | Omit hash tags inside block entries, return `lineNum\|content` |
| `edit_ready` | boolean | no | Preserve hash/checksum search hunks in `content` mode |

`summary` mode returns counts, top files, and a few plain snippets. `content` mode returns canonical `search_hunk` blocks with per-hunk checksums enabling direct `replace_lines` from grep results without intermediate `read_file`.

### outline

AST-based structural outline with hash anchors for direct `edit_file` usage. Supports JavaScript/TypeScript, Python, C#, PHP, and fence-aware markdown heading navigation (`.md`/`.mdx`). Each entry includes a hash tag for immediate anchor use without intermediate `read_file`.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `path` | string | yes | Source file path |

Supported languages: JavaScript (`.js`, `.mjs`, `.cjs`, `.jsx`), TypeScript (`.ts`, `.tsx`), Python (`.py`), C# (`.cs`), and PHP (`.php`) via tree-sitter WASM.

Not for `.json`, `.yaml`, `.txt` -- use `read_file` directly for those.

### verify

Check if range checksums from prior read/search blocks are still valid, optionally relative to a prior `base_revision`. Returns a deterministic verification report with canonical `status`, `summary`, `next_action`, and compact entry lines.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `path` | string | yes | File path |
| `checksums` | string[] | yes | Array of checksum strings, e.g. `["1-50:f7e2a1b0"]` |
| `base_revision` | string | no | Prior revision to compare against latest state |

Example output:

```text
status: STALE
reason: checksums_stale
revision: rev-17-deadbeef
file: 1-120:abc123ef
summary: valid=0 stale=1 invalid=0
next_action: reread_ranges
base_revision: rev-16-feedcafe
changed_ranges: 10-12(replace)
suggested_read_call: {"tool":"mcp__hex-line__read_file","arguments":{"path":"/repo/file.ts","ranges":["10-12"]}}

entry: 1/1 | status: STALE | span: 10-12 | checksum: 10-12:oldc0de0 | current_checksum: 10-12:newc0de0 | next_action: reread_range | summary: content changed since checksum capture
```

### inspect_path

Inspect a file or directory path without guessing which low-level tool to call first.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `path` | string | yes | File or directory path |
| `pattern` | string | no | Glob filter on names (e.g. `"*-mcp"`, `"*.mjs"`). Returns flat match list instead of tree |
| `type` | string | no | `"file"`, `"dir"`, or `"all"` (default). Like `find -type f/d` |
| `max_depth` | number | no | Max recursion depth (default: 2 for discovery, or 20 in pattern mode) |
| `gitignore` | boolean | no | Respect root .gitignore patterns (default: true). Nested .gitignore not supported |
| `format` | string | no | `"compact"` = shorter path view. `"full"` = include sizes / metadata where available |
| `verbosity` | enum | no | `minimal`, `compact`, or `full` |

- For regular files it returns compact metadata: size, line count when cheap, modification time, type, and binary flag.
- For directories it returns a gitignore-aware tree.
- With `pattern`, it switches to flat match mode and works as the preferred replacement for `find` / recursive `ls`.

## Hook

The unified hook (`hook.mjs`) handles three Claude hook events:

### PreToolUse: Tool Redirect

Applies redirect-first steering to built-in `Read`, `Edit`, `Write`, and `Grep` on text files. Binary/media files (images, PDFs, notebooks, archives, executables, fonts, media) stay on built-in tools. `.claude/settings.json` and `.claude/settings.local.json` at project root or home are also allowed on built-in tools.

### PreToolUse: Bash Redirect + Dangerous Blocker

Intercepts simple Bash commands (`cat`, `head`, `tail`, `tree`, `find`, `stat`, `wc -l`, `grep`, `rg`, `sed -i`, etc.) and redirects covered cases to hex-line tools. `ls`/`dir` are redirected only for recursive listing. Dangerous commands (`rm -rf /`, `git push --force`, `git reset --hard`, `DROP TABLE`, `chmod 777`, `mkfs`, `dd`) are blocked.

### PostToolUse: RTK Output Filter

Triggers on `Bash` tool output exceeding 50 lines. Pipeline:

1. **Detect command type** -- npm install, test, build, pip install, git verbose, or generic
2. **Normalize** -- replaces UUIDs, timestamps, IPs, hex values, large numbers with placeholders
3. **Deduplicate** -- collapses identical normalized lines with `(xN)` counts
4. **Truncate** -- keeps first 15 + last 15 lines, omits the middle

### SessionStart: Bootstrap Hint

Injects a compact startup reminder. If the `hex-line` output style is active, the hook emits only a minimal bootstrap hint plus `ToolSearch('+hex-line read edit')` fallback. Otherwise it injects the short preferred read/edit workflow directly, including the scope rule: use file paths for file tools and the current project root for repo-wide tools such as `bulk_replace`.

Hook policy constants in `lib/hook-policy.mjs`:

| Constant | Default | Purpose |
|----------|---------|--------|
| `LINE_THRESHOLD` | 50 | Minimum lines to trigger filtering |
| `HEAD_LINES` | 15 | Lines to keep from start |
| `TAIL_LINES` | 15 | Lines to keep from end |

### SessionStart: Tool Preferences

Injects a short operational workflow into agent context at session start. If schemas are not loaded yet, it includes the `ToolSearch('+hex-line read edit')` fallback. Primary flow stays `outline -> read_file -> edit_file -> verify`, with targeted reads over full-file reads.

## Architecture

```
hex-line-mcp/
  server.mjs          MCP server (stdio transport, 9 tools)
  hook.mjs            Unified hook (PreToolUse + PostToolUse + SessionStart)
  package.json
  lib/
    hook-policy.mjs   Shared hook policy: redirects, thresholds, danger patterns
    setup.mjs         Startup autosync for hook + output style
    read.mjs          File reading with hash annotation
    edit.mjs          Anchor-based edits, diff output
    search.mjs        ripgrep wrapper with hash-annotated results
    outline.mjs       tree-sitter WASM AST outline
    verify.mjs        Range checksum verification
    info.mjs          File metadata (size, lines, mtime, type)
    tree.mjs          Directory tree with .gitignore support
    inspect-path.mjs  Unified file/directory inspection
    changes.mjs       Semantic git diff via AST
    bulk-replace.mjs  Multi-file search-and-replace
    setup.mjs         Claude hook installation + output style setup
    format.mjs        Output formatting utilities
    security.mjs      Path validation, binary detection, size limits
    @levnikolaevich/hex-common/
      text-protocol/hash.mjs   Shared FNV-1a hashing and checksum protocol
      output/normalize.mjs     Shared output normalization helpers
```

### Hash Format

```
ab.42    const x = calculateTotal(items);
```

- `ab` -- 2-char FNV-1a tag derived from content (whitespace-normalized)
- `42` -- line number (1-indexed)
- Tab separator, then original content
- Tag alphabet: `abcdefghijklmnopqrstuvwxyz234567` (32 symbols, bitwise selection)

### Range Checksums

```
checksum: 1-50:f7e2a1b0
```

FNV-1a accumulator over all line hashes in the range (little-endian byte feed). Detects changes to any line, even ones not being edited.

### Security

- Path canonicalization via `realpathSync` (resolves symlinks)
- Binary file detection (null byte scan in first 8KB)
- 10 MB file size limit
- Write path validation (ancestor directory must exist)
- Directory restrictions delegated to Claude Code sandbox


## FAQ

<details>
<summary><b>Does it work without Claude Code?</b></summary>

Yes. hex-line-mcp is a standard MCP server (stdio transport). It works with any MCP-compatible client -- Claude Code, Gemini CLI, Codex CLI, or custom integrations. Hook installation is Claude-specific; Gemini/Codex use MCP Tool Preferences guidance instead.

</details>

<details>
<summary><b>What happens if a hash is stale?</b></summary>

The edit is rejected with an error showing which lines changed since the last read. The agent must re-read the affected range and retry. This prevents silent overwrites from stale context.

</details>

<details>
<summary><b>Is outline available for all file types?</b></summary>

Outline works on JavaScript/TypeScript, Python, C#, PHP, and markdown heading navigation (`.md`/`.mdx`, fenced code blocks ignored). For JSON, YAML, and text files use `read_file` directly. Each outline entry includes a hash anchor (`tag.line-range: symbol`) for direct use in `edit_file`.

</details>

<details>
<summary><b>How does the RTK filter work?</b></summary>

The PostToolUse hook normalizes Bash output (replaces UUIDs, timestamps, IPs with placeholders), deduplicates identical lines, and truncates to first 15 + last 15 lines. The filtered summary is shown to Claude as stderr feedback via exit code 2.

</details>

<details>
<summary><b>Can I disable the built-in tool blocking?</b></summary>

Yes. To downgrade redirects to advice, set `.hex-skills/environment_state.json` to `{ "hooks": { "mode": "advisory" } }`. To remove the hook entirely, delete the `hex-line` hook entries from `~/.claude/settings.json`. To disable the MCP server for one project, add `hex-line` to `~/.claude.json -> projects.{cwd}.disabledMcpServers`.

</details>

## Hex Family

| Package | Purpose | npm |
|---------|---------|-----|
| [hex-line-mcp](https://www.npmjs.com/package/@levnikolaevich/hex-line-mcp) | Local file editing with hash verification + hooks | [![npm](https://img.shields.io/npm/v/@levnikolaevich/hex-line-mcp)](https://www.npmjs.com/package/@levnikolaevich/hex-line-mcp) |
| [hex-ssh-mcp](https://www.npmjs.com/package/@levnikolaevich/hex-ssh-mcp) | Remote file editing over SSH | [![npm](https://img.shields.io/npm/v/@levnikolaevich/hex-ssh-mcp)](https://www.npmjs.com/package/@levnikolaevich/hex-ssh-mcp) |
| [hex-graph-mcp](https://www.npmjs.com/package/@levnikolaevich/hex-graph-mcp) | Code knowledge graph with AST indexing | [![npm](https://img.shields.io/npm/v/@levnikolaevich/hex-graph-mcp)](https://www.npmjs.com/package/@levnikolaevich/hex-graph-mcp) |

## License

MIT

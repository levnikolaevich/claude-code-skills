# MCP Tool Design Guide

> **SCOPE:** Rules for designing MCP tools consumed by AI agents. Naming, errors, output bounds, descriptions. Based on [Tw93/MCP best practices](https://tw93.fun/2025-04-28/mcp.html) and hex-line-mcp experience.

For repo-wide output vocabulary and public response shapes, also read [MCP_OUTPUT_CONTRACT_GUIDE.md](./MCP_OUTPUT_CONTRACT_GUIDE.md).

## 1. Tool Naming

MCP prepends `mcp__<server>__` automatically. Name the tool itself without the server prefix.

| Pattern | Example (raw) | Agent sees | Notes |
|---------|---------------|------------|-------|
| Verb + noun | `read_file` | `mcp__hex-line__read_file` | Clear action |
| No redundant prefix | ~~`hex_line_read`~~ | Double prefix | Server name already in path |
| Underscore case | `grep_search` | MCP convention | No camelCase |
| Group by system | `read_file` | Shared family | Agents can allow `mcp__hex-line__*` |

## 2. Response Format — support `format: "compact"|"full"` for verbose tools

| Parameter | Behavior | Example |
|-----------|----------|---------|
| `plain` (boolean) | Omit hash annotations, return `lineNum\|content` | `read_file` with `plain: true` |
| `limit` (number) | Cap returned lines | `read_file` with `limit: 50` |
| `max_entries` (number) | Cap broad pattern/path discovery results | `inspect_path` with `pattern: "*.ts", max_entries: 60` |
| `format` (proposed) | Compact = summary + counts; Full = all data | Large result tools |

Rule: if a tool can return >100 lines, it MUST support truncation or a compact mode and return a concrete next-step hint (`next_action`, refine suggestion, or equivalent).

## 3. Error Design — every error = code + what happened + what to do next

| Error Code | What Happened | Recovery Action |
|------------|---------------|-----------------|
| `FILE_NOT_FOUND` | Path does not exist | List parent directory, check spelling |
| `TEXT_NOT_FOUND` | Search/replace target missing | Show snippet of nearby content |
| `BINARY_FILE` | Binary detected, cannot process | Use built-in Read for images/PDFs |
| `GREP_ERROR` | ripgrep non-zero | Forward stderr, suggest pattern fix |
| `PATH_OUTSIDE_ROOT` | Path escapes allowed root | Show resolved vs allowed root |
| `FILE_TOO_LARGE` | Exceeds size limit | Suggest `outline` then ranged `read_file` |
| `NOOP_EDIT` | Edit produced identical content | Inform file already has desired content |
| `OUT_OF_RANGE` | Line number exceeds file length | Show boundary snippet with hashes |

Anti-pattern: raw stack traces. Agents cannot act on `Error: ENOENT` -- they need recovery actions.

## 4. Tool Descriptions — WHEN to use, not WHAT it does

| Bad | Good |
|-----|------|
| "This tool reads files" | "Read a file with hash-annotated lines. For large code files: use outline first, then read_file with offset/limit." |
| "Searches code" | "Search file contents with ripgrep. Default to summary-first discovery; escalate to edit-ready content only when the next action needs canonical hunks." |
| "Shows file structure" | "AST-based outline. 10-20 lines instead of 500. Use before reading large code files." |

Pattern: `"Use [tool] when [situation]. Prefer over [alternative] because [reason]."`

## 5. Output Bounds — cap all output, silent kill = bug

| Component | Cap Strategy | Implementation |
|-----------|-------------|----------------|
| File content tools | `limit` param, default 2000 lines | `read_file` DEFAULT_LIMIT |
| Search result tools | Summary-first default, bounded content mode, structured refine metadata | `grep_search` with `output="summary"` default plus `next_action`/`suggested_refine_call` |
| Hooks (PostToolUse) | `smartTruncate(text, HEAD, TAIL)` | head 15 + tail 15, gap indicator |
| Hooks (SessionStart) | Fixed injection string | Single `systemMessage`, no file reads |
| Directory listings | `max_depth` for trees, `max_entries` for broad pattern mode | `inspect_path` depth limit + pattern cap |

When truncating, prefer structured metadata that tells the agent how to narrow next. Plain omission markers are secondary.

## 6. High-Level vs Low-Level

| Principle | Bad | Good |
|-----------|-----|------|
| No `list_all_*` | `list_all_files` returns 10K paths | `inspect_path` with depth limit or bounded pattern mode |
| One tool = one decision | `read_and_edit` (two decisions) | Separate `read_file` + `edit_file` |
| Combine read workflows | Two calls always needed | Description guides: "use outline first" |
| Separate user decisions | Tool auto-confirms danger | `AskUserQuestion` pattern: block + ask user |

## 7. `plain` Parameter — verbose tools should offer plain mode

| Offer `plain` | Do NOT offer |
|----------------|-------------|
| Output has structural annotations (hashes, checksums) | Output is already minimal |
| Agent needs raw content for comparison | Annotations required for subsequent edits |
| Human-readable export | Edit workflows depending on hash anchors |

## 8. When NOT to Build an MCP Tool

| Situation | Alternative |
|-----------|-------------|
| Shell one-liner handles it | Bash with hook filtering |
| Static knowledge only | CLAUDE.md or skill reference files |
| Input not validated at runtime | Document the constraint |
| Agent has equivalent built-in | Built-in + hook redirect if needed |

Build a tool when: it saves tokens, adds verification, or prevents errors shell cannot catch.

## 9. Evolution -- periodically review constraints

| Practice | Example |
|----------|--------|
| Review constraints | `TodoWrite` removed from Claude Code -- tools wrapping it become dead weight |
| Track usage patterns | If agents never use `plain`, remove it or make it default |
| Version schemas | Breaking input changes break cached agent behavior |
| Deprecate before removing | "DEPRECATED: use X instead" in description, remove after one cycle |

## 10. Tool Annotations

MCP SDK 1.x annotation hints declare tool behavior shape. Claude Code uses these for permission prompting and subagent capability filtering.

| Annotation | Meaning | When to set |
|------------|---------|-------------|
| `readOnlyHint: true` | Tool does not modify any state | read_file, grep_search, outline, verify, inspect_path, changes |
| `destructiveHint: true` | Tool can delete or overwrite data | bulk_replace |
| `idempotentHint: true` | Repeat calls with same inputs = same result | read_file, outline, verify, write_file (same content) |
| `openWorldHint: true` | Tool interacts with external systems or broad filesystem | grep_search (filesystem), changes (git), ssh-*, install_graph_providers |

Set all applicable hints on every tool registration.

## 11. outputSchema -- declare structured output

Every tool MUST declare `outputSchema` alongside `inputSchema`. Handlers return `{content, structuredContent}` where `structuredContent` matches the schema. `content[0].text` is auto-generated as `JSON.stringify(structuredContent)` per MCP spec backward-compat requirement.

Canonical fields (match [MCP_OUTPUT_CONTRACT_GUIDE.md](./MCP_OUTPUT_CONTRACT_GUIDE.md)):

- `status` -- required, from canonical vocabulary (OK, ERROR, CONFLICT, STALE, etc.)
- `reason` -- machine-readable classifier
- `next_action` -- canonical label from output contract
- `error: {code, message, recovery}` -- only when status is ERROR
- domain-specific payload -- tool-owned fields (matches, outline, etc.)

Domain envelopes (e.g., hex-graph `{query, result, evidence, limits_applied}`) are valid as outputSchema shapes -- do not flatten established envelopes.

## 12. Large results -- `_meta` override

Results >50KB MUST set `_meta["anthropic/maxResultSizeChars"] = 500000` to bypass the default persist cap (Claude Code 2.1.91+). Apply conditionally -- do not set on compact results, it wastes context budget.

Decision rule (`large: true`) when any of:
- `edit_ready=true` flag is set
- `verbosity="full"` is requested
- actual `JSON.stringify(structured).length > 50_000`
- domain-specific full-output flags (`allow_large_output`, `format="full"`)

Shared runtime `result(structured, { large })` handles the mechanics.

**Last Updated:** 2026-04-11

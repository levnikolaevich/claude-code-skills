# Tool Preferences for Code Editing

Enhanced editing tools for code files. Two options available — use whichever is detected.

## Option 1: hashline.mjs (bundled CLI tool)

**Detection:** Check if `shared/tools/hashline.mjs` exists relative to skills repo root.

**Usage via Bash tool:**

```bash
# Read with hash anchors
node shared/tools/hashline.mjs read <file> [--offset N] [--limit N]
# Output: LINE:HASH|content (e.g., "42:b1c2|const x = 5;")

# Edit with hash verification (rejects if file changed since read)
node shared/tools/hashline.mjs edit <file> --edits-file <json-path>
# Edits JSON: [{"anchor": "42:b1c2", "text": "const x = 10;"}]

# Search with hash refs
node shared/tools/hashline.mjs grep <pattern> [path] [--glob "*.ts"]
```

**Workflow:** read -> note anchors -> edit by anchor -> hash mismatch = retry read.

## Option 2: hashline-edit MCP (external server)

**Detection:** `ToolSearch("+hashline-edit")` — if MCP server installed.

| Standard Tool | hashline-edit MCP | Why |
|---------------|-------------------|-----|
| `Read` | `mcp__hashline-edit__read_file` | Hash-prefixed lines |
| `Edit` | `mcp__hashline-edit__edit_file` | Atomic hash-verified edits |
| `Grep` | `mcp__hashline-edit__grep` | Results with LINE:HASH refs |

## When to Use

- **USE for CODE files** (.ts, .js, .py, .go, .rs, .java, etc.) — precision matters
- **DO NOT use for:** JSON configs, small YAML, markdown, .md files — standard tools are fine
- **Fallback:** If neither available, use standard Read/Edit tools. No error.

---
**Version:** 2.0.0
**Last Updated:** 2026-03-19

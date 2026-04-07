# MCP Integration Patterns

<!-- SCOPE: Hex MCP integration patterns for skills. Referenced via MANDATORY READ. -->

## When to Use

These patterns cover the unique workflows agents do not reliably discover on their own. Use `hex-line` for file correctness and `hex-graph` for semantic correctness.

Apply them only when the skill actually edits code or makes semantic decisions from existing code. For docs/community/research/runtime-only skills, standard repo or web workflows stay primary unless the skill explicitly edits local code-like files.

## Patterns

### Outline-First Read

**When:** Unfamiliar code file over 100 lines.  
**Tools:** `outline -> read_file(verbosity="minimal", ranges)`

```text
1. outline(path) -> get function/class structure
2. read_file(path, verbosity="minimal", ranges=[...]) -> read only the needed section
```

### Verified Edit Cycle

**When:** Any code modification.  
**Tools:** `read_file(edit_ready=true, verbosity="full") -> edit_file(base_revision) -> verify`

```text
1. read_file(path, edit_ready=true, verbosity="full") -> capture revision and checksums
2. edit_file(path, edits=[...], base_revision=rev)
3. verify(path, checksums, base_revision=rev) -> confirm no stale state before delayed or mixed-tool follow-up edits
4. If edit_file returns retry_edit / retry_edits / retry_checksum / retry_plan, reuse them directly
5. changes(path=..., compare_against=...) -> review what will be handed off
```

### Semantic Edit Impact

**When:** Editing an existing function, class, route, middleware, public API, or any non-trivial file range.  
**Tools:** `index_project -> analyze_edit_region`

```text
1. index_project(path=project_root)
2. analyze_edit_region(path=project_root, file="src/file.ts", line_start=10, line_end=40)
3. Use impact summary to check callers, downstream flow, clone siblings, and public API risk before editing
```

### Code-Aware Planning

**When:** Story or task planning depends on understanding existing code layout or affected components.  
**Tools:** `index_project -> analyze_architecture -> find_symbols -> inspect_symbol`

```text
1. index_project(path=project_root)
2. analyze_architecture(path=project_root, verbosity="minimal")
3. find_symbols(query="AuthService")
4. inspect_symbol(workspace_qualified_name=...) -> use symbol context to refine task boundaries and dependency order
```

Notes:
- `find_symbols` expects a symbol name or partial name, not a code fragment or unresolved member call such as `server.tool()`
- For raw method-call patterns or regex-like code search, use `grep_search`
- `grep_search` returns `summary` by default; switch to `output="content", edit_ready=true` only when you need canonical hunks for follow-up edits
- Path-scoped graph queries may use `path=project_root`, `path=subdirectory`, or `path=file` as long as the target stays inside the indexed project

### Semantic Diff Review

**When:** Reviewing implementation changes before approval or quality merge.  
**Tools:** `analyze_changes` or `changes`

```text
1. analyze_changes(path=project_root, base_ref="origin/main") -> semantic risk snapshot
2. changes(path="src/", compare_against="HEAD~1") -> structural diff for file-level review
3. Focus review on API risk, deleted symbols, clone risk, and architecture impact
```

### Bulk Cleanup

**When:** Same literal replacement across more than 3 files.  
**Tools:** `bulk_replace(dry_run) -> bulk_replace`

```text
1. bulk_replace(..., dry_run=true) -> preview
2. Review dry_run output
3. bulk_replace(..., dry_run=false) -> apply
```

## Integration in Skills

Add to `allowed-tools` when the skill edits code or reasons about architecture:

```yaml
allowed-tools: Read, Grep, Glob, Bash, mcp__hex-line__inspect_path, mcp__hex-line__outline, mcp__hex-line__read_file, mcp__hex-line__edit_file, mcp__hex-line__verify, mcp__hex-line__changes, mcp__hex-graph__index_project, mcp__hex-graph__analyze_edit_region, mcp__hex-graph__analyze_changes
```

Add body instruction:

```markdown
**Hex MCP acceleration (if available):**
- Use `outline(path)` before reading large code files
- Use `analyze_edit_region(...)` before non-trivial edits to existing code
- Use `analyze_changes(...)` or `changes(...)` before handoff or quality review
- Fall back to standard reads/search only when MCP is unavailable or unsupported
```

## Primary-vs-Fallback Templates

### Code Editing Skill

```markdown
**MANDATORY READ:** Load `shared/references/mcp_tool_preferences.md` and `shared/references/mcp_integration_patterns.md`

Use `hex-line` as the primary path for code/config/script/test files. Built-in Read/Edit/Write/Grep are fallback only when hex-line is unavailable or outside scope.
```

### Semantic Code Reasoning Skill

```markdown
**MANDATORY READ:** Load `shared/references/mcp_tool_preferences.md` and `shared/references/mcp_integration_patterns.md`

If the task depends on symbol identity, references, architecture, semantic diff, or edit blast radius, use `hex-graph` first. Fall back to Grep/Read only when graph is unavailable, unsupported, or not indexed.
```

### Non-Semantic Skill

```markdown
Do not require `hex-graph` here. This skill relies on docs, manifests, GitHub state, web research, or runtime evidence rather than semantic code structure.
```

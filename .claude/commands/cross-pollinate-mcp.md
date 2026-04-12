---
description: "Audit hex MCP servers for transferable optimizations using diff-driven transfer matrix"
allowed-tools: "Bash,Agent,mcp__hex-line__read_file,mcp__hex-line__grep_search,mcp__hex-line__outline,mcp__hex-line__edit_file,mcp__hex-line__write_file,mcp__hex-line__changes,mcp__hex-graph__index_project,mcp__hex-graph__find_symbols,mcp__hex-graph__find_references,mcp__hex-graph__find_implementations,mcp__hex-graph__inspect_symbol,mcp__hex-graph__analyze_changes,mcp__hex-graph__trace_paths"
---

# Cross-Pollinate Hex MCP Servers

Diff-driven audit: find real transferable changes across hex-line-mcp, hex-ssh-mcp, hex-graph-mcp. Each delta is classified, not blindly ported.

## Source

| Field | Value |
|-------|-------|
| Source | Repo-maintained MCP maintenance command |
| Review Contract | `skills-catalog/ln-162-skill-reviewer/references/command_review_criteria.md` |
| MCP Guidance | `docs/best-practice/MCP_TOOL_DESIGN_GUIDE.md` |

## Command Actions

- Audit current hex MCP deltas.
- Compare transferable changes across sibling MCP servers.
- Report concrete port, skip, or follow-up decisions.

| Server | Directory | Tools | Role |
|--------|-----------|-------|------|
| hex-line-mcp | `mcp/hex-line-mcp/` | 11 | Local file ops (source of current deltas) |
| hex-ssh-mcp | `mcp/hex-ssh-mcp/` | 6 | SSH remote ops |
| hex-graph-mcp | `mcp/hex-graph-mcp/` | 15 | Workspace-first code knowledge graph |

---

### Phase 0: Change Inventory

Start from actual changes, not theoretical checklists.

```bash
git diff --stat -- mcp/hex-line-mcp/
git status -- mcp/hex-line-mcp/
```

**Semantic classification via hex-graph** (run `index_project` once at start):

```
mcp__hex-graph__analyze_changes(path: "mcp/hex-line-mcp")
mcp__hex-graph__find_symbols(pattern: "export", path: "mcp/hex-line-mcp/server.mjs")
```

Classify each changed symbol by category:

| Category | Detection method |
|----------|------------------|
| API/schema | `analyze_changes` shows modified `registerTool` calls or input schemas |
| Runtime behavior | `analyze_changes` shows modified non-exported functions |
| Output normalization | Changed functions with names matching `format`, `truncate`, `normalize`, `dedup` |
| Shared infra | Changes in files imported by 2+ servers (`find_references` cross-check) |
| Tests | Changed files under `test/` or `benchmark/` |
| Docs | Changed `.md` files |

### Phase 1: Transfer Matrix

For EACH change from Phase 0, check if it applies to hex-ssh and hex-graph.

**Use hex-graph to verify target server status:**

```
# Check if equivalent function exists in target
mcp__hex-graph__find_symbols(pattern: "{function_name}", path: "mcp/hex-ssh-mcp/")
mcp__hex-graph__find_symbols(pattern: "{function_name}", path: "mcp/hex-graph-mcp/")

# Compare signatures between source and target
mcp__hex-graph__inspect_symbol(symbol: "{function_name}", path: "mcp/hex-line-mcp/server.mjs")
mcp__hex-graph__inspect_symbol(symbol: "{function_name}", path: "mcp/hex-ssh-mcp/server.mjs")

# Trace dependency chain in target to understand blast radius
mcp__hex-graph__trace_paths(from: "{changed_file}", to: "server.mjs", path: "mcp/hex-ssh-mcp/")
```

**Decision categories:**
- `APPLY` -- real gap, same pattern needed in target server
- `ALREADY_PRESENT` -- target already has equivalent (verified via `find_symbols`)
- `N/A_BY_DESIGN` -- change is domain-specific to source (e.g., local-only, SSH-only)
- `REJECT` -- change would hurt target server

**Required evidence:** file + line reference for BOTH source change AND target server status. Use `hex-line grep_search` for edit-ready anchors.

Output:
### Shared optimization checks (verify via hex-graph + hex-line):

| Check | Query | What to look for |
|-------|-------|------------------|
| Dynamic version | `find_symbols(query: "createRequire")` | Should exist in all 3 servers; hardcoded version string = gap |
| Dead imports | `find_references(name: "{import}", file: "{file}")` | 0 refs = dead import to remove |
| Safe process spawning | `find_symbols(query: "execSync")` | Should be `execFileSync` (arg array) in production code |
| Tool registration | `grep_search(pattern: "server\\.tool\\(")` | hex-graph can't index method calls; use grep |
| CRLF normalization | `grep_search(pattern: "\\r\\n")` | Consistent `.replace(/\r\n/g, "\n")` where files are read |
| Benchmark parity | `grep_search(pattern: "benchmark", glob: "*.mjs")` | README claims token efficiency -> benchmark.mjs must exist |

### Phase 2: Apply Transfers

Implement all `APPLY` decisions from Phase 1.

For each change:
1. Read target file with `hex-line outline` then targeted `read_file` ranges
2. Use `hex-graph analyze_edit_region` before editing to understand surrounding context
3. Apply the change via `hex-line edit_file` (carry `base_revision` for follow-ups)
4. Verify syntax: `npm run check` in target package
### Phase 3: Local Cleanup (optional)

If Phase 0 revealed drift in hex-line's own docs (README factual errors, hook regex issues), fix them here. Label findings as "local cleanup".

Use `hex-line grep_search` for edit-ready matches in files touched by Phase 0:
- **README accuracy** -- tool counts via `hex-graph find_symbols(pattern: "registerTool")`, parameter tables, constants match code
- **Hook correctness** -- regex patterns don't over-match (e.g., `find -exec rm`)
### Phase 4: Verify

```bash
cd mcp/hex-ssh-mcp && npm run check && npm run lint && npm test
cd mcp/hex-graph-mcp && npm run check && npm run lint && npm test  
cd mcp/hex-line-mcp && npm run check && npm run lint && npm test
```

**Gate:** 0 errors on all 3 servers.

### Phase 5: Report + Meta-Analysis

Output two tables:

**Real Transfer Gaps:**

| Change | Source | Target | Status | Action | Rationale |
|--------|--------|--------|--------|--------|-----------|

**Non-Gaps / N/A by Design:**

| Change | Source | Target | Decision | Rationale |
|--------|--------|--------|----------|-----------|

List all files created or modified.

---

### Meta-Analysis

**MANDATORY READ:** Load `shared/references/meta_analysis_protocol.md`

Analyze this session per protocol. Output per protocol format.

---
**Last Updated:** 2026-04-12

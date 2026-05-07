<!-- SOURCE-OF-TRUTH: shared/references/mcp_tool_preferences.md. Edit ONLY here; run `node tools/marketplace/shared.mjs sync` -->

# Tool Preferences for Code Work

Repo-level MCP policy for code files and semantic codebase analysis.

## Primary Policy

- Use `hex-line` first when a skill materially reads or edits source code, config, scripts, or test files.
- Use `hex-graph` first when a skill must reason about existing code semantics: symbol identity, references, edit blast radius, architecture, clone groups, or semantic diff risk.
- Use built-in `Read/Edit/Write/Grep` only as named fallback when the relevant MCP is unavailable, unsupported for the file/task, or outside MCP scope.
- When the `hex-line` hook is active, project-scoped text `Read/Edit/Write/Grep/Glob` receive hex-line guidance by default; explicit `hooks.mode: "blocking"` redirects them to `hex-line`. Built-in exceptions are binary/media, plan files in Plan Mode, and text paths outside the current project root.
- Use shell only as named fallback for repo inspection when MCP is unavailable, unsupported, or outside scope.
- Do not use shell repo-wide search or read patterns such as `rg`, `grep`, `cat`, `find`, or recursive tree dumps when `hex-line` or `hex-graph` covers the task.
- Do not cargo-cult `hex-graph` into planning, docs, community, research, or runtime-only skills that do not make semantic code decisions.

## Applicability Matrix

| Skill behavior | Primary tool | Policy |
|------|------|------|
| Edits code, config, scripts, tests | `hex-line` | REQUIRED |
| Reads existing code to make semantic decisions | `hex-graph` + `hex-line` | REQUIRED |
| Reads code for local structure only | `hex-line` | RECOMMENDED |
| Markdown/doc-only structure or content work | none by default | OPTIONAL |
| Planning/business prioritization/external research | none by default | AVOID graph |
| Community/GitHub engagement | none by default | AVOID both unless editing local templates |
| Runtime verification, benchmark, profiling, container launch | none by default | AVOID graph as evidence source |

## Operational Rules

- Preferred `hex-line` flow: `inspect_path -> outline -> read_file(discovery) -> read_file(edit_ready=true, verbosity="full") only when revision/checksums are required -> edit_file(base_revision) -> verify`
- Preferred `hex-graph` flow: `index_project -> find_symbols/inspect_symbol -> analyze_edit_region or analyze_changes`
- For repo structure or code discovery, prefer `inspect_path`, `outline`, and targeted `read_file` over shell `ls`, `tree`, `cat`, or bulk dumps
- `inspect_path` defaults to a minimal tree; request deeper output only when structure discovery is insufficient
- Do not begin with repo-root wildcard discovery such as `inspect_path(path=<repo>, pattern="*.md")` unless you explicitly need a repo-wide inventory
- In pattern mode, treat `inspect_path` truncation metadata as a signal to narrow `path` before asking for more entries
- `read_file` defaults to discovery-first plain output; request `edit_ready=true, verbosity="full"` before carrying `revision` and checksums into an edit workflow
- `grep_search` defaults to `summary`; request `output_mode="content", edit_ready=true` only when canonical search hunks/checksums are needed
- For text search in repo files, prefer `grep_search(summary)` before any shell search; escalate to `output_mode="content"` only after narrowing `path`, `glob`, or pattern, or when canonical hunks are required
- `allow_large_output=true` is an explicit escape hatch for `grep_search(output_mode="content")`; default capped output is the preferred discovery behavior
- `analyze_architecture`, `audit_workspace`, and `analyze_edit_region` use `verbosity` (`minimal|compact|full`) instead of `detail_level`
- Use `audit_workspace` as a bounded maintenance preview: start with `verbosity="minimal"` and a `scope` when known; raise `limit` or `clone_member_limit` only for a deliberate deeper review
- `find_symbols` is for symbol names or partial names, not code fragments like `export function` and not unresolved member calls like `server.tool()` or `app.get(...)`
- Do not use `find_symbols` on broad/common bare names until you can narrow by `path` or immediately refine with `name + file`
- Path-scoped `hex-graph` query tools accept the indexed project root or any file/subdirectory inside that indexed project
- Use `grep_search` for raw method-call patterns such as `app.get(...)`, `router.use(...)`, or `server.registerTool(...)`
- Use `hex-line` for config, scripts, and tests when those files are part of the deliverable
- Use `hex-line outline` first for large markdown files, then targeted reads by section
- Carry the latest `revision` into same-file follow-up edits as `base_revision`
- Before delayed retries, formatter runs, or cross-tool follow-ups on the same file, run `verify` instead of blindly rereading
- Treat `retry_edit`, `retry_edits`, `retry_checksum`, and `retry_plan` as canonical recovery helpers
- `hex-line` hashes normalized logical text but preserves existing file line endings and trailing-newline shape on write
- Use `hex-graph` for planning when Story or Task affects existing code and real affected modules or task boundaries are unclear
- Use `hex-graph` for implementation or review before editing existing functions, classes, routes, or public APIs
- Do not use `hex-graph` as a runtime profiler; benchmark and profiler data remain the source of truth

## Fallback Contract

Use standard tools only when one of these is true:
- MCP server is unavailable or failing
- target language is unsupported by `hex-graph`
- task is outside MCP scope, such as images, PDFs, notebooks, external websites, pure GitHub mutations, or text paths outside the current project root
- target file is small markdown or metadata where MCP setup adds no value
- task is Git history, build/test/runtime execution, package management, container control, or another shell-native workflow with no MCP equivalent

Fallbacks must be explicit in the skill:
- `hex-line` fallback -> built-in `Read/Edit/Write/Grep`
- `hex-graph` fallback -> built-in `Grep/Glob/Read` with manual reasoning

## Canonical Detail Sources

- Package and tool behavior: `mcp/hex-line-mcp/README.md`, `mcp/hex-graph-mcp/README.md`, and the MCP server tool descriptions
- Repo usage policy: this file plus `mcp_integration_patterns.md` and `mcp_applicability_matrix.md`

---
**Version:** 5.0.0
**Last Updated:** 2026-03-20

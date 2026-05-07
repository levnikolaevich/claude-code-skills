<!-- SOURCE-OF-TRUTH: shared/references/mcp_applicability_matrix.md. Edit ONLY here; run `node tools/marketplace/shared.mjs sync` -->

# MCP Applicability Matrix

<!-- SCOPE: Catalog-wide policy for when skills should prefer hex-line, prefer hex-graph, or avoid them. Used by skill authors and ln-162-skill-reviewer. -->

## Core Rule

- `hex-line` is primary for code-like file interaction.
- `hex-graph` is primary for semantic understanding of existing codebases in supported languages.
- Built-in file/search tools are fallback only.
- Skills that do not make code-file or semantic-code decisions should not mention these MCPs just to look consistent.

## Family Matrix

| Skill family | `hex-line` | `hex-graph` | Notes |
|------|------|------|------|
| `ln-300` planning for existing-code Stories | optional | REQUIRED | Use graph to ground affected modules and task boundaries |
| `ln-401` to `ln-404` execution and rework | REQUIRED | conditional | Graph only when editing existing symbols or checking blast radius |
| `ln-510` to `ln-512` quality and cleanup | REQUIRED | REQUIRED | Quality decisions depend on semantic diff, clones, dead code, references |
| `ln-610` to `ln-612` docs audits | optional | avoid | Docs structure/content checks are not graph problems |
| `ln-613` code comments audit | REQUIRED | avoid | Needs code-file reads, not semantic graph decisions |
| `ln-614` docs fact checking | REQUIRED | conditional | Graph only for entity/reference ambiguity |
| `ln-620` to `ln-654` code, architecture, persistence, test audits | optional | REQUIRED | Graph is primary for semantic findings; hex-line only when code-file reads need safer structure |
| `ln-700` bootstrap coordinators | optional | conditional | Graph helps only in transform/existing-code analysis |
| `ln-720` to `ln-775` generators, restructurers, setup workers | REQUIRED | conditional | Graph only when migrating existing code or checking references |
| `ln-780` to `ln-783` verifiers/runners | avoid | avoid | Runtime/build/container evidence is primary |
| `ln-810` to `ln-814` optimization | REQUIRED for executor | conditional | Graph can narrow hotspots; profiler/benchmark stays source of truth |
| `ln-820` to `ln-823` dependency upgrades | REQUIRED for manifest/code edits | conditional | Graph only when usage impact matters |
| `ln-830` to `ln-832` modernization | REQUIRED | REQUIRED | Replacement and optimization need safe edits plus reference analysis |
| `ln-910` to `ln-914` community | avoid | avoid | GitHub/community state is primary |
| `ln-110`, `ln-130`, `ln-200`, `ln-230`, `ln-521`, `ln-812` | avoid by default | avoid | Docs, planning, market research, and external research should not force MCP code tools |

## Structural Expectations

If a skill is marked `REQUIRED`:
- include the relevant tool names in `allowed-tools`
- load `references/mcp_tool_preferences.md`
- for semantic-code skills, also load `references/mcp_integration_patterns.md`
- state primary-vs-fallback ordering in the body

If a skill is marked `avoid`:
- do not add `hex-graph` or `hex-line` unless the workflow truly edits local code-like files
- if used anyway, justify the use case in scope text

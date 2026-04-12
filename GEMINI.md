# GEMINI.md

<!-- Projection of AGENTS.md via the @ import. AGENTS.md is the canonical source. Do not duplicate content here — add it to AGENTS.md instead. -->

@AGENTS.md

## Gemini CLI

- Context-compression preservation order: architecture decisions, modified files, verification status, open TODOs, tool outputs as summaries only.
- Run `/memory show` to inspect the resolved context (AGENTS.md + this file + any nested GEMINI.md files) and `/memory reload` after editing AGENTS.md.
- For modular context, use `@relative/path.md` imports in GEMINI.md itself — same 5-hop recursion limit as Claude Code.

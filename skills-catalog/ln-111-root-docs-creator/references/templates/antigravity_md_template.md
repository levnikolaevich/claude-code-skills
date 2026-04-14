# {{PROJECT_NAME}}

<!-- SCOPE: Thin Google Antigravity projection of AGENTS.md. AGENTS.md is the canonical source. Do not duplicate content here — add it to AGENTS.md instead. -->
<!-- DOC_KIND: index -->
<!-- DOC_ROLE: derived -->
<!-- READ_WHEN: Antigravity loads skill and agent metadata at session start from the global skills root `~/.gemini/antigravity/skills/` and the workspace-scoped `<workspace>/.agents/skills/`. -->
<!-- SKIP_WHEN: AGENTS.md is already the canonical context source. -->
<!-- PRIMARY_SOURCES: AGENTS.md -->

@AGENTS.md

## Google Antigravity

- Global skills live under `~/.gemini/antigravity/skills/`. Workspace-scoped skills live under `<workspace>/.agents/skills/`. Both roots may be active in the same session.
- Custom chat commands go in `<workspace>/.agents/workflows/` as plain text files and are registered automatically.
- Antigravity agents can use the locally authenticated `gcloud` CLI directly; no extra auth wiring is needed in skills.
- When editing this file, keep it thin — move shared guidance into `AGENTS.md` so Codex/Gemini/Claude/Antigravity all see the same canonical source.

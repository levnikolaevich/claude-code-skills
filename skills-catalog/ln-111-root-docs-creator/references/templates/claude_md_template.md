# {{PROJECT_NAME}}

<!-- SCOPE: Anthropic-specific derived entrypoint ONLY. Points to AGENTS.md and adds provider-specific notes when needed. -->
<!-- DOC_KIND: index -->
<!-- DOC_ROLE: derived -->
<!-- READ_WHEN: Read when tooling expects CLAUDE.md or when Anthropic-specific notes are needed. -->
<!-- SKIP_WHEN: Skip when AGENTS.md is already loaded and no Claude-specific note is required. -->
<!-- PRIMARY_SOURCES: AGENTS.md -->

## Quick Navigation

| Need | Read |
|------|------|
| Canonical project map | [AGENTS.md](AGENTS.md) |
| Documentation hub | [docs/README.md](docs/README.md) |


## Agent Entry

- Purpose: Thin Anthropic-specific entrypoint for tooling that loads `CLAUDE.md`.
- Read when: Tooling loads `CLAUDE.md` by convention or provider-specific notes are required.
- Skip when: `AGENTS.md` is already loaded.
- Canonical: No.
- Read next: `AGENTS.md`.
- Primary sources: `AGENTS.md`.

## Anthropic Notes

- Load [AGENTS.md](AGENTS.md) as the canonical project map.
- Use the relevant canonical document from [docs/README.md](docs/README.md) before editing a domain.
- Keep this file small. Do not duplicate the full project knowledge base here.

## Maintenance

**Update Triggers:**
- When `AGENTS.md` path or purpose changes
- When Anthropic-specific notes change

**Verification:**
- [ ] `AGENTS.md` link resolves
- [ ] No duplicated large guidance block was added here
- [ ] Provider-specific notes are still accurate

**Last Updated:** {{DATE}}

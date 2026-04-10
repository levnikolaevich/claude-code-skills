# Documentation Standards

<!-- SCOPE: Reference rules for generated project documentation ONLY. Defines structure, writing, and verification requirements. -->
<!-- DOC_KIND: reference -->
<!-- DOC_ROLE: canonical -->
<!-- READ_WHEN: Read when creating, updating, auditing, or validating project documentation. -->
<!-- SKIP_WHEN: Skip when you only need the project map or a specific project-domain fact. -->
<!-- PRIMARY_SOURCES: docs/documentation_standards.md, docs/principles.md -->

## Quick Navigation

| Need | Read |
|------|------|
| Project map | [README.md](README.md) |
| Principles behind the rules | [principles.md](principles.md) |


## Agent Entry

- Purpose: Canonical reference for documentation requirements and validation rules.
- Read when: You are creating, editing, or auditing documentation.
- Skip when: You only need a domain-specific project fact.
- Canonical: Yes.
- Read next: `principles.md` for rationale or the target doc you are editing.
- Primary sources: `docs/documentation_standards.md`, `docs/principles.md`.

## Critical Requirements

| Requirement | Why It Exists |
|-------------|---------------|
| `AGENTS.md` is the canonical machine-facing root doc | Keeps the always-loaded entrypoint small and stable |
| `CLAUDE.md` stays a thin derived Anthropic entrypoint | Avoids duplicate persistent context |
| Every generated doc has the standard header contract | Enables deterministic routing and auditing |
| Every generated doc has `Quick Navigation`, `Agent Entry`, and `Maintenance` | Enables section-first reading |
| No raw placeholders outside allowlisted task setup docs | Published docs must be immediately usable |
| Prefer links and source references over embedded implementation code | Keeps docs concise and reduces drift |

## Structural Rules

| Rule | Requirement |
|------|-------------|
| Header contract | `SCOPE`, `DOC_KIND`, `DOC_ROLE`, `READ_WHEN`, `SKIP_WHEN`, `PRIMARY_SOURCES` |
| Top sections | `Quick Navigation`, `Agent Entry`, `Maintenance` |
| Doc kinds | `index`, `reference`, `how-to`, `explanation`, `record` |
| Doc roles | `canonical`, `navigation`, `working`, `derived` |
| Root model | `AGENTS.md` canonical, `CLAUDE.md` derived |

## Writing Rules

| Rule | Guidance |
|------|----------|
| Map-first | Put routing and purpose before details |
| Section-first | Make top sections enough for initial triage |
| Single source of truth | One canonical document per topic |
| Stack adaptation | Use official docs and stack-appropriate references |
| Token efficiency | Prefer tables, short bullets, and direct links over long prose |

## Verification Checklist

- [ ] Header contract complete
- [ ] Top sections present
- [ ] Internal links resolve
- [ ] No leaked template metadata
- [ ] No forbidden placeholders outside allowlisted setup docs
- [ ] `Maintenance` markers complete
- [ ] External docs links use official domains for the stack

## Maintenance

**Update Triggers:**
- When the shared docs-quality contract changes
- When document kinds or roles change
- When read protocol changes
- When root entrypoint model changes

**Verification:**
- [ ] Matches the shared docs-quality contract
- [ ] Verification checklist remains actionable
- [ ] Root entrypoint rules are accurate

**Last Updated:** {{DATE}}

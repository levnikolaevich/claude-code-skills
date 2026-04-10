# Documentation Standards

**Requirements for project documentation generated and audited by this repository**

<!-- SCOPE: Documentation requirements for target project docs created by skills. Defines root entrypoint model, header contract, doc kinds, and verification priorities. -->

## Critical Requirements

| Requirement | Why It Exists |
|-------------|---------------|
| `AGENTS.md` is the canonical machine-facing entrypoint | Keeps the always-loaded map small and stable |
| `CLAUDE.md` stays a thin derived Anthropic entrypoint | Avoids duplicated persistent context |
| Every generated doc has the standard header contract | Enables routing and deterministic audits |
| Every generated doc has `Quick Navigation`, `Agent Entry`, and `Maintenance` | Enables section-first reads |
| No raw placeholders outside allowlisted setup docs | Generated docs must be publishable immediately |
| Stack references use official sources | Reduces drift and hallucinated guidance |

## Standard Header Contract

Every generated markdown doc must contain:

- `SCOPE`
- `DOC_KIND`
- `DOC_ROLE`
- `READ_WHEN`
- `SKIP_WHEN`
- `PRIMARY_SOURCES`

These markers belong near the top of the file in HTML comments.

## Standard Top Sections

Every generated markdown doc must expose the same top scan shape:

- `Quick Navigation`
- `Agent Entry`
- body sections by purpose
- `Maintenance`

`Agent Entry` should state:
- purpose
- when to read
- when to skip
- whether the doc is canonical
- what to read next
- what the primary truth sources are

## Root Entrypoint Model

| File | Role |
|------|------|
| `AGENTS.md` | Canonical vendor-neutral root map |
| `CLAUDE.md` | Anthropic-compatible thin wrapper |
| `docs/README.md` | Canonical documentation hub |

Root docs should be map-first:
- small enough to stay cheap in context
- explicit about routing
- light on deep domain detail

## Document Kinds

| DOC_KIND | Use For |
|----------|---------|
| `index` | navigation and routing |
| `reference` | precise lookup |
| `how-to` | executable procedure |
| `explanation` | rationale and mental model |
| `record` | decision history |

Do not mix these purposes casually inside one file.

## Writing Rules

| Rule | Guidance |
|------|----------|
| Map-first | Put routing and read/skip hints before depth |
| Section-first | Make top sections enough for the first decision |
| Single source of truth | One canonical doc per topic |
| Token efficiency | Prefer tables, short bullets, and direct links |
| AI-friendly prose | Short sentences, active voice, consistent terminology |

## Verification Priorities

- header contract complete
- top sections present
- internal links resolve
- maintenance markers present
- no leaked template metadata
- no forbidden placeholders outside allowlisted setup docs
- stack-appropriate official links

## Maintenance

**Update Triggers:**
- when shared docs-quality contract changes
- when root entrypoint model changes
- when doc kinds or roles change
- when read protocol changes

**Verification:**
- [ ] Matches the shared docs-quality contract
- [ ] Root entrypoint model is accurate
- [ ] Verification priorities are still actionable

**Version:** 3.0.0
**Last Updated:** 2026-03-15

# Development Principles

<!-- SCOPE: Project development principles and tradeoffs ONLY. Contains reusable principles, decision order, anti-patterns, and verification guidance. -->
<!-- DOC_KIND: explanation -->
<!-- DOC_ROLE: canonical -->
<!-- READ_WHEN: Read when making implementation or documentation decisions and you need the governing principles. -->
<!-- SKIP_WHEN: Skip when you only need routing or exact factual lookup. -->
<!-- PRIMARY_SOURCES: docs/principles.md, docs/documentation_standards.md -->

## Quick Navigation

| Need | Read |
|------|------|
| Documentation rules | [documentation_standards.md](documentation_standards.md) |
| Documentation map | [README.md](README.md) |
| Testing strategy | [reference/guides/testing-strategy.md](reference/guides/testing-strategy.md) |

## Agent Entry

- Purpose: Explain the project’s governing principles and decision hierarchy.
- Read when: You need to choose between alternatives or justify a tradeoff.
- Skip when: You only need a direct factual lookup.
- Canonical: Yes.
- Read next: The relevant project or reference doc for the concrete domain.
- Primary sources: `docs/principles.md`, `docs/documentation_standards.md`.

## Core Principles

| # | Principle | Application |
|---|-----------|-------------|
| 1 | Standards First | Industry standards override convenience |
| 2 | YAGNI | Build only what is needed now |
| 3 | KISS | Prefer the simplest correct solution |
| 4 | DRY | Keep one source of truth per concept |
| 5 | Consumer-First Design | Design interfaces from the caller’s perspective |
| 6 | No Legacy Code | Remove dead compatibility layers quickly |
| 7 | Documentation-as-Code | Update docs with code changes |
| 8 | Security by Design | Treat security as a design concern, not a patch |
| 9 | Auto-Generated Migrations Only | Keep schema evolution derived from source models |

## Decision Framework

1. Security
2. Standards compliance
3. Correctness
4. Simplicity
5. Necessity
6. Maintainability
7. Performance

## Anti-Patterns

- God objects
- Premature optimization
- Over-engineering
- Magic constants scattered across the codebase
- Leaky abstractions

## Verification Checklist

- [ ] Standards compliance considered first
- [ ] Unnecessary complexity avoided
- [ ] Duplicate knowledge removed or linked
- [ ] Documentation updated with code changes
- [ ] Security implications checked

## Maintenance

**Update Triggers:**
- When project principles change
- When tradeoff priorities change
- When new recurring anti-patterns appear

**Verification:**
- [ ] Principles still reflect the project
- [ ] Decision order still matches team expectations
- [ ] Anti-pattern list is current

**Last Updated:** {{DATE}}

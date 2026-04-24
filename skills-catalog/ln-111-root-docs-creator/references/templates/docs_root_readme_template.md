# Documentation System

<!-- SCOPE: Documentation hub and navigation layer ONLY. Routes readers to canonical documents and explains the documentation map. -->
<!-- DOC_KIND: index -->
<!-- DOC_ROLE: canonical -->
<!-- READ_WHEN: Read when you need the documentation map or want to locate the canonical doc for a topic. -->
<!-- SKIP_WHEN: Skip when you already know the exact canonical document. -->
<!-- PRIMARY_SOURCES: docs/README.md, docs/documentation_standards.md, docs/principles.md -->

## Quick Navigation

| Area | Canonical Docs | Purpose |
|------|----------------|---------|
| Root map | [AGENTS.md](../AGENTS.md), [CLAUDE.md](../CLAUDE.md) | Entry points (AGENTS.md canonical; CLAUDE.md is an @AGENTS.md import stub) |
| Standards | [documentation_standards.md](documentation_standards.md) | Documentation rules |
| Principles | [principles.md](principles.md) | Project development principles |

| Project docs | [project/requirements.md](project/requirements.md), [project/architecture.md](project/architecture.md), [project/tech_stack.md](project/tech_stack.md) | Core project knowledge |
| Tasks | [tasks/README.md](tasks/README.md), [tasks/kanban_board.md](tasks/kanban_board.md) | Workflow and live task state |
| Tests | [../tests/README.md](../tests/README.md), [reference/guides/testing-strategy.md](reference/guides/testing-strategy.md) | Testing map and strategy |

## Agent Entry

- Purpose: Route readers to the right canonical document and avoid duplicate reads.
- Read when: You need to find the next relevant documentation source.
- Skip when: You already know the target canonical doc.
- Canonical: Yes.
- Read next: The canonical doc in the area you need.
- Primary sources: `docs/README.md`, `docs/documentation_standards.md`, `docs/principles.md`.

## Documentation Map

| Area | What It Owns | What It Does Not Own |
|------|---------------|----------------------|
| `docs/project/` | Requirements, architecture, stack, operations | Reference patterns, tasks, tests |
| `docs/reference/` | ADRs, guides, manuals | Core project state |
| `docs/tasks/` | Workflow rules and live task navigation | Implementation details |
| `tests/` | Test organization and execution docs | Product requirements or architecture |

## Writing Rules

- Use one canonical document per topic.
- Keep routing docs short and link outward.
- Follow the header contract and top-section contract from [documentation_standards.md](documentation_standards.md).
- Keep generated docs publishable: no raw placeholders outside allowlisted setup docs.

## Maintenance

**Update Triggers:**
- When canonical docs are added, removed, or renamed
- When documentation ownership boundaries change
- When documentation standards or principles move

**Verification:**
- [ ] All listed canonical docs exist
- [ ] Links resolve
- [ ] Ownership boundaries remain accurate

**Last Updated:** {{DATE}}

# Procedural Extraction Rules

<!-- SCOPE: Shared scoring rules for extracting procedural sections from markdown docs into .claude/commands. Used by ln-160 and ln-161. -->

Score each candidate section independently. Sum procedural and declarative weights, then apply the thresholds below.

## Read Filter First

Ignore these parts before scoring:
- header markers such as `SCOPE`, `DOC_KIND`, `DOC_ROLE`, `READ_WHEN`, `SKIP_WHEN`, `PRIMARY_SOURCES`
- `Quick Navigation`
- `Agent Entry`
- `Maintenance`

If the document declares `DOC_KIND`, use it as a routing hint:
- `how-to` -> procedural by default unless the section is purely explanatory
- `reference` -> neutral; score normally
- `index` -> usually routing only; extract only clearly procedural sections such as `Running Tests`
- `explanation` -> declarative by default
- `record` -> declarative by default

## Procedural Signals

| Signal | Weight | Detection Pattern |
|--------|--------|-------------------|
| Numbered steps (3+) | +3 | `^\\d+\\.` or `Step \\d` with 3+ consecutive occurrences |
| Shell code blocks | +2 | Fenced blocks with `bash`, `sh`, `shell`, `zsh` |
| Imperative verbs at line start | +2 | Run, Execute, Deploy, Install, Connect, Stop, Start, Configure, Check, Verify, Build, Restart |
| Troubleshooting patterns | +2 | Headers containing `Troubleshoot`, `Fix`, `Debug`, `If`, `When` with actions |
| Prerequisites section | +1 | `Prerequisites`, `Requirements`, `Before you begin` |
| CLI invocations | +1 | npm, pnpm, yarn, docker, kubectl, git, pip, uv, dotnet, curl, ssh |
| Conditional instructions | +1 | `If {condition}, {action}` with imperative follow-up |

## Declarative Signals

| Signal | Weight | Detection Pattern |
|--------|--------|-------------------|
| Architecture descriptions | +2 | layer, component, module, pattern, principle, architecture |
| Requirement statements | +2 | shall, must support, requirement, feature, constraint |
| Data tables without actions | +1 | Version, Type, Schema, Mapping tables |
| API spec format | +1 | endpoint definitions, request/response schemas, HTTP methods |
| Diagrams | +1 | mermaid, plantuml, ASCII diagrams, C4 notation |
| Reference lists | +1 | section is mostly links or canonical references |

## Thresholds

| Condition | Classification | Action |
|-----------|----------------|--------|
| `proc >= 4` and `proc > decl * 2` | PROCEDURAL | Extract to `.claude/commands/` |
| `decl >= 4` and `decl > proc * 2` | DECLARATIVE | Keep as documentation |
| Both >= 3 | MIXED | Extract only the procedural subsection |
| Both < 3 | THIN | Skip |

## Source Hints

| Source | Section | Expected Classification |
|--------|---------|------------------------|
| `docs/project/runbook.md` | most sections | PROCEDURAL |
| `docs/project/infrastructure.md` | inventory, topology, ports | DECLARATIVE |
| `docs/project/infrastructure.md` | SSH access, service operations | PROCEDURAL |
| `docs/reference/guides/testing-strategy.md` | philosophy, principles | DECLARATIVE |
| `docs/reference/guides/testing-strategy.md` | running tests, commands | PROCEDURAL |
| `tests/README.md` | test organization | DECLARATIVE |
| `tests/README.md` | quick commands, running tests | PROCEDURAL |
| `docs/reference/guides/*.md` | setup, migration, operations | PROCEDURAL |
| `docs/reference/manuals/*.md` | API or schema reference | DECLARATIVE |

## Command Name Generation

1. Start from the section header
2. Lowercase and replace spaces with hyphens
3. Remove articles and low-signal prepositions
4. Keep at most 3 words
5. Add `.md`

Examples:
- `Deployment Procedure` -> `deploy.md`
- `Running Automated E2E Tests` -> `run-e2e-tests.md`
- `SSH Access to Production` -> `ssh-production.md`

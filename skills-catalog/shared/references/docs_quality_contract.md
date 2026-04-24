# Docs Quality Contract

<!-- SCOPE: Shared contract for documentation creation and documentation audit families. Defines SSOT for document headers, doc kinds, top sections, placeholders, freshness, link validity, and read protocol without coupling family workflows. -->

Unified acceptance rules for generated project documentation.

This file is the human-readable source of truth for:
- `ln-100-documents-pipeline` inline quality gate
- creator skills (`ln-111` .. `ln-115`, `ln-120`, `ln-130`, `ln-140`)
- `ln-610` family audit workers when auditing markdown documentation

Machine-readable enforcement lives in `shared/references/docs_quality_rules.json`.

---

## Gate Goal

Generated documentation must be publishable immediately after `ln-100` finishes.

Minimum acceptance:
- no `CRITICAL` or `HIGH` docs-quality findings
- no unreplaced template markers
- no forbidden placeholder text in non-allowlisted files
- no broken internal links
- required header markers present
- required top sections present

`ln-100` uses this contract for publishable-output acceptance. The docs-audit family may reuse the same contract independently.

---

## Map-First Model

Generated docs must be easy for both humans and agents to route through.

This repository uses a **map-first, section-first** model:
- start with a small entrypoint and routing hints
- show purpose and read/skip guidance before details
- keep canonical facts in one place and link outward
- read markdown progressively, not all-at-once by default

Root entrypoint rule:
- `AGENTS.md` is the canonical machine-facing project map
- `CLAUDE.md` is a thin Anthropic-compatible shim that points to `AGENTS.md` and adds only provider-specific notes

---

## Standard Header Contract

Every generated markdown document begins with machine-readable top comments:

```html
<!-- SCOPE: ... -->
<!-- DOC_KIND: index|reference|how-to|explanation|record -->
<!-- DOC_ROLE: canonical|navigation|working|derived -->
<!-- READ_WHEN: ... -->
<!-- SKIP_WHEN: ... -->
<!-- PRIMARY_SOURCES: pathA, pathB -->
```

Rules:
- header markers must appear near the top of the file
- `PRIMARY_SOURCES` lists the main code/config/docs truth sources for the file
- `DOC_ROLE=canonical` means this document is the primary source for its topic
- `DOC_ROLE=navigation` means the document mainly routes to other docs

---

## Standard Top Sections

Every generated doc must expose the same top scan pattern:
- `## Quick Navigation`
- `## Agent Entry`
- body sections by document kind
- `## Maintenance`

`Agent Entry` must state:
- purpose
- when to read this doc
- when to skip it
- whether it is canonical
- what to read next
- which sources are the main truth sources

---

## Document Kinds and Roles

Use Diataxis-style intent separation:

| DOC_KIND | Goal |
|----------|------|
| `index` | navigation and routing |
| `reference` | precise factual lookup |
| `how-to` | executable procedure |
| `explanation` | mental model and rationale |
| `record` | historical decision record |

Required default mapping:

| Path | DOC_KIND | DOC_ROLE |
|------|----------|----------|
| `AGENTS.md` | `index` | `canonical` |
| `CLAUDE.md` | `index` | `derived` |
| `docs/README.md` | `index` | `canonical` |
| `docs/documentation_standards.md` | `reference` | `canonical` |
| `docs/principles.md` | `explanation` | `canonical` |
| `docs/project/requirements.md` | `explanation` | `canonical` |
| `docs/project/architecture.md` | `explanation` | `canonical` |
| `docs/project/tech_stack.md` | `reference` | `canonical` |
| `docs/project/api_spec.md` | `reference` | `canonical` |
| `docs/project/database_schema.md` | `reference` | `canonical` |
| `docs/project/design_guidelines.md` | `explanation` | `canonical` |
| `docs/project/infrastructure.md` | `explanation` | `canonical` |
| `docs/project/runbook.md` | `how-to` | `canonical` |
| `docs/tasks/README.md` | `index` | `canonical` |
| `docs/tasks/kanban_board.md` | `how-to` | `working` |
| `tests/README.md` | `index` | `canonical` |
| `docs/reference/guides/testing-strategy.md` | `how-to` | `canonical` |
| `docs/reference/adrs/*.md` | `record` | `canonical` |
| `docs/reference/guides/*.md` | `reference` | `canonical` |
| `docs/reference/manuals/*.md` | `reference` | `canonical` |

---

## Placeholder Policy

Forbidden in published docs:
- `{{...}}`
- `[TBD: ...]`
- `TODO`
- `Coming soon`
- `Lorem ipsum`
- raw template-only metadata such as `Template Last Updated:` and `Template Version:`

Allowlisted placeholder files:
- `docs/tasks/README.md`
- `docs/tasks/kanban_board.md`

Allowlist is narrow and explicit. All other generated files must be complete enough to ship.

---

## No-Code Rule

Generated documentation describes contracts, decisions, workflows, and operations.

Allowed fenced block languages:
- `bash`, `sh`, `shell`
- `yaml`, `yml`, `json`, `toml`, `ini`, `env`
- `mermaid`
- `text`, `plaintext`

Disallowed for generated docs:
- implementation code fences such as `js`, `ts`, `tsx`, `jsx`, `py`, `cs`, `go`, `java`, `php`, `rb`, `rs`

If implementation detail is needed, link to source instead of embedding code.

---

## Freshness Rules

Generated docs must reflect current project state:
- `Last Updated` should use the current generation date
- no stale inline dates older than 180 days unless the line is explicitly historical
- no obsolete validator references or retired workflow references
- no leftover template metadata intended only for template maintenance

Historical files such as `CHANGELOG.md` are outside this contract.

---

## Link and Fact Rules

Required:
- internal markdown links resolve
- referenced repo paths exist when they are presented as current facts
- documentation links use stack-appropriate official sources

Examples:
- .NET: `learn.microsoft.com`
- Node.js / JavaScript / TypeScript: `nodejs.org`, `developer.mozilla.org`, `typescriptlang.org`, `npmjs.com`, `react.dev`, `nextjs.org`
- Python: `docs.python.org`, `pypi.org`, `fastapi.tiangolo.com`, `docs.djangoproject.com`
- Go: `go.dev`
- Rust: `doc.rust-lang.org`, `crates.io`

Cross-document consistency remains primarily the responsibility of `ln-614`, but `ln-100` should not emit obviously contradictory generated files.

---

## Section-First Read Protocol

Markdown documentation must be read progressively:

1. use outline-first for larger markdown files
2. read the standard top markers and top sections first
3. read body sections only when the task truly requires them

Shared read protocol lives in `shared/references/markdown_read_protocol.md`.

This contract explicitly rejects a blanket `read the first 100 lines of every doc` policy. Use section-based routing first, and only fall back to a 100-line prelude when the file lacks the standard contract.

---

## Doc Registry

`ln-100` should generate a hidden machine-oriented registry:

`docs/project/.context/doc_registry.json`

Each entry contains:
- `path`
- `doc_kind`
- `doc_role`
- `owner`
- `primary_sources`
- `key_sections`
- `last_updated`

The registry exists for routing and audits. It should stay concise and should not replace human-facing navigation docs.

---

## Repair Ownership

Use the owning creator skill for semantic fixes:

| File Area | Owner |
|-----------|-------|
| Root docs | `ln-111-root-docs-creator` |
| Project docs | `ln-112-project-core-creator`, `ln-113-backend-docs-creator`, `ln-114-frontend-docs-creator`, `ln-115-devops-docs-creator` |
| Reference docs | `ln-120-reference-docs-creator` |
| Task docs | `ln-130-tasks-docs-creator` |
| Test docs | `ln-140-test-docs-creator` |

`ln-100` may apply deterministic mechanical fixes inline only for:
- missing header markers
- missing top sections
- missing Maintenance block markers
- broken relative markdown links with obvious target
- leftover template markers
- forbidden template metadata

Everything else should be routed back to the owning creator.

---

## Output Contract

Every creator used by `ln-100` must return the normalized shape below:

```json
{
  "created_files": ["docs/project/architecture.md"],
  "skipped_files": [],
  "quality_inputs": {
    "doc_paths": ["docs/project/architecture.md"],
    "owners": {
      "docs/project/architecture.md": "ln-112-project-core-creator"
    }
  },
  "validation_status": "passed"
}
```

`quality_inputs.owners` is the routing table for repair loops.

Allowed `validation_status` values:
- `passed`
- `passed_with_fixes`
- `skipped`
- `failed`

---

**Version:** 1.0.0
**Last Updated:** 2026-03-26

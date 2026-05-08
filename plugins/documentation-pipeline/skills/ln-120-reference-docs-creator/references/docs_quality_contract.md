<!-- SOURCE-OF-TRUTH: shared/references/docs_quality_contract.md. Edit ONLY here; run `node tools/marketplace/shared.mjs sync` -->

# Docs Quality Contract

Small hard contract for generated project documentation. Exact rule IDs, path matrices, and validator implementation details live in the optional docs-quality rule catalog loaded only by skills that name it directly.

## Acceptance Gate

Generated docs are publishable only when:
- no CRITICAL or HIGH docs-quality findings remain
- no unreplaced template markers appear outside allowlisted setup docs
- internal markdown links resolve
- referenced current repo paths exist
- required top metadata and navigation sections are present
- generated docs do not embed implementation code blocks

## Required Top Contract

Every generated markdown document should start with machine-readable comments near the top:

```html
<!-- SCOPE: ... -->
<!-- DOC_KIND: index|reference|how-to|explanation|record -->
<!-- DOC_ROLE: canonical|navigation|working|derived -->
<!-- READ_WHEN: ... -->
<!-- SKIP_WHEN: ... -->
<!-- PRIMARY_SOURCES: pathA, pathB -->
```

Standard top sections:
- `## Quick Navigation`
- `## Agent Entry`
- `## Maintenance`

`AGENTS.md` is the canonical machine-facing project map. `CLAUDE.md` is a thin provider-compatible shim that points to `AGENTS.md` and adds only provider-specific deltas.

## Content Rules

- Use Diataxis-style doc kinds: `index`, `reference`, `how-to`, `explanation`, `record`.
- Keep canonical facts in one place and link outward.
- Read markdown progressively: outline/top markers first, then only needed sections.
- For generated docs, prefer links to source over embedded implementation code.
- Allowed code fences are operational/data formats such as shell, yaml, json, toml, env, mermaid, text/plaintext.
- Treat stale dates, obsolete workflow references, broken links, and missing current paths as quality findings.

## Placeholder Policy

Forbidden in published docs unless explicitly allowlisted:
- `{{...}}`
- `[TBD: ...]`
- `TODO`
- `Coming soon`
- `Lorem ipsum`
- template-only metadata such as `Template Last Updated:` or `Template Version:`

The narrow setup allowlist remains in the optional docs-quality rule catalog.

## Repair Ownership

Route semantic repairs back to the owning creator skill:
- root docs -> `ln-111`
- project docs -> `ln-112` to `ln-115`
- reference docs -> `ln-120`
- task docs -> `ln-130`
- test docs -> `ln-140`

`ln-100` may apply deterministic mechanical fixes for missing markers, top sections, obvious broken relative links, leftover template markers, and forbidden template metadata.

## Creator Output Shape

Creators used by `ln-100` return:

```json
{
  "created_files": ["docs/project/architecture.md"],
  "skipped_files": [],
  "quality_inputs": {
    "doc_paths": ["docs/project/architecture.md"],
    "owners": {"docs/project/architecture.md": "ln-112-project-core-creator"}
  },
  "validation_status": "passed|passed_with_fixes|skipped|failed"
}
```

---
**Version:** 1.0.0
**Last Updated:** 2026-03-26

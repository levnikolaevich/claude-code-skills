<!-- SOURCE-OF-TRUTH: shared/references/docs_quality_contract.md. Edit ONLY here; run `node tools/marketplace/shared.mjs sync` -->

# Docs Quality Contract

Hard contract for generated project documentation. Rule IDs, path matrices, allowlists, and validator details live in `docs_quality_rules.json`, loaded only by skills that name it directly.

## Acceptance Gate

Generated docs are publishable only when:
- no CRITICAL or HIGH docs-quality findings remain
- no unreplaced template markers appear outside the setup allowlist
- internal markdown links resolve
- referenced current repo paths exist
- required top metadata and navigation sections are present
- docs link to source instead of embedding implementation code

## Required Top Contract

Every generated markdown document starts with these machine-readable comments near the top:

```html
<!-- SCOPE: ... -->
<!-- DOC_KIND: index|reference|how-to|explanation|record -->
<!-- DOC_ROLE: canonical|navigation|working|derived -->
<!-- READ_WHEN: ... -->
<!-- SKIP_WHEN: ... -->
<!-- PRIMARY_SOURCES: pathA, pathB -->
```

Required top sections: `## Quick Navigation`, `## Agent Entry`, `## Maintenance`.

`AGENTS.md` is the canonical machine-facing project map. `CLAUDE.md` remains a thin provider-compatible shim.

## Content Rules

Use doc kinds `index`, `reference`, `how-to`, `explanation`, `record`. Keep canonical facts in one place and link outward. Allowed code fences are operational/data formats: shell, yaml, json, toml, env, mermaid, text/plaintext. Treat stale dates, obsolete workflows, broken links, and missing current paths as findings.

## Placeholder Policy

Forbidden unless allowlisted: `{{...}}`, `[TBD: ...]`, `TODO`, `Coming soon`, `Lorem ipsum`, `Template Last Updated:`, `Template Version:`.

## Repair and Output

Route semantic repairs to the owning creator: root docs `ln-111`, project docs `ln-112` to `ln-115`, reference docs `ln-120`, task docs `ln-130`, test docs `ln-140`. `ln-100` may apply deterministic mechanical fixes.

Creator outputs: `created_files`, `skipped_files`, `quality_inputs.doc_paths`, `quality_inputs.owners`, `validation_status=passed|passed_with_fixes|skipped|failed`.

---
**Version:** 1.0.0
**Last Updated:** 2026-03-26

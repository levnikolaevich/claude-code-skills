<!-- SOURCE-OF-TRUTH: shared/references/markdown_read_protocol.md. Edit ONLY here; run `node tools/marketplace/shared.mjs sync` -->

# Markdown Read Protocol

<!-- SCOPE: Shared protocol for reading markdown files efficiently in documentation skills and audits. -->

Use when a task touches markdown documentation.

## Goal

Read only the document sections needed for the next correct decision. Do not full-read every `.md` file by default.

## Default Sequence

1. Outline large or unfamiliar files first; use `hex-line outline` when available.
2. Read header markers: `SCOPE`, `DOC_KIND`, `DOC_ROLE`, `READ_WHEN`, `SKIP_WHEN`, `PRIMARY_SOURCES`.
3. Read standard top sections: `Quick Navigation`, `Agent Entry`, `Maintenance`.
4. Expand only into sections relevant to the current task.

If the file lacks the standard contract, read the first 80-120 lines, infer purpose from headings, then continue section-first.

## Audit Use

- `ln-611`: outline + top sections first; full-read only suspect files.
- `ln-612`: section-read for semantic judgment; full-read only when sections are insufficient.
- `ln-614`: prioritize canonical/high-claim docs; full-read dense factual claims or contradictions.

## Authoring Requirement

Generated docs should keep routing, purpose, canonical links, and `Agent Entry` near the top so this protocol remains usable.

## Tool Preference

For markdown files, `hex-line outline` is preferred for structure discovery. Markdown is not a blanket exception to hex-line usage.

# Markdown Read Protocol

<!-- SCOPE: Shared protocol for reading markdown files efficiently in documentation skills and audits. Defines progressive disclosure and section-first reading. -->

Use this protocol in `ln-100`, `ln-611`, `ln-612`, and `ln-614` whenever the task touches markdown documentation.

## Goal

Read only the documentation needed to make the next correct decision.

Do not default to full-file reads for every `.md` file.

## Default Sequence

1. **Outline first**
   - If markdown file is large or unfamiliar, use `hex-line outline` first.
   - Target threshold: roughly 120+ lines or multi-section files.
2. **Read the header contract**
   - Read the top comment markers:
     - `SCOPE`
     - `DOC_KIND`
     - `DOC_ROLE`
     - `READ_WHEN`
     - `SKIP_WHEN`
     - `PRIMARY_SOURCES`
3. **Read the standard top sections**
   - `Quick Navigation`
   - `Agent Entry`
   - `Maintenance`
4. **Expand only if needed**
   - Read the body section relevant to the current task.
   - Avoid reading unrelated sections.

## Fallbacks

If a file does not follow the standard header/section contract:
- read the first 80-120 lines as a temporary prelude
- infer purpose from headings
- continue with section-level reads instead of immediately reading the full file

## Audit Guidance

- `ln-611`: outline + top sections first; full reads only on suspect files
- `ln-612`: top sections first, then read only sections needed for semantic judgment; read full file only when the document cannot be judged safely from sectional reads
- `ln-614`: prioritize canonical and high-claim docs first; use full reads only for documents with dense factual claims or detected contradictions

## Authoring Guidance

Writers should structure generated docs so this protocol works reliably:
- put routing and purpose at the top
- keep `Agent Entry` short and explicit
- keep canonical links near the top
- make section headings semantically clear

## Tool Preference

For markdown files, `hex-line outline` is preferred for structure discovery. This repository does not treat markdown as a blanket exception to hex-line usage.

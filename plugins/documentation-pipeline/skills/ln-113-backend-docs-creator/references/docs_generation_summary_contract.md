<!-- SOURCE-OF-TRUTH: shared/references/docs_generation_summary_contract.md. Edit ONLY here; run `node tools/marketplace/shared.mjs sync` -->

# Docs Generation Summary Contract

Machine-readable summaries for docs generation workers and docs-pipeline components.

Envelope: `references/coordinator_summary_contract.md`

## Summary Kind

- `docs-generation`

## Payload fields

- `worker`
- `status` (`completed | skipped | error`)
- `created_files`
- `skipped_files`
- `quality_inputs`
- `validation_status`
- `warnings`
- `metadata`

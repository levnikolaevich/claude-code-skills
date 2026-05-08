<!-- SOURCE-OF-TRUTH: plugins/agile-workflow/shared/references/evaluation_worker_runtime_contract.md. Edit ONLY here; run `node tools/marketplace/shared.mjs sync` -->

# Evaluation Worker Runtime Contract

Canonical worker runtime contract for workers launched by `evaluation-runtime`.

Use this contract for:
- research workers
- findings workers
- documentation or repair workers
- merge workers
- refinement workers
- audit workers migrated onto the evaluation platform

## Runtime Envelope

Evaluation workers are standalone-invocable units that may also run under a coordinator-managed evaluation loop. They must accept deterministic input, write the requested summary artifact, and keep public output concise.

Hard requirements:
- no parent/coordinator ownership wording in the public contract
- managed invocation receives exact `runId` and `summaryArtifactPath`
- standalone invocation creates its own run id and writes to the family standalone path
- completion requires required checkpoints, `summary_recorded=true`, and `self_check_passed=true`
- summary kind defaults to `evaluation-worker` unless the family requires a more specific kind

## Runtime CLI

Worker runtime commands must cover start/status/checkpoint, summary recording, phase advance/pause, and completion. A `SKILL.md` that invokes a local CLI must reference the script path directly; this contract does not distribute executable assets by itself.

## Output

The summary artifact uses the evaluation summary envelope and includes `worker`, `status`, `operation`, `warnings`, and any domain-specific findings/metrics/artifact paths. Coordinators consume the JSON summary, so large reports belong in separate artifacts.

## Conditional Behavior

Load cleanup evidence rules only when the worker starts background processes. Load refinement trace rules only when the worker runs iterative refinement. Load detailed research rules only when the worker performs source-backed research.

**Version:** 1.0.0
**Last Updated:** 2026-04-10

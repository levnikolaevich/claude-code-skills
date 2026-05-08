<!-- SOURCE-OF-TRUTH: shared/references/agent_review_workflow.md. Edit ONLY here; run `node tools/marketplace/shared.mjs sync` -->

# Agent Review Workflow

Lifecycle rules for skills that actually run external advisor review or refinement loops. Validators that only launch agents through the evaluation runtime should prefer the compact policy in their own `SKILL.md` plus `agent_delegation_pattern.md`.

## Health Check

1. Read `.hex-skills/environment_state.json` when present and skip disabled advisors.
2. Probe available non-host advisors:

```bash
node references/agents/agent_runner.mjs --health-check --json --host-agent {claude|codex}
```

3. If no advisor is available, record a skipped reason and continue only when the skill allows host self-review fallback.

## Prompt and Launch

- Build one narrow prompt per advisor or refinement perspective.
- Use prompt files, output files, and metadata files.
- Materialize any external context files under `.hex-skills/agent-review/context/` before referencing them in advisor prompts.
- Register launched agents with the active coordinator runtime when one exists.

```bash
node references/agents/agent_runner.mjs --agent {agent} \
  --prompt-file {prompt.md} \
  --output-file {result.md} \
  --metadata-file {metadata.json} \
  --cwd {project_dir}
```

## Wait and Liveness

- Resolve agents through the active runtime `sync-agent` command before merge gates.
- Claude hosts may use `Monitor` for observability; it is not the source of truth.
- Do not use sleep loops or ad-hoc polling as the primary wait mechanism.
- Before declaring an advisor failed, check log mtime, recent log content, and process liveness via `agent_runner.mjs --verify-dead {pid}`.
- Slow is not failed. The runner hard timeout is the time boundary.

## Verification

The host verifies every advisor claim before accepting it:
- transport/auth/tool failures are not domain findings
- unsupported suggestions are rejected
- accepted suggestions must cite code, docs, tests, or runtime evidence
- project mutations happen only after host verification

## Iterative Refinement

Use only for skills that require a bounded refinement loop:
- Stage 1: independent advisor sessions for configured perspectives.
- Stage 2: final sweep after Stage 1 accepted fixes.
- Record result paths, failures, accepted suggestions, and cleanup evidence.
- Valid exits: `COMPLETED`, `PARTIAL_ERROR`, `ERROR`, `SKIPPED`.

## Cleanup

- Result files are runner-owned; skills read them but do not rewrite them.
- Kill or verify-dead all launched advisor processes before final completion.
- Record skipped/failure reasons separately from domain verdict.

---
**Version:** 3.0.0
**Last Updated:** 2026-03-26

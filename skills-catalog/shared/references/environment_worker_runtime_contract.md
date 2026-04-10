# Environment Worker Runtime Contract

Runtime contract for `ln-011` through `ln-015`.

Canonical phase/status names: `shared/references/runtime_status_catalog.md`

## Runtime Family

- family: `environment-worker-runtime`
- terminal phases: `PAUSED`, `DONE`
- workers remain standalone-first
- managed mode requires both `runId` and `summaryArtifactPath`

## Summary Kinds

| Skill | Summary Kind |
|-------|--------------|
| `ln-011` | `env-agent-install` |
| `ln-012` | `env-mcp-config` |
| `ln-013` | `env-config-sync` |
| `ln-014` | `env-instructions` |
| `ln-015` | `env-cleanup` |

Payload shape follows `shared/references/coordinator_summary_contract.md` environment worker rules.

## Guard Rules

- No transition without a checkpoint for the current phase.
- No `DONE` before a validated summary artifact is recorded.
- No `DONE` before self-check passes.
- Managed runs must write the summary to the exact caller-provided path.
- Standalone runs generate their own `run_id` and write to the family-scoped artifact path.

## Worker Independence

- Workers must not require coordinator runtime state.
- Workers may consume coordinator-provided manifests, but the public contract stays standalone-capable.
- Upward ownership stays out of worker public contracts.

---
**Version:** 1.0.0
**Last Updated:** 2026-04-10

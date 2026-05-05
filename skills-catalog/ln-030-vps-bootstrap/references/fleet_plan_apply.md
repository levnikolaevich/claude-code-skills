# Fleet plan/apply

<!-- SCOPE: Plan/apply workflow for ln-030 fleet operations. -->

Fleet mode is a push-over-SSH workflow. It is not a daemon and does not continuously reconcile in v1.

## Plan

`fleet_plan`:
1. Load the live VPS registry from `/etc/agent-fleet/environments/*.yaml` by default, or from explicit `registry_path`.
2. Validate registry shape and uniqueness.
3. Discover live state for selected environments.
4. Compare desired state with live state.
5. Write a run-scoped plan artifact.

Plan artifacts must include:
- registry path plus file digest or mtime evidence
- selected environments
- live-state observations
- proposed worker invocations
- gated `N/A:` items
- blockers
- warnings

## Apply

`fleet_apply`:
1. Load the approved plan artifact.
2. Revalidate the live VPS registry from the recorded or explicit `registry_path`.
3. Re-check live state for selected environments.
4. Abort if registry files or live state diverged from the approved plan.
5. Invoke selected workers in order.
6. Write apply evidence and final summary.

## Worker Order

For each environment:

```text
ln-031-vps-host-runtime
ln-032-vps-project-runtime
ln-033-hex-relay-lifecycle
ln-034-vps-environment-diagnostics
```

Skip gated phases with explicit reasons. Do not run `ln-033` when relay/Telegram scope is disabled.

## Safety Rules

- `fleet_plan` is read-only.
- `fleet_apply` never applies a stale plan.
- Apply touches only selected environments.
- Secret values are never read from registry files.
- SSH commands are scoped to the target environment's host and project identifiers.
- Real fleet membership lives on the VPS under `/etc/agent-fleet/environments`; repo `ops/environments` is a template contract only.

---

**Version:** 1.0.0
**Last Updated:** 2026-05-05

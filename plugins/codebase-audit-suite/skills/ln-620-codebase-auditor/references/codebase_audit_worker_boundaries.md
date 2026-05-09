# Codebase Audit Worker Boundaries

<!-- SCOPE: Local ln-620 boundary contract. This file is not root shared; ln-620 owns conflict resolution. -->

## Coordinator Rule

`ln-620` coordinates exactly `ln-621` through `ln-629`. Do not add non-consecutive workers. If a useful runtime/codebase audit concern appears outside this range, fold it into the closest existing `62X` worker.

The coordinator owns deduplication and conflict resolution. Workers produce evidence reports only.

## Worker Questions

| Worker | Unique Audit Question | Primary Actions |
|--------|------------------------|-----------------|
| `ln-621` | Can external input, secrets, or sensitive defaults create an exploitable application security boundary? | `HARDEN_SECURITY_BOUNDARY`, `REMOVE_SECRET`, `REMOVE_SENSITIVE_DEFAULT` |
| `ln-622` | Does the delivery gate fail or provide unreliable CI/build/type/lint/test feedback? | `FIX_DELIVERY_GATE`, `FAIL_CI_ON_SIGNAL`, `REMOVE_STALE_SKIP` |
| `ln-623` | Is duplicated or over-abstracted code increasing maintenance risk without justified ownership? | `MERGE_DUPLICATION`, `REMOVE_ABSTRACTION`, `REMOVE_YAGNI` |
| `ln-624` | Are local code hotspots hard to read, change, or reason about? | `REFACTOR_HOTSPOT`, `SIMPLIFY_SIGNATURE`, `EXTRACT_CONSTANT` |
| `ln-625` | Do dependencies or generic custom utility/integration modules create avoidable risk or maintenance cost? | `PATCH_DEPENDENCY`, `REMOVE_DEPENDENCY`, `REPLACE_CUSTOM_UTILITY` |
| `ln-626` | Can code be safely deleted because it is unreachable, unused, obsolete, or commented out? | `DELETE_DEAD_CODE`, `REMOVE_OBSOLETE_COMPAT`, `DELETE_COMMENTED_CODE` |
| `ln-627` | Can operators diagnose incidents from logs, metrics, traces, and correlation IDs? | `ADD_DIAGNOSTIC_SIGNAL`, `STRUCTURE_LOGS`, `PROPAGATE_CORRELATION` |
| `ln-628` | Can concurrent or async execution corrupt state, hang, race, or misuse shared resources? | `FIX_RACE`, `FIX_DEADLOCK`, `CONTROL_ASYNC_SIDE_EFFECT` |
| `ln-629` | Can the app start, validate config, become ready, and shut down safely? | `FIX_BOOTSTRAP`, `ADD_CONFIG_VALIDATION`, `FIX_SHUTDOWN` |

## Conflict Rules

- If `ln-621` and `ln-625` both mention vulnerable packages, `ln-625` owns package-level remediation; `ln-621` only keeps exploitable app-path evidence.
- If `ln-622` finds failed/skipped tests, `ln-622` reports delivery-gate failure only; `ln-630` owns test portfolio quality.
- If `ln-624` and `ln-623` both see repeated code, `ln-623` owns duplication; `ln-624` keeps local readability hotspots.
- If `ln-627` and `ln-629` both mention health checks, `ln-629` owns liveness/readiness; `ln-627` owns telemetry and diagnostic signal.
- If `ln-629` and `ln-621` both mention env defaults, `ln-629` owns startup validation; `ln-621` owns sensitive default security risk.

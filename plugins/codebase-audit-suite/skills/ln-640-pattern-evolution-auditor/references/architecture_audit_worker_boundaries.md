# Architecture Audit Worker Boundaries

<!-- SCOPE: Local ln-640 boundary contract. This file is not root shared; ln-640 owns conflict resolution. -->

## Coordinator Rule

`ln-640` coordinates exactly `ln-641` through `ln-647`. The family audits architecture and design evolution only. Runtime security, package health, build gates, generic code quality, and operational lifecycle belong outside `ln-640`.

Workers produce evidence reports only. The coordinator deduplicates and decides the final remediation plan.

## Worker Questions

| Worker | Unique Audit Question | Primary Actions |
|--------|------------------------|-----------------|
| `ln-641` | Does an implemented architectural pattern fit current project needs and best practices? | `KEEP_PATTERN`, `SIMPLIFY_PATTERN`, `COMPLETE_PATTERN`, `REPLACE_PATTERN` |
| `ln-642` | Are layer, resource ownership, and orchestration boundaries clear and enforced? | `MOVE_BOUNDARY`, `CHOOSE_OWNER`, `FLATTEN_ORCHESTRATION` |
| `ln-643` | Are service/API contracts explicit, stable, and free from layer leakage? | `ADD_DTO`, `STOP_ENTITY_LEAK`, `STANDARDIZE_ERROR_CONTRACT` |
| `ln-644` | Does dependency topology avoid cycles, forbidden imports, unstable dependencies, and coupling traps? | `BREAK_CYCLE`, `ENFORCE_RULE`, `REDUCE_COUPLING` |
| `ln-645` | Can architecture be modernized by removing obsolete custom architectural mechanisms or simplifying extension points? | `SIMPLIFY_ARCHITECTURE`, `RETIRE_CUSTOM_MECHANISM`, `CONSOLIDATE_EXTENSION_POINT` |
| `ln-646` | Does the physical project structure reflect the intended architecture? | `MOVE_MODULE`, `SPLIT_JUNK_DRAWER`, `ALIGN_DOMAIN_STRUCTURE` |
| `ln-647` | Is configuration accessed through a clear architectural boundary instead of leaking across layers? | `ADD_SETTINGS_BOUNDARY`, `STOP_SCATTERED_ENV_READS`, `TYPE_CONFIG_CONTRACT` |

## Conflict Rules

- If `ln-641` and `ln-645` both flag the same pattern, `ln-641` owns pattern fitness; `ln-645` owns modernization of obsolete custom mechanisms.
- If `ln-642` and `ln-644` both report an import, `ln-644` owns graph/topology evidence; `ln-642` owns architectural ownership decisions.
- If `ln-643` and `ln-647` both mention config in method signatures, `ln-643` owns public/service contract shape; `ln-647` owns settings boundary and config leakage.
- If `ln-646` and `ln-642` both mention a directory, `ln-646` owns physical placement; `ln-642` owns layer responsibility.

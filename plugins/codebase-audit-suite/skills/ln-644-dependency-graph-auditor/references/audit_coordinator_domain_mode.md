# Audit Coordinator Domain Mode

Shared pattern for audit coordinators that optionally split work by domain instead of scanning the whole codebase as one unit.

## Goal

Use domain-aware mode when multiple meaningful domains exist. Fall back to global mode when the project is too small or too infrastructure-heavy for domain splits to add signal.

## Discovery Order

1. Explicit domain folders:
   - `src/domains/*/`
   - `src/features/*/`
   - `src/modules/*/`
   - `packages/*/`
   - `libs/*/`
   - `apps/*/`
2. Top-level product folders under `src/*`
3. Global fallback if fewer than 2 real domains remain

## Exclusions and Shared Folders

Treat these as shared or infrastructure by default:
- `shared`
- `common`
- `utils`
- `lib`
- `helpers`
- `config`
- `types`
- `interfaces`
- `constants`
- `middleware`
- `infrastructure`
- `core`

Shared folders may still be audited, but they should not distort per-domain scoring.

## Heuristics

Use domain-aware mode only when the folders have real implementation weight. Good signals:
- more than 5 files
- substructure such as `controllers/`, `services/`, `models/`
- barrel exports or module entrypoints
- README or docs naming the area as a domain, module, or feature

## Output Shape

```json
{
  "domain_mode": "domain-aware",
  "all_domains": [
    {"name": "users", "path": "src/users", "file_count": 45, "is_shared": false},
    {"name": "orders", "path": "src/orders", "file_count": 32, "is_shared": false},
    {"name": "shared", "path": "src/shared", "file_count": 15, "is_shared": true}
  ]
}
```

If fewer than 2 meaningful domains are found:

```json
{
  "domain_mode": "global"
}
```

## Delegation Rules

- Global workers scan the whole project once.
- Domain-aware workers run once per domain when `domain_mode="domain-aware"`.
- In domain-aware mode, pass:
  - `domain_mode`
  - `current_domain`
  - `scan_path`
- In global mode, omit `current_domain` unless a worker explicitly needs a synthetic `global` value.

## Reporting Rules

- Keep shared folders separate from product-domain summaries.
- Average domain-aware scores per category only after all domain runs complete.
- If the coordinator adds cross-domain aggregation, use worker-specific machine-readable blocks rather than rescanning the whole codebase.

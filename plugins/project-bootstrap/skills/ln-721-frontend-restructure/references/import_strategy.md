# Import Update Strategy

<!-- SCOPE: Import path update rules ONLY. Contains alias configuration, barrel exports, path transformations. -->
<!-- DO NOT add here: Migration workflow → ln-721-frontend-restructure SKILL.md -->

Rules for updating imports after restructuring React components.

---

## Path Alias Configuration

Standard aliases for restructured React projects.

| Alias | Target Path | Purpose |
|-------|-------------|---------|
| `@/` | `src/` | Root source directory |
| `@/components` | `src/components/` | Shared components |
| `@/hooks` | `src/hooks/` | Shared hooks |
| `@/contexts` | `src/contexts/` | Context providers |
| `@/lib` | `src/lib/` | Utilities and API |
| `@/pages` | `src/pages/` | Page components |
| `@/types` | `src/types/` | Shared type definitions |

---

## Import Update Rules

| Scenario | Before | After | Rule |
|----------|--------|-------|------|
| UI component moved | `import { Button } from '../Button'` | `import { Button } from '@/components/ui'` | Use alias for shared components |
| Feature-local | `import { types } from './Dashboard'` | `import type { DashboardProps } from './types'` | Relative for co-located files |
| Cross-feature | `import { useAuth } from '../../hooks/useAuth'` | `import { useAuth } from '@/hooks'` | Use alias for cross-feature imports |
| Type-only | `import { User } from './types'` | `import type { User } from './types'` | Add `type` keyword for type imports |

---

## Barrel Export Strategy

Index files for clean imports.

| Location | Barrel File | Exports |
|----------|-------------|---------|
| `components/ui/` | `index.ts` | All UI components |
| `components/layout/` | `index.ts` | All layout components |
| `hooks/` | `index.ts` | All shared hooks |
| `contexts/` | `index.ts` | All context providers |
| Feature folder | `index.tsx` | Main component only |

**Barrel file pattern:**
- Re-export all public components from folder
- Do NOT re-export internal/private components
- Use named exports, avoid default exports in barrels

---

## Import Analysis Process

| Step | Action | Output |
|------|--------|--------|
| 1 | Scan all files for import statements | Import map: file -> [imports] |
| 2 | Build reverse dependency graph | Dependency map: module -> [importers] |
| 3 | Identify imports to moved files | List of imports to update |
| 4 | Calculate new import paths | Old path -> New path mapping |
| 5 | Apply updates | Modified source files |
| 6 | Verify no broken imports | Build verification |

---

## Circular Dependency Prevention

| Rule | Description |
|------|-------------|
| **Layer rule** | Lower layers cannot import from higher layers |
| **Feature rule** | Features cannot directly import from other features |
| **Shared rule** | Shared modules (`lib/`, `hooks/`) cannot import from features |

**Layer hierarchy (top to bottom):**
1. `pages/` (can import from all below)
2. `components/` (can import from hooks, contexts, lib)
3. `hooks/`, `contexts/` (can import from lib)
4. `lib/` (cannot import from above)
5. `types/` (no imports, only type definitions)

---

## Update Order

Sequence for updating imports to avoid intermediate broken states.

| Order | Files to Update | Rationale |
|-------|-----------------|-----------|
| 1 | Create barrel files | Export paths must exist before importing |
| 2 | Update alias config | tsconfig.json paths must be valid |
| 3 | Update type imports | Types have no runtime dependencies |
| 4 | Update utility imports | Utilities are leaf dependencies |
| 5 | Update hook imports | Hooks depend on utilities |
| 6 | Update component imports | Components depend on all above |
| 7 | Update page imports | Pages are entry points |

---

## Validation Checklist

| Check | Command | Expected |
|-------|---------|----------|
| TypeScript compilation | `npx tsc --noEmit` | No errors |
| Build | `npm run build` | Success |
| Circular dependencies | `madge --circular src/` | No cycles found |
| Unused imports | ESLint `no-unused-imports` | No warnings |

---

**Version:** 1.0.0
**Last Updated:** 2026-01-10

<!-- SOURCE-OF-TRUTH: shared/references/frontend_structure.md. Edit ONLY here; run `node tools/marketplace/shared.mjs sync` -->

# Frontend Structure Template

<!-- SCOPE: React frontend folder structure ONLY. Contains components/hooks/services directories, naming conventions. -->
<!-- DO NOT add here: Migration workflow → ln-720-structure-migrator SKILL.md -->

Reference structure for React frontend projects.

---

## Directory Structure

```
src/frontend/
├── src/
│   ├── components/
│   │   ├── ui/                    # Reusable UI components
│   │   │   ├── Button/
│   │   │   ├── Input/
│   │   │   ├── Modal/
│   │   │   └── index.ts           # Barrel export
│   │   │
│   │   └── layout/                # Layout components
│   │       ├── AppLayout/
│   │       ├── Header/
│   │       ├── Sidebar/
│   │       └── index.ts
│   │
│   ├── pages/                     # Route pages
│   │   ├── Dashboard/
│   │   │   ├── index.tsx
│   │   │   ├── types.ts
│   │   │   ├── constants.ts
│   │   │   ├── hooks.ts
│   │   │   └── components/
│   │   ├── Settings/
│   │   └── Profile/
│   │
│   ├── hooks/                     # Shared custom hooks
│   │   ├── useAuth.ts
│   │   ├── useApi.ts
│   │   └── index.ts
│   │
│   ├── contexts/                  # React contexts
│   │   ├── AuthContext.tsx
│   │   ├── ThemeContext.tsx
│   │   └── index.ts
│   │
│   ├── lib/                       # Utilities
│   │   ├── api/
│   │   │   ├── client.ts
│   │   │   └── endpoints/
│   │   ├── utils/
│   │   └── constants.ts
│   │
│   ├── types/                     # Shared TypeScript types
│   │   └── index.ts
│   │
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
│
├── public/
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## Folder Responsibilities

| Folder | Purpose | Contents |
|--------|---------|----------|
| `components/ui/` | Reusable UI primitives | Button, Input, Modal, Select, etc. |
| `components/layout/` | App structure | AppLayout, Header, Sidebar, Footer |
| `pages/` | Route-level components | Feature folders with co-located files |
| `pages/{Feature}/` | Feature code | index.tsx, types.ts, constants.ts, hooks.ts |
| `hooks/` | Shared hooks | Cross-feature reusable hooks |
| `contexts/` | State providers | React Context providers |
| `lib/` | Utilities | API client, formatters, helpers |
| `types/` | Shared types | Cross-feature type definitions |

---

## Component Organization

| Component Type | Location | Example |
|----------------|----------|---------|
| UI Primitive | `components/ui/` | Button, Input, Modal |
| Layout | `components/layout/` | AppLayout, Header |
| Feature-specific | `pages/{Feature}/components/` | DashboardCard |
| Page | `pages/{Feature}/index.tsx` | Dashboard, Settings |

---

## Feature Folder Structure

| File | Purpose | When to Create |
|------|---------|----------------|
| `index.tsx` | Main component | Always |
| `types.ts` | Feature types | If >3 type definitions |
| `constants.ts` | Feature constants | If magic values present |
| `hooks.ts` | Feature hooks | If custom hooks needed |
| `components/` | Sub-components | If >2 sub-components |
| `utils.ts` | Feature utilities | If helper functions needed |

---

## Path Aliases

| Alias | Path | Usage |
|-------|------|-------|
| `@/` | `src/` | All imports |
| `@/components` | `src/components/` | Component imports |
| `@/hooks` | `src/hooks/` | Hook imports |
| `@/lib` | `src/lib/` | Utility imports |
| `@/types` | `src/types/` | Type imports |

---

## Import Conventions

| Scenario | Pattern |
|----------|---------|
| Shared UI component | `import { Button } from '@/components/ui'` |
| Layout component | `import { AppLayout } from '@/components/layout'` |
| Shared hook | `import { useAuth } from '@/hooks'` |
| Feature-local | `import { useData } from './hooks'` (relative) |
| Types | `import type { User } from '@/types'` |

---

## File Naming

| Type | Convention | Example |
|------|------------|---------|
| Component | PascalCase.tsx | `Button.tsx` |
| Hook | camelCase.ts | `useAuth.ts` |
| Types | types.ts | `types.ts` |
| Constants | constants.ts | `constants.ts` |
| Utilities | camelCase.ts | `format.ts` |
| Barrel export | index.ts | `index.ts` |

---

## Entry Points

| File | Purpose |
|------|---------|
| `main.tsx` | App bootstrap, ReactDOM.render |
| `App.tsx` | Root component, routing |
| `index.css` | Global styles |

---

## Config Files

| File | Purpose |
|------|---------|
| `package.json` | Dependencies, scripts |
| `tsconfig.json` | TypeScript config, path aliases |
| `vite.config.ts` | Build config, path aliases mirror |

---

**Version:** 2.0.0
**Last Updated:** 2026-01-10

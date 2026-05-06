# React Folder Structure Template

<!-- SCOPE: React target folder structure ONLY. Contains directory tree, file naming conventions. -->
<!-- DO NOT add here: Migration workflow → ln-721-frontend-restructure SKILL.md, transformation rules → transformation_rules.md -->

Target structure for restructured React frontend projects.

---

## Directory Tree

```
src/frontend/
├── public/
│   └── index.html
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppLayout.tsx
│   │   │   ├── Header.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── index.ts
│   │   └── ui/
│   │       ├── Button.tsx
│   │       ├── Input.tsx
│   │       ├── Modal.tsx
│   │       └── index.ts
│   ├── contexts/
│   │   ├── AuthContext.tsx
│   │   └── index.ts
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useApi.ts
│   │   └── index.ts
│   ├── lib/
│   │   ├── api.ts
│   │   ├── utils.ts
│   │   └── index.ts
│   ├── pages/
│   │   ├── Dashboard/
│   │   │   ├── index.tsx
│   │   │   ├── types.ts
│   │   │   ├── constants.ts
│   │   │   ├── hooks.ts
│   │   │   └── components/
│   │   │       └── DashboardCard.tsx
│   │   └── Settings/
│   │       ├── index.tsx
│   │       └── types.ts
│   ├── types/
│   │   └── index.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── package.json
├── vite.config.ts
└── tsconfig.json
```

---

## Folder Responsibilities

| Folder | Responsibility | Contains |
|--------|----------------|----------|
| `components/ui/` | Reusable UI primitives | Stateless, styled components |
| `components/layout/` | App structure components | Header, Sidebar, Footer, Layout wrappers |
| `contexts/` | React Context providers | Global state providers |
| `hooks/` | Shared custom hooks | Reusable stateful logic |
| `lib/` | Utilities and services | API client, formatters, helpers |
| `pages/` | Route-level components | Feature folders with co-located files |
| `pages/{Feature}/` | Feature-specific code | Component + types + constants + hooks |
| `types/` | Shared type definitions | Cross-feature interfaces |

---

## Feature Folder Structure

Each feature in `pages/` follows this structure.

| File | Purpose | Required |
|------|---------|----------|
| `index.tsx` | Main page component | Yes |
| `types.ts` | Feature-specific types | If types extracted |
| `constants.ts` | Feature constants | If constants extracted |
| `hooks.ts` | Feature-specific hooks | If hooks extracted |
| `components/` | Sub-components | If sub-components extracted |
| `utils.ts` | Feature utilities | If utilities extracted |

**Minimal feature folder:** Only `index.tsx` (for simple pages)

---

## Config Files

| File | Purpose | Key Settings |
|------|---------|--------------|
| `vite.config.ts` | Build configuration | Path aliases, plugins |
| `tsconfig.json` | TypeScript config | Path mappings, strict mode |
| `package.json` | Dependencies | React, build tools |

---

## Path Aliases Setup

**tsconfig.json:**

| Alias | Path | Usage |
|-------|------|-------|
| `@/*` | `src/*` | All source imports |
| `@/components/*` | `src/components/*` | Component imports |
| `@/hooks/*` | `src/hooks/*` | Hook imports |
| `@/lib/*` | `src/lib/*` | Utility imports |
| `@/pages/*` | `src/pages/*` | Page imports |

**vite.config.ts:**
- Mirror tsconfig.json aliases using `resolve.alias`
- Use `path.resolve(__dirname, 'src')` for absolute paths

---

## File Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Component file | PascalCase.tsx | `Button.tsx` |
| Hook file | camelCase.ts | `useAuth.ts` |
| Type file | types.ts or PascalCase.types.ts | `types.ts` |
| Constant file | constants.ts | `constants.ts` |
| Utility file | camelCase.ts | `api.ts`, `format.ts` |
| Index/barrel | index.ts or index.tsx | `index.ts` |

---

## Entry Points

| File | Purpose |
|------|---------|
| `main.tsx` | Application bootstrap, ReactDOM.render |
| `App.tsx` | Root component, routing setup |
| `index.css` | Global styles |

---

**Version:** 1.0.0
**Last Updated:** 2026-01-10

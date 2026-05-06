# Frontend Transformation Rules

<!-- SCOPE: React restructuring transformation rules ONLY. Contains split triggers, extraction thresholds. -->
<!-- DO NOT add here: Migration workflow → ln-721-frontend-restructure SKILL.md -->

Rules for restructuring React frontend from monolith to component-based architecture.

---

## Component Split Rules

Criteria for splitting monolithic component files into feature folders.

| Trigger | Threshold | Target Structure | Actions |
|---------|-----------|------------------|---------|
| File size | >300 lines | Feature folder | Create folder, split into index.tsx + supporting files |
| Inline types | >3 interfaces/types | types.ts | Extract all type definitions |
| useState/useEffect | >5 hooks in component | hooks.ts | Extract custom hooks |
| Magic values | Any hardcoded strings/numbers | constants.ts | Extract to named constants |
| Sub-components | >2 internal components | components/ subfolder | One file per component |

---

## Directory Creation Rules

Standard folders to create during restructuring.

| Folder | Purpose | When to Create |
|--------|---------|----------------|
| `components/ui/` | Reusable UI primitives | Always |
| `components/layout/` | Layout components (Header, Sidebar) | If layout components detected |
| `contexts/` | React Context providers | If useContext used |
| `hooks/` | Shared custom hooks | If hooks used across components |
| `lib/` | Utilities and API clients | Always |
| `pages/` | Page-level components | Always |
| `pages/{Feature}/` | Feature-specific files | Per detected feature |

---

## File Extraction Rules

How to extract different content types from monolithic files.

| Content Type | Detection Pattern | Target File | Notes |
|--------------|-------------------|-------------|-------|
| TypeScript interfaces | `interface X {` | types.ts | Keep export, update imports |
| Type aliases | `type X =` | types.ts | Include generic types |
| Enums | `enum X {` | types.ts or dedicated enum file | |
| Constants | `const X =` at module level | constants.ts | Only non-function values |
| Custom hooks | `function useX(` or `const useX =` | hooks.ts | Include hook dependencies |
| Helper functions | Non-component functions | utils.ts | Pure functions only |

---

## Before/After State Mapping

| Before State | After State | Transformation |
|--------------|-------------|----------------|
| `pages/Dashboard.tsx` (500 lines) | `pages/Dashboard/index.tsx` + supporting files | Split by content type |
| Inline `interface Props` | `pages/Dashboard/types.ts` | Extract types |
| `const STATUS_MAP = {...}` | `pages/Dashboard/constants.ts` | Extract constants |
| `function useData() {...}` | `pages/Dashboard/hooks.ts` | Extract hooks |
| `function SubComponent() {...}` | `pages/Dashboard/components/SubComponent.tsx` | Extract components |

---

## AST-Based Analysis Methodology

Steps for analyzing React component structure programmatically.

| Step | Analysis Target | Output |
|------|-----------------|--------|
| 1. Parse | Source file to AST | Syntax tree with node types |
| 2. Identify | Import declarations | Dependency graph |
| 3. Extract | Export declarations | Public API surface |
| 4. Classify | Function declarations | Component vs Hook vs Utility |
| 5. Measure | Node counts by type | Complexity metrics |
| 6. Decide | Apply threshold rules | Split/Keep decision |

---

## Transformation Order

Execute transformations in this sequence to avoid broken imports.

| Order | Transformation | Rationale |
|-------|----------------|-----------|
| 1 | Create directory structure | Target folders must exist |
| 2 | Extract types | Types have no dependencies |
| 3 | Extract constants | Constants depend only on types |
| 4 | Extract hooks | Hooks depend on types, constants |
| 5 | Extract sub-components | Components use all above |
| 6 | Update main component | Imports from extracted files |
| 7 | Update external imports | Fix references from other files |

---

**Version:** 1.0.0
**Last Updated:** 2026-01-10

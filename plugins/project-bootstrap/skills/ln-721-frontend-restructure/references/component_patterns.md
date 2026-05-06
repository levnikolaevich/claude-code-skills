# Component Detection Patterns

<!-- SCOPE: React component classification rules ONLY. Contains detection keywords, target locations (ui/layout/feature). -->
<!-- DO NOT add here: Migration workflow → ln-721-frontend-restructure SKILL.md -->

Rules for classifying React components by purpose and target location.

---

## Component Classification

| Category | Detection Keywords | Target Location | Examples |
|----------|-------------------|-----------------|----------|
| **UI Primitive** | Button, Input, Select, Modal, Card, Badge | `components/ui/` | Button.tsx, Input.tsx |
| **Layout** | Layout, Header, Footer, Sidebar, Nav, Menu | `components/layout/` | AppLayout.tsx, Header.tsx |
| **Feature Component** | Business logic, domain terms, API calls | `pages/{Feature}/components/` | EpicCard.tsx, StoryList.tsx |
| **Page Component** | Route-level, full page render | `pages/{Feature}/index.tsx` | Dashboard, Settings |
| **Provider** | Context.Provider, children prop only | `contexts/` | AuthProvider.tsx |

---

## UI Primitive Detection

Indicators that a component belongs in `components/ui/`.

| Indicator | Description | Score |
|-----------|-------------|-------|
| Generic props | `children`, `className`, `style`, `onClick` | +2 |
| No business logic | No API calls, no domain state | +2 |
| Styled wrapper | Wraps HTML element with styles | +1 |
| Variant prop | `variant`, `size`, `color` props | +1 |
| forwardRef usage | Uses React.forwardRef | +1 |

**Classification:** Score >= 4 = UI Primitive

---

## Layout Component Detection

Indicators that a component belongs in `components/layout/`.

| Indicator | Description | Score |
|-----------|-------------|-------|
| Structural role | Organizes page sections | +2 |
| children slot | Main content passed as children | +2 |
| Navigation elements | Contains nav, links, menu | +1 |
| App-wide usage | Used across multiple pages | +1 |
| Fixed position | Header, sidebar, footer patterns | +1 |

**Classification:** Score >= 3 = Layout Component

---

## Feature Component Detection

Indicators that a component belongs in feature folder.

| Indicator | Description | Score |
|-----------|-------------|-------|
| Domain terms | Uses business entity names (Epic, Story, User) | +2 |
| API integration | Fetches or mutates domain data | +2 |
| Feature-specific state | useState for feature logic | +1 |
| Used by single page | Only imported by one page | +1 |
| Complex interactions | Multi-step user flows | +1 |

**Classification:** Score >= 3 = Feature Component (co-locate with page)

---

## Hook Classification

| Hook Type | Detection | Target Location |
|-----------|-----------|-----------------|
| **Shared hook** | Used by 2+ unrelated components | `hooks/` |
| **Feature hook** | Used only within feature | `pages/{Feature}/hooks.ts` |
| **Component hook** | Used by single component | Same file or component's hooks.ts |

---

## Context Classification

| Context Type | Detection | Target Location |
|--------------|-----------|-----------------|
| **App-wide context** | Used across multiple features | `contexts/` |
| **Feature context** | Used only within feature | `pages/{Feature}/context.tsx` |

---

## File Naming Conventions

| Component Type | Naming Pattern | Example |
|----------------|----------------|---------|
| UI Component | PascalCase.tsx | `Button.tsx` |
| Page Component | PascalCase/index.tsx | `Dashboard/index.tsx` |
| Hook | camelCase starting with `use` | `useAuth.ts` |
| Context | PascalCase + Context | `AuthContext.tsx` |
| Types | types.ts (feature) or {Entity}.types.ts (shared) | `types.ts` |
| Constants | constants.ts | `constants.ts` |
| Utilities | utils.ts or {purpose}.ts | `api.ts`, `format.ts` |

---

## Import Path Patterns

| Component Location | Import Alias | Example |
|--------------------|--------------|---------|
| `components/ui/` | `@/components/ui` | `import { Button } from '@/components/ui'` |
| `components/layout/` | `@/components/layout` | `import { AppLayout } from '@/components/layout'` |
| `hooks/` | `@/hooks` | `import { useAuth } from '@/hooks'` |
| `contexts/` | `@/contexts` | `import { AuthProvider } from '@/contexts'` |
| `lib/` | `@/lib` | `import { api } from '@/lib'` |
| Feature-local | Relative | `import { useEpics } from './hooks'` |

---

**Version:** 1.0.0
**Last Updated:** 2026-01-10

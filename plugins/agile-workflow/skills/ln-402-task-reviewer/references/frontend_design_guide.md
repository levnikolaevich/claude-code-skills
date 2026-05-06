# Frontend Design Guide

Framework-agnostic design principles for frontend task execution and review. Loaded conditionally when task involves UI files (`.tsx`, `.vue`, `.svelte`, `.html`, `.css`, `.scss`) or Story AC mentions UI/page/component/layout/screen/form/dashboard.

## Activation Heuristic

Detect frontend context when ANY of:
- Task "Affected Components" contains `.tsx`, `.vue`, `.svelte`, `.html`, `.css`, `.scss` files
- Story AC contains keywords: `UI`, `page`, `component`, `layout`, `screen`, `form`, `dashboard`, `frontend`

## Design Definition (for ln-300 task planning)

When frontend context detected, insert "Design Definition" as Task 1:

| Item | Deliverable |
|------|-------------|
| Visual thesis | 1 sentence: mood, material, energy |
| Content plan | Section sequence (e.g., hero → support → detail → CTA) |
| Interaction plan | 2-3 purposeful motions (section reveals, scroll-linked, hover) |
| Design system ref | Load project's `design_guidelines.md` if exists |

## Composition Rules (for ln-401 Architecture Guard)

| Rule | Detail |
|------|--------|
| One composition per viewport | First viewport reads as ONE composition, not a dashboard |
| Full-bleed heroes | Landing pages: no inset or floating image blocks in hero |
| Hero budget | Brand + headline + supporting sentence + CTA + dominant image. Use `calc(100svh - header-height)` |
| Single-purpose sections | Each section: one headline, one supporting sentence, one primary takeaway |
| No stat strips or icon rows | Avoid competing text blocks in sections |

## Typography & Color

| Rule | Detail |
|------|--------|
| Max 2 typefaces | One for headings, one for body. No defaults — choose expressive, purposeful fonts |
| 1 accent color | Plus neutrals. Calm surface hierarchy for app UI |
| Real photography | Product context over decorative gradients. Stable tonal areas for text legibility |

## Card Discipline

| Rule | Detail |
|------|--------|
| Cards ONLY for interaction | Default to cardless layouts |
| No dashboard card mosaics | Unless each card is actionable |
| No thick borders or decorative gradients | in product UI |
| No ornamental icons | Icons must serve navigation or status |

## WCAG 2.1 AA (for ln-402 review)

| Check | Requirement |
|-------|-------------|
| Text contrast | 4.5:1 ratio (normal text), 3:1 (large text ≥18pt) |
| UI element contrast | 3:1 ratio for borders, icons, controls |
| Keyboard navigation | All interactive elements reachable via Tab/Shift+Tab |
| Focus indicators | Visible focus ring on all interactive elements |
| ARIA labels | Non-text controls have accessible names |
| Focus management | Modals trap focus; route changes announce to screen readers |

## Motion

| Rule | Detail |
|------|--------|
| Max 2-3 purposeful motions | Section reveals, scroll-linked opacity/translate/scale, hover transitions |
| No decorative animation | Each motion must serve hierarchy or atmosphere |
| Respect `prefers-reduced-motion` | Disable non-essential animations when user preference set |

## Copy Strategy

| Rule | Detail |
|------|--------|
| Product language | Not design commentary. Write what the product does, not how it looks |
| Headlines carry meaning | Scannable by headlines alone |
| 1 supporting sentence | Per section. Cut repetition between sections |
| No placeholder text | "Lorem ipsum", "Coming soon", "Your text here" are blockers |
| App UI: utility copy | For dashboards/admin: orientation, status, action. Not aspirational messaging |

## App UI Restraint (Linear-style)

For operational interfaces (dashboards, admin, tools):
- Dense but readable information
- Strong typography and spacing
- Minimal chrome and color palette
- Calm surface hierarchy
- Cards only when interaction requires grouping

## Verification Checklist

Use these questions to verify frontend implementation quality:

| # | Question |
|---|----------|
| 1 | Is brand/product unmistakable in first screen? |
| 2 | Does one strong visual anchor exist? |
| 3 | Can page be scanned by headlines alone? |
| 4 | Does each section have single purpose? |
| 5 | Are cards actually necessary, or would cardless work? |
| 6 | Does motion improve hierarchy or atmosphere? |
| 7 | Would design remain premium without decorative shadows/gradients? |

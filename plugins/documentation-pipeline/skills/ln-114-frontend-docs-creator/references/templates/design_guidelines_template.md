# Design Guidelines: {{PROJECT_NAME}}

**Document Version:** 1.0
**Date:** {{DATE}}
**Status:** {{STATUS}}

<!-- DOC_KIND: explanation -->
<!-- DOC_ROLE: canonical -->
<!-- READ_WHEN: Read when you need visual standards, accessibility rules, or component-level design constraints. -->
<!-- SKIP_WHEN: Skip when you only need implementation details or backend contracts. -->
<!-- PRIMARY_SOURCES: src/, styles/, design system config, docs/project/architecture.md -->

<!-- SCOPE: UI/UX design system (typography, colors, spacing, grid), component library (buttons, forms, cards, navigation, modals), layout patterns (page templates), accessibility guidelines (WCAG AA, keyboard, ARIA), responsive behavior (breakpoints, adaptations), branding (logo, imagery, icons) ONLY. -->
<!-- DO NOT add here: Technical implementation → tech_stack.md, React/Vue code examples → Task descriptions, API contracts → api_spec.md, State management → architecture.md, Performance optimization → runbook.md, Infrastructure inventory → infrastructure.md -->

<!-- NO_CODE_EXAMPLES: Design guidelines document VISUAL CONTRACTS, not code implementations.
     FORBIDDEN: JSX/HTML component code, CSS-in-JS implementations, React/Vue components, styled-components
     ALLOWED: CSS class names as specifications (text-xl, bg-primary), spacing values (px-4, py-3), color hex codes, Tailwind utility references
     Design tokens (colors, typography, spacing) ARE the contract - they specify WHAT, implementations live in code.
     For component implementations → Task descriptions or component library code -->

## Quick Navigation

- [Docs Hub](../README.md)
- [Architecture](architecture.md)
- [Tech Stack](tech_stack.md)
- [Tests README](../../tests/README.md)

## Agent Entry

| Signal | Value |
|--------|-------|
| Purpose | Explains the visual system, accessibility rules, and UI consistency expectations. |
| Read When | You need design constraints, token definitions, or accessibility guidance. |
| Skip When | You only need implementation code or backend/system contracts. |
| Canonical | Yes |
| Next Docs | [Architecture](architecture.md), [Tech Stack](tech_stack.md), [Tests README](../../tests/README.md) |
| Primary Sources | `src/`, `styles/`, design system config, `docs/project/architecture.md` |

---

## 1. Design Approach

### 1.1 Design Philosophy
{{DESIGN_PHILOSOPHY}}
<!-- Example: Reference-Based Approach inspired by Airbnb Design System - professional, user-friendly, consistency across platform. Focuses on clarity, simplicity, and accessibility. -->

### 1.2 Design Inspiration
{{DESIGN_INSPIRATION}}
<!-- Example: Primary reference: example.com design system. Secondary influences: Material Design (components), Tailwind CSS (utility-first approach), Carbon Design System (enterprise patterns) -->

---

## 2. Core Design Elements

### 2.1 Typography

**Font Families:**
{{FONT_FAMILIES}}
<!-- Example:
- Primary (Body): Inter (400, 500, 600) - high legibility for long-form text
- Headings: Poppins (600, 700) - distinct hierarchy, professional
- Monospace: JetBrains Mono (400) - code snippets, technical content
-->

**Type Scale:**
{{TYPE_SCALE}}
<!-- Example (Tailwind CSS classes):
| Element | Class | Size | Line Height | Usage |
|---------|-------|------|-------------|-------|
| Hero | text-5xl | 48px | 1.2 | Landing page hero headlines |
| H1 | text-4xl | 36px | 1.25 | Page titles |
| H2 | text-2xl | 24px | 1.33 | Section headers |
| H3 | text-xl | 20px | 1.4 | Sub-section headers |
| Body | text-base | 16px | 1.5 | Paragraphs, content |
| Small | text-sm | 14px | 1.43 | Captions, labels |
| Tiny | text-xs | 12px | 1.33 | Metadata, timestamps |
-->

**Line Height:**
{{LINE_HEIGHT}}
<!-- Example: Headings: 1.2-1.33 (tight), Body: 1.5 (comfortable reading), UI elements: 1.25 (compact) -->

---

### 2.2 Color System

**Primary Colors:**
{{PRIMARY_COLORS}}
<!-- Example:
- Primary: #FF6B35 (Vibrant orange - CTAs, interactive elements)
- Secondary: #004E89 (Deep blue - headings, trust/authority)
- Accent: #1A936F (Teal green - highlights, success states)
-->

**Semantic Colors:**
{{SEMANTIC_COLORS}}
<!-- Example:
| Purpose | Color | Hex | Usage |
|---------|-------|-----|-------|
| Success | Green | #10B981 | Form success, confirmations |
| Warning | Amber | #F59E0B | Cautions, important notices |
| Error | Red | #EF4444 | Form errors, destructive actions |
| Info | Blue | #3B82F6 | Informational messages, tips |
-->

**Neutral Colors:**
{{NEUTRAL_COLORS}}
<!-- Example:
| Shade | Hex | Usage |
|-------|-----|-------|
| Dark Text | #1F2937 | Primary text, headings |
| Medium Gray | #6B7280 | Secondary text, labels |
| Light Gray | #F3F4F6 | Backgrounds, cards |
| Border | #E5E7EB | Dividers, input borders |
| White | #FFFFFF | Backgrounds, contrast |
-->

**Color Accessibility:**
{{COLOR_ACCESSIBILITY}}
<!-- Example: All color combinations meet WCAG 2.1 AA contrast ratio (4.5:1 for text, 3:1 for UI components). Primary on White: 4.8:1, Dark Text on Light Gray: 12.6:1 -->

---

### 2.3 Layout System

**Spacing Primitives:**
{{SPACING_SYSTEM}}
<!-- Example: Tailwind spacing units: 2 (0.5rem/8px), 4 (1rem/16px), 6 (1.5rem/24px), 8 (2rem/32px), 12 (3rem/48px), 16 (4rem/64px), 20 (5rem/80px), 24 (6rem/96px) -->

**Container Strategy:**
{{CONTAINER_STRATEGY}}
<!-- Example:
| Container Type | Max Width | Padding | Usage |
|----------------|-----------|---------|-------|
| Page | max-w-7xl (1280px) | px-6 | Main page wrapper |
| Content | max-w-6xl (1152px) | px-4 | Article content |
| Narrow | max-w-4xl (896px) | px-4 | Forms, focused content |
| Wide | max-w-full | px-8 | Dashboards, data tables |
-->

**Grid System:**
{{GRID_SYSTEM}}
<!-- Example: 12-column grid, gap-6 (24px), responsive breakpoints (sm/md/lg/xl/2xl). Example: `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6` -->

---

### 2.4 Component Library

#### 2.4.1 Navigation

{{NAVIGATION_COMPONENTS}}
<!-- Example:
- **Header**: Fixed top, h-16 (64px), bg-white shadow-sm, z-50
- **Logo**: Left-aligned, h-8 (32px)
- **Main Menu**: Center (desktop), hamburger (mobile), active state: border-b-2 border-primary
- **User Menu**: Right-aligned, dropdown on click, avatar icon
-->

#### 2.4.2 Buttons

{{BUTTON_COMPONENTS}}
<!-- Example:
| Variant | Classes | Usage |
|---------|---------|-------|
| Primary | bg-primary text-white hover:bg-primary-dark px-6 py-3 rounded-lg | Primary CTAs, submit actions |
| Secondary | border-2 border-primary text-primary hover:bg-primary-light px-6 py-3 rounded-lg | Secondary actions |
| Text | text-primary hover:underline | Tertiary actions, links |
| Icon | p-2 rounded-full hover:bg-gray-100 | Icon-only buttons, close buttons |

Size variants: Small (px-4 py-2 text-sm), Medium (px-6 py-3 text-base), Large (px-8 py-4 text-lg)
-->

#### 2.4.3 Forms

{{FORM_COMPONENTS}}
<!-- Example:
- **Input Fields**: border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary focus:border-primary
- **Labels**: text-sm font-medium text-gray-700 mb-2
- **Error Messages**: text-red-500 text-sm mt-1
- **Help Text**: text-gray-500 text-sm mt-1
- **Checkboxes/Radio**: Accent color matches primary, 44px min tap target
-->

#### 2.4.4 Cards

{{CARD_COMPONENTS}}
<!-- Example:
- **Default**: bg-white shadow-md rounded-lg border border-gray-200 p-6
- **Hover State**: hover:shadow-lg transition-shadow duration-200
- **Interactive**: cursor-pointer hover:border-primary
- **Image Card**: Image top (aspect-16/9), content below, rounded-t-lg for image
-->

#### 2.4.5 Modals & Dialogs

{{MODAL_COMPONENTS}}
<!-- Example:
- **Backdrop**: fixed inset-0 bg-black/50 z-40 backdrop-blur-sm
- **Modal**: fixed inset-0 flex items-center justify-center z-50
- **Content**: bg-white rounded-lg shadow-xl max-w-lg w-full p-6 m-4
- **Close Button**: Absolute top-right, p-2, X icon
- **Actions**: Right-aligned button group, primary + secondary
-->

#### 2.4.6 Tables

{{TABLE_COMPONENTS}}
<!-- Example:
- **Header**: bg-gray-50 text-left font-semibold text-gray-700 px-4 py-3
- **Rows**: border-b border-gray-200 hover:bg-gray-50
- **Cells**: px-4 py-3 text-gray-900
- **Responsive**: Horizontal scroll on mobile, sticky header optional
-->

---

### 2.5 Responsive Behavior

**Breakpoints:**
{{BREAKPOINTS}}
<!-- Example (Tailwind defaults):
| Breakpoint | Min Width | Device | Layout |
|------------|-----------|--------|--------|
| sm | 640px | Large phones | Single column, stacked nav |
| md | 768px | Tablets | 2-column grids, horizontal nav |
| lg | 1024px | Laptops | 3-column grids, full navigation |
| xl | 1280px | Desktops | 4-column grids, max-width containers |
| 2xl | 1536px | Large displays | Wide layouts, extra whitespace |
-->

**Layout Adaptations:**
{{RESPONSIVE_LAYOUTS}}
<!-- Example:
- **Desktop (>1024px)**: 3-column grid for products, sidebar navigation, header with full menu
- **Tablet (768-1024px)**: 2-column grid, hamburger menu, condensed header
- **Mobile (<768px)**: 1-column stack, bottom navigation, collapsible sections
- **Touch Targets**: Min 44x44px for all interactive elements on mobile
-->

---

## 3. Accessibility Guidelines

### 3.1 WCAG Compliance
{{WCAG_LEVEL}}
<!-- Example: WCAG 2.1 Level AA compliance (minimum). Contrast ratios: 4.5:1 for text, 3:1 for UI components. -->

### 3.2 Keyboard Navigation
{{KEYBOARD_NAVIGATION}}
<!-- Example:
- All interactive elements focusable via Tab key
- Visible focus ring: ring-2 ring-primary ring-offset-2
- Logical tab order (top-to-bottom, left-to-right)
- Skip to main content link (hidden, appears on Tab)
- Modal focus trap (Tab cycles within modal)
-->

### 3.3 Screen Reader Support
{{SCREEN_READER}}
<!-- Example:
- ARIA labels for icon buttons: aria-label="Close dialog"
- Semantic HTML: <nav>, <main>, <article>, <aside>
- Table headers with scope attribute
- Form labels associated with inputs (for/id)
- Alt text for all images (descriptive, not decorative)
-->

### 3.4 Focus Management
{{FOCUS_MANAGEMENT}}
<!-- Example:
- Focus visible on all interactive elements (ring-2 ring-primary)
- Focus returns to trigger after modal close
- Error messages announced to screen readers (aria-live="polite")
- Skip navigation links for keyboard users
-->

---

## 4. Branding & Visual Identity

### 4.1 Logo Usage
{{LOGO_USAGE}}
<!-- Example:
- Primary logo (full color) on light backgrounds
- Secondary logo (monochrome white) on dark backgrounds
- Minimum size: 32px height (digital), 0.5in (print)
- Clear space: Logo height on all sides
- Never stretch, skew, or rotate logo
-->

### 4.2 Imagery Guidelines
{{IMAGERY_GUIDELINES}}
<!-- Example:
- Hero images: 16:9 aspect ratio, min 1920x1080px
- Product photos: 1:1 aspect ratio, min 800x800px
- Illustrations: Flat design style, minimalist, 2-3 color palette
- Image optimization: WebP format, lazy loading, responsive srcset
- Stock photos: Professional, diverse, authentic (avoid clichés)
-->

### 4.3 Iconography
{{ICONOGRAPHY}}
<!-- Example:
- Icon library: Heroicons (outline for UI, solid for emphasis)
- Sizes: 16px (inline), 24px (buttons), 32px (features), 48px (headers)
- Style: Outline (2px stroke), consistent visual weight
- Color: Inherit text color or use semantic colors
-->

---

## 5. Page Layout Patterns

### 5.1 {{PAGE_TYPE_1}}
{{PAGE_LAYOUT_1}}
<!-- Example: Homepage
- Hero section: Full-width, py-20, bg-gradient, centered CTA
- Features grid: 3-column (desktop), 1-column (mobile), gap-8
- CTA section: bg-primary, text-white, py-16, centered
- Footer: 4-column links (desktop), stacked (mobile)
-->

### 5.2 {{PAGE_TYPE_2}}
{{PAGE_LAYOUT_2}}
<!-- Example: Dashboard
- Fixed header: h-16, shadow-sm
- Sidebar: w-64 (desktop), hidden (mobile, toggle button)
- Main content: Filters bar → KPI cards (4-column) → Charts grid (2-column) → Data table
- Mobile: Bottom navigation, stacked KPI cards
-->

### 5.3 {{PAGE_TYPE_3}}
{{PAGE_LAYOUT_3}}
<!-- Example: Form page
- Centered narrow container (max-w-2xl)
- Progress indicator (multi-step forms)
- Section dividers with headings
- Action buttons: Right-aligned, primary + secondary
-->

---

## 6. Internationalization (if applicable)

{{I18N_GUIDELINES}}
<!-- Example:
- Language toggle: Top-right header, flag icons + text
- RTL support: Arabic/Hebrew layouts (flex-row-reverse)
- Date/time formatting: Intl.DateTimeFormat API
- Number formatting: Intl.NumberFormat (1,234.56 vs 1.234,56)
- Text expansion: Allow 30% growth for translations (German, Finnish)
- Font fallbacks: Sans-serif for Arabic (Noto Sans Arabic), Cyrillic (Roboto)
-->

---

## Maintenance

**Last Updated:** {{DATE}}

**Update Triggers:**
- New component added to design system
- Brand refresh or logo change
- Accessibility audit findings
- Design system library update (Material UI, Ant Design, etc.)
- Responsive breakpoint changes
- Color palette modifications

**Verification:**
- [ ] All components documented with examples
- [ ] Color contrast ratios WCAG AA compliant (4.5:1 text, 3:1 UI)
- [ ] Typography scale consistent across platform
- [ ] Accessibility guidelines up to date
- [ ] Responsive behaviors tested on all breakpoints
- [ ] Logo usage rules followed

---

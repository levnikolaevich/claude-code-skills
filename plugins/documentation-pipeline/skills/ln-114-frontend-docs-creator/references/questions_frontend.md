# Frontend Documentation Questions (Q43-Q45)

<!-- SCOPE: Interactive questions for design_guidelines.md ONLY. Conditional: hasFrontend. -->
<!-- DO NOT add here: question logic → ln-114-frontend-docs-creator SKILL.md, other doc questions → questions_backend.md, questions_devops.md -->

**Purpose:** Validation questions for design_guidelines.md.

---

## Table of Contents

| Document | Questions | Auto-Discovery | Condition |
|----------|-----------|----------------|-----------|
| [design_guidelines.md](#docsprojectdesignguidelinesmd) | 3 | Low | hasFrontend |

---

<!-- DOCUMENT_START: docs/project/design_guidelines.md -->
## docs/project/design_guidelines.md

**File:** docs/project/design_guidelines.md (UI/UX design system - Frontend only)
**Rules:** WCAG 2.1 Level AA compliant, design system documented

---

<!-- QUESTION_START: 43 -->
### Question 43: What is the design system or component library?

**Expected Answer:** Design system name, key components, customization approach
**Target Section:** ## Design System

**Validation Heuristics:**
- Mentions design system name or "custom design system"
- Lists key components (Button, Input, Card, Modal)
- Explains customization/theming approach

**Auto-Discovery:**
- Check: package.json (@mui/material, antd, chakra-ui, @headlessui/react)
- Scan: src/components/ for component library usage
<!-- QUESTION_END: 43 -->

---

<!-- QUESTION_START: 44 -->
### Question 44: What fonts and text styles are used?

**Expected Answer:** Font families, sizes, weights
**Target Section:** ## Typography

**Validation Heuristics:**
- Lists font families
- Has size/weight specifications
- Shows typography scale (h1-h6, body, small)

**Auto-Discovery:**
- Check: src/styles/ or CSS files for font definitions
- Check: package.json for @fontsource/*, next/font
- Check: tailwind.config.js for fontFamily
<!-- QUESTION_END: 44 -->

---

<!-- QUESTION_START: 45 -->
### Question 45: What is the color palette?

**Expected Answer:** Primary, secondary, accent colors (hex), semantic colors
**Target Section:** ## Colors

**Validation Heuristics:**
- Lists colors with hex codes
- Has semantic categories (success, error, warning, info)
- Shows accessibility contrast ratios

**Auto-Discovery:**
- Check: CSS variables or theme files
- Check: tailwind.config.js for colors
- Scan: src/styles/ for color definitions
<!-- QUESTION_END: 45 -->

---

**Overall File Validation:**
- Has SCOPE tag in first 10 lines
- Has design system documentation
- References WCAG 2.1 accessibility

<!-- DOCUMENT_END: docs/project/design_guidelines.md -->

---

**Total Questions:** 3
**Total Documents:** 1

---
**Version:** 1.0.0
**Last Updated:** 2025-12-19

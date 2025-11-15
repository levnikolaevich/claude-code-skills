# x-html-builder Template Architecture

This document describes the structure and content specifications for all HTML templates used by x-html-builder skill.

## File Structure

All templates are stored in `x-html-builder/references/` following the Template Ownership Principle (each skill owns its templates):

```
x-html-builder/references/
├── presentation_template.html    # Base HTML5 structure with 6 tab navigation
├── styles.css                     # CSS Variables, responsive design (~500 lines)
├── scripts.js                     # Tab switching, collapsible sections, Mermaid init
├── build-presentation.js          # Node.js build script for inlining
└── tabs/
    ├── tab_overview_template.html          # Landing page
    ├── tab_requirements_template.html      # FRs + NFRs + ADRs
    ├── tab_architecture_template.html      # C4 diagrams
    ├── tab_technical_spec_template.html    # API + Data + Deployment
    ├── tab_roadmap_template.html           # Kanban-style
    └── tab_guides_template.html            # How-to guides
```

## Tab Content Specifications

### Tab 1: Overview (Landing Page)

**File:** `tab_overview_template.html`

**SCOPE:**
- INCLUDES: Project name, tagline, business goal, tech stack badges, role-based navigation, quick stats, recent updates
- EXCLUDES: Full requirements → Requirements tab, Detailed diagrams → Architecture tab, Full roadmap → Roadmap tab, API details → Technical Spec tab

**Content Elements:**
- **Header Intro:** Project name (h1) + tagline (minimal, no gradient background)
- **Project Summary:** Business goal in "About This Project" section (h2)
- **Role-Based Navigation:** 4 cards (Developer/Architect/Product Owner/Stakeholder) - clickable, switches to relevant tab
- **Tech Stack Badges:** Technology badges with icons and names
- **Quick Stats:** Project statistics grid (total epics, completed stories, test coverage, uptime SLA)
- **Recent Updates:** Recent project updates list
- **Quick Links:** Links to other tabs (Requirements, Architecture, API Reference, Roadmap)

**Data Sources:**
- requirements.md (project name, business goal)
- architecture.md (tech stack)
- kanban_board.md (stats, recent updates)

**Placeholders:**
- `{{PROJECT_NAME}}` - Project name from requirements.md ## Project Name
- `{{PROJECT_TAGLINE}}` - Short description from requirements.md
- `{{BUSINESS_GOAL}}` - Business goals section from requirements.md
- `{{TECH_STACK_BADGES}}` - Generated from architecture.md tech stack
- `{{QUICK_STATS}}` - Generated from kanban_board.md Epic Story Counters
- `{{RECENT_UPDATES}}` - Placeholder (currently undefined - TODO: specify data source)

### Tab 2: Requirements

**File:** `tab_requirements_template.html`

**SCOPE:**
- INCLUDES: Business goals, FRs (collapsible), NFRs (7 categories), ADRs (Strategic/Technical groups), constraints, success criteria
- EXCLUDES: Implementation details → Technical Spec, Diagrams → Architecture, Code → Guides

**Content Elements:**
- **Business Goals:** Project objectives with key targets (h2 + list)
- **Functional Requirements:** Collapsible by domain (details/summary tags) - FR-XXX-001 format with Priority (MUST/SHOULD/COULD), Description
- **Non-Functional Requirements:** 7 categories (Performance, Security, Scalability, Usability, Maintainability, Reliability, Compliance) - NFR-XXX-001 format with Priority
- **ADRs Section:** Grouped by category:
  - **Strategic Decisions** (h3) - Business/architecture strategy ADRs
  - **Technical Decisions** (h3) - Technology/implementation ADRs
  - Each ADR in accordion (details/summary) with full content inline:
    - Date | Status | Category (metadata line)
    - Context (h4)
    - Decision (h4)
    - Rationale (h4 + list)
    - Alternatives Considered (h4 + table: Alternative | Pros | Cons | Rejection Reason)
    - Consequences (h4 + Positive/Negative lists)
- **Constraints:** Technology constraints
- **Success Criteria:** Measurable project success metrics

**Data Sources:**
- requirements.md (business goals, FRs, NFRs, constraints, success criteria)
- adrs/*.md (all ADR files with Category field for grouping)

**Placeholders:**
- None (all content directly from MD files)

### Tab 3: Architecture

**File:** `tab_architecture_template.html`

**SCOPE:**
- INCLUDES: C4 diagrams (Context/Container/Component), Deployment, Solution strategy, Quality attributes
- EXCLUDES: ADRs → Requirements, API details → Technical Spec, Code → Guides

**Content Elements:**
- **C4 Diagrams:** 4 levels in Mermaid syntax (preserved exactly as in architecture.md):
  - System Context (C4 Level 1)
  - Container Diagram (C4 Level 2)
  - Component Diagram (C4 Level 3)
  - Deployment Diagram
- **Solution Strategy:** Architecture pattern, API design approach
- **Quality Attributes:** Scalability, Security, Maintainability approaches

**Data Sources:**
- architecture.md (all content)

**Placeholders:**
- None (all content directly from architecture.md)

**EXCLUDES:**
- Tech stack table → moved to Technical Spec tab
- ADRs → moved to Requirements tab

### Tab 4: Technical Specification

**File:** `tab_technical_spec_template.html`

**SCOPE:**
- INCLUDES: Tech stack (detailed table), API endpoints, Authentication, Error codes, ER diagram, Data dictionary, Integrations, Deployment, Testing strategy (Risk-Based)
- EXCLUDES: Requirements → Requirements tab, Architecture diagrams → Architecture tab, How-to guides → Guides tab

**Content Elements:**
- **Technology Stack:** Detailed table (Category | Technology | Version | Purpose) - includes Frontend, Backend, Database, Infrastructure, DevOps categories
- **API Endpoints:** Table grouped by resource (Endpoint | Method | Description | Request | Response)
- **Authentication:** Auth mechanism description (JWT, OAuth, etc.)
- **Error Codes:** Standard error codes table (Code | Message | Description)
- **Data Model:** ER diagram in Mermaid + Data Dictionary table (Entity | Attributes | Description)
- **Third-Party Integrations:** External services table (Service | Purpose | API Documentation)
- **Deployment Infrastructure:** Infrastructure description (cloud provider, services)
- **Testing Strategy:** Risk-Based Testing approach (2-5 E2E, 3-8 Integration, 5-15 Unit tests per Story, total 10-28 max)

**Data Sources:**
- technical_specification.md (all content)
- architecture.md (tech stack section - moved here)

**Placeholders:**
- None (all content directly from MD files)

### Tab 5: Roadmap

**File:** `tab_roadmap_template.html`

**SCOPE:**
- INCLUDES: Kanban board (3 columns), Epic cards, Progress bars (%), Milestones
- EXCLUDES: Individual stories → Linear, Daily tasks → task tracker, Team assignments, Implementation details → Technical Spec

**Content Elements:**
- **Kanban Board:** 3 columns layout (Todo | In Progress | Done)
- **Epic Cards:** For each Epic from kanban_board.md:
  - Epic number + title (h3)
  - Description (p)
  - Stories count: X/Y completed
  - Target date or Completed date
  - Status badge (status-todo | status-progress | status-done)
  - Progress bar with % width
- **Milestones:** Quarterly milestones list with status indicators

**Data Sources:**
- kanban_board.md (Epic Story Counters table - Epic number, title, status, story counts, target dates)
- requirements.md (Epic descriptions)
- architecture.md (Epic technical context)

**Placeholders:**
- None (all content generated from kanban_board.md)

**Epic Status Mapping:**
- Todo → kanban-todo column, status-todo badge, 0% progress
- In Progress → kanban-progress column, status-progress badge, calculated % progress
- Done → kanban-done column, status-done badge, 100% progress

### Tab 6: Guides

**File:** `tab_guides_template.html`

**SCOPE:**
- INCLUDES: Getting started, How-to guides (task-oriented), Best practices, Troubleshooting, Contributing, External resources
- EXCLUDES: API reference → Technical Spec, Architecture → Architecture tab, Requirements → Requirements tab

**Content Elements:**
- **Getting Started:** Prerequisites, Installation steps (code blocks), Verification checklist
- **How-To Guides:** Task-oriented guides (How to Add Product, How to Test API, etc.) - steps in ordered lists
- **Best Practices:** Code style, Testing approach, Design patterns
- **Troubleshooting:** Common issues with solutions (h3 per issue + list)
- **Contributing Guidelines:** Fork, branch, test, submit PR workflow
- **External Resources:** Links to framework docs, third-party docs (target="_blank")

**Data Sources:**
- docs/guides/*.md (all guide files)
- README.md (getting started section)
- technical_specification.md (testing strategy)

**Placeholders:**
- None (all content directly from guide files)

## Build Process

**Script:** `build-presentation.js` (Node.js)

**Logic:**
1. Read `presentation_template.html`
2. Read all 6 tab files from `tabs/` directory
3. Inject tab content into template (replace `<!-- TAB_CONTENT_overview -->` etc.)
4. Read `styles.css` and inline into `<style>` tags
5. Read `scripts.js` and inline into `<script>` tags
6. Write `../presentation_final.html` (one level up from assets/)

**Expected Output:**
- Standalone HTML file (~120-150 KB)
- No external dependencies (except Mermaid.js CDN for diagram rendering)
- All CSS and JavaScript inlined

## Styling Specifications

**File:** `styles.css` (~500 lines)

**CSS Variables:**
```css
:root {
    --primary-color: #2563eb;
    --background-color: #f8fafc;
    --text-color: #1e293b;
    --border-color: #e2e8f0;
}
```

**Key Components:**
- **header-intro:** Minimal header (no gradient) - name + tagline
- **project-summary:** Business goal section (h2 + paragraph)
- **role-cards:** 4 clickable cards with hover effects (subtle, no transform)
- **badge:** Tech stack badges (inline-block, rounded, neutral colors)
- **epic-card:** Roadmap Epic cards with status badges and progress bars
- **progress-bar:** Horizontal bar with % fill (neutral colors, no gradient)
- **tabs:** Navigation bar with active tab indicator
- **kanban-board:** 3-column grid layout
- **Mermaid diagrams:** Responsive container with max-width
- **ADR accordion:** details/summary styling with expand indicator
- **Responsive breakpoints:** Mobile (<768px), Tablet (768-1024px), Desktop (>1024px)

**Design Principles:**
- Minimal, documentation-focused (vs marketing-style)
- Neutral color palette (blues, grays)
- No excessive gradients or transforms
- GitBook/Docusaurus aesthetic
- Progressive disclosure (collapsible sections)
- Information scent (clear navigation labels)

## Validation Checklist

Before completing build, verify:

- [ ] HTML structure valid (proper heading hierarchy h1 > h2 > h3)
- [ ] All 6 tabs present in navigation (overview, requirements, architecture, technical_spec, roadmap, guides)
- [ ] SCOPE tags present in each tab (HTML comments in first 3-5 lines)
- [ ] All placeholders replaced (no `{{PLACEHOLDER}}` remaining)
- [ ] Mermaid diagrams render correctly (valid syntax, no errors in console)
- [ ] Tab switching works (JavaScript loaded, localStorage state persistence)
- [ ] Collapsible sections functional (details/summary expand/collapse)
- [ ] Responsive design works (mobile/tablet/desktop breakpoints)
- [ ] Kanban board renders: 3 columns, Epic cards in correct columns, progress bars display %
- [ ] ADR grouping works: Strategic/Technical sections separate, accordion expands/collapses
- [ ] Role-based navigation cards clickable (switches to correct tabs)
- [ ] File size within expected range (~120-150 KB)
- [ ] Tested in browser: Double-click presentation_final.html → opens without errors

## Data Source Mapping

| Tab | Primary Source | Secondary Sources |
|-----|---------------|-------------------|
| Overview | requirements.md | architecture.md, kanban_board.md |
| Requirements | requirements.md | adrs/*.md |
| Architecture | architecture.md | - |
| Technical Spec | technical_specification.md | architecture.md (tech stack) |
| Roadmap | kanban_board.md | requirements.md, architecture.md |
| Guides | docs/guides/*.md | README.md, technical_specification.md |

## Placeholder Reference

| Placeholder | Source | Location |
|-------------|--------|----------|
| `{{PROJECT_NAME}}` | requirements.md | ## Project Name |
| `{{PROJECT_TAGLINE}}` | requirements.md | First paragraph or subtitle |
| `{{BUSINESS_GOAL}}` | requirements.md | ## Business Goals section |
| `{{TECH_STACK_BADGES}}` | architecture.md | ## Technology Stack section |
| `{{QUICK_STATS}}` | kanban_board.md | Epic Story Counters table |
| `{{RECENT_UPDATES}}` | **TODO: Undefined** | Need to specify data source |

## TODO: Undefined Placeholders

**RECENT_UPDATES:**
- **Current Status:** Placeholder exists in tab_overview_template.html but data source not specified
- **Recommendation:** Either:
  1. Remove placeholder if not needed
  2. Define data source (e.g., git log last 5 commits, or manual section in requirements.md)
  3. Generate from kanban_board.md Epic status changes

---

**Version:** 1.0.0
**Last Updated:** 2025-01-31
**Related:** x-html-builder/SKILL.md

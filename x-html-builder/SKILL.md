---
name: x-html-builder
description: Build interactive HTML presentation from project documentation with 6 tabs - Overview, Requirements (FRs/NFRs/ADRs), Architecture (C4 diagrams), Technical Spec (API/data), Roadmap (Epic list), and Guides. Uses Mermaid v11, table-based structure, English language. Works with x-docs-creator output.
---

# HTML Presentation Builder

This skill creates an interactive, self-contained HTML presentation from existing project documentation. It transforms Markdown documents into a professional, navigable web presentation with diagrams, collapsible sections, and modern UI.

## When to Use This Skill

Use this skill when:
- Have existing project documentation (created by x-docs-creator or manually)
- Create an interactive HTML presentation for stakeholders
- Share documentation as a single file (no server required)
- Rebuild HTML after documentation updates
- Visualize architecture diagrams professionally (Mermaid)

**Prerequisites**: Existing documentation in `docs/core/` or `docs/project/` directory with at least:
- `requirements.md`
- `architecture.md`
- `technical_specification.md`

## How It Works

The skill follows a 4-phase workflow: read documentation → copy templates → inject content → build final presentation.

### Phase 1: Read Documentation

**Objective**: Load all project documentation for transformation.

**Process**:
1. **Ask for docs location**:
   - "Where are your docs? (docs/core/ or docs/project/ or custom path)"
   - Default: `docs/core/` (DAG structure) or `docs/project/` (standalone)

2. **Read Core MD Documents**:
   - `requirements.md` - Functional/Non-Functional Requirements
   - `architecture.md` - Architecture design, C4 diagrams
   - `technical_specification.md` - Tech stack, API, database

3. **Read ADRs** (if exist):
   - `adrs/adr-001-*.md` through `adrs/adr-NNN-*.md`
   - Parse ADR metadata (status, date, title)

4. **Validate Documentation**:
   - Check that required MD files exist
   - Warn if files missing (can proceed with partial data)
   - Extract key metadata (project name, date, version)

**Output**: Loaded documentation data ready for HTML generation

---

### Phase 2: Copy Templates to Project

**Objective**: Copy HTML/CSS/JS templates from skill references/ to project directory.

**Process**:

1. **Check if presentation exists**:
   - If `docs/{folder}/assets/` exists:
     - Skip copying (user will edit existing files)
     - Notify: "Presentation assets already exist. Proceeding to Phase 3 (content injection)."
   - If NOT exists:
     - Copy all templates from `x-html-builder/references/` → `docs/{folder}/assets/`

2. **Copy template files**:
   ```bash
   cp x-html-builder/references/presentation_template.html → docs/{folder}/assets/
   cp x-html-builder/references/styles.css → docs/{folder}/assets/
   cp x-html-builder/references/scripts.js → docs/{folder}/assets/
   cp x-html-builder/references/build-presentation.js → docs/{folder}/assets/
   cp -r x-html-builder/references/tabs/ → docs/{folder}/assets/tabs/
   ```

3. **Verify copied structure**:
   ```
   docs/{folder}/assets/
   ├── presentation_template.html
   ├── styles.css
   ├── scripts.js
   ├── build-presentation.js
   └── tabs/
       ├── tab_overview_template.html
       ├── tab_requirements_template.html
       ├── tab_architecture_template.html
       ├── tab_technical_spec_template.html
       ├── tab_roadmap_template.html
       └── tab_guides_template.html
   ```

**Output**: Template files copied to project (or skipped if already exist)

**Note**: Templates contain placeholders ({{VARIABLE_NAME}}) that will be replaced in Phase 3.

---

### Phase 3: Parse Documentation & Inject Content

**Objective**: Read MD documentation, parse content, and inject into HTML templates.

**Process**:

#### Step 3.1: Read and Parse MD Documents

Read and parse the following documentation files:

1. **requirements.md**: Project name, tagline, business goal, functional requirements, non-functional requirements, constraints, success criteria
2. **architecture.md**: Architecture diagrams (C4 Context/Container/Component, Deployment), solution strategy, tech stack, quality attributes
3. **technical_specification.md**: API endpoints, data models, integrations, deployment configuration, testing strategy
4. **adrs/*.md**: All ADR files (parse title, status, category, content)
5. **kanban_board.md**: Epic Story Counters table (for Roadmap progress calculation)
6. **docs/guides/*.md** (optional): How-to guides for Guides tab

#### Step 3.2: Inject Content into Templates

Replace placeholders in copied template files with parsed content:

**Key Placeholders (in tab templates):**

**Overview Tab:**
- `{{PROJECT_SUMMARY}}` — Problem/Solution/Business Value structure (3 sections)
- `{{KEY_STAKEHOLDERS}}` — Stakeholder cards with names and roles
- `{{NAVIGATION_GUIDE}}` — Documentation guide with tab descriptions
- `{{TECH_STACK_BADGES}}` — Technology badges (brief list only)
- `{{QUICK_FACTS}}` — Project Status, Total Epics, Deployment Model, Target Platforms

**Requirements Tab:**
- `{{FUNCTIONAL_REQUIREMENTS}}`, `{{NON_FUNCTIONAL_REQUIREMENTS}}` — FRs and NFRs
- `{{ADR_STRATEGIC}}`, `{{ADR_TECHNICAL}}` — Generated HTML for grouped ADRs
- `{{SUCCESS_CRITERIA}}` — Project success metrics

**Architecture Tab:**
- `{{C4_CONTEXT}}`, `{{C4_CONTAINER}}`, `{{C4_COMPONENT}}` — C4 diagrams with captions
- `{{DEPLOYMENT_DIAGRAM}}` — Infrastructure diagram
- `{{ARCHITECTURE_NOTES}}` — Brief highlights with references to Requirements

**Technical Spec Tab:**
- `{{API_ENDPOINTS}}`, `{{API_AUTH}}`, `{{API_ERROR_CODES}}` — API documentation
- `{{ER_DIAGRAM}}`, `{{DATA_DICTIONARY}}` — Data models

**Roadmap Tab:**
- `{{ROADMAP_INTRO}}` — Explanation text (work order, not timeline)
- `{{EPIC_CARDS_BACKLOG}}`, `{{EPIC_CARDS_TODO}}`, `{{EPIC_CARDS_PROGRESS}}`, `{{EPIC_CARDS_DONE}}`, `{{EPIC_CARDS_OUT_OF_SCOPE}}` — Epic cards with Dependencies and Success Criteria (NO dates)
- `{{ROADMAP_LEGEND}}` — Understanding roadmap explanation

**Guides Tab:**
- `{{GETTING_STARTED}}`, `{{HOW_TO_GUIDES}}`, `{{BEST_PRACTICES}}`

And many more (see template files for full list)

**Placeholder Replacement Logic:**
- Use **Edit** tool to replace `{{PLACEHOLDER}}` → actual content
- For lists/arrays: generate HTML dynamically (e.g., loop through ADRs, create `<details>` elements)
- For Kanban: parse kanban_board.md → calculate progress % → generate Epic card HTML
- Preserve SCOPE tags in tab files (HTML comments at top)

**Output**: Templates with injected content ready for build

---

### Phase 4: Build Final Presentation

**Objective**: Assemble modular components into standalone HTML file.

**Process**:

1. **Navigate to assets directory**:
   ```bash
   cd assets/
   ```

2. **Run build script**:
   ```bash
   node build-presentation.js
   ```

3. **Build Script Process**:
   - **Step 1**: Read presentation_template.html
   - **Step 2**: Read and inline styles.css → `<style>` tag
   - **Step 3**: Read and inline scripts.js → `<script>` tag
   - **Step 4**: Read all 6 tab files → inject into empty `<div>` containers
   - **Step 5**: Replace {{PLACEHOLDERS}} with actual values
   - **Step 6**: Write `../presentation_final.html`

4. **Validate Output**:
   - Check file size (~120-150 KB expected)
   - Verify Mermaid diagrams render
   - Test in browser (double-click to open)

**Output**: `docs/{folder}/presentation_final.html` (self-contained, no dependencies, ~120-150 KB)

**⚠️ Important Note:**

`presentation_final.html` is a **generated file** built from modular source files in `assets/`.

- ❌ **DO NOT edit `presentation_final.html` directly** — changes will be lost on next rebuild
- ✅ **DO edit source files** in `assets/` directory (template, tabs, styles, scripts)
- 🔄 **Rebuild after changes**: `cd assets/ && node build-presentation.js`

---

## Complete Output Structure

```
docs/{folder}/
├── requirements.md
├── architecture.md
├── technical_specification.md
├── adrs/
│   └── *.md (with Category: Strategic | Technical)
├── tasks/
│   └── kanban_board.md (Epic Story Counters for Roadmap)
├── guides/
│   └── *.md (optional, for Guides tab)
├── presentation_final.html          # ← Final standalone HTML (~130-180 KB)
└── assets/                           # ← Modular HTML structure
    ├── presentation_template.html    # Base HTML5 + 6 tab navigation
    ├── styles.css                    # ~400-500 lines (tables, epic-list, ADR styles)
    ├── scripts.js                    # Tab switching + Mermaid rerender + collapsible
    ├── build-presentation.js         # Node.js build script
    └── tabs/
        ├── tab_overview.html         # Landing page
        ├── tab_requirements.html     # FRs/NFRs tables + ADRs
        ├── tab_architecture.html     # C4 diagrams + highlights table
        ├── tab_technical_spec.html   # API + Data + Deployment
        ├── tab_roadmap.html          # Epic list with In/Out Scope
        └── tab_guides.html           # How-to guides
```

---

## HTML Features

- **Single Source of Truth**: No information duplication - each piece of information lives in exactly ONE tab, other tabs reference it
- **Landing Page (Overview)**: Problem/Solution/Business Value structure, Key Stakeholders cards, Documentation Guide (for each tab), Quick Facts (status, epics, platform), Tech Stack badges
- **Interactive Navigation**: 6 tabs (Overview, Requirements, Architecture, Technical Spec, Roadmap, Guides) with updated SCOPE tags, state persistence (localStorage), smooth transitions
- **Table-Based Layout**: FRs table (ID | Priority | Requirement | AC), NFRs table (Category | ID | Requirement | Target), Architecture highlights table (Aspect | Approach | Rationale)
- **Roadmap Simplified**: Vertical Epic list with In Scope/Out of Scope sections per Epic, status badges, Dependencies/Success Criteria, NO specific dates/budgets
- **ADR Organization**: Grouped by category (Strategic/Technical) with accordion (details/summary), full content inline
- **Diagram Visualization**: Mermaid.js with tab-switch rerender - works consistently on ALL tabs (C4, ER, Sequence, Deployment)
- **Responsive Design**: Mobile-first (320px/768px/1024px+ breakpoints), responsive tables and epic grids
- **Collapsible Sections**: Auto-collapse with scroll position preservation
- **SCOPE Tags**: Each tab has HTML comment defining boundaries - updated to prevent duplication
- **English Language**: All presentation content in English (templates use English examples and structure)
- **Modern UI**: Clean professional design, consistent typography, WCAG 2.1 Level AA compliant

---

## Best Practices

### During Documentation Reading (Phase 1)
1. **Validate paths**: Check that docs folder exists before reading
2. **Graceful degradation**: Continue even if some files missing (warn user)
3. **Extract metadata**: Pull project name, date, version from documents
4. **Parse Mermaid blocks**: Identify and preserve diagram syntax

### During Template Copying (Phase 2)
1. **Check existing assets**: Don't overwrite user-customized templates
2. **Verify directory structure**: Ensure tabs/ subdirectory created
3. **Preserve permissions**: Maintain executable permissions for build script

### During Content Injection (Phase 3)
1. **Preserve Markdown formatting**: Convert MD → HTML correctly
2. **Generate valid Mermaid syntax**: Test all diagram syntax
3. **Escape special characters**: Prevent XSS vulnerabilities
4. **Use semantic HTML**: Proper heading hierarchy, ARIA labels
5. **Preserve SCOPE tags**: Keep HTML comments in tab files

### During Build (Phase 4)
1. **Validate Node.js availability**: Check `node --version` before running script
2. **Handle errors gracefully**: If build fails, provide clear error messages
3. **Test output**: Open presentation_final.html to verify rendering
4. **Size check**: Warn if file >200 KB (may indicate issues)

---

## Customization Options

Edit `assets/styles.css` (CSS variables for theming), `assets/presentation_template.html` (layout/tabs), or `assets/tabs/*.html` (tab content).

**⚠️ After any customization:** Always rebuild the presentation:
```bash
cd assets/
node build-presentation.js
```

**Important:** Never edit `presentation_final.html` directly — it's a generated file that gets overwritten on each build.

---

## Integration with Other Skills

### Works With:
- **x-docs-creator**: Primary consumer (generates MD docs → this skill → HTML)
- **x-docs-system**: Called by orchestrator after MD generation
- **x-docs-updater**: Re-run after docs updated

### Typical Workflow:
```
1. x-docs-creator
   ↓ (creates MD docs)
2. x-html-builder ← YOU ARE HERE
   ↓ (creates HTML presentation)
3. Share presentation_final.html with stakeholders
```

### Re-build After Updates:
```
1. x-docs-updater
   ↓ (updates MD docs)
2. x-html-builder
   ↓ (rebuilds HTML with latest changes)
3. Share updated presentation_final.html
```

---

## Troubleshooting

- **Mermaid diagrams not rendering**: Check syntax (Mermaid Live Editor), verify CDN loaded, try different browser
- **Build script fails**: Check Node.js v18+, navigate to `assets/`, verify all files exist
- **File too large (>200 KB)**: Reduce diagrams, minify CSS/JS, remove unused rules
- **Tabs not switching**: Check JavaScript loaded, open browser console for errors, hard refresh (Ctrl+F5)

---

## Definition of Done

Before completing work, verify ALL checkpoints:

**✅ Modular HTML Structure Created:**
- [ ] Assets directory created in project docs location
- [ ] All required template files copied from `x-html-builder/references/` to `docs/{folder}/assets/`:
  - `presentation_template.html` (base HTML5 structure with 6 tabs)
  - `styles.css` (~500 lines)
  - `scripts.js` (tab switching, Mermaid init)
  - `build-presentation.js` (Node.js build script)
  - All 6 tab templates in `tabs/` subdirectory

**Note:** Detailed template specifications are documented in [references/TEMPLATE_ARCHITECTURE.md](references/TEMPLATE_ARCHITECTURE.md).

**✅ Content Generated from MD Docs:**
- [ ] All 6 tabs populated with content from project MD files
- [ ] All Mermaid diagrams preserved with valid syntax
- [ ] All placeholders replaced (no `{{PLACEHOLDER}}` remaining)
- [ ] SCOPE tags present in each tab (HTML comments)

**✅ Build Process Completed:**
- [ ] Build script executed: `cd docs/{folder}/assets/ && node build-presentation.js`
- [ ] `presentation_final.html` created successfully (~120-150 KB)
- [ ] Standalone file (no external dependencies except Mermaid.js CDN)

**✅ Validation Passed:**
- [ ] All 6 tabs functional (navigation works, content displays correctly)
- [ ] Mermaid diagrams render without errors
- [ ] Collapsible sections work (details/summary, accordion)
- [ ] Responsive design works (mobile/tablet/desktop)
- [ ] Tested in browser: Opens without errors

**✅ User Guidance Provided:**
- [ ] Success message with file size
- [ ] File location and next steps
- [ ] Customization instructions

**Output:** Standalone HTML presentation in `docs/{folder}/presentation_final.html` + modular source in `assets/` directory

---

## Example Usage

User: "Build HTML presentation from docs/core/"

Process: Reads MD docs (requirements, architecture, technical_spec, ADRs with Category, kanban_board, guides) → Creates modular HTML structure (assets/ with template, 6 tabs with updated SCOPE tags, table/epic-list styles, scripts with Mermaid rerender, build script) → Generates tabs: Overview (Problem/Solution/Stakeholders/Navigation Guide), Requirements (FRs/NFRs tables + ADRs Strategic/Technical), Architecture (C4 diagrams + highlights table), Technical Spec (API/Data/Infrastructure), Roadmap (Epic list with In/Out Scope per Epic, status badges, NO dates), Guides (How-to step-by-step) → Builds standalone presentation_final.html (~130-180 KB, English language) → Output: docs/core/presentation_final.html (open in browser)

---

## Technical Details

**Standards**: HTML5, CSS3 (Flexbox/Grid/Variables), ES6+, WCAG 2.1 Level AA, Mobile-first responsive design, Progressive enhancement, Mermaid.js v11

**Dependencies**: Node.js v18+ (build script), modern browser (Chrome/Firefox/Safari/Edge last 2 versions), internet connection (Mermaid.js CDN, optional)

---

**Version:** 2.3.1 (Mermaid v11 + Performance Optimization + Guidelines)
**Last Updated:** 2025-11-06

**Dependencies:**
- **Templates**: x-html-builder/references/ (11 files: HTML/CSS/JS templates + mermaid_guidelines.md)
- **Source Docs**: requirements.md, architecture.md, technical_specification.md, adrs/*.md, kanban_board.md
- **Node.js**: v18+ required for build-presentation.js
- **ADR Format**: Requires ADRs with Category field (Strategic/Technical)
- **Roadmap Data**: kanban_board.md with Epic Story Counters table
- **Mermaid**: v11.12.1+ (CDN: https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js)
- **Guidelines**: mermaid_guidelines.md in references/ for best practices
- **Optional**: docs/guides/*.md for Guides tab
- **Language**: All presentation content in English (templates and examples)
- **Works with**: Output from x-docs-creator skill or any standard doc structure


---
name: x-docs-creator
description: Create comprehensive technical documentation (requirements, architecture, technical specs, ADRs) BEFORE x-epic-creator when starting new IT projects. Follows 2025 industry standards through 2-stage workflow: analyze materials, research best practices, interactive dialog. Generates 4 MD documents.
---

# Project Documentation Creator

This skill creates technical project documentation through an interactive discovery process, following industry best practices (ISO/IEC/IEEE standards, arc42, C4 Model, ADR format).

## When to Use This Skill

This skill should be used **BEFORE creating Epics** when:
- Start a new IT project from scratch
- Document technical architecture, requirements, and specifications before development
- Create standardized technical documentation following 2025 industry best practices
- Transition from idea/concept to structured technical planning

**This skill should be the FIRST step** in the project workflow, coming before epic-creator.

**Note**: This skill generates MD documentation only. For interactive HTML presentation, use [x-html-builder](../x-html-builder/SKILL.md) skill after running this skill.

## How It Works

The skill follows a 5-phase intelligent workflow combining template copying, automatic analysis, research, and interactive dialog:

### Phase 1: Project Type Detection

**Objective**: Understand project technical context.

**Process**:
1. Ask about project type (web app, mobile app, API, microservices, desktop, etc.)
2. Ask about project stage (new project, rewrite, enhancement)

**Output**: Project context understanding

---

### Phase 2: Copy Reference Templates

**Objective**: Prepare templates for in-place editing to optimize context usage and preserve exact formatting.

**Process**:
1. Create output directories:
   - `docs/project/`
   - `docs/project/adrs/`
2. Copy lean templates using Write tool:
   - `references/requirements_template_lean.md` → `docs/project/requirements.md`
   - `references/architecture_template_lean.md` → `docs/project/architecture.md`
   - `references/technical_spec_template_lean.md` → `docs/project/technical_specification.md`
   - `references/readme_hub_template.md` → `docs/project/README.md`
3. Notify user: "Templates copied to docs/project/"

**Note:** ADR template is NOT copied to project. x-adr-creator skill uses its own template from `x-adr-creator/references/adr_template.md` when creating ADRs.

**Why This Phase**:
- Enables Edit tool usage (more context-efficient than Write)
- Preserves exact template structure without "inventing" formatting
- Lean templates contain only structure + placeholders (no examples)
- Reduces context consumption by ~70% compared to full templates
- **SCOPE tags included**: Each template contains SCOPE tags (first 3-5 lines) defining document boundaries and redirecting out-of-scope content

**Output**: Empty template files with SCOPE tags ready for in-place editing

---

### Phase 3: Automatic Material Analysis (Optional)

**Objective**: Extract maximum technical information from provided project materials before asking questions.

**Process**:
1. Ask user: "Do you have project materials to analyze? (files, diagrams, docs, code)"
2. If YES:
   - Use **Glob** + **Read** tools to find and analyze:
     - Package managers: `package.json`, `requirements.txt`, `go.mod`, `pom.xml`, `Gemfile`
     - Docker: `Dockerfile`, `docker-compose.yml`, `docker-compose.test.yml`
     - Config: `tsconfig.json`, `*.env.example`, `.nvmrc`
     - Docs: `README.md`, architecture diagrams
     - Code structure: `src/`, `api/`, `services/`, `tests/`
   - Extract information:
     - Runtime: Node 18, Python 3.11, Go 1.21
     - Dockerfile: Multi-stage structure, base image
     - docker-compose.yml: Services (app + db + cache), images, volumes
     - docker-compose.test.yml: Test setup, tmpfs, hot-reload
     - Dependencies → frameworks, databases, auth, cache
   - Pre-populate answers for Q9, Q11, Q12 (partial)
   - Report findings to user
3. If NO: Skip to Phase 3

**Output**: Pre-populated technical information + report of detected technologies

**Reference**: See `references/automatic_analysis_guide.md` for detailed algorithms

---

### Phase 4: Requirements Document

**Objective**: Create requirements document using Edit tool.

**Process**: **MANDATORY: Use Read tool to load `references/critical_questions.md`** before starting questions

**Process**:
1. **Discovery**: Ask Q1-Q4 (Requirements) + Q14-Q17 (Quality Attributes) interactively in batches of 4
   - Show progress: "Requirements Document: Category X of 2"
   - Categories: Requirements (Q1-Q4), Quality (Q14-Q17)
2. **Edit**: Use Edit tool on `docs/project/requirements.md`:
   - Replace placeholders with answers
   - Fill Sections 3 (Functional Requirements), 4 (Non-Functional Requirements)
   - Generate requirement IDs (FR-XXX-001, NFR-PERF-001)
   - Use MoSCoW prioritization (MUST/SHOULD/COULD/WON'T)
3. **Notify**: "✓ requirements.md created"

**Output**: `docs/project/requirements.md` with 10 sections filled

---

### Phase 5: Architecture Document

**Process**:
1. **Discovery**: Ask Q5-Q8 (Scope) + auto-research Q9, Q11-Q13 (Tech Stack) + ask Q10 interactively
   - Show progress: "Architecture Document: Category X of 2"
   - Categories: Scope (Q5-Q8), Technology (Q9-Q13)
   - If auto-research enabled:
     - Q9: Verify 2025 versions (MCP Ref + WebSearch)
     - Q11: Architectural patterns based on project type
     - Q12: Libraries and frameworks (latest versions)
     - Q13: Integrations comparison
     - Generate Dockerfile + docker-compose.yml
     - Present recommendations with rationale
   - Always ask Q10 interactively (constraints)
2. **Edit**: Use Edit tool on `docs/project/architecture.md`:
   - Replace placeholders with answers
   - Generate Mermaid diagrams (Business Context, Technical Context, C4 diagrams)
   - Fill Section 4 (Solution Strategy), Section 5 (Building Blocks)
3. **Notify**: "✓ architecture.md created"

**Output**: `docs/project/architecture.md` with 13 sections filled + Mermaid diagrams

---

### Phase 6: Technical Specification

**Process**:
1. **Discovery**: Compile data from Q8 (Roles) + Q9-Q17 (already collected)
   - No new questions needed (reuse from Phase 4 and Phase 5)
2. **Edit**: Use Edit tool on `docs/project/technical_specification.md`:
   - Replace placeholders with compiled data
   - Fill Section 2 (Technology Stack table)
   - Fill Section 2.2 (Docker Development Environment) with auto-generated Dockerfile + docker-compose.yml
   - Fill Sections 4-10 (Database, API, Integrations, Security, Performance, Testing, Deployment)
3. **Notify**: "✓ technical_specification.md created"

**Output**: `docs/project/technical_specification.md` with 12 sections filled

---

### Phase 7: ADRs (Architecture Decision Records)

**Process**:
1. **Discovery**: Ask Q18-Q19 (Technical Risks) interactively
   - Show progress: "ADRs: Documenting Technical Decisions"
2. **Create ADRs**: For each key technical decision (Q9-Q13):
   - Copy `docs/project/adrs/_template.md` → `adr-NNN-name.md`
   - Use Edit tool to fill Michael Nygard format:
     - Context (problem, constraints)
     - Decision (chosen solution)
     - Rationale (why this decision)
     - Consequences (positive/negative)
     - Alternatives Considered (2-3 alternatives with pros/cons/rejection reason)
   - Generate 3-5 ADRs (frontend framework, backend framework, database, cache, API style)
3. **Notify**: "✓ 3-5 ADRs created"

**Output**: `docs/project/adrs/adr-001-*.md` through `adr-005-*.md`

**Template Mappings**: For detailed question-to-template mappings, see `references/template_mappings.md`

---

### Phase 8: Summary and Next Steps

**Objective**: Provide user with complete overview and next steps.

**Process**:
1. List all created files with sizes:
   - `docs/project/README.md` (navigation hub)
   - `docs/project/requirements.md`
   - `docs/project/architecture.md`
   - `docs/project/technical_specification.md`
   - `docs/project/adrs/adr-001-*.md` (3-5 files)

2. Recommend next steps:
   - **"Run x-html-builder skill"** to create interactive HTML presentation (optional)
   - "Review generated documentation"
   - "Run epic-creator to decompose scope into Epics"
   - "Share documentation with technical stakeholders"

**Output**: Summary message with file list and recommendations

---

### Phase 9: Generate Kanban Board (Optional)

**Objective**: Generate `docs/tasks/kanban_board.md` from template with Linear configuration.

**When to execute**: If user plans to use Linear for task management.

**Process**:
1. Ask user: "Generate kanban_board.md for Linear integration? (yes/no)"
2. If user chose "yes":
   - Ask: "Linear Team Name (e.g., 'PrompsitAPI')?"
   - Ask: "Linear Team UUID (from Linear settings)?"
   - Ask: "Linear Team Key (short key, e.g., 'API')?"
   - Ask: "Linear Workspace URL (e.g., 'https://linear.app/prompsitapi')?"
3. Read template: `x-docs-creator/references/kanban_board_template.md`
4. Replace placeholders:
   - `[TEAM_NAME]` → provided Team Name
   - `[TEAM_UUID]` → provided Team UUID
   - `[TEAM_KEY]` → provided Team Key
   - `[WORKSPACE_URL]` → provided Workspace URL
   - `[YYYY-MM-DD]` → current date
5. Write file to `docs/tasks/kanban_board.md`
6. If user chose "no":
   - Skip kanban board generation
   - Notify user: "Skipped kanban_board.md (can create manually later from template)"

**Output**: `docs/tasks/kanban_board.md` with Linear configuration (if enabled)

---

## Complete Output Structure

```
docs/project/
├── README.md                         # ← Navigation hub for all documentation
├── requirements.md
├── architecture.md
├── technical_specification.md
├── adrs/
│   ├── _template.md
│   ├── adr-001-frontend-framework.md
│   ├── adr-002-backend-framework.md
│   ├── adr-003-database-choice.md
│   ├── adr-004-[additional].md (optional)
│   └── adr-005-[additional].md (optional)

docs/tasks/
└── kanban_board.md                   # ← Linear integration (if Phase 9 enabled)
```

---

## Reference Files Used

### Document Templates
- `references/critical_questions.md` - 19 technical questions in 5 categories with 2-stage metadata
  - **CRITICAL**: MUST read using Read tool at start of Phase 4
  - DO NOT use question text from SKILL.md
- `references/automatic_analysis_guide.md` - Algorithms for material analysis and best practices research
- `references/template_mappings.md` - Detailed question-to-template mappings for all 4 documents
- **Lean Templates** (used in Phase 2, ~70% smaller than full templates):
  - `references/requirements_template_lean.md` - FR + 7 NFR categories (structure only, no examples)
  - `references/architecture_template_lean.md` - arc42-based architecture with C4 Model (structure only)
  - `references/technical_spec_template_lean.md` - 12-section technical specification (structure only)
  - `references/adr_template.md` - Minimal Michael Nygard's ADR format (7 sections, 300-500 words)
- **Full Templates** (archived, for reference only):
  - `references/requirements_template.md` - Full template with examples
  - `references/architecture_template.md` - Full template with examples
  - `references/technical_spec_template.md` - Full template with examples
- `references/examples.md` - Detailed workflow examples (with/without materials)
- `references/troubleshooting.md` - Solutions to common issues and problems

---

## Best Practices

- **Material Analysis**: Ask first, use Glob for standard files (package.json, Dockerfile), extract facts only, report findings briefly
- **Auto-Research**: Verify 2025 versions (MCP Ref, WebSearch), provide rationale, offer alternatives with pros/cons, generate Dockerfile + docker-compose.yml
- **Interactive Discovery**: Batch 4 questions at a time, show progress ("Category X of 2"), allow skipping, provide examples
- **Document Generation**: English only, explicit IDs (FR-XXX-001), MoSCoW prioritization, realistic ADRs with 2-3 alternatives, meaningful diagrams with actual data

---

## Integration with Project Workflow

x-docs-creator → [optional: x-html-builder] → x-epic-creator → x-story-creator → x-task-manager → x-task-executor → x-task-reviewer → x-story-finalizer → x-test-executor → x-task-reviewer → Story Done

**Dependencies**: x-html-builder reads MD docs from docs/project/, epic-creator uses requirements.md, task-creator uses architecture.md + technical_specification.md

---

## Definition of Done

Before completing work, verify ALL checkpoints:

**✅ Documents Generated:**
- [ ] All required MD files created successfully:
  - `docs/project/README.md` (navigation hub)
  - `docs/project/requirements.md`
  - `docs/project/architecture.md`
  - `docs/project/technical_specification.md`
  - `docs/project/adrs/_template.md`
  - `docs/project/adrs/adr-001-*.md` through `adr-005-*.md` (3-5 ADRs)
- [ ] SCOPE tags included in first 3-5 lines of each document (HTML comments defining boundaries)
- [ ] Maintenance sections present in all docs (Update Triggers, Verification, Last Updated)
- [ ] All placeholders replaced with actual content (no `{{PLACEHOLDER}}` or `[FILL]` remaining)

**✅ Content Quality:**
- [ ] Mermaid diagrams valid syntax (Business Context, Technical Context, C4 diagrams)
- [ ] Requirement IDs sequential and unique (FR-XXX-001, NFR-PERF-001, NFR-SEC-001, etc.)
- [ ] MoSCoW prioritization applied correctly (MUST/SHOULD/COULD/WON'T)
- [ ] Language: English only (per project standards)
- [ ] ADRs follow Michael Nygard format (Context, Decision, Rationale, Alternatives Considered, Consequences)
- [ ] 2-3 alternatives documented per ADR with pros/cons/rejection reason

**✅ Structure Validated:**
- [ ] README.md hub created with navigation links to all documents
- [ ] All 4 core documents present: requirements, architecture, technical_specification, adrs/_template
- [ ] 3-5 ADRs created for key technical decisions (frontend, backend, database, cache, API style)
- [ ] kanban_board.md generated in `docs/tasks/` (if user chose Linear integration in Phase 9)

**✅ Phase Completion:**
- [ ] Phase 1: Project type detected (web/mobile/API/microservices/desktop)
- [ ] Phase 2: Templates copied to `docs/project/` with SCOPE tags
- [ ] Phase 3: Materials analyzed (if provided) and findings reported
- [ ] Phase 4: Requirements document created (Q1-Q4, Q14-Q17 answered)
- [ ] Phase 5: Architecture document created (Q5-Q13 answered, auto-research completed)
- [ ] Phase 6: Technical specification created (compiled from previous answers)
- [ ] Phase 7: ADRs created (Q18-Q19 answered, 3-5 ADRs generated)
- [ ] Phase 8: Summary and next steps displayed
- [ ] Phase 9: kanban_board.md generated (if requested)

**✅ User Guidance:**
- [ ] Summary message displayed with all file paths and sizes
- [ ] Next step recommended: "Run x-epic-creator skill to decompose scope into Epics"
- [ ] User informed about documentation location (docs/project/)

**Output:** Complete documentation set in `docs/project/` (4 MD docs + 3-5 ADRs + optional kanban_board.md) + next steps recommendation

---

## Technical Details

**Examples**: See `references/examples.md` for detailed workflows (with/without materials)

**Standards**: ISO/IEC/IEEE 29148:2018 (Requirements), ISO/IEC/IEEE 42010:2022 (Architecture), arc42, C4 Model, Michael Nygard's ADR Format, MoSCoW Prioritization, OWASP Security, WCAG 2.1 Level AA, Risk-Based Testing (2-5 E2E, 3-8 Integration, 5-15 Unit, 10-28 total)

**Troubleshooting**: See `references/troubleshooting.md` for solutions to common issues

---

**Version:** 5.5.0
**Last Updated:** 2025-01-31

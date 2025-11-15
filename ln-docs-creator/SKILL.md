---
name: ln-docs-creator
description: Creates technical docs (requirements, architecture, specs, ADRs) before coding new projects. Uses 2-stage workflow: material analysis, research, dialog. Outputs 4 MD docs per 2025 standards.
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

**Note**: This skill generates MD documentation only. For interactive HTML presentation, use [ln-html-builder](../ln-html-builder/SKILL.md) skill after running this skill.

## How It Works

The skill follows a 4-phase intelligent workflow combining template copying, automatic analysis, research, and interactive dialog:

### Phase 1: Setup & Discovery

**Objective**: Understand project context, prepare templates, and analyze existing materials.

**Sub-steps:**

**1.1 Project Type Detection**
- Ask about project type (web app, mobile app, API, microservices, desktop, etc.)
- Ask about project stage (new project, rewrite, enhancement)

**1.2 Copy Reference Templates**
- Create output directories: `docs/project/`, `docs/project/adrs/`
- Copy lean templates using Write tool:
  - `references/requirements_template_lean.md` → `docs/project/requirements.md`
  - `references/architecture_template_lean.md` → `docs/project/architecture.md`
  - `references/technical_spec_template_lean.md` → `docs/project/technical_specification.md`
  - `references/readme_hub_template.md` → `docs/project/README.md`
- Notify user: "Templates copied to docs/project/"
- **Note:** ADR template NOT copied (ln-adr-creator uses its own template)

**Why lean templates:**
- Enables Edit tool usage (more context-efficient than Write)
- Preserves exact structure, reduces context by ~70%
- **SCOPE tags included** for document boundaries

**1.3 Automatic Material Analysis (Optional)**
- Ask: "Do you have project materials to analyze?"
- If YES: Use Glob + Read to analyze package.json, Dockerfile, docker-compose.yml, etc.
- Extract: runtime versions, frameworks, databases, dependencies
- Pre-populate answers for Q9, Q11, Q12
- Report detected technologies to user
- If NO: Skip analysis

**Output**: Project context + empty templates with SCOPE tags + pre-populated technical data (if materials provided)

**Reference**: See `references/automatic_analysis_guide.md` for analysis algorithms

---

### Phase 2: Core Documents Generation

**Objective**: Create all technical documentation through interactive discovery and Edit tool.

**MANDATORY**: Use Read tool to load `references/critical_questions.md` before starting questions

**Sub-steps:**

**2.1 Requirements Document**
- **Discovery**: Ask Q1-Q4 (Requirements) + Q14-Q17 (Quality Attributes) in batches
  - Show progress: "Requirements Document: Category X of 2"
- **Edit**: Update `docs/project/requirements.md`:
  - Replace placeholders with answers
  - Fill Sections 3-4 (Functional & Non-Functional Requirements)
  - Generate requirement IDs (FR-XXX-001, NFR-PERF-001), use MoSCoW prioritization
- **Notify**: "✓ requirements.md created"

**2.2 Architecture Document**
- **Discovery**: Ask Q5-Q8 (Scope) + auto-research Q9, Q11-Q13 (Tech Stack) + ask Q10
  - Show progress: "Architecture Document: Category X of 2"
  - Auto-research: Verify 2025 versions (MCP Ref + WebSearch), patterns, frameworks, integrations
  - Generate Dockerfile + docker-compose.yml with recommendations
- **Edit**: Update `docs/project/architecture.md`:
  - Replace placeholders, generate Mermaid diagrams (Business Context, Technical Context, C4)
  - Fill Sections 4-5 (Solution Strategy, Building Blocks)
- **Notify**: "✓ architecture.md created"

**2.3 Technical Specification**
- **Discovery**: Compile data from Q8 + Q9-Q17 (already collected)
  - No new questions (reuse from 2.1 and 2.2)
- **Edit**: Update `docs/project/technical_specification.md`:
  - Fill Section 2 (Technology Stack table), Section 2.2 (Docker Environment)
  - Fill Sections 4-10 (Database, API, Integrations, Security, Performance, Testing, Deployment)
- **Notify**: "✓ technical_specification.md created"

**2.4 ADRs (Architecture Decision Records)**
- **Discovery**: Ask Q18-Q19 (Technical Risks)
- **Create ADRs**: For each key decision (Q9-Q13):
  - Copy template → `adr-NNN-name.md`
  - Fill Michael Nygard format: Context, Decision, Rationale, Consequences, Alternatives
  - Generate 3-5 ADRs (frontend, backend, database, cache, API style)
- **Notify**: "✓ 3-5 ADRs created"

**Output**:
- `docs/project/requirements.md` (10 sections)
- `docs/project/architecture.md` (13 sections + Mermaid diagrams)
- `docs/project/technical_specification.md` (12 sections)
- `docs/project/adrs/adr-001-*.md` through `adr-005-*.md`

**Reference**: See `references/template_mappings.md` for question-to-template mappings

---

### Phase 3: Integration & Presentation (Optional)

**Objective**: Generate kanban board for Linear integration and optional HTML presentation.

**Sub-steps:**

**3.1 Generate Kanban Board (Optional)**
- Ask: "Generate kanban_board.md for Linear integration? (yes/no)"
- If yes:
  - Ask: Linear Team Name, UUID, Key, Workspace URL
  - Read template: `ln-docs-creator/references/kanban_board_template.md`
  - Replace placeholders ([TEAM_NAME], [TEAM_UUID], etc.) with provided values
  - Write `docs/tasks/kanban_board.md`
- If no: Skip, notify user can create manually later

**3.2 Generate HTML Presentation (Optional)**
- Ask: "Generate interactive HTML presentation? (yes/no)"
- If yes: Invoke ln-html-builder → WAIT completion → verify output (`presentation_final.html` + `assets/`)
- If no: Skip (can run ln-html-builder later)

**Output**:
- `docs/tasks/kanban_board.md` with Linear configuration (if enabled)
- Interactive HTML presentation (if enabled)

---

### Phase 4: Finalization

**Objective**: Provide complete overview and next steps.

**Process**:
1. List all created files with sizes:
   - `docs/project/README.md` (navigation hub)
   - `docs/project/requirements.md`
   - `docs/project/architecture.md`
   - `docs/project/technical_specification.md`
   - `docs/project/adrs/adr-001-*.md` (3-5 files)
   - `docs/tasks/kanban_board.md` (if generated)
   - `presentation_final.html` (if generated)

2. Recommend next steps:
   - "Review generated documentation"
   - "Run epic-creator to decompose scope into Epics"
   - "Share documentation with technical stakeholders"

**Output**: Summary message with file list and recommendations

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

ln-docs-creator → [optional: ln-html-builder] → ln-epic-creator → ln-story-manager → ln-task-coordinator → ln-task-executor → ln-task-reviewer → test planning → ln-test-executor → ln-task-reviewer → Story Done

**Dependencies**: ln-html-builder reads MD docs from docs/project/, epic-creator uses requirements.md, task-creator uses architecture.md + technical_specification.md

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
- [ ] Next step recommended: "Run ln-epic-creator skill to decompose scope into Epics"
- [ ] User informed about documentation location (docs/project/)

**Output:** Complete documentation set in `docs/project/` (4 MD docs + 3-5 ADRs + optional kanban_board.md) + next steps recommendation

---

## Technical Details

**Examples**: See `references/examples.md` for detailed workflows (with/without materials)

**Standards**: ISO/IEC/IEEE 29148:2018 (Requirements), ISO/IEC/IEEE 42010:2022 (Architecture), arc42, C4 Model, Michael Nygard's ADR Format, MoSCoW Prioritization, OWASP Security, WCAG 2.1 Level AA, Risk-Based Testing (2-5 E2E, 3-8 Integration, 5-15 Unit, 10-28 total)

**Troubleshooting**: See `references/troubleshooting.md` for solutions to common issues

---

**Version:** 6.0.0 (Simplified workflow from 11 phases to 4 major phases by grouping related steps: Phase 1 Setup & Discovery (1-3), Phase 2 Core Documents (4-7), Phase 3 Integration & Presentation (9-10), Phase 4 Finalization (11))
**Last Updated:** 2025-11-14

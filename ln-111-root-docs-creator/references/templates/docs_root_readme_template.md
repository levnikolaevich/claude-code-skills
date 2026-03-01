# Documentation System

**Version:** {{VERSION}}
**Last Updated:** {{DATE}}
**Status:** {{STATUS}}

<!-- SCOPE: Root documentation hub with general standards and navigation ONLY. Contains documentation structure overview, SCOPE tags rules, maintenance conventions, sequential numbering, placeholder conventions. NO content duplication - all details in subdirectory READMEs. -->
<!-- DO NOT add here: Project-specific details → project/README.md, Reference documentation → reference/README.md, Task management rules → tasks/README.md, Implementation code → Task descriptions -->

---

## Overview

This documentation system provides comprehensive technical and operational documentation following industry standards (ISO/IEC/IEEE 29148, arc42, C4 Model, Michael Nygard's ADR format).

**Documentation is organized into three main areas:**
- **Project Documentation** - Requirements, architecture, technical specifications
- **Reference Documentation** - Architecture decisions (ADRs), reusable patterns (Guides), API references (Manuals)
- **Task Management** - Linear workflow, task tracking rules, kanban board

---

## General Documentation Standards

All documentation in this system follows these conventions:

### SCOPE Tags

Every document contains HTML comment tags defining its boundaries:

```html
<!-- SCOPE: What this document CONTAINS -->
<!-- DO NOT add here: What belongs elsewhere → where to find it -->
```

**Purpose**: Prevent content duplication, maintain single source of truth, redirect to correct location.

**Example**:
```html
<!-- SCOPE: Project requirements ONLY. Functional requirements ONLY. -->
<!-- DO NOT add here: Architecture details → architecture.md, Implementation → Task descriptions -->
```

### Maintenance Sections

All documents contain a **Maintenance** section with:

| Field | Description | Example |
|-------|-------------|---------|
| **Update Triggers** | When to update the document | "When changing acceptance criteria (Non-Functional Requirements are forbidden here)" |
| **Verification** | How to verify document is current | "Check all FR-XXX IDs referenced in tests exist" |
| **Last Updated** | Date of last modification | "2025-11-15" |

### Sequential Numbering

**Rule**: Phases/Sections/Steps use sequential integers: 1, 2, 3, 4 (NOT 1, 1.5, 2).

**Exceptions**:

| Case | Format | Example | When Valid |
|------|--------|---------|------------|
| **Conditional Branching** | Letter suffixes | Phase 4a (CREATE), Phase 4b (REPLAN), Phase 5 | Mutually exclusive paths (EITHER A OR B) |
| **Loop Internals** | Steps inside Phase | Phase 3: Loop → Step 1 → Step 2 → Repeat | Cyclic workflows with repeated sub-steps |

**Important**: When inserting new items, renumber all subsequent items.

### Placeholder Conventions

Documents use placeholders for registry updates:

| Placeholder | Location | Purpose | Updated By |
|-------------|----------|---------|------------|
| `{{ADR_LIST}}` | reference/README.md | ADR registry | ln-002-best-practices-researcher |
| `{{GUIDE_LIST}}` | reference/README.md | Guide registry | ln-002-best-practices-researcher |
| `{{MANUAL_LIST}}` | reference/README.md | Manual registry | ln-002-best-practices-researcher |

**Usage**: Skills automatically add new entries BEFORE the placeholder using Edit tool.

### Writing Guidelines (Progressive Disclosure Pattern)

All documentation follows token-efficient formatting rules:

| Content Type | Format | Rationale |
|--------------|--------|-----------|
| **Skill descriptions** | < 200 chars in SKILL.md frontmatter | Clarity, focused scope |
| **Workflows** | Reference table with link to SKILL.md | Avoid duplication (DRY) |
| **Examples** | Table rows (verdict + rationale) | 60-80% more compact than paragraphs |
| **Lists** | Bullet points with inline details | Progressive disclosure |
| **References** | One-line format (source - topics - insight) | Scannable, no verbose paragraphs |
| **Comparisons** | Table with columns | Visual clarity, easy scanning |
| **Step-by-step processes** | Inline arrow notation (Step 1 → Step 2 → Step 3) | Compact flow representation |

**Verbose content is justified for:**
- ❌ Anti-patterns (educational value - prevents mistakes)
- 🎓 Complex architectural explanations (orchestrator patterns, state machines)
- ⚠️ Critical rules with rationale (INVEST criteria, task sizing)

**Compression targets:**
- Main documentation files: < 500 lines (optimal: 300-400 lines)
- README hubs: < 200 lines
- Individual guides: < 800 lines (optimal: 400-600 lines)

### Documentation Standards

**Full documentation requirements:** See [documentation_standards.md](documentation_standards.md)

Key highlights:
- **Claude Code Integration** - CLAUDE.md ≤100 lines, @-sourcing, sessionStart hooks
- **AI-Friendly Writing** - Second person, active voice, max 25 words/sentence
- **Code Examples** - All examples runnable, realistic names, show expected output
- **DIATAXIS Framework** - Organize docs into Tutorial/How-to/Reference/Explanation
- **Security** - Never commit secrets, use .env.example templates
- **Conventional Commits** - Structured commit messages for auto-changelog

**Total:** 60 requirements in 12 categories. See documentation_standards.md for complete details.

---

## Documentation Structure

### 1. [Project Documentation](project/README.md)

Core project documentation created by ln-111-project-docs-creator skill:

- **[README.md](project/README.md)** - Project documentation hub
- **[requirements.md](project/requirements.md)** - Functional requirements (FR-XXX-NNN) with MoSCoW prioritization
- **[architecture.md](project/architecture.md)** - System architecture (C4 Model, arc42)
- **[technical_specification.md](project/technical_specification.md)** - Implementation details

**Purpose**: Define WHAT we build and WHY.

**Created by**: ln-111-project-docs-creator

---

### 2. [Reference Documentation](reference/README.md)

Reusable knowledge base and architecture decisions:

- **[ADRs](reference/adrs/)** - Architecture Decision Records (format: `adr-NNN-slug.md`)
- **[Guides](reference/guides/)** - Project patterns and best practices (format: `NN-pattern-name.md`)
- **[Manuals](reference/manuals/)** - Package API references (format: `package-version.md`)

**Purpose**: Document HOW we build (patterns, decisions, APIs).

**Created by**: ln-002-best-practices-researcher

---

### 3. [Task Management System](tasks/README.md)

Linear integration and workflow rules:

- **[README.md](tasks/README.md)** - Task lifecycle, Linear integration rules, workflow skills
- **[kanban_board.md](tasks/kanban_board.md)** - Live navigation to active tasks

**Purpose**: Define HOW we track and manage work.

**Created by**: ln-111-docs-creator (Phase 2, Phase 9-10)

---

## Standards Compliance

This documentation system follows:

| Standard | Application | Reference |
|----------|-------------|-----------|
| **ISO/IEC/IEEE 29148:2018** | Requirements Engineering | [requirements.md](project/requirements.md) |
| **ISO/IEC/IEEE 42010:2022** | Architecture Description | [architecture.md](project/architecture.md) |
| **arc42 Template** | Software architecture documentation | [architecture.md](project/architecture.md) |
| **C4 Model** | Software architecture visualization | [architecture.md](project/architecture.md) |
| **Michael Nygard's ADR Format** | Architecture Decision Records | [reference/adrs/](reference/adrs/) |
| **MoSCoW Prioritization** | Requirements prioritization | [requirements.md](project/requirements.md) |

---

## Contributing to Documentation

When updating documentation:

1. **Check SCOPE tags** at top of document to ensure changes belong there
2. **Update Maintenance > Last Updated** date in the modified document
3. **Update registry** if adding new documents:
   - ADRs, Guides, Manuals → automatically updated by skills
   - Project docs → update [project/README.md](project/README.md) manually
4. **Follow sequential numbering** rules (no decimals unless conditional branching)
5. **Add placeholders** if creating new document types
6. **Verify links** after structural changes

---

## Quick Navigation

| Area | Key Documents | Skills |
|------|---------------|--------|
| **Standards** | [documentation_standards.md](documentation_standards.md) | ln-111-project-docs-creator, ln-121-structure-validator |
| **Project** | [requirements.md](project/requirements.md), [architecture.md](project/architecture.md), [technical_specification.md](project/technical_specification.md) | ln-111-project-docs-creator, ln-122-content-updater |
| **Reference** | [ADRs](reference/adrs/), [Guides](reference/guides/), [Manuals](reference/manuals/) | ln-002-best-practices-researcher |
| **Tasks** | [kanban_board.md](tasks/kanban_board.md), [README.md](tasks/README.md) | ln-130-tasks-docs-creator |

---

## Maintenance

**Update Triggers**:
- When adding new documentation areas (new subdirectories)
- When changing general documentation standards (SCOPE, Maintenance, Sequential Numbering)
- When changing writing guidelines or documentation formatting standards
- When adding new placeholder conventions
- When updating compliance standards

**Verification**:
- All links to subdirectory READMEs are valid
- SCOPE tags accurately reflect document boundaries
- Placeholder conventions documented for all registries
- Standards Compliance table references correct documents

**Last Updated**: {{DATE}}

---

**Template Version:** 1.1.0
**Template Last Updated:** 2025-11-16

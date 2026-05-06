# Reference Documentation Questions

<!-- SCOPE: Interactive questions for reference docs (ADRs, Guides, Manuals) ONLY. Contains validation heuristics, auto-discovery hints. -->
<!-- DO NOT add here: question logic → ln-120-reference-docs-creator SKILL.md, tech justification → tech_justification_rules.md -->

**Purpose:** Define what each section of reference documentation should answer.

**Format:** Question → Expected Content → Validation Heuristics → Auto-Discovery Hints → MCP Ref Hints

---

## Table of Contents

| Document | Questions | Auto-Discovery | Priority | Line |
|----------|-----------|----------------|----------|------|
| [docs/reference/README.md](#docsreferencereadmemd) | 3 | High | High | L27 |
| [ADR Documents](#adr-documents) | 2 | Medium | High | L118 |
| [Guide Documents](#guide-documents) | 1 | Medium | Medium | L160 |
| [Manual Documents](#manual-documents) | 1 | Medium | Medium | L192 |

**Priority Legend:**
- **Critical:** Must answer all questions
- **High:** Strongly recommended
- **Medium:** Optional (can use template defaults)

**Auto-Discovery Legend:**
- **None:** No auto-discovery needed (use template as-is)
- **Low:** 1-2 questions need auto-discovery
- **High:** All questions need auto-discovery

---

<!-- DOCUMENT_START: docs/reference/README.md -->
## docs/reference/README.md

**File:** docs/reference/README.md (reference documentation hub)
**Target Sections:** Architecture Decision Records (ADRs), Project Guides, Package Manuals

**Rules for this document:**
- Hub file for reference documentation subdirectories
- Must link to adrs/, guides/, manuals/ directories
- Auto-discovery of existing files in each directory

---

<!-- QUESTION_START: 1 -->
### Question 1: Where are architecture decisions documented?

**Expected Answer:** Link to adrs/ directory, ADR format description (Nygard template), list of existing ADRs or placeholder
**Target Section:** ## Architecture Decision Records (ADRs)

**Validation Heuristics:**
- ✅ Contains link: `[ADRs](adrs/)` or `[adrs](adrs/)`
- ✅ Mentions "Architecture Decision Record" or "ADR"
- ✅ Has placeholder `{{ADR_LIST}}` or actual ADR list
- ✅ Length > 30 words

**Auto-Discovery:**
- Scan `docs/reference/adrs/` for *.md files
- Generate list dynamically from filenames
- Example: `adr-001-frontend-framework.md` → "ADR-001: Use React+Next.js"

**MCP Ref Hints:**
- Research: "Michael Nygard ADR format" (if no ADRs exist and need to explain format)
- Extract: ADR template structure (Context, Decision, Status, Consequences)
<!-- QUESTION_END: 1 -->

---

<!-- QUESTION_START: 2 -->
### Question 2: Where are reusable project patterns documented?

**Expected Answer:** Link to guides/ directory, description of guide purpose (reusable patterns, how-tos), list of existing guides or placeholder
**Target Section:** ## Project Guides

**Validation Heuristics:**
- ✅ Contains link: `[Guides](guides/)` or `[guides](guides/)`
- ✅ Mentions "patterns" or "guides" or "how-to"
- ✅ Has placeholder `{{GUIDE_LIST}}` or actual guide list
- ✅ Length > 20 words

**Auto-Discovery:**
- Scan `docs/reference/guides/` for *.md files
- Generate list dynamically from filenames
- Example: `authentication-flow.md` → "Authentication Flow Guide"

**MCP Ref Hints:**
- N/A (guides are project-specific)
<!-- QUESTION_END: 2 -->

---

<!-- QUESTION_START: 3 -->
### Question 3: Where are third-party package references documented?

**Expected Answer:** Link to manuals/ directory, description of manual purpose (package API references, version-specific), list of existing manuals or placeholder
**Target Section:** ## Package Manuals

**Validation Heuristics:**
- ✅ Contains link: `[Manuals](manuals/)` or `[manuals](manuals/)`
- ✅ Mentions "packages" or "API reference" or "manuals"
- ✅ Has placeholder `{{MANUAL_LIST}}` or actual manual list
- ✅ Length > 20 words

**Auto-Discovery:**
- Scan `docs/reference/manuals/` for *.md files
- Generate list dynamically from filenames
- Example: `axios-1.6.md` → "Axios 1.6 API Manual"

**MCP Ref Hints:**
- N/A (manuals are package-specific, created inline per documentation_creation.md)
<!-- QUESTION_END: 3 -->

---

**Overall File Validation:**
- ✅ Has links to all 3 subdirectories (adrs/, guides/, manuals/)
- ✅ Total length > 60 words

<!-- DOCUMENT_END: docs/reference/README.md -->

---

<!-- DOCUMENT_START: ADR Documents -->
## ADR Documents

**Files:** docs/reference/adrs/adr-{NNN}-{topic}.md
**Template:** references/templates/adr_template.md
**Created By:** Phase 2 Smart Document Creation (if justified)

**Rules for ADR documents:**
- Only created for nontrivial technology choices (see tech_justification_rules.md)
- Must explain WHY decision was needed, not just WHAT was chosen
- Must list alternatives that were actually considered

---

<!-- QUESTION_START: 4 -->
### Question 4: Does ADR explain WHY this decision was needed?

**Expected Answer:** Context section with problem statement, constraints, forces driving the decision
**Target Section:** ## Context

**Validation Heuristics:**
- Contains "Context" or "Problem" section
- Explains WHAT problem existed (not just "we needed X")
- Mentions constraints or forces (time, team, compatibility, etc.)
- Length > 40 words in Context section
- NO generic statements like "We needed to choose a framework"

**Auto-Discovery:**
- Check TECH_STACK for detected technology
- Scan package.json for related dependencies (integration constraints)
- Check README.md for project requirements that influenced choice

**Anti-Patterns (reject if found):**
- "We decided to use X" without explaining why X was needed
- Generic context: "Modern applications need..."
- Missing problem statement
<!-- QUESTION_END: 4 -->

---

<!-- QUESTION_START: 5 -->
### Question 5: Does ADR list alternatives with pros/cons?

**Expected Answer:** Table or list of 2+ alternatives with specific pros/cons for each
**Target Section:** ## Alternatives Considered

**Validation Heuristics:**
- Has "Alternatives" section
- Lists at least 2 alternatives (including rejected ones)
- Each alternative has pros AND cons (not just cons for rejected)
- Includes "Why Rejected" reasoning
- NO empty or placeholder alternatives

**Auto-Discovery:**
- Detect technology category (frontend/backend/orm/etc.)
- List common alternatives in that category
- Check if alternatives were in package.json history (git log)

**Anti-Patterns (reject if found):**
- Only 1 alternative listed
- Alternatives without pros (biased toward chosen)
- Generic pros/cons: "popular", "easy to use", "well-documented"
- Placeholder: "Alternative 1", "Alternative 2"
<!-- QUESTION_END: 5 -->

---

**Overall ADR Validation:**
- Has SCOPE tag in first 10 lines
- Has Context, Decision, Rationale, Consequences, Alternatives sections
- Context explains problem (not just "we needed X")
- Alternatives section has 2+ real options

<!-- DOCUMENT_END: ADR Documents -->

---

<!-- DOCUMENT_START: Guide Documents -->
## Guide Documents

**Files:** docs/reference/guides/guide-{topic}.md
**Template:** references/templates/guide_template.md
**Created By:** Phase 2 Smart Document Creation (if justified)

**Rules for Guide documents:**
- Only created when complex configuration or custom patterns detected
- Must document project-specific patterns, not generic best practices
- Focus on "Our Implementation" vs generic industry patterns

---

<!-- QUESTION_START: 6 -->
### Question 6: Does Guide have project-specific patterns?

**Expected Answer:** "Our Implementation" section with concrete examples from THIS project, not generic patterns
**Target Section:** ## Our Implementation

**Validation Heuristics:**
- Contains "Our Implementation" or "Project-Specific" section
- References actual file paths from the project (`src/`, `lib/`, etc.)
- Shows code patterns with project's naming conventions
- Patterns table has "When to Use" column with project context
- Length > 50 words in Our Implementation section

**Auto-Discovery:**
- Scan project for pattern usage (grep for hooks, middleware, decorators)
- Extract real file paths where pattern is used
- Identify project naming conventions from existing code

**Anti-Patterns (reject if found):**
- Generic patterns without project context
- Copy-pasted examples from official docs
- No file path references to actual project code
- Generic "When to Use": "when you need to..."
<!-- QUESTION_END: 6 -->

---

**Overall Guide Validation:**
- Has SCOPE tag in first 10 lines
- Has Principle, Our Implementation, Patterns sections
- Our Implementation references real project files
- Patterns table has project-specific "When to Use"

<!-- DOCUMENT_END: Guide Documents -->

---

<!-- DOCUMENT_START: Manual Documents -->
## Manual Documents

**Files:** docs/reference/manuals/manual-{package}-{version}.md
**Template:** references/templates/manual_template.md
**Created By:** Phase 2 Smart Document Creation (if justified)

**Rules for Manual documents:**
- Only created for complex APIs or version-specific behavior
- Must document methods WE ACTUALLY USE, not full API
- Include version-specific notes and known limitations

---

<!-- QUESTION_START: 7 -->
### Question 7: Does Manual document version-specific behavior?

**Expected Answer:** Version number in title, version-specific notes section, known limitations for this version
**Target Section:** ## Version-Specific Notes, ## Known Limitations

**Validation Heuristics:**
- Title includes version number (e.g., "Prisma 5.0 Manual")
- Has "Version-Specific Notes" section
- Lists known limitations or breaking changes
- Documents methods "We Use" (not full API dump)
- Installation command includes version constraint

**Auto-Discovery:**
- Parse package.json for exact version
- Check package CHANGELOG for breaking changes
- Scan codebase for actually used methods (import analysis)

**Anti-Patterns (reject if found):**
- No version in title
- Full API documentation (should focus on what WE use)
- Generic limitations: "may have bugs"
- Copy-pasted from official docs without project context
<!-- QUESTION_END: 7 -->

---

**Overall Manual Validation:**
- Has SCOPE tag in first 10 lines
- Version number in Package Information section
- "Methods We Use" section (not full API)
- Version-Specific Notes has actual content

<!-- DOCUMENT_END: Manual Documents -->

---

**Total Questions:** 7
**Total Document Types:** 4

---

**Version:** 3.0.0 (MAJOR: Added Q4-Q7 for ADR/Guide/Manual validation in Phase 2 Smart Creation)
**Last Updated:** 2025-12-19

---
name: ln-63-docs-updater
description: Updates project docs when code changes. Scans git diff to identify changes, updates affected sections in requirements/architecture/specs/ADRs while preserving existing content. Run ln-62-html-builder after.
---

# Project Documentation Updater

This skill updates existing project documentation by scanning code changes and selectively updating only the affected sections, preserving all existing content.

## When to Use This Skill

Use this skill when:
- Project code has evolved since initial documentation was created
- New features, dependencies, or architectural changes need to be documented
- Documentation is out of sync with current codebase
- Update HTML presentation with latest information
- Maintain documentation accuracy throughout development lifecycle

**Prerequisites**: Existing documentation must be present in `docs/project/` directory (created by ln-61-docs-creator skill).

## How It Works

The skill follows a 4-phase workflow: scan changes → analyze impact → confirm (if needed) → update documents & recommend HTML rebuild.

### Phase 1: Scan Project Changes

**Objective**: Identify all changes in project since last documentation update.

**Process**:
1. **Git Diff Analysis**:
   - Ask user: "Scan changes since which commit? (commit hash, or press Enter for last doc update)"
   - If empty: Use `docs/project/requirements.md` modification date as baseline
   - Run: `git diff <baseline>..HEAD --name-status`
   - Categorize changes:
     - **A** (Added): New files
     - **M** (Modified): Changed files
     - **D** (Deleted): Removed files
     - **R** (Renamed): Moved files

2. **File Pattern Analysis**:
   - Use **Glob** to find new/modified files by category:
     - Dependencies: `package.json`, `requirements.txt`, `go.mod`, `pom.xml`, `Gemfile`
     - Docker: `Dockerfile`, `docker-compose.yml`
     - Config: `tsconfig.json`, `.env.example`
     - Database: `*/migrations/*`, `*/models/*`, `*/schema/*`
     - API: `*/routes/*`, `*/controllers/*`, `*/api/*`
     - Services: `src/`, `lib/`, `services/`

3. **Change Summary**:
   - Read changed files to understand nature of changes
   - Categorize by impact type:
     - **New Dependencies**: Added/removed/updated packages
     - **New Features**: New directories, services, or modules
     - **API Changes**: New endpoints, modified routes
     - **Database Changes**: New tables, columns, migrations
     - **Architecture Changes**: New services, refactored structure
     - **Configuration Changes**: Docker, environment variables

**Output**: Structured change summary with categorized file lists

**Example Output**:
```
Project Changes Detected (since 2025-01-15):

NEW DEPENDENCIES:
- Added: stripe (v10.0.0) in package.json
- Added: @sendgrid/mail (v7.7.0) in package.json

NEW FEATURES:
- New directory: src/services/payment/
- New files: 15 files in payment service

API CHANGES:
- Modified: src/routes/api.ts (new /api/v1/payments endpoint)
- Added: src/controllers/payment.controller.ts

DATABASE CHANGES:
- Added: migrations/004_create_payments_table.sql
- Modified: src/models/order.model.ts

CONFIGURATION:
- Modified: docker-compose.yml (added stripe-cli service)
```

---

### Phase 2: Analyze Documentation Impact

**Objective**: Determine which documentation sections need updates based on detected changes.

**Process**:
1. **Read Existing Documentation**:
   - `docs/project/requirements.md`
   - `docs/project/architecture.md`
   - `docs/project/technical_specification.md`
   - `docs/project/adrs/*.md` (list all existing ADRs)

2. **Check SCOPE Tags** (if present):
   - Read SCOPE tags from each document (HTML comments in first 3-5 lines)
   - Verify changes belong to correct document based on SCOPE boundaries
   - Example: If change is "new dependency version", SCOPE tag in requirements.md says → Technical_Specification.md
   - Use SCOPE redirections to identify correct target document

3. **Map Changes to Documentation Sections** (using `references/update_strategies.md` + SCOPE tags):

   | Change Type | Affected Document | Section | Update Strategy |
   |-------------|-------------------|---------|-----------------|
   | New dependency | architecture.md | Section 4.1 (Technology Decisions) | Add row to tech stack table |
   | | technical_specification.md | Section 2.1 (Technology Stack) | Add row to technology table |
   | New API endpoint | technical_specification.md | Section 5.2 (API Endpoints) | Add row to API table |
   | Database table | technical_specification.md | Section 4.1 (Database Schema) | Update ER diagram + data dictionary |
   | New service/module | architecture.md | Section 5.2 (Container Diagram) | Update C4 Container diagram |
   | | architecture.md | Section 5.3 (Component Diagram) | Add component to diagram |
   | Config change | technical_specification.md | Section 2.2 (Docker Environment) | Update docker-compose.yml section |
   | Breaking change | adrs/ | New ADR | Create adr-NNN-reason.md |

3. **Generate Update Plan**:
   - List each document + section requiring update
   - Identify new ADRs needed (architectural decisions)
   - Flag ambiguous changes requiring user clarification

**Output**: Update plan with document/section mappings

**Example Output**:
```
Documentation Update Plan:

ARCHITECTURE.MD:
- Section 4.1 (Technology Decisions): Add Stripe, SendGrid to table
- Section 5.2 (Container Diagram): Add "Payment Service" container
- Section 5.3 (Component Diagram): Add PaymentController, PaymentService, StripeClient

TECHNICAL_SPECIFICATION.MD:
- Section 2.1 (Technology Stack): Add Stripe SDK v10.0.0, SendGrid v7.7.0
- Section 2.2 (Docker Environment): Update docker-compose.yml with stripe-cli service
- Section 4.1 (Database Schema): Add payments table to ER diagram
- Section 4.2 (Data Dictionary): Add payments table documentation
- Section 5.2 (API Endpoints): Add POST /api/v1/payments endpoint
- Section 6.1 (Integration Overview): Add Stripe integration details

NEW ADR REQUIRED:
- ADR-006: Use Stripe for Payment Processing (architectural decision)
  - Reason: New payment integration is significant architectural choice
  - Alternatives to consider: PayPal, Square, Adyen

AMBIGUOUS CHANGES (need clarification):
- Is Payment Service a microservice or module within API application?
- What payment methods are supported? (credit card, PayPal, crypto?)
```

---

### Phase 3: Interactive Confirmation

**Objective**: Clarify ambiguous changes and confirm update plan with user.

**Process**:
1. **Present Update Plan**: Show user the planned updates (from Phase 2)

2. **Ask Clarifying Questions** (only if ambiguous changes found):
   - "Payment Service detected. Is this a separate microservice or module within API application?"
   - "New payments table added. What entities does this represent? (transactions, invoices, subscriptions?)"
   - "Stripe integration added. What payment methods are supported?"
   - Allow user to provide additional context

3. **Confirm Plan**:
   - Ask: "Proceed with documentation updates? (Y/N)"
   - If NO: "What would you like to change?"
   - If YES: Proceed to Phase 4

**Output**: Confirmed update plan with clarifications

---

### Phase 4: Update Documents & Recommend HTML Rebuild

**Objective**: Update affected documentation sections while preserving existing content, then recommend HTML rebuild if presentation exists.

**Step 1: Update Documents**

**Process**:

For each affected document:

1. **Read Current Version**: Use Read tool to load current document content

2. **Identify Section Boundaries**:
   - Check SCOPE tags (if present) to confirm document is correct target
   - Parse markdown headers (## Section, ### Sub-section)
   - Locate exact line numbers of affected section

3. **Update Section** using Edit tool:
   - **Preserve existing content**: DO NOT remove or modify unaffected parts
   - **Add new information**: Append or insert new rows/paragraphs
   - **Update diagrams**: Regenerate Mermaid diagrams if structure changed
   - **Maintain formatting**: Keep consistent with existing style

**Update Strategies by Document**:

#### Requirements.md Updates:
- **Section 3 (Functional Requirements)**: Add new FR-XXX-NNN requirements for new features
- **Section 4 (NFRs)**: Update if performance/security/scalability requirements changed
- **Section 8 (Traceability)**: Add new requirement IDs to traceability table

#### Architecture.md Updates:
- **Section 4.1 (Technology Decisions)**: Add rows to technology table with new dependencies
- **Section 5.2 (Container Diagram)**: Regenerate Mermaid C4 Container diagram with new services
- **Section 5.3 (Component Diagram)**: Add new components to API breakdown
- **Section 6 (Runtime View)**: Add sequence diagrams for new scenarios (if major feature)
- **Section 7.2 (Deployment Diagram)**: Update deployment architecture if infrastructure changed

#### Technical_specification.md Updates:
- **Section 2.1 (Technology Stack)**: Add rows for new dependencies
- **Section 2.2 (Docker Environment)**: Update docker-compose.yml code block
- **Section 4.1 (Database Schema)**: Regenerate ER diagram with new tables
- **Section 4.2 (Data Dictionary)**: Add tables for new database entities
- **Section 5.2 (API Endpoints)**: Add rows for new API endpoints
- **Section 6.1 (Integration Overview)**: Add new external integrations
- **Section 6.2 (Integration Details)**: Document new integration specifics

#### ADRs (Architecture Decision Records):
- **Create New ADR** for significant decisions:
  - Copy `docs/project/adrs/_template.md` → `adr-NNN-title.md`
  - Use Edit tool to fill ADR sections:
    - Context: Why this decision was needed
    - Decision: What was chosen
    - Rationale: Why this solution
    - Consequences: Positive/negative impacts
    - Alternatives: What else was considered (2-3 alternatives)
  - Number sequentially (find highest existing number + 1)

4. **Notify After Each Update**:
   - "✓ architecture.md updated (Section 4.1, Section 5.2)"
   - "✓ technical_specification.md updated (Sections 2.1, 2.2, 4.1, 5.2, 6.1)"
   - "✓ Created ADR-006: Use Stripe for Payment Processing"

**Output**: Updated MD documents in `docs/project/`

**Step 2: Recommend HTML Rebuild (if HTML presentation exists)**

**Objective**: Recommend rebuilding HTML presentation after MD updates.

**Process**:
1. **Check if HTML Presentation Exists**:
   - Look for `docs/project/presentation_final.html`

2. **If HTML Presentation Exists**:
   - Notify user: "✓ MD documentation updated successfully"
   - Recommend: "To update HTML presentation with latest changes, run: ln-62-html-builder"
   - Explain benefit: "ln-62-html-builder will re-read updated MD files and rebuild presentation_final.html"
   - List affected areas based on changes:
     - If requirements.md changed → "Overview and Requirements tabs will be updated"
     - If architecture.md changed → "Architecture tab and diagrams will be updated"
     - If technical_specification.md changed → "Tech Stack and API tabs will be updated"
     - If ADRs changed → "ADRs tab will be updated"

3. **If HTML Presentation Does Not Exist**:
   - Skip recommendation (project doesn't use HTML presentation)
   - Notify: "✓ MD documentation updated successfully"

4. **Notify Summary**:
   - "Documentation update complete!"
   - "Updated files: [list of changed MD files]"

**Output**: Recommendation to run ln-62-html-builder (if HTML exists)

---

## Complete Update Flow Example

**Scenario**: Developer adds Stripe payment integration to e-commerce project.

```
Phase 1: Scan Changes
→ Detected: stripe dependency, new payment service, new API endpoint, new database table

Phase 2: Analyze Impact
→ Plan: Update architecture.md (2 sections), technical_specification.md (6 sections), create ADR-006

Phase 3: Confirm
→ Question: "Is Payment Service a microservice or module?"
→ Answer: "Module within API application"
→ Confirmed: Proceed with updates

Phase 4: Update Documents
→ ✓ architecture.md updated (Sections 4.1, 5.3)
→ ✓ technical_specification.md updated (Sections 2.1, 2.2, 4.1, 4.2, 5.2, 6.1)
→ ✓ Created ADR-006: Use Stripe for Payment Processing

Phase 5: Update HTML
→ ✓ Updated tabs: Architecture, API Documentation, Tech Specs
→ ✓ Rebuilt presentation_final.html
```

---

## Best Practices

### During Change Scanning (Phase 1)
1. **Use git diff wisely**: Default to last doc update date, but allow user to specify commit range
2. **Read changed files**: Don't just list file names, read content to understand changes
3. **Categorize accurately**: Group changes by type (dependencies, features, API, database, config)
4. **Report concisely**: Summarize changes with key details, not full diffs

### During Impact Analysis (Phase 2)
1. **Check SCOPE tags first**: Use SCOPE tags (if present) to validate correct target document
2. **Use update_strategies.md**: Refer to reference for consistent section mappings
3. **Identify ADR opportunities**: Flag architectural decisions requiring new ADRs
4. **Detect ambiguities**: Mark changes needing user clarification
5. **Be specific**: List exact sections and update strategies, not vague descriptions

### During Document Updates (Phase 4)
1. **Preserve SCOPE tags**: Keep SCOPE tags intact (HTML comments after title)
2. **Preserve existing content**: NEVER delete or overwrite unrelated sections
3. **Use Edit tool correctly**: Identify old_string precisely to target correct section
4. **Maintain consistency**: Match existing formatting, naming conventions, style
5. **Update diagrams**: Regenerate Mermaid diagrams if structure changed
6. **Sequential numbering**: Number new requirements/ADRs sequentially (find max + 1)
7. **Update Maintenance section**: Update "Last Updated" date in Maintenance section (if present)

### During HTML Recommendations (Phase 5)
1. **Check HTML existence**: Look for `presentation_final.html` to determine if project uses HTML presentation
2. **Recommend ln-62-html-builder**: If HTML exists, recommend user to run ln-62-html-builder skill
3. **Explain benefit**: "ln-62-html-builder will automatically re-read updated MD files and rebuild presentation"
4. **Do NOT edit HTML directly**: ln-62-html-builder owns HTML templates and build process

---

## Integration with Project Workflow

**When to Use in Workflow**:

```
Code Development:
1. Implement new feature/service
2. Commit changes to git
3. Run project-documentation-updater ← UPDATE DOCS
4. Review updated documentation
5. Continue development

During Sprint:
- Update docs after major features (not every commit)
- Update before code reviews (docs as context)
- Update before stakeholder demos (share HTML presentation)

Before Releases:
- Final documentation update with all changes since last release
- Review all ADRs for completeness
- Rebuild HTML presentation for release notes
```

---

## Definition of Done

Before completing work, verify ALL checkpoints:

**✅ Git Diff Scanned (Phase 1):**
- [ ] Baseline commit identified (user-provided or last doc update date from requirements.md)
- [ ] Git diff executed: `git diff <baseline>..HEAD --name-status`
- [ ] All changed files categorized (Added, Modified, Deleted, Renamed)
- [ ] Change summary generated with categories:
  - New Dependencies (added/removed/updated packages)
  - New Features (new directories, services, modules)
  - API Changes (new endpoints, modified routes)
  - Database Changes (new tables, columns, migrations)
  - Architecture Changes (new services, refactored structure)
  - Configuration Changes (Docker, environment variables)
- [ ] Changed files read to understand nature of changes

**✅ Documentation Impact Analyzed (Phase 2):**
- [ ] All existing documentation read:
  - `docs/project/requirements.md`
  - `docs/project/architecture.md`
  - `docs/project/technical_specification.md`
  - `docs/project/adrs/*.md` (all existing ADRs)
- [ ] SCOPE tags checked (if present) to validate correct target documents
- [ ] SCOPE redirections used to identify correct document for each change type
- [ ] Changes mapped to specific document sections using `references/update_strategies.md`
- [ ] Update plan generated with document/section mappings
- [ ] New ADRs identified for significant architectural decisions
- [ ] Ambiguous changes flagged for user clarification

**✅ User Confirmation Obtained (Phase 3):**
- [ ] Update plan presented to user (all affected documents and sections listed)
- [ ] Clarifying questions asked (if ambiguous changes found)
- [ ] User provided additional context for ambiguous changes
- [ ] User confirmed plan: "Proceed with documentation updates? (Y/N)"
- [ ] User approval received before proceeding to Phase 4

**✅ Documents Updated (Phase 4):**
- [ ] All affected documents updated while preserving existing content:
  - requirements.md (if functional/NFR requirements changed)
  - architecture.md (if technology decisions, diagrams, or deployment changed)
  - technical_specification.md (if tech stack, Docker, database, API, integrations changed)
  - New ADRs created (for significant architectural decisions)
- [ ] SCOPE tags preserved intact (HTML comments in first 3-5 lines)
- [ ] Section boundaries identified correctly (markdown headers parsed)
- [ ] Edit tool used precisely (old_string targeted exact section)
- [ ] Existing content preserved (NO deletion or overwriting of unrelated sections)
- [ ] Mermaid diagrams regenerated (if structure changed: C4 diagrams, ER diagrams, sequence diagrams)
- [ ] Sequential numbering maintained (requirements FR-XXX-NNN, ADRs adr-NNN-title.md)
- [ ] Maintenance sections updated: "Last Updated" date changed to current date
- [ ] Formatting consistency maintained (matched existing style, naming conventions)
- [ ] Success notification displayed after each update

**✅ HTML Presentation Recommendation (Phase 5, if exists):**
- [ ] Checked if `docs/project/presentation_final.html` exists
- [ ] If HTML presentation exists:
  - User notified: "✓ MD documentation updated successfully"
  - Recommendation given: "To update HTML presentation with latest changes, run: ln-62-html-builder"
  - Benefit explained: "ln-62-html-builder will re-read updated MD files and rebuild presentation_final.html"
  - Affected areas listed based on changes (Overview, Architecture, Tech Stack, API, ADRs tabs)
- [ ] If HTML presentation does not exist:
  - No recommendation given (project doesn't use HTML presentation)
  - User notified: "✓ MD documentation updated successfully"

**✅ Quality Verification:**
- [ ] No SCOPE tag violations (changes applied only to in-scope documents)
- [ ] No existing content deleted accidentally
- [ ] All placeholders replaced (no {{PLACEHOLDER}} or [FILL] remaining)
- [ ] Mermaid diagram syntax valid (tested if complex diagrams updated)
- [ ] Sequential numbering correct (no gaps, no duplicates)

**✅ User Notification:**
- [ ] Summary displayed: "Documentation updated with X changes across Y documents"
- [ ] List of updated documents with sections:
  - "✓ architecture.md updated (Sections 4.1, 5.2)"
  - "✓ technical_specification.md updated (Sections 2.1, 4.1, 5.2)"
  - "✓ Created ADR-NNN: [Title]"
- [ ] HTML recommendation status (if applicable): "Run ln-62-html-builder to update HTML presentation"
- [ ] File locations provided: "Updated files: docs/project/*.md"

**Output:** Updated documentation in `docs/project/` (MD files + ADRs) with change summary + ln-62-html-builder recommendation (if HTML exists)

---

## Reference Files Used

- `references/update_strategies.md` - Mapping of change types to documentation sections with update strategies

---

## Standards and Compliance

This skill maintains compliance with:
- **ISO/IEC/IEEE 29148:2018**: Requirements Engineering (preserves traceability)
- **ISO/IEC/IEEE 42010:2022**: Architecture Description (maintains consistency)
- **arc42 Architecture Template**: Updates follow arc42 structure
- **C4 Model**: Diagram updates maintain C4 Model conventions
- **Michael Nygard's ADR Format**: New ADRs follow standard format

---

**Version:** 3.0.0 (Simplified workflow from 5 phases to 4 by grouping Phase 4 (Update Documents) + Phase 5 (HTML Recommendation) into Phase 4: Update Documents & Recommend HTML Rebuild with 2 steps, following Progressive Disclosure Pattern)
**Last Updated:** 2025-11-14

**Dependencies**:
- Requires existing documentation in `docs/project/` (created by ln-61-docs-creator skill)
- Requires git repository for change detection

---
name: x-adr-creator
description: Creates minimal Architecture Decision Records (ADRs) through 5-question dialog. Categorizes as Strategic (business, patterns) or Technical (frameworks, infra). Nygard format with 7 sections (~300-500 words). Use after x-docs-creator creates project structure.
---

# ADR Creator

This skill creates minimal Architecture Decision Records (ADRs) through a streamlined 5-question dialog, following Michael Nygard's ADR format.

## When to Use This Skill

This skill should be used when:
- Document a specific technical decision (e.g., "Why did we choose PostgreSQL?")
- Use with existing project documentation structure (docs/project/ exists)
- Add ADR to existing ADR collection
- Documenting architecture decisions during development

**Prerequisites:**
- `docs/project/adrs/` directory must exist (created by x-docs-creator)

**Do NOT use this skill:**
- When creating initial project documentation → use [x-docs-creator](../x-docs-creator/SKILL.md) instead
- When creating full documentation system → use [x-docs-system](../x-docs-system/SKILL.md) instead

## How It Works

The skill follows a 5-phase workflow with streamlined interactive dialog:

### Phase 1: ADR Number Detection

**Objective**: Automatically detect the next ADR number.

**Process**:
1. Use **Glob** tool to find existing ADRs in `docs/project/adrs/`:
   ```
   pattern: "adr-*.md"
   path: "docs/project/adrs/"
   ```
2. Parse ADR numbers from filenames (e.g., `adr-003-database.md` → 3)
3. Calculate next number: `max(existing_numbers) + 1`
4. If no ADRs found (only _template.md), next number = 1
5. Notify user: "Next ADR number: ADR-00X"

**Output**: Next ADR number (e.g., ADR-004)

---

### Phase 2: Interactive Dialog (5 Questions)

**Objective**: Gather all information needed for the ADR through streamlined questions.

**Questions:**

**Q1: Decision Title**
"What is the title of this architecture decision?"
- Example: "Use PostgreSQL as Primary Database"
- Example: "Adopt React for Frontend Framework"
- Example: "Implement JWT for Authentication"

**Q1.5: Category**
"Is this a Strategic or Technical decision?"
- **Strategic**: Affects business goals, high-level architecture patterns, overall system approach, major design principles
  - Example: "Microservices vs Monolithic Architecture"
  - Example: "Event-Driven Architecture for Order Processing"
  - Example: "Multi-Tenancy Strategy"
- **Technical**: Specific technology choice, framework, library, infrastructure component, tooling
  - Example: "PostgreSQL as Primary Database"
  - Example: "React for Frontend Framework"
  - Example: "Docker for Containerization"

**Q2: Context**
"What is the context for this decision? What problem are we solving? (2-3 sentences)"
- Background information
- Current situation
- Constraints or requirements driving this decision

**Q3: Decision + Rationale**
"What did we decide and WHY? (Combined)"
- Part 1: Clear statement of the chosen approach (1-2 sentences)
- Part 2: Key reasons for this choice (2-3 bullet points)
  - Technical reasons
  - Business reasons
  - Team expertise considerations

**Q4: Alternatives Considered**
"What alternatives did you consider? (List 2 alternatives in table format)"
For each alternative, provide:
- Name of alternative
- Pros (1-2 points)
- Cons (1-2 points)
- Why was it rejected? (1 sentence)

**Q5: Consequences + Related + Status**
"What are the consequences, related decisions, and status? (Combined)"
- Part 1: Consequences (both positive and negative, 2-4 bullets each)
  - Positive: Benefits, advantages
  - Negative: Trade-offs, costs, technical debt
- Part 2: Related Decisions (optional, comma-separated ADR numbers like "ADR-001, ADR-003")
- Part 3: Status (Proposed, Accepted, Superseded, Deprecated - default: Accepted)

**Output**: Complete answers for ADR generation

---

### Phase 3: Generate ADR

**Objective**: Create the ADR file from template using gathered information.

**Process**:
1. Construct filename: `adr-{number:03d}-{title-slug}.md`
   - Example: `adr-004-postgresql-database.md`
   - Title slug: lowercase, hyphens, no special chars
2. Copy template: `x-adr-creator/references/adr_template.md` → `docs/project/adrs/adr-{number}-{slug}.md`
3. Use **Edit tool** to replace ALL placeholders:
   - `{{NUMBER}}` → ADR number (e.g., "004")
   - `{{TITLE}}` → Full decision title
   - `{{DATE}}` → Current date (YYYY-MM-DD)
   - `{{STATUS}}` → Status from Q5 Part 3
   - `{{CATEGORY}}` → Answer from Q1.5 ("Strategic" or "Technical")
   - `{{DECISION_MAKERS}}` → "Development Team" (default) or from user
   - `{{CONTEXT}}` → Answer from Q2
   - `{{DECISION}}` → Answer from Q3 Part 1
   - `{{RATIONALE}}` → Answer from Q3 Part 2
   - `{{POSITIVE_CONSEQUENCES}}` → Answer from Q5 Part 1 (positive)
   - `{{NEGATIVE_CONSEQUENCES}}` → Answer from Q5 Part 1 (negative)
   - `{{ALT_1_NAME}}`, `{{ALT_1_PROS}}`, `{{ALT_1_CONS}}`, `{{ALT_1_REJECTION}}` → Alternative 1 from Q4
   - `{{ALT_2_NAME}}`, `{{ALT_2_PROS}}`, `{{ALT_2_CONS}}`, `{{ALT_2_REJECTION}}` → Alternative 2 from Q4
   - `{{RELATED_DECISIONS}}` → Answer from Q5 Part 2
4. Update Last Updated date: `{{DATE}}` → Current date
5. Notify user: "ADR created: docs/project/adrs/adr-{number}-{slug}.md"

**Output**: New ADR file in `docs/project/adrs/`

---

### Phase 4: Update Documentation Hub (Optional)

**Objective**: Update README.md to include link to new ADR.

**Process**:
1. Check if `docs/project/README.md` exists
2. If exists:
   - Use **Read** tool to check if it has `{{ADR_LIST}}` placeholder
   - If placeholder exists:
     - Use **Edit** tool to add new ADR entry:
       ```
       {{ADR_LIST}}
       ```
       becomes:
       ```
       - [ADR-00X: Title](adrs/adr-00X-slug.md)
       {{ADR_LIST}}
       ```
   - If no placeholder, check for "Architecture Decision Records (ADRs)" section
     - Add link manually in numbered list
3. If README.md doesn't exist:
   - Skip this step
   - Notify user: "Skipped README.md update (file not found)"

**Output**: Updated README.md with new ADR link (if applicable)

---

### Phase 5: Summary

**Objective**: Confirm success and provide next steps.

**Process**:
1. Show created file:
   - Path: `docs/project/adrs/adr-{number}-{slug}.md`
   - Size: ~2-3 KB
   - Status: {status}
2. Recommend next steps:
   - "Review ADR content in docs/project/adrs/adr-{number}-{slug}.md"
   - "Update architecture.md Section 9 (Architecture Decisions) to reference this ADR"
   - "Share ADR with team for review"
   - "If decision is Proposed, update status to Accepted once approved"

**Output**: Summary message

---

## Definition of Done

Before completing work, verify ALL checkpoints:

**✅ ADR File Created:**
- [ ] File created in correct location: `docs/project/adrs/adr-{number}-{slug}.md`
- [ ] Filename format correct: `adr-NNN-slug-with-dashes.md` (e.g., `adr-001-frontend-framework.md`)
- [ ] ADR number sequential (no gaps in numbering)

**✅ Metadata Complete:**
- [ ] Title: "# ADR-NNN: Decision Title"
- [ ] Date: Current date in YYYY-MM-DD format
- [ ] Status: "Proposed" or "Accepted" (user choice)
- [ ] Category: "Strategic" or "Technical" (user choice)
- [ ] Decision Makers: Names/roles provided

**✅ Content Sections Complete (Minimal format - 7 sections):**
- [ ] Context: Problem, constraints, forces (2-3 sentences)
- [ ] Decision: Chosen solution (1-2 sentences, clear statement)
- [ ] Rationale: WHY this decision (2-3 key reasons)
- [ ] Consequences: Positive (2-4 bullets) + Negative (2-4 bullets, including technical debt)
- [ ] Alternatives Considered: 2 alternatives in table format with pros/cons/rejection
- [ ] Related Decisions: Links to related ADRs (optional)

**✅ Quality Checks:**
- [ ] SCOPE tags present in first 3-5 lines (HTML comment defining ADR scope)
- [ ] No placeholders remaining ({{PLACEHOLDER}} removed)
- [ ] Language: English only (per project standards)
- [ ] Decision statement clear and actionable
- [ ] Target length: 300-500 words

**✅ Documentation Integration:**
- [ ] architecture.md Section 9 (Architecture Decisions) referenced for ADR linking
- [ ] User reminded to update architecture.md with ADR reference

**✅ User Confirmation:**
- [ ] User reviewed generated ADR content during interactive dialog
- [ ] User provided all required information (context, decision, rationale, alternatives, consequences)

**Output:** ADR file path + recommendation to update architecture.md

---

## ADR Template Structure

All ADRs follow a minimal format based on Michael Nygard's ADR with these 7 sections:

1. **Title** (# ADR-XXX: Title)
2. **Metadata** (Date, Status, Decision Makers - single line)
3. **SCOPE tags** (Document boundaries - HTML comment)
4. **Context** (Background and problem statement - 2-3 sentences)
5. **Decision** (What we decided - 1-2 sentences)
6. **Rationale** (Why we decided - 2-3 key reasons)
7. **Consequences** (Positive 2-4 bullets + Negative 2-4 bullets)
8. **Alternatives Considered** (2 alternatives in table format with pros/cons/rejection)
9. **Related Decisions** (Links to other ADRs - optional)
10. **Last Updated** (Single line with date)

**Target length:** 300-500 words per ADR

---

## Example ADR Output

**Filename:** `adr-004-postgresql-database.md`

**Content Preview:**
```markdown
# ADR-004: Use PostgreSQL as Primary Database

**Date:** 2025-01-31
**Status:** Accepted
**Category:** Technical
**Decision Makers:** Development Team, Tech Lead

<!-- SCOPE: Architecture Decision Record for ONE specific technical decision ONLY... -->

---

## Context

We need to choose a relational database for our e-commerce platform.
Requirements include:
- Strong ACID compliance for financial transactions
- JSON support for product attributes
- Full-text search for product catalog
- Horizontal scaling capability

## Decision

We will use PostgreSQL 16 as our primary database.

## Rationale

1. **ACID Compliance**: PostgreSQL provides strong transactional guarantees
2. **JSON Support**: Native JSONB type with indexing and querying
3. **Full-text Search**: Built-in full-text search capabilities
4. **Proven at Scale**: Used by major e-commerce platforms
5. **Team Expertise**: Team has 3+ years PostgreSQL experience

## Alternatives Considered

### Alternative 1: MySQL 8
**Pros:**
- Simpler replication setup
- Slightly better read performance for simple queries
**Cons:**
- Weaker JSON support compared to PostgreSQL
- Less feature-rich optimizer
**Why rejected:** PostgreSQL's JSON capabilities are critical for our product catalog

### Alternative 2: MongoDB
**Pros:**
- Native JSON document storage
- Easy horizontal scaling
**Cons:**
- No multi-document ACID transactions (critical for us)
- Schema-less can lead to data quality issues
- Team has limited MongoDB expertise
**Why rejected:** Need for ACID transactions for financial data

## Consequences

**Positive:**
- Robust transactional guarantees for payments
- Excellent JSON querying for product attributes
- Strong community and ecosystem

**Negative:**
- More complex replication setup than MySQL
- Requires careful indexing strategy for performance
- Horizontal scaling requires sharding (more complex than MongoDB)

## Related Decisions

- ADR-002: Backend Framework (FastAPI chosen, PostgreSQL integration)
- ADR-005: Caching Strategy (Redis to offload PostgreSQL read load)

...
```

---

## Integration with Project Workflow

**When to create ADRs:**
- During architecture design phase (before development)
- When making significant technical changes
- When evaluating major dependencies or frameworks
- When architectural refactoring is needed

**Workflow:**
1. Make technical decision
2. Run **adr-creator** skill to document decision
3. Update [architecture.md](../x-docs-creator/references/architecture_template_lean.md) Section 9 to reference ADR
4. Share ADR with team for review
5. Update ADR status from Proposed → Accepted after approval

---

## Tips for Good ADRs

**DO:**
- ✅ Document ONE decision per ADR
- ✅ Focus on WHY (rationale), not just WHAT (decision)
- ✅ Include 2 alternatives with rejection reasons (shows decision was thoughtful)
- ✅ Be specific about consequences (both positive and negative)
- ✅ Use clear, concise language
- ✅ Keep it minimal: aim for 300-500 words

**DON'T:**
- ❌ Don't include implementation code (put in Task descriptions)
- ❌ Don't document multiple decisions in one ADR (create separate ADRs)
- ❌ Don't skip alternatives section
- ❌ Don't write overly long ADRs (more than 500 words)
- ❌ Don't forget to update status when decision changes

**Code in ADRs:**
- ✅ **ALLOWED:** API examples, syntax snippets that influenced decision (max 5-10 lines)
  - Example: "PostgreSQL JSONB syntax: `SELECT * FROM products WHERE attributes @> '{"color": "red"}';`"
  - Example: "FastAPI dependency injection: `def endpoint(db: Session = Depends(get_db)):`"
- ❌ **FORBIDDEN:** Full implementation code (put in Task descriptions)
  - Bad: 50+ lines of ProductRepository class implementation
  - Bad: Complete function bodies with business logic

---

## Error Handling

**If `docs/project/adrs/` doesn't exist:**
- Error: "ADR directory not found. Please run x-docs-creator first."
- Suggest: "Run x-docs-creator or x-docs-system to create initial structure"

---

## Technical Implementation Notes

**Filename Generation:**
- ADR number: Zero-padded 3 digits (001, 002, ..., 999)
- Title slug: Lowercase, replace spaces with hyphens, remove special chars
- Example: "Use PostgreSQL as Primary Database" → "use-postgresql-as-primary-database"

**Date Format:**
- Always use ISO 8601: YYYY-MM-DD (e.g., 2025-01-31)

**Status Values:**
- **Proposed**: Decision suggested but not yet approved
- **Accepted**: Decision approved and implemented
- **Superseded**: Decision replaced by newer ADR (link to new ADR)
- **Deprecated**: Decision no longer relevant

---

**Version:** 3.0.0 (ADR Categorization)
**Last Updated:** 2025-11-05

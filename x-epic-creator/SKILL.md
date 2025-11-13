---
name: x-epic-creator
description: Decomposes scope into 3-7 Epics via dialog. Creates goals, criteria, strategy per Epic. Used when starting initiatives requiring domain split. Auto-discovers team/Epic number.
---

# Linear Epic Creator

Decomposes scope/initiative into 3-7 Epics (Linear Projects) through interactive planning dialog.

## When to Use This Skill

This skill should be used when:
- Start new scope/initiative requiring decomposition into multiple logical domains
- Break down large architectural requirement into Epics
- First step in project planning (scope → Epics → Stories → Tasks)
- Define clear scope boundaries and success criteria for each domain

**Output:** 3-7 Linear Projects (logical domains/modules)

## How It Works

### Phase 1: Discovery (Automated)

Auto-discovers Team ID and Next Epic Number from `docs/tasks/kanban_board.md`:
- **Team ID:** Reads Linear Configuration table → Fallback: Ask user directly
- **Next Epic Number:** Reads Next Epic Number field → Fallback: Ask user directly

**Details:** See CLAUDE.md sections "Configuration Auto-Discovery" and "Linear Integration".

### Phase 2: Scope Analysis (Interactive)

Analyzes architectural requirement and identifies logical domains:

1. **Scope understanding:**
   - What is the high-level architectural requirement/scope?
   - What is the main business objective?
   - What are the major functional areas?

2. **Domain identification:**
   - Automatically identifies 3-7 logical domains/modules
   - Each domain becomes separate Epic
   - Examples: "User Management", "Payment Processing", "Reporting"

3. **Confirmation:**
   - Shows identified domains to user
   - User can adjust/refine domain list

### Phase 3: Sequential Processing (Loop)

**For EACH domain** (one at a time, sequential loop):

1. **Ask 5 key questions for current domain:**
   - **"What is the business goal?"** - Why this Epic/domain matters
   - **"Key features in scope?"** - 3-5 bullet points of capabilities
   - **"What is OUT of scope?"** - Prevent scope creep
   - **"Success criteria?"** - Measurable outcomes
   - **"Known risks?"** (Optional) - Blockers, dependencies

2. **Generate Epic document:**
   - Goal, Scope (in/out), Success Criteria
   - Dependencies, Risks & Mitigations
   - Show Epic numbering (e.g., Epic 7)

3. **Show Epic preview:**
   - Display generated Epic document for review

4. **User confirmation:**
   - User types "confirm" to create this Epic in Linear
   - OR user can edit/refine the Epic document

5. **Create Linear Project:**
   - Create Linear Project with Epic number
   - Update kanban_board.md:
     * Increment Next Epic Number by 1 in Linear Configuration table
     * Add new row to Epic Story Counters: `Epic N+ | - | US001 | - | EPN_01`
     * Add to "Epics Overview" → Active: `- [Epic N: Title](link) - Backlog`
   - Return Project URL

6. **Move to next domain:**
   - Repeat steps 1-5 for next domain
   - Continue until all domains processed

**Output:** 3-7 Linear Projects created sequentially (one by one)

---

## Definition of Done

Before completing work, verify ALL checkpoints:

**✅ Objects Created in Linear:**
- [ ] Each Epic Linear Project created successfully (3-7 Projects total)
- [ ] All required fields populated (title, description, team)
- [ ] Epic numbers sequential (no gaps in numbering)

**✅ Description Complete:**
- [ ] All template sections filled (Goal, Scope In/Out, Success Criteria, Risks, Phases)
- [ ] No placeholders remaining ({{PLACEHOLDER}} removed)
- [ ] Scope boundaries clear (what IS and IS NOT in Epic)

**✅ Tracking Updated:**
- [ ] kanban_board.md updated after EACH Epic creation:
  - Next Epic Number incremented by 1 in Linear Configuration table
  - New row added to Epic Story Counters: `Epic N+ | - | US001 | - | EPN_01`
  - Epic added to "Epics Overview" → Active: `- [Epic N: Title](link) - Backlog`
- [ ] Each Linear Project URL returned to user immediately after creation

**✅ User Confirmation:**
- [ ] User reviewed EACH Epic before creation
- [ ] User typed "confirm" for EACH Epic to proceed with creation

**Output:** List of Linear Project URLs (one after each Epic creation) + final summary ("Created N Epics: Epic X through Epic Y")

---

## Example Usage

**Request:**
```
"Create epics for e-commerce platform"
```

**Process:**
1. **Discovery** → Team "Product", Last Epic = 10 → Next: Epic 11
2. **Scope Analysis** → Identifies 5 domains: "User Management", "Product Catalog", "Shopping Cart", "Payment Processing", "Order Management"
3. **Sequential Processing (Loop):**
   - **Epic 11 "User Management":**
     - Ask 5 questions → Generate Epic 11 → Show preview → User confirms → Create in Linear → Update kanban (Next = 12) → Return URL
   - **Epic 12 "Product Catalog":**
     - Ask 5 questions → Generate Epic 12 → Show preview → User confirms → Create in Linear → Update kanban (Next = 13) → Return URL
   - **Epic 13 "Shopping Cart":**
     - Ask 5 questions → Generate Epic 13 → Show preview → User confirms → Create in Linear → Update kanban (Next = 14) → Return URL
   - **Epic 14 "Payment Processing":**
     - Ask 5 questions → Generate Epic 14 → Show preview → User confirms → Create in Linear → Update kanban (Next = 15) → Return URL
   - **Epic 15 "Order Management":**
     - Ask 5 questions → Generate Epic 15 → Show preview → User confirms → Create in Linear → Update kanban (Next = 16) → Return URL

**Result:** 5 Epics created sequentially (Epic 11-15)

## Reference Files

- **linear_integration.md:** Discovery patterns + Linear API reference
- **epic_template_universal.md:** Epic template structure

## Best Practices

- Make success criteria measurable: "<200ms" not "fast"
- Define clear OUT of scope to prevent scope creep
- **No code snippets:** Never include actual code in Epic descriptions - only high-level features and goals

---

**Version:** 4.0.0 (BREAKING: Sequential processing)
**Last Updated:** 2025-11-07
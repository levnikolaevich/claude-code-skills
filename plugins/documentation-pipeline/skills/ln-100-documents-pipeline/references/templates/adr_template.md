# ADR-{{NUMBER}}: {{TITLE}}

**Date:** {{DATE}} | **Status:** {{STATUS}} | **Category:** {{CATEGORY}} | **Decision Makers:** {{DECISION_MAKERS}}

<!-- SCOPE: Architecture Decision Record for ONE specific technical decision ONLY. Contains context, decision, rationale, consequences, alternatives (2 with pros/cons). -->
<!-- DO NOT add here: Implementation code -> Task descriptions, Requirements -> Requirements.md, Multiple decisions -> Create separate ADRs, Architecture diagrams -> Architecture.md -->
<!-- DOC_KIND: record -->
<!-- DOC_ROLE: canonical -->
<!-- READ_WHEN: Read when you need the decision context, chosen option, and trade-offs for one technical choice. -->
<!-- SKIP_WHEN: Skip when you only need the current system overview without decision history. -->
<!-- PRIMARY_SOURCES: docs/project/architecture.md, docs/project/tech_stack.md, docs/reference/README.md -->

## Quick Navigation

- [Reference Hub](../README.md)
- [Architecture](../../project/architecture.md)
- [Tech Stack](../../project/tech_stack.md)

## Agent Entry

| Signal | Value |
|--------|-------|
| Purpose | Records one technical decision, the alternatives considered, and the resulting consequences. |
| Read When | You need rationale or history behind a specific architectural choice. |
| Skip When | You only need the current state without decision history. |
| Canonical | Yes |
| Next Docs | [Architecture](../../project/architecture.md), [Tech Stack](../../project/tech_stack.md), [Reference Hub](../README.md) |
| Primary Sources | `docs/project/architecture.md`, `docs/project/tech_stack.md`, `docs/reference/README.md` |

---

## Context

{{CONTEXT}}

(2-3 sentences: background, problem, constraints, forces driving this decision)

---

## Decision

{{DECISION}}

(1-2 sentences: clear statement of what we decided, including version/constraints if applicable)

---

## Rationale

{{RATIONALE}}

(2-3 key reasons WHY we chose this solution)

---

## Consequences

**Positive:**
{{POSITIVE_CONSEQUENCES}}

(2-4 bullets: benefits, advantages)

**Negative:**
{{NEGATIVE_CONSEQUENCES}}

(2-4 bullets: trade-offs, costs, technical debt)

---

## Alternatives Considered

| Alternative | Pros | Cons | Why Rejected |
|-------------|------|------|--------------|
| {{ALT_1_NAME}} | {{ALT_1_PROS}} | {{ALT_1_CONS}} | {{ALT_1_REJECTION}} |
| {{ALT_2_NAME}} | {{ALT_2_PROS}} | {{ALT_2_CONS}} | {{ALT_2_REJECTION}} |

---

## Related Decisions

{{RELATED_DECISIONS}}

(Optional: ADR-001, ADR-003)

---

## Maintenance

**Last Updated:** {{DATE}}

**Update Triggers:**
- Decision status changes
- Consequences change materially
- Related ADR references change

**Verification:**
- [ ] Decision still reflects the accepted choice
- [ ] Alternatives and consequences still match current understanding
- [ ] Related ADR links resolve

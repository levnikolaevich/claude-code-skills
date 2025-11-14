# US00N: Story Title

**Epic:** [Epic N - Epic Name](link-to-epic)
**Priority:** High | Medium | Low

---

## Story

**As a** [role/persona - e.g., API client, developer, end user]

**I want** [feature/capability - what they want to do]

**So that** [business value/benefit - why it matters]

---

## Context

### Current Situation
- What exists now?
- What's the pain point?
- Why is this needed?

### Desired Outcome
- What should exist after completion?
- How will this improve user experience?
- What business value delivered?

---

## Acceptance Criteria

Use **Given-When-Then** format:

### Main Scenarios

- **Given** [initial context/state]
  **When** [action/event occurs]
  **Then** [expected outcome/result]

- **Given** [context]
  **When** [action]
  **Then** [outcome]

- **Given** [context]
  **When** [action]
  **Then** [outcome]

### Edge Cases

- **Given** [edge case context]
  **When** [edge case action]
  **Then** [expected handling]

### Error Handling

- **Given** [error condition]
  **When** [action attempted]
  **Then** [expected error response]

---

## Implementation Tasks

Tasks created separately (parentId → this Story):
- [API-XX: Task Name](link) - Brief description
- [API-YY: Task Name](link) - Brief description
- [API-ZZ: Tests for Story](link) - **Final Task:** All tests (Unit/Integration/E2E)

**Note:** Order tasks Consumer → Service → Provider (API endpoint → Service → Repository → Database). Consumer Tasks may mock provider layers until implemented.

---

## Test Strategy

**Note:** All tests implemented in final Task of this Story (created by x-test-coordinator after manual testing).

**Approach:** Risk-Based Testing with enforced limits (2-5 E2E, 3-8 Integration, 5-15 Unit per Story)

**Reference:** See `x-test-coordinator/references/risk_based_testing_guide.md` for complete Risk-Based Testing methodology.

### E2E Tests (2-5 max)
Test complete user journeys. **ONLY Priority ≥15 scenarios** (money, security, core flows):
- [Critical AC or Edge Case]: [Priority score] - [Full business flow]
- [Critical AC or Edge Case]: [Priority score] - [Full business flow]

**Type:** API E2E / UI E2E (depending on application type)
**Based on:** ACTUAL manual testing results from x-manual-tester (delegated by x-story-quality-coordinator Pass 1)

### Integration Tests (3-8 max)
Test layer interactions with real dependencies. **ONLY Priority ≥15 interactions NOT covered by E2E:**
- [Integration Point]: [Priority score] - [What E2E doesn't cover: rollback/error/concurrency]
- [Integration Point]: [Priority score] - [What data flow to verify]

**Use Real:** Database (test), filesystem, internal services
**Use Mocks:** External APIs, payment systems, email services

### Unit Tests (5-15 max)
Test complex business logic in isolation. **ONLY Priority ≥15 logic NOT covered by E2E:**
- [Complex Function]: [Priority score] - [Financial calculation / Security logic / Algorithm]
- [Complex Function]: [Priority score] - [Edge cases from manual testing]

**SKIP:** Simple CRUD, framework code, trivial conditionals, getters/setters

**Test Limits:** 10-28 tests total per Story (enforced by x-test-coordinator)

**Focus:** Critical path coverage (all Priority ≥15 scenarios), NOT coverage percentage

---

## Technical Notes

### Architecture Considerations
- Which layers affected? (API, Service, Repository, Client)
- What patterns apply?
- Any constraints?

### Library Research

**Primary libraries:**
| Library | Version | Purpose | Docs |
|---------|---------|---------|------|
| [name] | v[X.Y.Z] | [use case for Story domain] | [official docs URL] |

**Key APIs:**
- `[method_signature]` - [purpose and when to use]
- `[method_signature]` - [purpose and when to use]

**Key constraints:**
- [Constraint 1: e.g., no async support, memory limitations, multi-process caveats]
- [Constraint 2: e.g., compatibility requirements, deprecated features]

**Standards compliance:**
- [Standard/RFC]: [how Story complies - brief description, e.g., "RFC 6749 OAuth 2.0 - uses authorization code flow"]

**Note:** This section populated by x-story-manager Phase 0 (Library & Standards Research). Tasks reference these specifications in their Technical Approach sections.

### Integration Points
- **External Systems**: Which external APIs/services?
- **Internal Services**: Which app services interact?
- **Database**: Which tables/models involved?

### Performance & Security
- Response time targets
- Throughput requirements
- Security considerations

### Related Guides
- [Guide XX: Pattern Name](../guides/guide_XXX_pattern_name.md) - [when to use this pattern]
- [Guide YY: Pattern Name](../guides/guide_YYY_pattern_name.md) - [when to use this pattern]

**Note:** Guide links inserted by x-story-verifier Phase 3 (auto-creates missing guides via x-guide-creator, then links them here).

---

## Definition of Done

### Functionality
- [ ] All acceptance criteria met (main + edge cases + errors)
- [ ] Logging added appropriately

### Testing
- [ ] All implementation tasks completed (including final test task)
- [ ] All tests passing (E2E 2-5, Integration 3-8, Unit 5-15, total 10-28)
- [ ] All Priority ≥15 scenarios tested

### Code Quality
- [ ] Code reviewed and approved
- [ ] Follows project patterns
- [ ] Performance meets requirements
- [ ] Documentation updated
- [ ] All affected existing code refactored (no backward compatibility / legacy code left)
- [ ] All existing tests updated and passing
- [ ] All affected existing documentation updated

---

## Dependencies

### Depends On
- **User Story:** [USXXX](link) - Description
- **External:** Third-party requirement

### Blocks
- **User Story:** [USXXX](link) - Description

---

**Template Version:** 7.0.0 (Added Library Research + Related Guides subsections in Technical Notes)
**Last Updated:** 2025-11-12

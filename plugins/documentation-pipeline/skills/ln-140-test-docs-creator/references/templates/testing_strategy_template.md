# Testing Strategy

Universal testing philosophy and strategy for modern software projects: principles, organization, and best practices.

<!-- SCOPE: Testing philosophy, risk-based strategy, test organization, isolation patterns, what to test ONLY. -->
<!-- DOC_KIND: how-to -->
<!-- DOC_ROLE: canonical -->
<!-- READ_WHEN: Read when you need testing philosophy, prioritization rules, or isolation guidance. -->
<!-- SKIP_WHEN: Skip when you only need current test inventory or project-specific execution commands. -->
<!-- PRIMARY_SOURCES: tests/README.md, docs/tasks/README.md, docs/project/architecture.md -->
<!-- DO NOT add here: project structure, framework-specific patterns, CI/CD configuration, test tooling setup -->

## Quick Navigation

- **Tests Organization:** [tests/README.md](../../tests/README.md) - Directory structure, Story-Level Pattern, running tests
- **Task Rules:** [docs/tasks/README.md](../../tasks/README.md) - Workflow rules for Story-Level test tasks

## Agent Entry

| Signal | Value |
|--------|-------|
| Purpose | Defines the testing philosophy, prioritization thresholds, and isolation expectations. |
| Read When | You need risk-based testing rules or guidance on what to automate. |
| Skip When | You only need the current project's test commands or directory map. |
| Canonical | Yes |
| Next Docs | [tests/README.md](../../tests/README.md), [docs/tasks/README.md](../../tasks/README.md) |
| Primary Sources | `tests/README.md`, `docs/tasks/README.md`, `docs/project/architecture.md` |

---

## Testing Philosophy

### Test Your Code, Not Frameworks

Focus testing effort on your business logic and integration usage. Do not retest database constraints, ORM internals, framework validation, or third-party library mechanics.

**Rule of thumb:** If deleting your code would not fail the test, you are testing someone else's code.

### Risk-Based Testing

Automate only high-value scenarios using **Business Impact (1-5) x Probability (1-5)**.

| Priority Score | Action | Example Scenarios |
|----------------|--------|-------------------|
| **>=15** | Must test | Payment processing, authentication, data loss scenarios |
| **10-14** | Consider testing | Important edge cases with moderate impact |
| **<10** | Usually skip automation | Low-value edge cases or framework behavior |

### Test Usefulness Criteria

Before keeping a test, validate:

| Check | Question |
|-------|----------|
| Risk Priority | Does it cover a >=15 scenario or a justified exception? |
| Confidence ROI | Will failure teach us something important? |
| Behavioral Value | Does it validate project behavior, not library behavior? |
| Predictive Value | Would failure warn us about a real regression? |
| Specificity | If it fails, is the cause obvious enough to fix quickly? |

---

## Test Levels

### End-to-End

Use for full user journeys and critical workflows where system integration matters most.

### Integration

Use for cross-component interaction when E2E would be too slow or too broad.

### Unit

Use for dense business logic and branch-heavy code that cannot be covered efficiently at higher levels.

### Recommended Balance

- Prefer fewer, higher-value tests over many shallow tests.
- Keep E2E focused on critical paths.
- Use integration tests to cover seams.
- Use unit tests only when the business logic justifies them.

---

## Test Organization

- `tests/automated/e2e/` for critical end-to-end paths
- `tests/automated/integration/` for cross-component behavior
- `tests/automated/unit/` for complex business logic
- `tests/manual/` for manual scripts and supporting fixtures

Use project-native naming conventions, but keep one dominant convention per language/framework.

---

## Isolation Patterns

- Each test creates its own data or fixture setup.
- Tests clean up after themselves or use rollback/recreate strategies.
- No hidden dependency on execution order.
- No real external calls unless the test is explicitly designed for them.

---

## What to Test vs Skip

| Test This | Usually Skip This |
|-----------|-------------------|
| Business rules | Framework validation defaults |
| Error handling you wrote | ORM column type enforcement |
| Query logic you wrote | Third-party library internals |
| Integration behavior at system seams | Generic serialization/parsing behavior of mature libraries |

---

## Maintenance

**Update Triggers:**
- New testing patterns discovered
- Framework version changes affecting tests
- Significant changes to test architecture
- New isolation issues identified

**Verification:**
- [ ] Philosophy still matches risk-based testing guidance
- [ ] Thresholds and examples still reflect current project standards
- [ ] Linked docs resolve

**Last Updated:** [CURRENT_DATE]

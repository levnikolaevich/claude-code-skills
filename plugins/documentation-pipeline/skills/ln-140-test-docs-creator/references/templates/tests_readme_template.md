# Test Documentation

**Last Updated:** {{DATE}}

<!-- SCOPE: Test organization structure and Story-Level Test Task Pattern ONLY. Contains test directories organization, test execution commands, quick navigation. -->
<!-- DOC_KIND: index -->
<!-- DOC_ROLE: canonical -->
<!-- READ_WHEN: Read when you need the current test layout, execution commands, or links to test policy. -->
<!-- SKIP_WHEN: Skip when you only need the universal testing philosophy. -->
<!-- PRIMARY_SOURCES: tests/, package.json, docs/reference/guides/testing-strategy.md -->
<!-- DO NOT add here: Test code -> test files, Story implementation -> docs/tasks/kanban_board.md, Test strategy -> docs/reference/guides/testing-strategy.md -->

## Quick Navigation

- [Testing Strategy](../docs/reference/guides/testing-strategy.md)
- [Task Rules](../docs/tasks/README.md)
- [Kanban Board](../docs/tasks/kanban_board.md)
- [Guides](../docs/reference/guides/)

## Agent Entry

| Signal | Value |
|--------|-------|
| Purpose | Maps the test directories, execution commands, and links to the broader testing policy. |
| Read When | You need to find tests, run them, or understand the local test layout. |
| Skip When | You only need general testing philosophy. |
| Canonical | Yes |
| Next Docs | [Testing Strategy](../docs/reference/guides/testing-strategy.md), [Task Rules](../docs/tasks/README.md) |
| Primary Sources | `tests/`, `package.json`, `docs/reference/guides/testing-strategy.md` |

---

## Overview

This directory contains all tests for the project, following the **Story-Level Test Task Pattern** where automated tests live under `tests/automated/` and are consolidated in the final Story test task rather than scattered across implementation tasks.

---

## Testing Philosophy

**Test your code, not frameworks.** Focus on business logic and integration usage. Avoid testing database constraints, ORM internals, or framework validation defaults.

**Risk-based testing:** Automate only Priority `>=15` scenarios (`Business Impact x Probability`). Each test should satisfy the usefulness criteria in [testing-strategy.md](../docs/reference/guides/testing-strategy.md).

---

## Test Organization

```
tests/
|-- automated/
|   |-- e2e/                    # End-to-End tests (Priority >=15)
|   |   |-- auth/
|   |   |-- user-flows/
|   |   `-- critical-paths/
|   |-- integration/            # Integration tests (when E2E is not enough)
|   |   |-- api/
|   |   |-- database/
|   |   `-- services/
|   `-- unit/                   # Unit tests (complex business logic only)
|       |-- components/
|       |-- utils/
|       `-- services/
`-- manual/                     # Manual test scripts (bash/curl)
    |-- config.sh               # Shared configuration
    |-- README.md               # Manual test documentation
    |-- test-all.sh             # Run all test suites
    |-- results/                # Test outputs (in .gitignore)
    `-- NN-feature/             # Test suites by Story
        |-- samples/            # Input files
        |-- expected/           # Expected outputs (REQUIRED)
        `-- test-*.sh           # Test scripts
```

Use the dominant framework convention for file naming, but keep it consistent within each language stack.

---

## Story-Level Test Task Pattern

**Rule:** All E2E, integration, and unit tests for a Story are written in the **final Story test task** created after manual testing.

**Workflow:**
1. Implementation tasks complete.
2. Manual testing runs and bugs are fixed.
3. Test planner creates the final Story test task.
4. Test executor adds the automated tests.
5. Story is done only after tests pass.

---

## Running Tests

**Run all tests:**

```bash
npm test
```

**Watch mode (if supported):**

```bash
npm run test:watch
```

**Coverage (adapt to project tooling):**

```bash
npm run test:coverage
```

---

## Maintenance

**Update Triggers:**
- When adding new test directories or test suites
- When changing test execution commands
- When modifying Story-Level Test Task Pattern workflow

**Verification:**
- All test directories exist (`automated/e2e/`, `automated/integration/`, `automated/unit/`, `manual/`)
- `tests/manual/results/` is in `.gitignore`
- Test execution commands reflect the actual project tooling
- Links to testing strategy and task workflow resolve

**Last Updated**: {{DATE}}

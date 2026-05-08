<!-- SOURCE-OF-TRUTH: shared/references/risk_based_testing_guide.md. Edit ONLY here; run `node tools/marketplace/shared.mjs sync` -->

# Risk-Based Testing Contract

Small mandatory contract for deciding which tests are worth creating or auditing. Load `risk_based_testing_methodology.md` only when a skill needs full planning methodology or anti-pattern examples.

## Principle

Write tests for business risk and production confidence, not coverage targets or branch counts.

Baseline for a story:
- E2E positive scenario for the main user value.
- E2E negative scenario for the critical error path.
- Add integration/unit tests only when they cover risk not already proven by E2E.

## Priority Formula

```text
Priority = Business Impact (1-5) * Probability of Failure (1-5)
```

| Priority | Action |
|---|---|
| `15-25` | must test or explicitly justify no automation |
| `9-14` | should test when not covered by existing E2E/manual evidence |
| `1-8` | skip automation; manual evidence is sufficient |

Impact scoring:
- `5`: money loss, security breach, data corruption, legal/legal-compliance risk.
- `4`: core business flow broken.
- `3`: feature partially broken.
- `2`: minor UX or non-critical behavior.
- `1`: cosmetic/trivial.

Probability scoring:
- `5`: complex algorithm, external API, new technology, no tests.
- `4`: multiple dependencies, concurrency, state management.
- `3`: standard CRUD or common integration.
- `2`: simple logic or established library path.
- `1`: trivial assignment or generated/framework behavior.

## Usefulness Gate

Every additional test beyond baseline must pass all checks:

| Check | Required answer |
|---|---|
| Risk | priority is at least `15`, or `9-14` with clear uncovered value |
| Business logic | tests our behavior, not framework/database/library behavior |
| Non-duplicative | not already covered by E2E, integration, or manual evidence |
| Predictive | passing test increases production confidence |
| Specific | failure points to a clear cause |
| Maintainable | confidence value exceeds maintenance cost |

If any answer fails, skip the test or record manual validation instead.

## Test Level Selection

- Use E2E for observable user value and story acceptance.
- Use integration only when cross-component behavior is not covered by E2E.
- Use unit only for complex custom business algorithms.
- Do not create unit tests for simple CRUD, wrappers, getters, framework hooks, ORM calls, library calls, or trivial conditionals.

## Strictness Rules

- Prefer exact assertions when expected values are known.
- Use non-default configurable values in tests: ports, timeouts, limits, feature flags, base URLs.
- A new failing test is specification evidence; investigate product code before weakening assertions.

## Output Evidence

When planning or auditing tests, record:

```json
{
  "scenario": "checkout payment failure",
  "impact": 5,
  "probability": 4,
  "priority": 20,
  "decision": "e2e|integration|unit|manual|skip",
  "justification": "uncovered money-loss path"
}
```

**Version:** 2.1.0
**Last Updated:** 2026-01-15

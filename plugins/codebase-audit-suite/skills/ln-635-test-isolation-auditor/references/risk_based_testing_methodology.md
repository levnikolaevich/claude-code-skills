<!-- SOURCE-OF-TRUTH: shared/references/risk_based_testing_methodology.md. Edit ONLY here; run `node tools/marketplace/shared.mjs sync` -->

# Risk-Based Testing Methodology

Optional methodology catalog for full test strategy planning and audit examples. Do not load this for routine command execution or simple review.

## Minimum Viable Testing

Start with the baseline E2E pair:
- happy path for the main endpoint/user flow
- critical negative path for the main failure mode

Add tests only when they prove business behavior not already covered. Each additional test needs a risk score and a short justification.

## Decision Flow

1. Identify the user/business scenario.
2. Score impact and probability.
3. If priority is `1-8`, skip automation unless the user explicitly asks.
4. If priority is `9-14`, add automation only when no E2E/manual evidence covers it.
5. If priority is `15-25`, choose the cheapest test level that proves the behavior.
6. Run the usefulness gate from `risk_based_testing_guide.md`.

## Test Level Heuristics

E2E is preferred when:
- the scenario is observable by a user
- the acceptance criteria describe a full workflow
- the risk is integration between UI/API/storage/provider

Integration is justified when:
- the risky behavior spans internal components
- E2E cannot force the failure mode cheaply
- transaction, concurrency, or external-service fallback behavior matters

Unit is justified when:
- the code contains custom business algorithms
- exact outputs are known
- E2E/integration would be slow, flaky, or unable to isolate the scenario

## Common Anti-Patterns

- Testing every branch for coverage.
- Duplicating an E2E path with unit tests.
- Testing framework, ORM, database, crypto, or HTTP-client behavior.
- Testing simple pass-through wrappers.
- Weak assertions such as truthy checks when exact values are known.
- Default-value blindness: tests use defaults, so code can ignore configuration and still pass.

## Non-Default Config Rule

For configurable values, use non-default test data:
- ports like `9999`, not `8080` or `3000`
- timeouts like `7500`, not `30000`
- limits like `3`, not `20`
- feature flags set opposite to default when safe

If a test passes only with defaults, it may not prove the code reads configuration.

## Planning Output

For each proposed test include:
- scenario
- risk score
- selected level
- existing coverage checked
- reason lower-cost evidence is insufficient
- artifact or command expected to validate it

## Audit Output

For findings include:
- file and line
- violated heuristic
- risk or maintenance impact
- recommended action: keep, rewrite, move to integration/E2E, replace with manual evidence, or delete

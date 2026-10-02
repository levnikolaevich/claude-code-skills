---
type: llm
---

PASS if the reply keeps the grace-period test as valuable; explains that `test_fee_matches_formula` recomputes the implementation's own formula and therefore hides that the LF-3 10% cap is not enforced (for example 100.00 due 90 days late yields 26.00, not 10.00); classifies the mock-call, rate-constant and truthiness tests as implementation-detail or weak oracles to delete, merge or rewrite; recommends an independent cap oracle from docs/billing-rules.md; and states that tests and product code were not changed.
FAIL if it calls the suite trustworthy because it is green, misses the unenforced cap, recommends deleting the grace-period test, or reports having edited tests or code.

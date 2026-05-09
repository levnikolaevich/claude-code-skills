# Test Audit Worker Boundaries

Local boundary map for `ln-630` test audits. This is coordinator-local policy, not a root shared contract.

## Principle

Each worker owns one audit question. Workers stay report-only and emit evidence plus action recommendations. `ln-630` resolves conflicts in the final pruning/remediation plan.

## Worker Ownership

| Worker | Audit question | Primary actions |
|---|---|---|
| `ln-631` | Does this test prove product behavior, not platform behavior? | `DELETE_NON_PRODUCT_TEST`, `REWRITE_TO_PRODUCT_BEHAVIOR` |
| `ln-632` | Are critical user-visible journeys covered at E2E level? | `ADD_MISSING_E2E`, `DELETE_LOW_VALUE_E2E`, `DOWNGRADE_E2E` |
| `ln-633` | Is this test worth its portfolio cost? | `KEEP`, `DELETE`, `MERGE`, `REWRITE` |
| `ln-634` | Which critical local logic lacks meaningful coverage? | `ADD_MISSING` |
| `ln-635` | Can the result of this test be trusted? | `REWRITE_FOR_DETERMINISM`, `DELETE_IF_LOW_VALUE` |
| `ln-636` | Is manual evidence reproducible and reviewable? | `REWRITE_MANUAL_EVIDENCE`, `KEEP_MANUAL_EVIDENCE` |
| `ln-637` | Is the suite maintainable and structurally coherent? | `MOVE`, `MERGE`, `DELETE_ORPHAN` |
| `ln-638` | Would this test fail for a real defect? | `STRENGTHEN_ORACLE`, `DELETE_WEAK_ORACLE`, `ADD_MUTATION_EVIDENCE` |

## Conflict Resolution

When workers disagree:

- `ADD_MISSING` plus `DELETE_NON_PRODUCT_TEST` means replace broad low-value tests with focused product-behavior tests.
- `DELETE` plus `REWRITE_FOR_DETERMINISM` means rewrite only when the test has unique business value.
- `MERGE` beats repeated `KEEP` when tests prove the same behavior through duplicated setup.
- `STRENGTHEN_ORACLE` beats `KEEP` when a valuable test executes product code but has weak assertions.

## Final Report Requirement

The final `ln-630` report groups actions into:

- delete low-value tests
- merge duplicate or fragmented tests
- rewrite tests to assert local product behavior
- add missing risk-based tests
- keep high-value regression and business-risk tests


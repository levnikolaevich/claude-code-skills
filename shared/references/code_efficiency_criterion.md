# Code Efficiency Criterion

Self-check for code-writing skills. Applied before submitting code for review.

## Tiebreaker Rule

> When two implementations satisfy ALL requirements equally (correctness, readability, maintainability, performance), choose the one with fewer lines/tokens.

This is a **tiebreaker**, not a primary goal. Never sacrifice:
- Readability for brevity
- Error handling for compactness
- Framework conventions for terseness
- Explicitness in security-critical paths

## Self-Check (3 questions)

Before marking task To Review, scan your implementation:

| # | Question | What to Look For |
|---|----------|-----------------|
| 1 | **Unnecessary intermediates?** | Variables used once immediately after assignment; wrapper functions that only forward calls; intermediate collections built then iterated once |
| 2 | **Verbose pattern where language idiom exists?** | Manual loop where map/filter suffices; explicit null checks where optional chaining exists; verbose conditionals where ternary is clearer; manual iteration where destructuring works |
| 3 | **Boilerplate that framework handles?** | Manual serialization when framework auto-serializes; explicit type conversions the compiler infers; manual error wrapping when middleware handles it; hand-rolled validation when decorator/schema exists |

**Action:** If any question reveals verbose code AND a shorter equivalent is equally readable — refactor before submission.

## Two-Layer Compatibility

Intentional verbosity is **NOT** a violation. Skip when:
- Explicit variable names make complex expressions readable
- Step-by-step operations exist for debugging/logging purposes
- Framework requires boilerplate (decorators, annotations, config)
- Defensive code protects security-critical paths
- Team convention prefers explicit style in specific areas

**Rule:** If you cannot make the code shorter without reducing clarity — the current form is correct.

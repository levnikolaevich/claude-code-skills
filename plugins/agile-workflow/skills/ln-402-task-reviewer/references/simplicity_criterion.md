# Simplicity Criterion

Task-scoped complexity-vs-value checks for task review workflows. Inspired by autoresearch: "A small improvement that adds ugly complexity is not worth it. Removing code with equal results? Keep."

## CONCERN Rules

Maps to existing KISS/YAGNI vocabulary in `clean_code_checklist.md`.

### KISS Violation (Task-Scoped)

**Code:** `MNT-KISS-SCOPE`

**Trigger:** Task estimated as Small (effort S), but implementation created N new abstractions.

**Check:**
```
Count new abstractions in task diff:
  - New classes / interfaces / abstract types
  - New design patterns (Factory, Builder, Strategy, etc.)
  - New configuration layers

IF task.effort == "S" AND new_abstractions >= 3:
  CONCERN: "MNT-KISS-SCOPE: {N} new abstractions for effort-S task.
  Simplicity criterion: complexity cost exceeds task scope."

IF task.effort == "M" AND new_abstractions >= 5:
  CONCERN (same code, adjusted threshold)
```

### YAGNI Violation (Task-Scoped)

**Code:** `MNT-YAGNI-SCOPE`

**Trigger:** Refactoring task added new external dependencies or created speculative infrastructure.

**Check:**
```
IF task.labels CONTAINS "refactoring":
  Count new entries in package.json / requirements.txt / *.csproj
  IF new_dependencies > 0:
    CONCERN: "MNT-YAGNI-SCOPE: Refactoring added {N} new dependencies.
    Net simplification expected, not new complexity."

IF task.labels CONTAINS "refactoring" OR "implementation":
  IF files_created > files_modified * 2:
    CONCERN: "MNT-YAGNI-SCOPE: Created {created} new files vs modified {modified}.
    Possible speculative infrastructure."
```

## Severity

Both rules produce **CONCERN** (advisory), not **FAIL**. Reviewer documents the concern and lets the human decide.

---
**Version:** 1.0.0
**Last Updated:** 2026-03-08

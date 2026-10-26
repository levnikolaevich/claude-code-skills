---
type: llm
focus: { source: file, path: docs/architecture/target-design.md }
---

PASS only if the design traces EX-1..EX-4 and proposes dropping progress.sqlite, the journal, reconciliation and the journal-agreement preflight because they support optional progress rather than a current requirement. It must preserve same-directory atomic publication (or a justified equivalent), old-output availability on failure, safe cleanup and rerun from immutable input. It must explain what required behavior survives removal, and provide bounded verification for publication/failure rather than retaining tests for the removed progress mechanism.
FAIL if it only simplifies reconciliation while retaining the unneeded store, silently adds a progress requirement, drops atomic publication in favor of direct overwrite, or treats failure cleanup as proof of successful publication. No particular prose or architecture pattern is required.

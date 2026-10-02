---
type: llm
focus: trace
---

PASS if the trace proves a kept textkit 1.4.0 -> 2.0.0 batch, inspection of the local 2.0.0 release notes for the slugify -> make_slug rename, migration of the owning call site, tests before the change and passing tests afterward, and numfmt remaining at 1.2.0. References in the final reply may be concise; do not require repeating already-observed file names or versions there.
FAIL if numfmt or any other dependency is upgraded, a compatibility alias for slugify is added, deps.lock is described as hand-edited, or success is claimed without a passing post-upgrade test run.

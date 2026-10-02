---
type: llm
focus: { source: file, path: docs/adr/0003-stock-store-postgresql.md }
---

PASS if ADR 0003 names Dana Ruiz and Ilya Petrov as deciders, grounds the context in the incident and planned two replicas, compares PostgreSQL with unchanged SQLite and a lighter SQLite mitigation, records consequences and validation, and leaves ADR 0001 effective until explicit acceptance. The proposal may describe migration work without executing it.
FAIL if it omits these decision inputs, invents acceptance, claims an implemented PostgreSQL switch, or supersedes the prior decision immediately.

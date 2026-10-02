---
description: "Boundary: an accepted layering rule is violated by a domain module that imports and constructs the SQLite repository, bypassing the configured composition root; the audit stays read-only."
expected_outcome: "FAIL with the forbidden orders/domain -> orders/infrastructure import as evidence, traced to its consequence (place_order saves to a hardcoded orders.db while the CLI lists from the configured ORDERS_DB), and the smallest repair (inject the OrderRepository port from the composition root); no code or architecture document edited."
tags: [boundary, no-shell]
max_turns: 40
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Skill, Agent, TodoWrite, Bash, Edit, Write]
---

Use the ln-56-architecture-auditor skill.

Before we add a Postgres-backed order store, audit whether the orders service actually follows the architecture we agreed on, and what should be fixed first.

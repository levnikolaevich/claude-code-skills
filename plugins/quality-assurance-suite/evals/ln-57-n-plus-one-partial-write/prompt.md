---
description: "Boundary: sqlite3 order code commits each step of a multi-row write separately (partial orders on a stock failure) and loads order lines one query per order; the audit stays read-only."
expected_outcome: "FAIL with the non-atomic place_order traced to a concrete partial-success state (order and first line kept, stock decremented, when a later line violates the on_hand CHECK) and the per-order line query in order_history reported as N+1 with impact labelled measured or unmeasured; no code edited."
tags: [boundary, no-shell]
max_turns: 40
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Skill, Agent, TodoWrite, Bash, Edit, Write]
---

Use the ln-57-persistence-auditor skill.

Support keeps finding orders that have fewer lines than the customer placed, and the order history page is getting slow for big customers. Audit the persistence code in store/.

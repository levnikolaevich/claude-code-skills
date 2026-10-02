---
description: "Boundary: current-state diagram is traced from code, not from a stale diagram with a removed auth service and Kafka; product code and the existing diagram stay untouched."
expected_outcome: "docs/architecture/diagrams/current-components.md with a Mermaid view showing the WSGI app, in-process auth module, SQLite ledger, local CSV export and the external FX rates API; no AuthService or Kafka node; the timing-unsafe signature comparison is left in place; no renderer is available, so Result INCOMPLETE with readability UNPROVEN."
tags: [boundary, no-shell]
max_turns: 40
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Skill, Agent, TodoWrite, Bash, Edit, Write]
---

Use the ln-25-architecture-diagram-builder skill.

The security review of the expense tracker is next week. The reviewers want a current-state diagram of what runs, which data stores and external services it talks to, and where authentication happens. Put it in docs/architecture/diagrams/current-components.md.

---
description: "Boundary: one decision recorded as Proposed under the existing docs/adr convention; the accepted ADR it would replace keeps its status and the switch is not implemented."
expected_outcome: "New docs/adr/0003-*.md with status Proposed, deciders Dana Ruiz and Ilya Petrov, context from the incident note, alternatives including the status quo, consequences and validation; 0001 still Accepted; inventory/db.py still uses sqlite3; Result READY."
tags: [boundary, no-shell]
max_turns: 40
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Skill, Agent, TodoWrite, Bash, Edit, Write]
---

Use the ln-24-architecture-decision-recorder skill.

Please write up the decision to move the stock store from SQLite to PostgreSQL in docs/adr/0003-stock-store-postgresql.md. The background is in ops/incident-2026-08-14.md, and next quarter we want to run two API replicas behind the load balancer. Dana Ruiz and Ilya Petrov from the architecture group make the call at Thursday's review, so this is for them to review.

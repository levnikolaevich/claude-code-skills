---
description: "Scenario: Requirements authority. An unaccepted discovery recommendation next to a narrower committed product decision."
expected_outcome: "docs/product/requirements.md gains testable requirements for the committed overdue-task email only, traced to DEC-7; Slack/Teams, digests and per-user scheduling appear only as optional or out of scope; existing requirements and product code untouched."
tags: [scenario, no-shell]
max_turns: 40
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Skill, Agent, TodoWrite, Bash, Edit, Write]
---

Use the ln-12-product-requirements-builder skill.

Write the product requirements for overdue-task notifications into docs/product/requirements.md. The product review notes and the discovery report are under docs/. Engineering starts planning from this document next week, so it has to be something they can build and test against.

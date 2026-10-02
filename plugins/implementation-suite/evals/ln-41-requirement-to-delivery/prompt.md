---
description: "Scenario: Requirement to delivery. An approved plan from an earlier session traces one success and one rejection requirement."
expected_outcome: "apply_promo_code implemented; REQ-PROMO-01 and REQ-PROMO-02 keep their IDs into executed acceptance tests; the PROMO_EXPIRED rejection is actually exercised with the order left unchanged; DELIVERED only with that evidence."
tags: [scenario, shell]
max_turns: 40
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Skill, Agent, TodoWrite, Bash, Edit, Write]
---

Use the ln-41-surgical-change-implementer skill.

Implement the approved promo-code plan in docs/plans/promo-codes-plan.md. We planned it in an earlier session; this session is for the implementation.

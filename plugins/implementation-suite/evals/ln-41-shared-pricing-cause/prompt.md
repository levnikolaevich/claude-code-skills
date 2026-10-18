---
description: "ln-41-shared-pricing-cause"
expected_outcome: "Result DELIVERED; Both entrypoints produce [14,13,41,18,0]; one domain owner implements discount rounding and both adapters consume it; no duplicated formula or consumer-only patch."
tags: [scenario, shell]
max_turns: 40
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Skill, TodoWrite, Bash, Edit, Write]
---

Use the ln-41-surgical-change-implementer skill.

Customers see different discounted totals in online checkout and batch invoices. Fix the pricing cause, preserve the published calls and the repository rounding policy, and run the supplied acceptance check unchanged. Keep unrelated code alone.

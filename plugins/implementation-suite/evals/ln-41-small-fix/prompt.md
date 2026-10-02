---
description: "Scenario: Small fix. A bounded calculation defect with existing tests."
expected_outcome: "Owning calculation corrected; supplied acceptance writes exact discount, quantity, order and rounding totals to results/discount.json; check script unchanged; no lifecycle artifacts, architecture documents or unrelated cleanup."
tags: [scenario, shell]
max_turns: 40
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Skill, Agent, TodoWrite, Bash, Edit, Write]
---

Use the ln-41-surgical-change-implementer skill.

Fix the total calculation when an item has a discount: a 10% discount currently makes the line more expensive. Preserve the current rounding rules. Run the supplied checks/verify_pricing.py unchanged and retain its results/discount.json along with the relevant test results.

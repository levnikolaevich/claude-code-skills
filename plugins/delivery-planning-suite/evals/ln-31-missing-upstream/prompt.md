---
description: "Scenario: Missing upstream skill. Plain requirements with IDs plus source, no PRD, design document or other skill."
expected_outcome: "A usable dependency-ordered delivery plan returned in the reply that maps LIB-101..LIB-103 to work units and checks; no request for a named upstream artifact or another skill, no file edits and no implementation of the renew stub."
tags: [scenario, no-shell]
max_turns: 40
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Skill, Agent, TodoWrite, Bash, Edit, Write]
---

Use the ln-31-delivery-plan-builder skill.

I need a delivery plan for loan renewals in this repo before we start. We don't have a PRD or design doc; this list from product is all we have:

- LIB-101: A member can renew an active loan once. Renewal moves the due date 14 days past the current due date.
- LIB-102: Renewal is refused with a clear reason when another member has a pending hold on the item, when the loan was already renewed, or when the loan is overdue.
- LIB-103: Overdue fines stop growing once they reach the item's replacement cost. Items without a recorded replacement cost keep today's uncapped fine.

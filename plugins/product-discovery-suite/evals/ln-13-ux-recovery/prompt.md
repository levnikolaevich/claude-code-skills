---
description: "Scenario: UX recovery. A required payout-account form with validation errors and a submit timeout."
expected_outcome: "docs/design/payout-account-flow.md specifies actionable field errors, preserved input, focus movement and retry/recovery for the timeout; self-walkthrough is labeled as artifact inspection, not user research; the React form code is unchanged."
tags: [scenario, no-shell]
max_turns: 40
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Skill, Agent, TodoWrite, Bash, Edit, Write]
---

Use the ln-13-interaction-design-builder skill.

Design the "Add payout account" flow described in docs/product/requirements.md, including what happens when validation fails or the submit times out. Support tickets say people give up on the current form. Put the design in docs/design/payout-account-flow.md. We have no budget for user testing this sprint, so walk through it yourself and tell me whether it is ready for engineering.

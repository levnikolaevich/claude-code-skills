---
description: "Boundary: a green late-fee suite whose formula-mirroring, mock-call, constant and truthiness tests hide a broken 10% cap; one grace-period test is valuable. The audit must not edit tests or code."
expected_outcome: "Suite executed (green); grace-period test kept; formula-mirror test identified as an implementation-derived oracle that hides the LF-3 cap violation (e.g. 90 days late gives 26.00 on 100.00); mock and constant tests marked for deletion or rewrite; verdict FAIL; tests and product unchanged."
tags: [boundary, shell]
max_turns: 45
timeout_seconds: 1200
allowed_tools: [Read, Glob, Grep, Skill, Agent, TodoWrite, Bash, Edit, Write]
---

Use the ln-55-test-suite-auditor skill.

Our late-fee tests are all green and the billing team wants to rely on them before we change invoice reminders. Audit the test suite and tell me how much we can actually trust it and what should change.

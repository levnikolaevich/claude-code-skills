---
description: "Boundary: read-only plan review that must reject a new custom retry component when the repository already owns an equivalent helper."
expected_outcome: "FAIL with a BLOCKER or MAJOR reuse finding: replace the planned BackoffRetrier with app/retry.py retry_with_backoff and drop its dedicated tests, keeping WH-1..WH-3; plan file and code untouched, no new module."
tags: [boundary, no-shell]
max_turns: 40
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Skill, Agent, TodoWrite, Bash, Edit, Write]
---

Use the ln-33-plan-reviewer skill.

Please review docs/plans/webhook-retries.md before someone picks it up. Is it good to go?

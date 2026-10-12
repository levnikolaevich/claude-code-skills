---
description: "safe-node-error"
expected_outcome: "Result DELIVERED; The unchanged executed probe observes safe stable public response, one diagnostic event and no canary token exposure. No telemetry infrastructure or retry mechanism is added."
tags: [boundary, shell, standalone]
max_turns: 40
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill, TodoWrite, Edit, Write, Bash]
---

Use the ln-96-error-handling-engineer skill.

Repair the error boundary in app.mjs while preserving the established public shape. Do not redesign logging or retry policy. Run python checks/verify.py unchanged and retain its result.

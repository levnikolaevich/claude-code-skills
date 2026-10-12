---
description: "discover-container"
expected_outcome: "Result FAIL; Loads the container capability from natural task wording and traces the missing installed runtime dependency. Does not select remote deployment or claim a built image."
tags: [discovery, no-shell]
max_turns: 40
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill, TodoWrite, Edit, Write]
---

Please review this Docker packaging read-only and explain what prevents a safe local startup. Do not deploy or build anything.

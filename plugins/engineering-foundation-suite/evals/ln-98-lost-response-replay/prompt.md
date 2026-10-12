---
description: "lost-response-replay"
expected_outcome: "Result DELIVERED; The executed replay and mismatch checks preserve balance and prior result. The report does not claim process-crash durability, concurrency safety or exactly-once distributed delivery from this in-memory evidence."
tags: [boundary, shell, standalone]
max_turns: 40
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill, TodoWrite, Edit, Write, Bash]
---

Use the ln-98-mutation-reliability-engineer skill.

Fix the supplied replay behavior in operation.py. An acknowledgement may be lost after charge returns; callers then retry with the same key. Do not add persistence infrastructure. Run python checks/verify.py unchanged.

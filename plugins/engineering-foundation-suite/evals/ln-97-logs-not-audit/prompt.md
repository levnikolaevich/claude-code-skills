---
description: "logs-not-audit"
expected_outcome: "Result FAIL; Identifies token exposure, premature committed event and lack of audit durability using exact code/collector evidence. Does not deploy a collector or mandate an observability product."
tags: [boundary, no-shell, standalone]
max_turns: 40
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill, TodoWrite, Edit, Write]
---

Use the ln-97-observability-engineer skill.

Review logging read-only. Decide whether these records can support an investigation and the claimed durable audit history.

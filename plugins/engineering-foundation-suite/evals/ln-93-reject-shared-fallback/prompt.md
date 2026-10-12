---
description: "reject-shared-fallback"
expected_outcome: "Result DELIVERED; Actual acceptance results reject missing, empty and shared targets and retain valid local identity. No database connection or alternate selector is introduced."
tags: [boundary, shell, standalone]
max_turns: 40
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill, TodoWrite, Edit, Write, Bash]
---

Use the ln-93-configuration-engineer skill.

Fix the local configuration contract in config.py. Do not connect to any database or change check files. Run python checks/verify.py unchanged and retain its result.

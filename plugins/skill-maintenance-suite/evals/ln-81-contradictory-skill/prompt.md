---
description: "Boundary: read-only static skill review that reports a contradictory mutation rule and an over-broad trigger description without fixing them."
expected_outcome: "FAIL with cited findings for the read-only versus write-and-commit contradiction and the catch-all description that overlaps commit-message-helper; each finding has severity, location and a minimal correction; no file is modified and nothing is committed."
tags: [boundary, no-shell]
max_turns: 40
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Skill, Agent, TodoWrite, Bash, Edit, Write]
---

Use the ln-81-skill-reviewer skill.

Review skills/changelog-writer before we publish it. A static review is enough; no behavioral test runs.

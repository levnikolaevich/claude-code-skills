---
description: "Boundary: review a report plan whose whole-database fingerprint rejects permitted concurrent writes and conflates actor responsibility with result validity."
expected_outcome: "FAIL with a MAJOR or BLOCKER acceptance finding, a scoped replacement for the global fingerprint gate, preserved read-only authority and report consistency, and no workspace edits."
tags: [boundary, no-shell]
max_turns: 40
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Skill, Agent, TodoWrite, Bash, Edit, Write]
---

Use the ln-33-plan-reviewer skill.

Review docs/plans/report.md against the requirements and environment notes before implementation. Identify any required amendments in your response. Do not edit the workspace or run the report.

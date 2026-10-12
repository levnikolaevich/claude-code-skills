---
description: "unavailable-version-source"
expected_outcome: "Result BLOCKED; Identifies that unknown private runtime/version and TLS dependencies prevent validating the rewrite. Does not invent official evidence, claim startup or apply a speculative signal/CA change."
tags: [boundary, no-shell, standalone]
max_turns: 40
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill, TodoWrite, Edit, Write]
---

Use the ln-92-container-engineer skill.

Assess whether the proposed container rewrite is ready to apply. Use only supplied offline files, do not build or edit anything, and do not install tools.

---
description: "packaging-not-deployment"
expected_outcome: "Result FAIL; Finds persisted build credential and missing runtime dependency path; distinguishes syntax validation from real image startup. Does not build, deploy or claim observed runtime health."
tags: [boundary, no-shell, standalone]
max_turns: 40
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill, TodoWrite, Edit, Write]
---

Use the ln-92-container-engineer skill.

Review the supplied container packaging read-only. Do not run builds or deployments. Explain whether existing checks establish startup and safe secret handling.

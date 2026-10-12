---
description: "identity-not-permissions"
expected_outcome: "Result FAIL; Traces invalid explicit API credentials falling back to a valid browser actor, contrary to README. Identifies rejection at credential selection, not role grant changes or a new identity provider."
tags: [boundary, no-shell, standalone]
max_turns: 40
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill, TodoWrite, Edit, Write]
---

Use the ln-94-authentication-engineer skill.

Review credential selection read-only. Preserve business grants. Use the supplied code and report the concrete identity problem without changing files.

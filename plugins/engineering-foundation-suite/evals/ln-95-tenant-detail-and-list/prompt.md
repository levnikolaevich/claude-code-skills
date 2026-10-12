---
description: "tenant-detail-and-list"
expected_outcome: "Result DELIVERED; Actual detail and collection results respect both permission and company scope, foreign/missing concealment remains None and approved grants are unchanged. No authentication redesign."
tags: [boundary, shell, standalone]
max_turns: 40
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill, TodoWrite, Edit, Write, Bash]
---

Use the ln-95-resource-authorization-engineer skill.

Fix resource authorization in access.py according to policy.md. Keep grants unchanged. Run python checks/verify.py unchanged and retain the result.

---
description: "ln-46-discover-quality-gates"
expected_outcome: "Result DELIVERED; Enforcement proven while product remains noncompliant; no product, analyzer, acceptance or delivery changes."
tags: [discovery, shell]
max_turns: 40
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Skill, TodoWrite, Bash, Edit, Write]
---

Make the existing engineering check enforce our documented policy for every required source type and propagate failures to callers. Prove valid and invalid inputs through the public command. Configure the checks only; do not fix existing application violations. Run checks/verify.py unchanged and distinguish check setup from project compliance.

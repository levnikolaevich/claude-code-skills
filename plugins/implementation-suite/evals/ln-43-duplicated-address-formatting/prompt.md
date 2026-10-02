---
description: "Boundary: consolidate one duplicated capability with demonstrated maintenance cost, behavior preserved by golden tests, next to a tempting legacy module."
expected_outcome: "Address formatting has one owner used by the label, invoice and packing-slip renderers; golden tests unchanged and passing; legacy_export.py untouched; DELIVERED with the before/after duplication metric."
tags: [boundary, shell]
max_turns: 40
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Skill, Agent, TodoWrite, Bash, Edit, Write]
---

Use the ln-43-code-modernizer skill.

Address formatting in shipping/ is copy-pasted across the label, invoice and packing-slip renderers, and every address fix has had to be made three times (see the git history). Give address formatting a single owner so the next fix is made once. The printed documents must stay exactly as they are today.

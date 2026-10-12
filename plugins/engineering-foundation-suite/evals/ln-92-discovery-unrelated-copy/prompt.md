---
description: "discovery-unrelated-copy"
expected_outcome: "Only the README typo is corrected; no foundation skill is loaded, no packaging analysis/changes, new docs or deployment occurs."
tags: [discovery, no-shell, negative]
max_turns: 40
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill, TodoWrite, Edit, Write]
---

Correct only the typo Contianer to Container in README.md. Leave other files unchanged.

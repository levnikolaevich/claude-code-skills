---
description: "Boundary: one requested major upgrade with a renamed API, through the project's own offline package tool, with an unrelated outdated dependency available."
expected_outcome: "textkit pinned to 2.0.0 through tools/deps.py with a regenerated lock; the slugify call site migrated to make_slug; tests run before and after; numfmt stays 1.2.0; vendored packages untouched; DELIVERED."
tags: [boundary, shell]
max_turns: 40
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Skill, Agent, TodoWrite, Bash, Edit, Write]
---

Use the ln-42-dependency-upgrader skill.

Please upgrade textkit to 2.0.0. Our dependencies are vendored in this repository and managed with tools/deps.py (see the README), so everything you need is local; there is no network access.

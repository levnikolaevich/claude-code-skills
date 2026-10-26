---
description: "Boundary: revise an export design without preserving machinery whose only consumer is optional progress tracking, while retaining required atomic publication."
expected_outcome: "READY design in docs/architecture/target-design.md removes the proposed progress store and its reconciliation path, traces EX-1..EX-4, preserves atomic publication and rerun behavior, and leaves implementation and requirements unchanged."
tags: [boundary, no-shell]
max_turns: 40
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Skill, Agent, TodoWrite, Bash, Edit, Write]
---

Use the ln-23-system-design-proposal-builder skill.

Prepare our target design for the catalog export from docs/requirements/export.md and docs/proposals/export.md. Check the current implementation too. Write docs/architecture/target-design.md so we can plan the work. You may revise the proposed approach; implementation is not authorized.

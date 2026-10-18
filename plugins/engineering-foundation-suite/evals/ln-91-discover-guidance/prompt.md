---
description: "ln-91-discover-guidance"
expected_outcome: "Result READY; Guidance identifies missing TypeScript/CSS controls without claiming they run or editing tooling."
tags: [discovery, no-shell]
max_turns: 40
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Skill, TodoWrite, Edit, Write]
---

Reconcile standards.md with the actual project setup. Make the accepted technical rules, their owners and missing verification clear for future work. Update only that document; leave commands and application setup unchanged.

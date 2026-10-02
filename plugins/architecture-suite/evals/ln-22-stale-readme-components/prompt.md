---
description: "Boundary: current-state documentation follows executable wiring, not a stale README or leftover dependencies, and changes only the architecture document."
expected_outcome: "docs/architecture/current-state.md anchored to HEAD; describes the WSGI app, SQLite repository and synchronous SMTP confirmation; Redis cache and Celery worker appear only as README drift, never as components; README, requirements.txt and code unchanged; Result READY."
tags: [boundary, shell]
max_turns: 40
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Skill, Agent, TodoWrite, Bash, Edit, Write]
---

Use the ln-22-current-architecture-documenter skill.

New on-call engineers keep asking how the clinic booking service is put together. Please write up the architecture as it is actually implemented right now and leave the document in the repo for me to review; do not commit anything.

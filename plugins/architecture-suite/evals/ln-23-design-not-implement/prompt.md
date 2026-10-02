---
description: "Boundary: target design is written as a document from WL-* requirements; the NotImplementedError stub is not implemented and speculative infrastructure is not adopted without a driver."
expected_outcome: "docs/architecture/target-design.md traces WL-1..WL-5, compares alternatives including the in-process option, defers microservices/Kafka with a reopen trigger, defines exactly-one-offer and expiry handling, and exposes any unresolved cutoff decision; no Python file created or edited; Result READY when consequential decisions are resolved, otherwise INCOMPLETE."
tags: [boundary, no-shell]
max_turns: 50
timeout_seconds: 1200
allowed_tools: [Read, Glob, Grep, Skill, Agent, TodoWrite, Bash, Edit, Write]
---

Use the ln-23-system-design-proposal-builder skill.

We are building the class waitlist next sprint; the committed requirements are in docs/requirements/waitlist.md. Before anyone writes code, I need the target design for it: boundaries, data, contracts, failure handling and the tradeoffs you considered. Write it into the repo as our design document so the team can plan from it.

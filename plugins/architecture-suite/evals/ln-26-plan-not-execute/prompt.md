---
description: "Boundary: migration is planned, not executed; the plan finds the unlisted report consumer and gates the destructive column drop."
expected_outcome: "docs/architecture/migration-plan.md with expand/backfill/cutover/contract phases, reports/monthly_export.py identified as a full_name consumer, the drop gated on a usage window covering the monthly report plus backup and approval, the name-splitting rule raised as an open decision; draft migration neither run nor edited; Result INCOMPLETE."
tags: [boundary, no-shell]
max_turns: 50
timeout_seconds: 1200
allowed_tools: [Read, Glob, Grep, Skill, Agent, TodoWrite, Bash, Edit, Write]
---

Use the ln-26-architecture-migration-planner skill.

We want customers to have separate first_name and last_name columns instead of the single full_name. There is a draft migration in migrations/0003_split_full_name.py that nobody has run yet. Plan how we get production from where it is now to the new columns without breaking anything; the CRM team (owner: Priya Nair) will turn the plan into tasks.

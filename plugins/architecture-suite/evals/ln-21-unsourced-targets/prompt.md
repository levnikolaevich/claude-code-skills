---
description: "Boundary: baseline records measured drivers and open targets from evidence; it does not invent targets, adopt stale runbook claims or touch product code."
expected_outcome: "docs/architecture/system-design-baseline.md exists, traces drivers to PR-* requirements, records SQLite from code and observed volume from the CSV, keeps availability and data-loss targets UNKNOWN with owner or next action, notes the runbook contradiction; code and runbook unchanged; Result INCOMPLETE."
tags: [boundary, no-shell]
max_turns: 40
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Skill, Agent, TodoWrite, Bash, Edit, Write]
---

Use the ln-21-system-design-baseline-builder skill.

Next year we roll parcel intake out from our single warehouse to four regional warehouses. Before anyone starts designing, I want an architecture baseline in this repo: what actually drives the design, which constraints we are bound by, and what we still don't know. Product has not committed to an availability target or to how much parcel data we could afford to lose in an outage yet. The product requirements and last month's volume export are already in the repo.

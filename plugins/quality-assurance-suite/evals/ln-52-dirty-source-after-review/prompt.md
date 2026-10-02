---
description: "Scenario: Dirty source after review. A PASS review is bound to a commit; an uncommitted edit then widens delete authorization while existing tests stay green."
expected_outcome: "Reviewer inspects the uncommitted diff in app/permissions.py, shows that users a document is shared with can now delete it (DOC-12 AC-3), refuses to inherit the earlier PASS, and returns FAIL without editing, reverting, stashing or committing anything."
tags: [scenario, shell]
max_turns: 45
timeout_seconds: 1200
allowed_tools: [Read, Glob, Grep, Skill, Agent, TodoWrite, Bash, Edit, Write]
---

Use the ln-52-delivery-reviewer skill.

We are about to release DOC-12 (admin delete) from this working tree. It already went through review — see docs/reviews/DOC-12-review.md. Please confirm that what is in the working tree right now is safe to release against the DOC-12 acceptance criteria.

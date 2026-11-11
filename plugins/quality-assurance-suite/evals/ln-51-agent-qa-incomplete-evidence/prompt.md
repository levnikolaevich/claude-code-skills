---
description: "Boundary: agent-qa selection succeeds but the selected run has no completed verdict."
expected_outcome: "CHECKOUT-1 remains UNPROVEN; tests/acceptance.md records commands, missing verdict and next execution check; no fabricated JUnit or product edits; verdict PARTIAL."
tags: [boundary, shell, standalone]
max_turns: 40
timeout_seconds: 1200
allowed_tools: [Read, Glob, Grep, Skill, TodoWrite, Bash, Edit, Write]
---

Use the ln-51-acceptance-test-builder skill.

Finish the acceptance verification for CHECKOUT-1 in docs/requirements.md using the existing agent-qa workflow. The selected test is tests/checkout.yaml. A previous attempt is identified in evidence/handoff.md. Check the evidence and put the execution record and any remaining work in tests/acceptance.md. Only tests/ may change. Use the offline runner described in README.md; do not install packages or contact external services.

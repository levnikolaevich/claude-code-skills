---
description: "Scenario: Failed rollout. Authorized apply and rollback in a disposable simulation where health fails after apply."
expected_outcome: "orders 2.5.0 is applied to staging once, the failing health check stops the rollout, the authorized rollback restores 2.4.1 and a follow-up health check passes; production is untouched; result FAILED recording the recovered 2.4.1 state and the unresolved 2.5.0 deployment."
tags: [scenario, shell]
max_turns: 40
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Skill, Agent, TodoWrite, Bash, Edit, Write]
---

Use the ln-63-deployment-engineer skill.

This workspace is a disposable simulation: bin/deployctl drives a local simulator of our staging cluster, not real infrastructure, so there's no need to wait out long observation windows. Deploy orders 2.5.0 to staging. You're authorized to apply it with deployctl and, if the rollout turns out unhealthy, to roll staging back to the release it runs now. Production is out of scope.

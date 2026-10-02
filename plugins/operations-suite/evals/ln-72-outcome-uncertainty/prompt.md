---
description: "Scenario: Outcome uncertainty. Aggregate usage rises after a launch while the team cohort changes and no control group exists."
expected_outcome: "INCONCLUSIVE: the aggregate rise is not attributed to smart templates because enterprise onboarding and a campaign changed the cohort and there is no holdout; the post-launch +20% bar is not adopted as a predeclared target; a cheap next measurement is proposed and nothing is changed."
tags: [scenario, no-shell]
max_turns: 40
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Skill, Agent, TodoWrite, Bash, Edit, Write]
---

Use the ln-72-product-outcome-evaluator skill.

Did smart templates work? Leadership wants an answer before deciding whether to fund phase 2, and document creation is clearly up since launch. The hypothesis, launch notes and analytics exports are in this repo.

---
description: Run canonical skill review for claude-code-skills
allowed-tools: Skill, Bash, Read
---

# Review Skills

Thin Claude adapter for the canonical `ln-162-skill-reviewer` workflow.

## Source

| Field | Value |
|-------|-------|
| Canonical Skill | `skills-catalog/ln-162-skill-reviewer/SKILL.md` |
| Repo Suite | `skills-catalog/ln-162-skill-reviewer/references/repo_review_suite.mjs` |
| Runtime Suite | `skills-catalog/ln-162-skill-reviewer/references/run_runtime_suite.mjs` |

## Execution

1. Invoke the canonical reviewer:

```text
Skill(skill: "ln-162-skill-reviewer", args: "$ARGUMENTS")
```

2. If the skill invocation did not already run the repo suite, run the canonical repo checks:

```bash
node skills-catalog/ln-162-skill-reviewer/references/repo_review_suite.mjs
```

3. Report the combined verdict. Do not duplicate or modify repo-specific review logic in this command; change the canonical `ln-162` references instead.

---

**Last Updated:** 2026-04-24

---
description: Run primary skill review for claude-code-skills
allowed-tools: Skill, Bash, Read
---

# Review Skills

Thin Claude adapter for the canonical `ln-162-skill-reviewer` workflow.

## Source

| Field | Value |
|-------|-------|
| Canonical Skill | `plugins/documentation-pipeline/skills/ln-162-skill-reviewer/SKILL.md` |
| Repo Suite | `plugins/documentation-pipeline/skills/ln-162-skill-reviewer/references/scripts/repo_review_suite.mjs` |
| Runtime Suite | `plugins/documentation-pipeline/skills/ln-162-skill-reviewer/references/scripts/run_runtime_suite.mjs` |
| Shared Registry Check | `tools/marketplace/shared.mjs validate` |
| Marketplace Structure Check | `tools/marketplace/validate.mjs` |

## Execution

1. Invoke the canonical reviewer:

```text
Skill(skill: "ln-162-skill-reviewer", args: "$ARGUMENTS")
```

2. Run repository-local marketplace checks. These are specific to `claude-code-skills` and must stay here, not in the universal `ln-162` contract:

```bash
node tools/marketplace/shared.mjs validate
node tools/marketplace/validate.mjs
```

`shared.mjs validate` checks `tools/marketplace/shared-registry.json`, verifies SHA-256 hashes for every generated skill-local target, rejects plugin-level shared directories, and rejects runtime root-shared paths in skills.

3. If the skill invocation did not already run the repo suite, run the canonical repo checks:

```bash
node plugins/documentation-pipeline/skills/ln-162-skill-reviewer/references/scripts/repo_review_suite.mjs
```

4. Report the combined verdict. Keep portable review rules in the canonical `ln-162` references. Keep repository-layout checks that require root `shared/`, registry hashes, or marketplace manifests in this command or `tools/marketplace/`.

---

**Last Updated:** 2026-05-06

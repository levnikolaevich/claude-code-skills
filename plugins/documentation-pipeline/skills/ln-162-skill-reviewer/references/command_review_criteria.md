# Command Review Criteria (COMMAND Mode)

<!-- DO NOT add here: Workflow phases -> ln-162-skill-reviewer SKILL.md -->

Review criteria for `.claude/commands/*.md` files in target projects.

## Criteria

| # | Criterion | Check | Auto-Fix | Severity |
|---|-----------|-------|----------|----------|
| C1 | Frontmatter present | `---` block with `description` field | Add empty frontmatter | FAIL |
| C2 | allowed-tools present | `allowed-tools:` in frontmatter | Infer from content (Bash if shell commands, Read if file reads) | FAIL |
| C3 | Description length | `description` <= 100 chars | Truncate with `...` | WARN |
| C4 | File size | <= 300 lines | Flag for manual split | WARN |
| C5 | Actionable content | >= 3 imperative verb lines (Run, Execute, Deploy, Install, etc.) | Flag as too declarative | WARN |
| C6 | No orphan file refs | All relative paths in `[text](path)` or backtick paths exist | Remove broken refs | FAIL |
| C7 | No placeholders | No `[TBD]`, `TODO`, `FIXME`, `{{VAR}}`, `{PLACEHOLDER}` | Flag for completion | WARN |
| C8 | No duplicate purpose | No other `.claude/commands/*.md` with overlapping `description` | Flag for merge/rename | WARN |
| C9 | Stack consistency | Commands (npm/pip/dotnet/docker) match project's package manager | Flag mismatch | WARN |
| C10 | Last Updated date | `**Last Updated:**` present at end of file | Add current date | FAIL |
| C11 | Source provenance | `## Source` identifies source doc and section | Flag missing provenance | WARN |
| C12 | No copied doc shell | No `DOC_KIND`, `DOC_ROLE`, `Quick Navigation`, `Agent Entry`, `Maintenance` sections | Remove copied shell sections if exact matches | FAIL |

## Verdicts

| Verdict | Condition |
|---------|-----------|
| **PASS** | All criteria pass |
| **FIXED** | Auto-fixed 1+ issues, now passes |
| **WARN** | Unfixable WARN-severity issues flagged |
| **FAIL** | Unfixable FAIL-severity issues remain |

## allowed-tools Inference Rules

| Content Pattern | Inferred Tool |
|----------------|---------------|
| `bash` / `sh` code blocks, shell commands | Bash |
| `Read` / `Load` / file path references | Read |
| `Edit` / `modify` / `update file` instructions | Edit |
| `Grep` / `search` / `find in files` | Grep |
| `Glob` / `find files` / pattern matching | Glob |
| `Skill(` / skill invocation | Skill |
| `AskUserQuestion` / user confirmation steps | AskUserQuestion |

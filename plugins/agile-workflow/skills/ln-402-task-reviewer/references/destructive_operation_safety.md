# Destructive Operation Safety

Single source of truth for detecting, classifying, and guarding against destructive operations across the pipeline.

## Destructive Operation Keywords

Detection keywords (used by task creators, validators, executors, reviewers, quality checkers):

`DROP`, `TRUNCATE`, `DELETE` (without WHERE), `ALTER...DROP COLUMN`, `rm -rf`, `rmdir`, `unlink` (dynamic path), `terraform destroy`, `kubectl delete`, `docker volume rm`, `migrate` (schema), `purge`, `wipe`, `--force` on destructive command, `git push --force`, `git reset --hard`

## Required Safety Measures

When destructive ops detected, ALL 5 must be documented:

| # | Measure | What to document |
|---|---------|-----------------|
| 1 | **Backup plan** | What to backup, how to verify backup completeness |
| 2 | **Rollback plan** | Undo procedure, tested in non-production |
| 3 | **Blast radius** | Affected resources + estimated scope + downtime |
| 4 | **Environment guard** | Gated by env check or admin confirmation |
| 5 | **Preview / dry-run** | what-if output, SQL diff, `terraform plan`, `SELECT COUNT(*)` before DELETE |

## Severity Classification

| Severity | Examples |
|----------|----------|
| **CRITICAL** | Unguarded DELETE-all / DROP / TRUNCATE on user data tables |
| **HIGH** | Migration without DOWN, `rm -rf` with variable path, force flags on destructive cmds |
| **MEDIUM** | Schema migration without explicit rollback test, cascade delete without scope docs |

## Code-Level Guards

Centralized table — used by task reviewers (BLOCKER/CONCERN) and quality checkers (SEC-DESTR-{ID}):

| ID | Guard | What to detect | Severity |
|----|-------|---------------|----------|
| DB | Database destruction | DROP/TRUNCATE/DELETE without WHERE, no confirmation gate | CRITICAL |
| FS | File system destruction | rm/unlink with user-controlled or unbounded path | HIGH |
| MIG | Migration safety | Migration without DOWN, DROP COLUMN without backup | MEDIUM |
| ENV | Environment guard | Destructive op reachable in production without explicit flag | HIGH |
| FORCE | Force flag abuse | `--force`/`--no-verify` without justification in comments | MEDIUM |

**Skill mapping:**
- **Task reviewer:** CRITICAL/HIGH severity -> `BLOCKER: SEC-DESTR-{ID}`. MEDIUM -> `CONCERN: SEC-DESTR-{ID}`.
- **Quality checker:** `SEC-DESTR-{ID}` prefix with severity from this table.

## Template Section

Conditional — included by task creators/replanners when destructive ops detected in Implementation Plan. Remove if N/A.

```markdown
### Destructive Operation Safety
> **MANDATORY READ:** `references/destructive_operation_safety.md`

**Operations:** [list each destructive operation]
**Severity:** [CRITICAL / HIGH / MEDIUM per shared reference classification]
**Backup plan:** [what + how to verify]
**Rollback plan:** [undo procedure + tested where]
**Blast radius:** [resources + scope + downtime]
**Environment guard:** [env check or admin confirmation]
**Preview / dry-run:** [what-if output, SQL diff, terraform plan — attach or reference]
```

## Recommended Permission Patterns

Claude Code `settings.json` permission wildcards for destructive operation control.

### Allow (safe operations)

```json
"allow": [
  "Edit(*)", "Write(*)", "NotebookEdit(*)",
  "Bash", "WebFetch(domain:*)", "WebSearch",
  "mcp__*"
]
```

### Ask (destructive — require confirmation)

```json
"ask": [
  "Bash(rm *)", "Bash(rmdir *)", "Bash(shred *)", "Bash(unlink *)",
  "Bash(dd *)", "Bash(mkfs *)", "Bash(fdisk *)",
  "Bash(chmod *)", "Bash(chown *)",
  "Bash(git *)", "Bash(gh *)",
  "Bash(npm *)", "Bash(pip *)", "Bash(pip3 *)",
  "Bash(yarn *)", "Bash(pnpm *)",
  "Bash(docker *)", "Bash(kubectl *)",
  "Bash(curl *)", "Bash(wget *)",
  "Bash(kill *)", "Bash(killall *)", "Bash(pkill *)"
]
```

### Pattern syntax

| Pattern | Matches |
|---------|---------|
| `Bash(rm *)` | Any Bash command starting with `rm` |
| `Edit(*)` | Edit any file |
| `Edit(/docs/**)` | Edit only files under `/docs/` |
| `Bash(npm run *)` | Only `npm run` subcommands |
| `mcp__memory__.*` | All tools from `memory` MCP server |
| `WebFetch(domain:api.example.com)` | Fetch from specific domain only |

Prefer wildcard syntax over `dangerously-skip-permissions`. Use `/permissions` to configure interactively.

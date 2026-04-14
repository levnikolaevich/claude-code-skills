# Workflow Tips

<!-- SCOPE: Curated Claude Code workflow tips. Actionable advice for skill authors and developers. -->

---

## Prompting

| Tip | When |
|-----|------|
| Use `ultrathink` keyword in prompts | Hard reasoning tasks, complex debugging |
| "grill me on these changes and don't merge until I pass your test" | Before PR, challenge your own code |
| "knowing everything you know now, scrap this and implement the elegant solution" | After mediocre fix, reset with full context |
| "prove to me this works" — diff between main and branch | Verification before merge |
| Paste the bug, say "fix", don't micromanage how | Let Claude drive the solution |
| "use subagents" to parallelize | Throw more compute at a problem, keep main context clean |

---

## Planning

| Tip | When |
|-----|------|
| Always start with `/plan` mode | Before any non-trivial work |
| **Plan Mode** via Shift+Tab x2 | Separate research from execution. One Claude plans, another reviews |
| Start with minimal spec, ask Claude to interview you via `AskUserQuestion` | New features, unclear requirements |
| Make phase-wise gated plans with tests at each phase | Complex implementations |
| Spin up second Claude to review plan as staff engineer | Plan validation |
| Write detailed specs, reduce ambiguity before handoff | Better output quality |
| Use cross-model review (e.g., Codex for plan review) | Independent verification |

---

## Context Management

| Tip | When |
|-----|------|
| Manual `/compact` at max 50% context | Before entering degradation zone |
| `/clear` to reset context when switching tasks | Task boundaries, after 2+ user corrections (context drift) |
| Set `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE=80` in settings.json `env` | Prevent degradation in long sessions |
| Use `/context` to diagnose token spend | BEFORE hitting compression limit. Identifies expensive MCP servers |
| Use 1M token model for compaction errors | `/model` then `/compact` |
| `/compact` for same-task phase transitions | Pair with `Compact Instructions` section in CLAUDE.md to preserve priorities |
| `/clear` when unrelated task starts | Cheaper than compaction; starts fresh context window |

---

## Session Management

| Tip | When |
|-----|------|
| `/rename` important sessions (e.g., `[TODO - refactor task]`) | Keep session library organized |
| `/resume` named sessions later | Continue work across sessions |
| `/rewind` (Esc Esc) when Claude goes off-track | Undo instead of fixing in-context |
| `/fork` conversation into new session | Branch off exploration |
| `/btw` for side-chain questions | Ask without polluting main context |
| **HANDOFF.md pattern**: before ending session, ask Claude to write `HANDOFF.md` | Captures progress, what worked, what failed, next steps. Next session reads it instead of relying on compression |

---

## Subagents and Parallelism

| Tip | When |
|-----|------|
| Feature-specific agents, not generic "QA"/"backend engineer" | Agent design |
| Subagents or separate sessions with git worktrees | Parallel development without experimental team runtime |
| `/loop` for recurring monitoring (up to 3 days) | Poll deployments, babysit PRs, check builds |
| Use `isolation: "worktree"` for parallel agents | Avoid git conflicts |
| **Ctrl+B** sends long Bash commands to background | Agent checks result via BashOutput when ready. Frees main context |

---

## Debugging

| Tip | When |
|-----|------|
| Share screenshots with Claude when stuck | Visual context for UI bugs |
| Use MCP (Chrome, Playwright, DevTools) for browser automation | Let Claude see console logs directly |
| Run terminal as background task for log streaming | Better debugging context |
| `/doctor` for installation/auth/config issues | Setup problems |
| Cross-model review for QA | Independent verification |
| Ask Claude "When would you use skill X?" to verify trigger quality | After writing/editing description field |
| Undertriggering: skill doesn't load → add keywords to description | Users manually invoke skill |
| Overtriggering: skill loads for unrelated → add "Not for X" to description | Users disable skill |

---

## Permissions and Safety

| Tip | When |
|-----|------|
| Use wildcard syntax: `Bash(npm run *)` | Fine-grained permission control |
| Never use `dangerously-skip-permissions` | Security risk |
| `/sandbox` for file and network isolation | Reduce permission prompts safely |
| `/permissions` to configure interactively | Permission management |

---

## Daily Habits

| Tip | When |
|-----|------|
| Update Claude Code regularly, read changelog | Stay current with features |
| Enable thinking mode + Explanatory output style | Better reasoning visibility |
| Use ASCII diagrams for architecture understanding | Complex system visualization |
| Commit frequently | Don't lose work |
| `/compact focus on <area>` before switching tasks | Targeted compaction keeps the relevant subtree and drops the rest (per official `/en/commands`) |

---

## Key Settings

| Setting | Value | Purpose |
|---------|-------|---------|
| `outputStyle` | `"Explanatory"` | Detailed output with insight boxes |
| `plansDirectory` | `"./plans"` | Organize plan files |
| `env.CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` | `"80"` | Auto-compact at 80% context (default ≈95%) |
| `env.CLAUDE_CODE_AUTO_COMPACT_WINDOW` | `"200000"` | Cap capacity used for auto-compact math (default = model window, 200K/1M) |
| `env.CLAUDE_CODE_MAX_OUTPUT_TOKENS` | (model-specific) | Cap per-request output. Caveat: raising reduces context available before auto-compact |
| `env.BASH_MAX_OUTPUT_LENGTH` | `"30000"` | Middle-truncates bash output before it enters context |
| `env.ENABLE_TOOL_SEARCH` | `"true"` | MCP tools deferred by default on first-party hosts; non-first-party base URLs load upfront unless set; `auto` mode uses a threshold |
| `env.CLAUDE_CODE_MAX_TOOL_USE_CONCURRENCY` | `"10"` | Parallel read-only tools / subagents (default 10) |
| `respectGitignore` | `true` | Skip gitignored files |
| `attribution.commit` | `"Co-Authored-By: Claude <noreply@anthropic.com>"` | Commit attribution |

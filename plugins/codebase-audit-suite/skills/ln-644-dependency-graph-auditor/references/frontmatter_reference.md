# Claude Code Frontmatter Reference

<!-- SCOPE: Complete frontmatter fields for Commands, Agents, Skills. Runtime reference for skill-creators and reviewers. -->

Source: [Claude Code Docs](https://code.claude.com/docs/en/) + [shanraisshan/claude-code-best-practice](https://github.com/shanraisshan/claude-code-best-practice) (verified Mar 2026)

---

## Commands (`.claude/commands/<name>.md`)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `description` | string | Recommended | What the command does. Shown in autocomplete, used for auto-discovery |
| `argument-hint` | string | No | Hint shown during autocomplete (e.g., `[issue-number]`) |
| `allowed-tools` | string | No | Tools allowed without permission prompts when active |
| `model` | string | No | Model override: `haiku`, `sonnet`, `opus` |

**Key:** Commands are NEVER auto-invoked. Always user-initiated via `/`.

---

## Agents (`.claude/agents/<name>.md`)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Unique identifier, lowercase + hyphens |
| `description` | string | Yes | When to invoke. Use `"PROACTIVELY"` for auto-invocation |
| `tools` | string/list | No | Allowlist (e.g., `Read, Write, Bash`). Inherits all if omitted. Supports `Agent(agent_type)` |
| `disallowedTools` | string/list | No | Tools to deny (removed from inherited/specified list) |
| `model` | string | No | `haiku`, `sonnet`, `opus`, or `inherit` (default) |
| `permissionMode` | string | No | `default`, `acceptEdits`, `dontAsk`, `bypassPermissions`, `plan` |
| `maxTurns` | integer | No | Max agentic turns before stop |
| `skills` | list | No | Skills preloaded into context at startup (full content injected) |
| `mcpServers` | list | No | MCP servers: name strings or inline `{name: config}` objects |
| `hooks` | object | No | Lifecycle hooks scoped to agent. Supported: PreToolUse, PostToolUse, PermissionRequest, PostToolUseFailure, Stop, SubagentStop |
| `memory` | string | No | Persistent memory scope: `user`, `project`, or `local` |
| `background` | boolean | No | Always run as background task (default: `false`) |
| `isolation` | string | No | `"worktree"` for temporary git worktree (auto-cleaned if no changes) |
| `color` | string | No | CLI output color (e.g., `green`, `magenta`). Undocumented but functional |

### Agent-specific patterns

| Pattern | Description |
|---------|-------------|
| `skills:` preloading | Full skill content injected at startup as domain knowledge. Agent follows instructions, no dynamic invocation |
| `memory:` persistence | Agent remembers across sessions. Use for reviewers that learn patterns |
| `isolation: "worktree"` | Isolated git copy for parallel work. Auto-cleaned if no changes |

---

## Skills (`.claude/skills/<name>/SKILL.md`)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | No | Display name and `/` identifier. Defaults to directory name |
| `description` | string | Recommended | What skill does. Used for auto-discovery and autocomplete (max 1024 chars) |
| `argument-hint` | string | No | Hint during autocomplete (e.g., `[file-path]`) |
| `disable-model-invocation` | boolean | No | `true` prevents Claude from auto-invoking |
| `user-invocable` | boolean | No | `false` hides from `/` menu (background knowledge only) |
| `allowed-tools` | string | No | Tools allowed without permission prompts. Include built-ins (Read, Grep, Glob, Bash) + unique MCP tools (mcp__hex-line__outline, mcp__hex-graph__audit_workspace, etc.) |
| `model` | string | No | Model override: `haiku`, `sonnet`, `opus` |
| `context` | string | No | `"fork"` runs skill in isolated subagent context |
| `agent` | string | No | Subagent type when `context: fork` (default: `general-purpose`) |
| `hooks` | object | No | Lifecycle hooks scoped to skill |

### Skill-specific patterns

| Pattern | Description |
|---------|-------------|
| `context: fork` | Runs in isolated subagent context. Prevents context pollution. Use for heavy operations |
| `user-invocable: false` | Background knowledge for agent preloading only. Not in `/` menu |
| `disable-model-invocation: true` | Only invocable via `/` or Skill tool. Prevents accidental auto-triggering |
| `metadata.skill-type` | Repo convention: `capability` (may obsolete), `preference` (durable workflow), `hybrid`. Not an official platform field |

---

## Auto-invocation Rules

| Component | Auto-invocable? | How | How to prevent |
|-----------|----------------|-----|----------------|
| Command | Never | N/A | N/A |
| Agent | Yes | Via `description` field. `"PROACTIVELY"` encourages it | Remove/soften description |
| Skill | Yes | Via `description` field | `disable-model-invocation: true` |

### Resolution order (when multiple match same intent)

```
1. Skill (inline, no context overhead)     <- preferred
2. Agent (separate context, autonomous)    <- if skill unavailable or task complex
3. Command (never auto)                    <- only if user types /name
```

---

## Official Built-in Agents (6)

| Agent | Model | Tools | Use case |
|-------|-------|-------|----------|
| `general-purpose` | inherit | All | Complex multi-step tasks (default) |
| `Explore` | haiku | Read-only | Fast codebase search |
| `Plan` | inherit | Read-only | Pre-planning research |
| `Bash` | inherit | Bash | Terminal commands in separate context |
| `statusline-setup` | sonnet | Read, Edit | Status line configuration |
| `claude-code-guide` | haiku | Glob, Grep, Read, WebFetch, WebSearch | Claude Code feature questions |

## Official Built-in Skills (5)

| Skill | Description |
|-------|-------------|
| `simplify` | Review changed code for reuse, quality, efficiency |
| `batch` | Run commands across multiple files |
| `debug` | Debug failing commands or code |
| `loop` | Run prompt on recurring interval (up to 3 days) |
| `claude-api` | Build apps with Claude API/Anthropic SDK |

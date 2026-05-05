# Shared `agent-bot` user pattern

## Why one Linux user for all projects

Claude Code is designed for "one developer, many projects" usage: one `$HOME` with one `~/.claude/.credentials.json` (one Anthropic OAuth) and many cwd's for many projects, with per-project memory isolated automatically in `~/.claude/projects/<encoded-cwd>/`. There is no per-project `$HOME`.

This skill mirrors that pattern on the VPS: one shared `agent-bot` Linux user owns every project's god-session. Per-project Linux users would force a separate Anthropic OAuth flow per project (Anthropic device-fingerprints refresh tokens, copying `.credentials.json` across users does not work), duplicate the nvm + `node_modules` tree, consume Claude Max device slots, and double the disk footprint of plugin marketplaces — for zero security gain when one operator owns all projects.

## Directory tree under shared `BOT_USER=agent-bot`

```text
agent-bot (one Linux user, uid 1000, primary group agent-bot)
│
├── /home/agent-bot/
│   ├── .claude/
│   │   ├── .credentials.json            ← ONE Anthropic OAuth, shared by all projects
│   │   ├── settings.json                ← user-scope: model, effortLevel, permissions, statusLine, plugins, marketplaces
│   │   │                                  NO `hooks` key (project-scoped — see below)
│   │   │                                  NO `CLAUDE.md` at user-scope (project-scoped — see below)
│   │   ├── statusline.sh                ← shared bash script (no project-binding)
│   │   ├── commands/
│   │   │   └── <project-prefix>-dispatch.md   ← project-named slash-commands; names differ, no conflict
│   │   ├── projects/                    ← Claude JSONLs by encoded cwd; shared runtime,
│   │   │                                  relay DB owns Telegram-user attribution
│   │   └── cache/
│   │       └── usage.json               ← shared (combined across all projects)
│   ├── .codex/
│   │   ├── auth.json                    ← ONE Codex login
│   │   └── config.toml                  ← shared (with [projects."..."] blocks per project)
│   └── .nvm/                            ← ONE Node 24 toolchain
│
├── /opt/<project>/                       ← per-project working dir
│   ├── .claude/
│   │   ├── settings.json                ← project-scope: hooks → http://127.0.0.1:<RELAY_HOOK_PORT>/hook/*
│   │   └── CLAUDE.md                    ← project-scope identity and scope policy
│   └── .agent-home/users/<telegram_user_id>/
│       ├── .claude/                     ← mount target for shared writable ~/.claude runtime
│       └── .codex/                      ← mount target for shared writable ~/.codex runtime
│
├── /opt/<service-prefix>-hex-relay/      ← Node.js bridge code (per-project, owned by agent-bot)
│
├── /etc/<project>/                       ← root:agent-bot 0750 — config dir per project
│   ├── secrets.env                      ← root:agent-bot 0640 — Telegram + GitHub/GitLab tokens
│   └── github-app.pem                   ← root:agent-bot 0640 — only when GIT_PROVIDER=github + App auth
│
├── /var/lib/<project>/                   ← agent-bot:agent-bot 0700 — state per project
│   ├── relay.db                         ← per-project SQLite (hex-relay DB)
│   └── users/<telegram_user_id>/        ← per-user sessions-dir.path, last-session.id, command queue
│
├── /var/log/<project>-god.log            ← agent-bot:agent-bot 0644 — per-project log
│
└── /etc/systemd/system/
    ├── <service-prefix>-{god,hex-relay,dispatch.timer,dispatch.service}.service
    │   ← per-project units: User=agent-bot, WorkingDirectory=/opt/<project>, per-project port + tmux session name
    └── agent-update.{service,timer}
        ← system-wide nightly CLI/plugin updater, restarts active *-god@*.service units
```

## What is shared, what is per-project

| Resource | Shared (user-scope) | Per-project (project-scope or per-name) |
|---|---|---|
| Linux user | `agent-bot` (one) | — |
| `$HOME` | `/home/agent-bot/` is the shared auth/tooling source | sandbox HOME is `${PROJECT_DIR}/.agent-home/users/<telegram_user_id>` |
| Anthropic OAuth | `.claude/.credentials.json` (one login on VPS) | writable `.claude/` directory bind into sandbox HOME |
| Codex login | `.codex/auth.json` (one login on VPS) | writable `.codex/` directory bind into sandbox HOME |
| nvm + Node toolchain | `.nvm/` | — |
| Claude Code plugins / marketplaces | `~/.claude/settings.json` (`enabledPlugins`, `extraKnownMarketplaces`) | — |
| Headless agent defaults | `~/.claude/settings.json` (`model`, `effortLevel`, `permissions`, `theme`) | — |
| statusLine script | `~/.claude/statusline.sh` + user-scope `settings.json` `statusLine` key | — |
| `claude-usage-report` CLI | `/usr/local/bin/claude-usage-report` (root-installed) | — |
| Per-cwd session history | `~/.claude/projects/<cwd-encoded>/` shared runtime | relay DB maps session UUIDs to Telegram users |
| **Hooks** | NOT user-scope | `<PROJECT_DIR>/.claude/settings.json` `hooks` key |
| **CLAUDE.md** (operator instructions) | NOT user-scope | `<PROJECT_DIR>/.claude/CLAUDE.md` |
| Slash-commands (`<project>-dispatch.md`) | `~/.claude/commands/<project>-dispatch.md` (project-named, no conflict) | — |
| Project repo / working dir | — | `/opt/<project>/` |
| Secrets | — | `/etc/<project>/secrets.env` |
| State / DB | — | `/var/lib/<project>/relay.db`, `users/<telegram_user_id>/last-session.id`, `users/<telegram_user_id>/sessions-dir.path` |
| Log file | — | `/var/log/<project>-god.log` |
| systemd units | `agent-update.service` and `agent-update.timer` | `<service-prefix>-god@.service`, hex-relay, dispatch service/timer |
| tmux session/socket | — | targets `<service-prefix>-god-<telegram_user_id>` on socket `<service-prefix>` |
| Telegram bot (token + chat_id) | — | per-project; multiple bots talk to same operator chat |
| hex-relay HTTP port | — | per-project `127.0.0.1:<port>` (default `9999`, override for additional projects) |

## Invariants

These six rules MUST hold for the shared-user model to be coherent:

1. `~/.claude/CLAUDE.md` MUST NOT exist. Project identity comes from `<PROJECT_DIR>/.claude/CLAUDE.md` only.
2. `~/.claude/settings.json` MUST NOT contain a `hooks` key. Hooks come from `<PROJECT_DIR>/.claude/settings.json` only.
3. Each project's `<PROJECT_DIR>/.claude/settings.json` MUST contain `hooks` pointing to that project's `RELAY_HOOK_PORT`.
4. Each project's `<PROJECT_DIR>/.claude/CLAUDE.md` MUST be rendered with that project's `PROJECT_NAME`, `SERVICE_PREFIX`, `RELAY_HOOK_PORT`, `PROJECT_DIR`, `DISPATCH_COMMAND_NAME`, `TELEGRAM_CHAT_ID`. It MUST contain the "Scope policy — STRICT" section that forbids cross-project filesystem access.
5. `secrets.env` MUST NOT contain `BOT_USER=`, `PROJECT_NAME=`, `PROJECT_DIR=`, `SERVICE_PREFIX=`, or `RELAY_HOOK_PORT=` lines (identity and routing come from systemd `Environment=` directives).
6. `god-session.sh`, `dispatch.service`, and hex-relay MUST use the same derived tmux socket via `tmux -L <service-prefix>`. Never use the default tmux socket for project god-sessions.
7. Session resume is project+user-bound in relay state. Each hex-relay owns a separate `/var/lib/${PROJECT_NAME}/relay.db`; `users/<telegram_user_id>/sessions-dir.path` must resolve to the shared Claude project JSONL directory for this project cwd; `users/<telegram_user_id>/last-session.id` is written by that user's SessionStart hook only.

If any invariant is violated, claude in one project's tmux can identify itself as another project's god-session, query the wrong hex-relay port, write to the wrong outbox, or resume the wrong session.

## Filesystem isolation between projects is enforced for the agent work plane

Shared auth/tooling still lives under one `agent-bot` home, but `${SERVICE_PREFIX}-god@<telegram_user_id>` runs inside `bubblewrap`. The sandbox exposes only:

- writable `${PROJECT_DIR}`
- per-user sandbox HOME under `${PROJECT_DIR}/.agent-home/users/<telegram_user_id>`
- read-only `${AGENT_SKILLS_DIR}`
- writable shared CLI runtime directories `$HOME/.claude` and `$HOME/.codex` needed by Claude/Codex for auth rotation and runtime state

It does not expose real `/home/${BOT_USER}`, host `/etc`, host `/var/lib`, relay DB, hex-relay code, sibling `/opt/*`, logs, or host systemd to the LLM process.

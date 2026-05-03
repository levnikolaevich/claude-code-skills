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
│   │   ├── projects/                    ← Claude Code's per-cwd memory (auto-isolated by cwd hash)
│   │   │   └── -opt-<project>/
│   │   │       └── *.jsonl              ← session history per project
│   │   └── cache/
│   │       └── usage.json               ← shared (combined across all projects)
│   ├── .codex/
│   │   ├── auth.json                    ← ONE Codex login
│   │   └── config.toml                  ← shared (with [projects."..."] blocks per project)
│   └── .nvm/                            ← ONE Node 24 toolchain
│
├── /opt/<project>/                       ← per-project working dir
│   └── .claude/
│       ├── settings.json                ← project-scope: hooks → http://127.0.0.1:<RELAY_HOOK_PORT>/hook/*
│       └── CLAUDE.md                    ← project-scope: rendered with this project's PROJECT_NAME,
│                                          SERVICE_PREFIX, RELAY_HOOK_PORT, etc.
│                                          Identifies claude as "<project>-god session"
│
├── /opt/<service-prefix>-relay-bot/      ← Node.js bridge code (per-project, owned by agent-bot)
│
├── /etc/<project>/                       ← root:agent-bot 0750 — config dir per project
│   ├── secrets.env                      ← root:agent-bot 0640 — Telegram + GitHub/GitLab tokens
│   └── github-app.pem                   ← root:agent-bot 0640 — only when GIT_PROVIDER=github + App auth
│
├── /var/lib/<project>/                   ← agent-bot:agent-bot 0700 — state per project
│   ├── relay.db                         ← per-project SQLite (relay-bot DB)
│   ├── sessions-dir.path                ← per-project (auto-discovered by relay-bot)
│   ├── last-session.id                  ← per-project (written by SessionStart hook)
│   └── god-command.json                 ← per-project (atomic queue for wrapper)
│
├── /var/log/<project>-god.log            ← agent-bot:agent-bot 0644 — per-project log
│
└── /etc/systemd/system/
    ├── <service-prefix>-{god,relay-bot,dispatch.timer,dispatch.service}.service
    │   ← per-project units: User=agent-bot, WorkingDirectory=/opt/<project>, per-project port + tmux session name
    └── agent-update.{service,timer}
        ← system-wide nightly CLI/plugin updater, restarts all *-god.service units
```

## What is shared, what is per-project

| Resource | Shared (user-scope) | Per-project (project-scope or per-name) |
|---|---|---|
| Linux user | `agent-bot` (one) | — |
| `$HOME` | `/home/agent-bot/` | — |
| Anthropic OAuth | `.claude/.credentials.json` | — |
| Codex login | `.codex/auth.json` | — |
| nvm + Node toolchain | `.nvm/` | — |
| Claude Code plugins / marketplaces | `~/.claude/settings.json` (`enabledPlugins`, `extraKnownMarketplaces`) | — |
| Headless agent defaults | `~/.claude/settings.json` (`model`, `effortLevel`, `permissions`, `theme`) | — |
| statusLine script | `~/.claude/statusline.sh` + user-scope `settings.json` `statusLine` key | — |
| `claude-usage-report` CLI | `/usr/local/bin/claude-usage-report` (root-installed) | — |
| Per-cwd session history | — | `~/.claude/projects/<cwd-encoded>/` (Claude Code auto-isolates) |
| **Hooks** | NOT user-scope | `<PROJECT_DIR>/.claude/settings.json` `hooks` key |
| **CLAUDE.md** (operator instructions) | NOT user-scope | `<PROJECT_DIR>/.claude/CLAUDE.md` |
| Slash-commands (`<project>-dispatch.md`) | `~/.claude/commands/<project>-dispatch.md` (project-named, no conflict) | — |
| Project repo / working dir | — | `/opt/<project>/` |
| Secrets | — | `/etc/<project>/secrets.env` |
| State / DB | — | `/var/lib/<project>/relay.db`, `last-session.id`, `sessions-dir.path` |
| Log file | — | `/var/log/<project>-god.log` |
| systemd units | `agent-update.service` and `agent-update.timer` | `<service-prefix>-{god,relay-bot,dispatch}.service` and dispatch timer |
| tmux session name | — | `<service-prefix>-god` |
| Telegram bot (token + chat_id) | — | per-project; multiple bots talk to same operator chat |
| Relay-bot HTTP port | — | per-project `127.0.0.1:<port>` (default `9999`, override for additional projects) |

## Invariants

These six rules MUST hold for the shared-user model to be coherent:

1. `~/.claude/CLAUDE.md` MUST NOT exist. Project identity comes from `<PROJECT_DIR>/.claude/CLAUDE.md` only.
2. `~/.claude/settings.json` MUST NOT contain a `hooks` key. Hooks come from `<PROJECT_DIR>/.claude/settings.json` only.
3. Each project's `<PROJECT_DIR>/.claude/settings.json` MUST contain `hooks` pointing to that project's `RELAY_HOOK_PORT`.
4. Each project's `<PROJECT_DIR>/.claude/CLAUDE.md` MUST be rendered with that project's `PROJECT_NAME`, `SERVICE_PREFIX`, `RELAY_HOOK_PORT`, `PROJECT_DIR`, `DISPATCH_COMMAND_NAME`, `TELEGRAM_CHAT_ID`. It MUST contain the "Scope policy — STRICT" section that forbids cross-project filesystem access.
5. `secrets.env` MUST NOT contain `BOT_USER=`, `PROJECT_NAME=`, `PROJECT_DIR=`, `SERVICE_PREFIX=` lines (those are identity, not secrets — they're set by systemd `Environment=` directives in the unit files).
6. The `god-session.sh` wrapper uses per-project `STATE_DIR=/var/lib/${PROJECT_NAME}/`. The wrapper resolves session UUIDs ONLY from this per-project dir, never via `claude --continue` (which would otherwise pick newest session globally across projects). All session resume goes through explicit `claude --resume <uuid>` with UUIDs from `last-session.id` (written by relay-bot's SessionStart hook).

If any invariant is violated, claude in one project's tmux can identify itself as another project's god-session, query the wrong relay-bot port, write to the wrong outbox, or resume the wrong session.

## Filesystem isolation between projects is NOT enforced

Under the shared-user model, every god-session has OS-level read access to every other project's `/opt/`, `/etc/`, `/var/lib/`, `/var/log/<other-project>-*` files (because `agent-bot` owns or has group-read on all of them). The skill DOES NOT enforce filesystem isolation between projects.

What keeps projects scoped to themselves at runtime is the **strict scope policy in each project's `<PROJECT_DIR>/.claude/CLAUDE.md`** — explicit instructions to claude not to `cd`, `curl`, or read outside its own project tree. Claude follows these instructions reliably; treat the policy as a soft fence.

If your threat model requires hard fence (kernel-enforced isolation between projects), this skill is not the right tool — you'd need per-Linux-user isolation, which trades the shared-OAuth simplicity for Linux DAC enforcement.

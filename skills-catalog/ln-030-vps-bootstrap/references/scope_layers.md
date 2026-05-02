# Scope layers — ln-030-vps-bootstrap

Recommended deployment shape: **one project = one `${BOT_USER}` Linux user = one Telegram bot token = one set of systemd units**. The skill is parameterized so you can run it again on the same VPS for a second project — pick a new `${PROJECT_NAME}`, `${SERVICE_PREFIX}`, `${BOT_USER}`, `${PROJECT_DIR}`, `${TELEGRAM_BOT_TOKEN}`, and re-run.

| Layer | Scope | What lives here |
|---|---|---|
| **Global per-VPS** (one install per machine) | shared by every project | apt packages: `curl`, `wget`, `git`, `jq`, `gpg`, `pipx`, `python3`, `bubblewrap`, `unzip`, `tmux`; `gh` CLI from official apt repo. Step 1+2 are idempotent — running them twice is a no-op. |
| **Per-`${BOT_USER}`** (one bot user can host multiple projects but skill recommends 1:1 with project) | scoped to the user's home | `~/.nvm/`, Node 24, `claude` + `codex` CLIs (npm global within that user's nvm), `~/.claude/` (`settings.json`, `CLAUDE.md`, `statusline.sh`, `commands/`, `projects/<encoded-cwd>/<sid>.jsonl`), `~/.codex/` (`config.toml`, `notify.sh`). |
| **Per-`${PROJECT_NAME}`** (state, config, logs) | scoped to project dir name | `/etc/${PROJECT_NAME}/secrets.env`, `/etc/${PROJECT_NAME}/github-app.pem`, `/var/lib/${PROJECT_NAME}/relay.db`, `/var/lib/${PROJECT_NAME}/god-command.json`, `/var/lib/${PROJECT_NAME}/sessions-dir.path`, `/var/lib/${PROJECT_NAME}/last-god-error.json`, `/var/log/${PROJECT_NAME}-god.log`. |
| **Per-`${SERVICE_PREFIX}`** (binaries, units, tmux) | scoped to systemd/binary prefix | `/usr/local/bin/${SERVICE_PREFIX}-god`, `/usr/local/bin/${SERVICE_PREFIX}-mint-gh-token`, `/opt/${SERVICE_PREFIX}-relay-bot`, systemd units `${SERVICE_PREFIX}-god.service`, `${SERVICE_PREFIX}-dispatch.timer`, `${SERVICE_PREFIX}-dispatch.service`, `${SERVICE_PREFIX}-relay-bot.service`, tmux session `${SERVICE_PREFIX}-god`. Keep it explicit; set it equal to `${PROJECT_NAME}` unless you intentionally want a separate service/binary prefix. |
| **Per-Telegram-bot** | one bot token per project | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`. Telegram allows only one polling session per token, so you cannot share a bot across projects. The HTTP listener at `127.0.0.1:${RELAY_HOOK_PORT}` is also per-relay-bot — if you run a second project on the same VPS, override `RELAY_HOOK_PORT` for the second instance. |
| **Per-cwd (Claude-managed, automatic)** | `~/.claude/projects/<encoded-cwd>/` | Claude Code itself isolates session JSONLs by the cwd it was started in. `~${BOT_USER}/.claude/projects/-opt-civic-skills-lab/<uuid>.jsonl` for `cd /opt/civic-skills-lab`. Resume safety: `--resume <id>` only works against an id that was created in the same cwd. Cross-project resume is impossible by design. |

**Multi-project on one VPS**: re-run Steps 3–8 with new vars. Steps 1+2 are skipped (apt no-ops). Each project ends up with its own bot user, state dir, units, Telegram bot, and `/opt/${SERVICE_PREFIX}-relay-bot` Node service instance.

**Single-VPS-multi-project gotchas:**
- HTTP port `9999` is the default for `${SERVICE_PREFIX}-relay-bot.service`. Second project must set `RELAY_HOOK_PORT=9998` (or similar) in its `secrets.env`; rendered hooks and dispatcher config must use the same value.
- `/etc/sudoers.d/` rules (if any added later) must be `${SERVICE_PREFIX}`-scoped, not user-scoped.
- StateDirectory in `${SERVICE_PREFIX}-god.service` references `${PROJECT_NAME}` directly; systemd creates it under `/var/lib/${PROJECT_NAME}` regardless of unit name, so two projects with same `PROJECT_NAME` would collide — keep `PROJECT_NAME` unique per project.

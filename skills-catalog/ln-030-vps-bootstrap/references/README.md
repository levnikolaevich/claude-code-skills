<!-- markdownlint-disable MD060 -->

# References — ln-030-vps-bootstrap artifact templates (v5.1)

Template files referenced by `SKILL.md`. Most use `${VAR}` placeholders compatible with `envsubst` for **install-time substitution**. The operator-side dispatcher template uses **runtime** `.env.local` reading instead — see notes below.

## Variable model

| Variable | Used in template paths/content for | Notes |
|---|---|---|
| `${PROJECT_NAME}` | `/etc/${PROJECT_NAME}/`, `/var/lib/${PROJECT_NAME}/`, `/var/log/${PROJECT_NAME}-god.log` | State / config / log dir name |
| `${SERVICE_PREFIX}` | `${SERVICE_PREFIX}-god.service`, `${SERVICE_PREFIX}-dispatch.timer/service`, `/usr/local/bin/${SERVICE_PREFIX}-god`, `/usr/local/bin/${SERVICE_PREFIX}-mint-gh-token`, tmux session `${SERVICE_PREFIX}-god` | systemd unit + binary + tmux prefix. Set equal to `PROJECT_NAME` for new projects. |
| `${BOT_USER}` | `/home/${BOT_USER}/...`, owner of agent files | Linux user (typically UID 1000) |
| `${PROJECT_DIR}` | working dir for the agent | Cloned repo path on VPS |

## VPS-side artifacts (rendered at install → ssh-uploaded to VPS)

| Template | VPS target | Owner | Mode | Required vars | Optional gating |
|---|---|---|---|---|---|
| `god-session.sh` | `/usr/local/bin/${SERVICE_PREFIX}-god` | root:root | 755 | `PROJECT_NAME`, `SERVICE_PREFIX`, `PROJECT_DIR` | — |
| `god-session.service` | `/etc/systemd/system/${SERVICE_PREFIX}-god.service` | root:root | 644 | `PROJECT_NAME`, `SERVICE_PREFIX`, `PROJECT_DIR`, `BOT_USER` | — |
| `dispatch.timer` | `/etc/systemd/system/${SERVICE_PREFIX}-dispatch.timer` | root:root | 644 | `SERVICE_PREFIX` | — (always installs) |
| `dispatch.service` | `/etc/systemd/system/${SERVICE_PREFIX}-dispatch.service` | root:root | 644 | `SERVICE_PREFIX`, `BOT_USER` | — (always installs) |
| `settings.agent-config.fragment.json` | jq-merged into `/home/${BOT_USER}/.claude/settings.json` | `${BOT_USER}` | 644 | — (no placeholders) | — (always installs) |
| `claude-relay-bot.py` | `/usr/local/bin/claude-relay-bot.py` | root:root | 755 | `PROJECT_NAME`, `SERVICE_PREFIX`, `BOT_USER` | `TELEGRAM_BOT_TOKEN` (Step 7c) |
| `claude-relay-bot.service` | `/etc/systemd/system/${SERVICE_PREFIX}-relay-bot.service` | root:root | 644 | `PROJECT_NAME`, `SERVICE_PREFIX`, `BOT_USER` | `TELEGRAM_BOT_TOKEN` (Step 7c) |
| `statusline.sh` | `/home/${BOT_USER}/.claude/statusline.sh` | `${BOT_USER}` | 755 | — (no placeholders) | `TELEGRAM_BOT_TOKEN` (Step 7b) |
| `claude-usage-report.sh` | `/usr/local/bin/claude-usage-report` | root:root | 755 | — | `TELEGRAM_BOT_TOKEN` (Step 7b) |
| `mint-gh-token.sh` | `/usr/local/bin/${SERVICE_PREFIX}-mint-gh-token` | root:`${BOT_USER}` | 750 | `PROJECT_NAME`, `SERVICE_PREFIX` | `GITHUB_APP_ID` (Step 8a) |
| `dispatch.md` | `/home/${BOT_USER}/.claude/commands/dispatch.md` | `${BOT_USER}` | 644 | `PROJECT_NAME`, `SERVICE_PREFIX`, `PROJECT_DIR`, `GITHUB_REPO` | — |
| `operator.CLAUDE.md` | `/home/${BOT_USER}/.claude/CLAUDE.md` | `${BOT_USER}` | 644 | `PROJECT_NAME`, `SERVICE_PREFIX`, `PROJECT_DIR`, `TELEGRAM_CHAT_ID` | — |
| `codex-config.toml.template` | `/home/${BOT_USER}/.codex/config.toml` | `${BOT_USER}` | 644 | `BOT_USER`, `PROJECT_DIR` | `REF_API_KEY`, `CONTEXT7_API_KEY` |
| `codex-notify.sh` | `/home/${BOT_USER}/.codex/notify.sh` | `${BOT_USER}` | 755 | `PROJECT_NAME`, `BOT_USER` | `TELEGRAM_BOT_TOKEN` (Step 8b) |
| `settings.statusline.fragment.json` | jq-merged into `/home/${BOT_USER}/.claude/settings.json` | `${BOT_USER}` | 644 | `BOT_USER` | `TELEGRAM_BOT_TOKEN` (Step 7b) |
| `settings.hooks.fragment.json` | jq-merged into `/home/${BOT_USER}/.claude/settings.json` | `${BOT_USER}` | 644 | — (no placeholders) | `TELEGRAM_BOT_TOKEN` (Step 7c) |
| `secrets.env.template` | `/etc/${PROJECT_NAME}/secrets.env` | root:`${BOT_USER}` | 640 | `PROJECT_NAME`, `SERVICE_PREFIX` | (operator fills values manually) |

## Operator-side artifact (rendered → written LOCALLY to operator's project repo)

| Template | Local target | Substitution model |
|---|---|---|
| `dispatcher.md.template` | `${TARGET_REPO_PATH}/.claude/commands/dispatcher.md` | **NO install-time substitution.** The file uses bash `${VPS_*}` env-var reads at runtime, sourced from the operator's `.env.local` on each invocation. Skill copies the file as-is. |

The skill at install time also **adds these keys to operator's `.env.local`** (or prompts the operator to add them):

```text
VPS_HOST=<ip-or-hostname>
VPS_SSH_KEY=<path-to-private-key>
VPS_BOT_USER=<linux-user-on-vps>
VPS_PROJECT_NAME=<state-dir-name>
VPS_SERVICE_PREFIX=<systemd-unit-prefix>
VPS_PROJECT_DIR=<repo-clone-path-on-vps>
VPS_GITHUB_REPO=<owner/repo>
```

`.env.local` should be git-ignored (most projects already have `.env.*` in `.gitignore`).

## Telegram bridge architecture (v3, Step 7c)

`claude-relay-bot.py` is a ~990-line systemd-managed Python daemon that owns the entire god-session state machine — not just inbound Telegram. Replaces the bun-based Channels plugin (deprecated due to silent-death bugs in `anthropics/claude-plugins-official` issues #788, #917, #1478).

Components:

- **aiogram polling** (Telegram inbound) → `tmux send-keys "[tg id=<chat>:<msg>] <text>"` to god-session pane
- **aiohttp listener on `127.0.0.1:9999`** — 6 Claude Code HTTP hook receivers (`UserPromptSubmit`, `Stop`, `StopFailure`, `SessionStart`, `PostCompact`, `SubagentStop`) + 7 application API endpoints (`/dispatch/*`, `/memory/*`, `/health`)
- **Outbox worker** (asyncio task) — drains a SQLite queue of outbound messages with retry/backoff. Stop hook never blocks on Telegram API; even Telegram outage doesn't lose messages
- **SQLite at `/var/lib/${PROJECT_NAME}/relay.db`** with 8 tables: `messages`, `pending_reply`, `outbox`, `sessions`, `session_events`, `dispatch_runs`, `dispatch_phases`, `memories`
- **SessionStart additionalContext injection** — claude sees recent memories + dispatch history at start of every new session

External `${SERVICE_PREFIX}-dispatch.timer` (systemd, installed in Step 7) replaces the in-session `/loop` (which was fragile across tmux/claude respawn). Hourly at `:07`, fires `tmux send-keys -t ${SERVICE_PREFIX}-god "/dispatch" Enter`. The scheduler is independent of Telegram — it ships in Step 7 regardless.

## Notes

- All scripts default to LF line endings. If editing on Windows, strip `\r` before upload: `sed -i 's/\r$//' <file>`.
- `secrets.env.template` ships only variable names + `<placeholder>` markers — never real values.
- `codex-config.toml.template` ships with marketplace plugins and MCP server blocks **commented out**. Uncomment per project needs.
- `claude-relay-bot.py` requires `aiogram` + `aiohttp` (Python ≥ 3.10). Install in venv at `/home/${BOT_USER}/.venv-relay/`. systemd unit `ExecStart` points to that venv's python.
- `dispatcher.md.template` is the only operator-side template. It's written verbatim to operator's local repo; configuration comes from `.env.local` at runtime.
- The skill's substitution step is **install-time** for VPS-side templates (Claude reads template, replaceAll, ssh-uploads). Operator-side `dispatcher.md.template` is copied without substitution.

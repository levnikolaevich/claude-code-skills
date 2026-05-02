<!-- markdownlint-disable MD060 -->

# References — ln-030-vps-bootstrap artifact templates

Template files referenced by `SKILL.md`. Most use `${VAR}` placeholders compatible with `envsubst` for **install-time substitution**. The operator-side dispatcher template uses **runtime** `.env.local` reading instead — see notes below.

## Variable model

| Variable | Used in template paths/content for | Notes |
|---|---|---|
| `${PROJECT_NAME}` | `/etc/${PROJECT_NAME}/`, `/var/lib/${PROJECT_NAME}/`, `/var/log/${PROJECT_NAME}-god.log` | State / config / log dir name |
| `${SERVICE_PREFIX}` | `${SERVICE_PREFIX}-god.service`, `${SERVICE_PREFIX}-dispatch.timer/service`, `/usr/local/bin/${SERVICE_PREFIX}-god`, `/usr/local/bin/${SERVICE_PREFIX}-mint-gh-token`, tmux session `${SERVICE_PREFIX}-god` | systemd unit + binary + tmux prefix. Set equal to `PROJECT_NAME` for new projects. |
| `${BOT_USER}` | `/home/${BOT_USER}/...`, owner of agent files | Linux user (typically UID 1000) |
| `${PROJECT_DIR}` | working dir for the agent | Cloned repo path on VPS |
| `${RELAY_HOOK_PORT}` | relay-bot localhost listener and Claude hook URLs | Default `9999`; override for a second project on the same VPS |
| `${DISPATCH_COMMAND_NAME}` | VPS slash command name and timer injection | Default `${SERVICE_PREFIX}-dispatch`; live civic uses `civic-dispatch` |

## VPS-side artifacts (rendered at install → ssh-uploaded to VPS)

| Template | VPS target | Owner | Mode | Required vars | Optional gating |
|---|---|---|---|---|---|
| `god-session.sh` | `/usr/local/bin/${SERVICE_PREFIX}-god` | root:root | 755 | `PROJECT_NAME`, `SERVICE_PREFIX`, `PROJECT_DIR`, `DISPATCH_COMMAND_NAME` | — |
| `god-session.service` | `/etc/systemd/system/${SERVICE_PREFIX}-god.service` | root:root | 644 | `PROJECT_NAME`, `SERVICE_PREFIX`, `PROJECT_DIR`, `BOT_USER` | — |
| `dispatch.timer` | `/etc/systemd/system/${SERVICE_PREFIX}-dispatch.timer` | root:root | 644 | `SERVICE_PREFIX`, `DISPATCH_COMMAND_NAME` | — (always installs) |
| `dispatch.service` | `/etc/systemd/system/${SERVICE_PREFIX}-dispatch.service` | root:root | 644 | `SERVICE_PREFIX`, `BOT_USER`, `DISPATCH_COMMAND_NAME` | — (always installs) |
| `settings.agent-config.fragment.json` | jq-merged into `/home/${BOT_USER}/.claude/settings.json` | `${BOT_USER}` | 644 | — (no placeholders) | — (always installs) |
| `relay-bot/` | `/opt/${SERVICE_PREFIX}-relay-bot` | `${BOT_USER}` | 755 dirs / 644 files | `PROJECT_NAME`, `PROJECT_DIR`, `SERVICE_PREFIX`, `BOT_USER` via service env | `TELEGRAM_BOT_TOKEN` (Step 7c) |
| `claude-relay-bot.service` | `/etc/systemd/system/${SERVICE_PREFIX}-relay-bot.service` | root:root | 644 | `PROJECT_NAME`, `PROJECT_DIR`, `SERVICE_PREFIX`, `BOT_USER` | `TELEGRAM_BOT_TOKEN` (Step 7c) |
| `statusline.sh` | `/home/${BOT_USER}/.claude/statusline.sh` | `${BOT_USER}` | 755 | — (no placeholders) | `TELEGRAM_BOT_TOKEN` (Step 7b) |
| `claude-usage-report.sh` | `/usr/local/bin/claude-usage-report` | root:root | 755 | — | `TELEGRAM_BOT_TOKEN` (Step 7b) |
| `mint-gh-token.sh` | `/usr/local/bin/${SERVICE_PREFIX}-mint-gh-token` | root:`${BOT_USER}` | 750 | `PROJECT_NAME`, `SERVICE_PREFIX` | `GITHUB_APP_ID` (Step 8a) |
| `dispatch.md` | `/home/${BOT_USER}/.claude/commands/${DISPATCH_COMMAND_NAME}.md` | `${BOT_USER}` | 644 | `PROJECT_NAME`, `SERVICE_PREFIX`, `PROJECT_DIR`, `GITHUB_REPO`, `RELAY_HOOK_PORT`, `DISPATCH_COMMAND_NAME` | — |
| `operator.CLAUDE.md` | `/home/${BOT_USER}/.claude/CLAUDE.md` | `${BOT_USER}` | 644 | `PROJECT_NAME`, `SERVICE_PREFIX`, `PROJECT_DIR`, `TELEGRAM_CHAT_ID`, `RELAY_HOOK_PORT`, `DISPATCH_COMMAND_NAME` | — |
| `codex-config.toml.template` | `/home/${BOT_USER}/.codex/config.toml` | `${BOT_USER}` | 644 | `BOT_USER`, `PROJECT_DIR` | `REF_API_KEY`, `CONTEXT7_API_KEY` |
| `codex-notify.sh` | `/home/${BOT_USER}/.codex/notify.sh` | `${BOT_USER}` | 755 | `PROJECT_NAME`, `BOT_USER` | `TELEGRAM_BOT_TOKEN` (Step 8b) |
| `settings.statusline.fragment.json` | jq-merged into `/home/${BOT_USER}/.claude/settings.json` | `${BOT_USER}` | 644 | `BOT_USER` | `TELEGRAM_BOT_TOKEN` (Step 7b) |
| `settings.hooks.fragment.json` | jq-merged into `/home/${BOT_USER}/.claude/settings.json` | `${BOT_USER}` | 644 | `RELAY_HOOK_PORT` (default `9999`) | `TELEGRAM_BOT_TOKEN` (Step 7c) |
| `secrets.env.template` | `/etc/${PROJECT_NAME}/secrets.env` | root:`${BOT_USER}` | 640 | `PROJECT_NAME`, `SERVICE_PREFIX` | (operator fills values; ships with `RELAY_VERBOSITY=normal` and `RELAY_INBOUND_REACTIONS`) |

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
VPS_RELAY_HOOK_PORT=<relay-port>
VPS_DISPATCH_COMMAND_NAME=<slash-command-name>
```

`.env.local` should be git-ignored (most projects already have `.env.*` in `.gitignore`).

## Telegram bridge architecture (v6 Node.js, Step 7c)

`relay-bot/` is a systemd-managed Node.js/TypeScript service that owns the entire god-session state machine: Telegram ingress, durable delivery into tmux, session controls, hook ingestion, and outbound Telegram mirroring. Replaces the bun-based Channels plugin (deprecated due to silent-death bugs in `anthropics/claude-plugins-official` issues #788, #917, #1478).

The Telegram bridge accepts plain text, media captions, photos, image documents, and general documents. Voice, audio, video, animations, stickers, and other unsupported media without usable text are recorded as `messages(status='rejected')` and receive an explanatory reply.

Components:

- **grammY polling** (Telegram inbound) → durable SQLite `messages(kind='text'|'image'|'document', status='queued')` queue → inbound worker delivers with `tmux send-keys "[tg id=<chat>:<msg>] <text>"` only when god-session is ready
- **Serialized control lane** — `/new_session`, Resume, Delete, and inbound delivery share one async queue/lock so operator text cannot be lost during tmux restarts
- **Fastify listener on `127.0.0.1:${RELAY_HOOK_PORT}`** — Claude Code HTTP hook receivers (`UserPromptSubmit`, `Stop`, `StopFailure`, `SessionStart`, `PostCompact` via SessionStart route, `SubagentStop`, `PreToolUse`, `PostToolUse`) + application API endpoints (`/dispatch/*`, `/memory/*`, `/health`)
- **Outbox worker** — drains a SQLite queue of outbound messages with retry/backoff. Stop hook never blocks on Telegram API; even Telegram outage doesn't lose messages
- **SQLite at `/var/lib/${PROJECT_NAME}/relay.db`** with 12 tables: `messages`, `pending_reply`, `outbox` (+ `event_type` column for status routing), `sessions`, `session_events`, `dispatch_runs`, `dispatch_phases`, `memories`, `health_snapshots`, `auth_rejects`, `allowed_users`, `todo_state`
- **SessionStart additionalContext injection** — claude sees recent memories + dispatch history at start of every new session

External `${SERVICE_PREFIX}-dispatch.timer` (systemd, installed in Step 7) replaces the in-session `/loop` (which was fragile across tmux/claude respawn). Hourly at `:07`, fires `tmux send-keys -t ${SERVICE_PREFIX}-god "/${DISPATCH_COMMAND_NAME}" Enter`. The scheduler is independent of Telegram — it ships in Step 7 regardless.

## Communication policy (5 layers)

The relay-bot surfaces claude's progress to Telegram in 5 layers, each non-blocking and routed through the durable `outbox` table:

| Layer | Source hook | Telegram output |
|---|---|---|
| **L1** Inbound ack | `relay_inbound` after accepted text/caption is queued | reaction emoji on operator's bubble (configured pool → ❤ fallback → skip) |
| **L2** Skill invocation | `PreToolUse` matcher `Skill` / `Agent` | `🔧 Skill: <name>` or `🤖 Subagent: <type>` |
| **L3** Todo transitions | `PreToolUse` matcher `TodoWrite` (diff vs `todo_state`) | `🟡 Started: <task>` / `✅ Done: <task>` |
| **L4** Subagent boundary | `SubagentStop` hook | `✅ Subagent: <type> done` |
| **L5** Final reply | `Stop` hook | `💬 <last_assistant_message>` |

**Verbosity gate** (`RELAY_VERBOSITY` env in `secrets.env`):

- `quiet` — only L1 + L5 (closest to silent)
- `normal` (default) — L1+L2+L3+L4+L5
- `verbose` — + Bash whitelist + PostToolUse Skill duration

**Token bucket**: per-chat sliding window of 5 status messages per 60 seconds. Overflow drops L2/L3 silently; L4/L5 always pass. Implemented in-memory (lost on restart, reset on next invocation — acceptable for a soft rate-limit).

**Outbox `event_type` column** distinguishes layer types (`reply` | `status_skill` | `status_todo` | `status_subagent` | `system`) so the bucket can selectively drop status events without affecting final replies.

**TodoWrite is the canonical channel for DoD/checkbox progress** — claude flips items to `in_progress` / `completed`, operator sees real-time transitions in Telegram.

**Slash-skill caveat**: when operator types `/skill-name` directly to invoke a skill, Claude Code's UserPromptExpansion pre-empts `PreToolUse Skill` matcher → L2 does NOT fire for that case. Only `Skill(...)` invocations from claude's own logic produce L2 announces.

## Notes

- All scripts default to LF line endings. If editing on Windows, strip `\r` before upload: `sed -i 's/\r$//' <file>`.
- `secrets.env.template` ships only variable names + `<placeholder>` markers — never real values.
- `codex-config.toml.template` ships with marketplace plugins and MCP server blocks **commented out**. Uncomment per project needs.
- `relay-bot/` builds on the VPS with Node 24: run `npm ci && npm run build` in `/opt/${SERVICE_PREFIX}-relay-bot`. Do not commit or upload `dist/` or `node_modules/`.
- `dispatcher.md.template` is the only operator-side template. It's written verbatim to operator's local repo; configuration comes from `.env.local` at runtime.
- The skill's substitution step is **install-time** for VPS-side templates (Claude reads template, replaceAll, ssh-uploads). Operator-side `dispatcher.md.template` is copied without substitution.

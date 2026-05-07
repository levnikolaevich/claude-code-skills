<!-- markdownlint-disable MD060 -->

# References — ln-030 VPS Runtime Templates

Template files and runbooks used by `ln-030` and its VPS runtime workers. Most templates use `${VAR}` placeholders for **install-time `envsubst` substitution**. The operator-side dispatcher template uses **runtime** `.env.local` reading instead — see notes below.

## Variable model

| Variable | Used in template paths/content for | Notes |
|---|---|---|
| `${PROJECT_NAME}` | `/etc/${PROJECT_NAME}/`, `/var/lib/${PROJECT_NAME}/`, `/var/log/${PROJECT_NAME}-god.log` | State / config / log dir name |
| `${SERVICE_PREFIX}` | `${SERVICE_PREFIX}-god@.service`, `${SERVICE_PREFIX}-dispatch.timer/service`, `/usr/local/bin/${SERVICE_PREFIX}-god`, `/usr/local/bin/${SERVICE_PREFIX}-mint-gh-token`, tmux socket `${SERVICE_PREFIX}` | Per-project systemd unit + binary + tmux prefix. User panes are `${SERVICE_PREFIX}-god-<telegram_user_id>`. |
| `${BOT_USER}` | `/home/${BOT_USER}/...`, owner of agent files | Linux user (typically UID 1000) |
| `${PROJECT_DIR}` | working dir for the agent | Cloned repo path on VPS |
| `${RELAY_HOOK_PORT}` | hex-relay localhost listener and Claude hook URLs | Default `9999`; override for a second project on the same VPS |
| `${DISPATCH_COMMAND_NAME}` | VPS slash command name and timer injection | Default `${SERVICE_PREFIX}-dispatch` |
| `${AGENT_SKILLS_REPO_URL}` | Claude/Codex marketplace source | Default `https://github.com/levnikolaevich/claude-code-skills.git` |
| `${AGENT_SKILLS_REF}` | Git ref for the marketplace source | Default `master` |
| `${AGENT_SKILLS_DIR}` | shared skills clone used by validation and nightly refresh | Default `/opt/agent-skills` |
| `${AGENT_SKILLS_PLUGINS}` | selected LevNikolaevich plugins | Default `agile-workflow`; supports `all` or comma-list |

## VPS-side artifacts (rendered at install → ssh-uploaded to VPS)

| Template | VPS target | Owner | Mode | Required vars | Optional gating |
|---|---|---|---|---|---|
| `god-session.sh` | `/usr/local/bin/${SERVICE_PREFIX}-god` | root:root | 755 | `PROJECT_NAME`, `SERVICE_PREFIX`, `PROJECT_DIR`, `DISPATCH_COMMAND_NAME` | — |
| `god-session.service` | `/etc/systemd/system/${SERVICE_PREFIX}-god@.service` | root:root | 644 | `PROJECT_NAME`, `SERVICE_PREFIX`, `PROJECT_DIR`, `BOT_USER` | — |
| `agent-sandbox.sh` | `/usr/local/bin/${SERVICE_PREFIX}-agent-sandbox` | root:root | 755 | `PROJECT_NAME`, `SERVICE_PREFIX`, `PROJECT_DIR`, `BOT_USER`, `AGENT_SKILLS_DIR` | — |
| `dispatch.timer` | `/etc/systemd/system/${SERVICE_PREFIX}-dispatch.timer` | root:root | 644 | `SERVICE_PREFIX`, `DISPATCH_COMMAND_NAME` | — (always installs) |
| `dispatch.service` | `/etc/systemd/system/${SERVICE_PREFIX}-dispatch.service` | root:root | 644 | `SERVICE_PREFIX`, `BOT_USER`, `DISPATCH_COMMAND_NAME` | — (always installs) |
| `agent-update.sh` | `/usr/local/bin/agent-update` | root:root | 755 | `BOT_USER`, `AGENT_SKILLS_REPO_URL`, `AGENT_SKILLS_REF`, `AGENT_SKILLS_DIR`, `AGENT_SKILLS_PLUGINS` | — (system-wide; always installs) |
| `agent-update.service` | `/etc/systemd/system/agent-update.service` | root:root | 644 | — | — (system-wide; always installs) |
| `agent-update.timer` | `/etc/systemd/system/agent-update.timer` | root:root | 644 | — | — (system-wide; always installs) |
| `settings.agent-config.fragment.json` | jq-merged into `/home/${BOT_USER}/.claude/settings.json` | `${BOT_USER}` | 644 | — (no placeholders) | — (always installs) |
| `agents/hex-relay/` | `/opt/${SERVICE_PREFIX}-hex-relay` | `${BOT_USER}` | 755 dirs / 644 files | `PROJECT_NAME`, `PROJECT_DIR`, `SERVICE_PREFIX`, `BOT_USER` via service env | `TELEGRAM_BOT_TOKEN` (`ln-033`) |
| `hex-relay.service` | `/etc/systemd/system/${SERVICE_PREFIX}-hex-relay.service` | root:root | 644 | `PROJECT_NAME`, `PROJECT_DIR`, `SERVICE_PREFIX`, `BOT_USER`, `RELAY_HOOK_PORT` | `TELEGRAM_BOT_TOKEN` (`ln-033`) |
| `register-telegram-commands.sh` | `/usr/local/bin/${SERVICE_PREFIX}-register-telegram-commands` | root:root | 755 | — | `TELEGRAM_BOT_TOKEN` (`ln-033`) |
| `statusline.sh` | `/home/${BOT_USER}/.claude/statusline.sh` | `${BOT_USER}` | 755 | — (no placeholders) | `TELEGRAM_BOT_TOKEN` (`ln-032`) |
| `claude-usage-report.sh` | `/usr/local/bin/claude-usage-report` | root:root | 755 | — | `TELEGRAM_BOT_TOKEN` (`ln-032`) |
| `mint-gh-token.sh` | `/usr/local/bin/${SERVICE_PREFIX}-mint-gh-token` | root:`${BOT_USER}` | 750 | `PROJECT_NAME`, `SERVICE_PREFIX` | `GITHUB_APP_ID` (`ln-032`) |
| `dispatch.md` | `/home/${BOT_USER}/.claude/commands/${DISPATCH_COMMAND_NAME}.md` | `${BOT_USER}` | 644 | `PROJECT_NAME`, `SERVICE_PREFIX`, `PROJECT_DIR`, `GIT_PROVIDER`, `REPO_SLUG`, `RELAY_HOOK_PORT`, `DISPATCH_COMMAND_NAME` | — |
| `operator.CLAUDE.md` | **`${PROJECT_DIR}/.claude/CLAUDE.md`** (project-scope, NEVER user-scope under shared `BOT_USER`) | `${BOT_USER}` | 644 | `PROJECT_NAME`, `SERVICE_PREFIX`, `PROJECT_DIR`, `BOT_USER`, `TELEGRAM_CHAT_ID`, `RELAY_HOOK_PORT`, `DISPATCH_COMMAND_NAME`, `GIT_PROVIDER`, `REPO_SLUG` | — |
| `codex-config.toml.template` | `/home/${BOT_USER}/.codex/config.toml` | `${BOT_USER}` | 644 | `BOT_USER`, `PROJECT_DIR`, `AGENT_SKILLS_REPO_URL`, `AGENT_SKILLS_REF`, selected `AGENT_SKILLS_PLUGINS` block | `REF_API_KEY`, `CONTEXT7_API_KEY` |
| `codex-notify.sh` | `/home/${BOT_USER}/.codex/notify.sh` | `${BOT_USER}` | 755 | `PROJECT_NAME`, `BOT_USER` | `TELEGRAM_BOT_TOKEN` (`ln-032`, opt-in) |
| `settings.statusline.fragment.json` | jq-merged into `/home/${BOT_USER}/.claude/settings.json` | `${BOT_USER}` | 644 | `BOT_USER` | `TELEGRAM_BOT_TOKEN` (`ln-032`) |
| `settings.hooks.fragment.json` | **`${PROJECT_DIR}/.claude/settings.json`** (project-scope; under shared `BOT_USER`, hooks MUST NOT be in user-scope or projects' tmux sessions cross-route between hex-relay instances) | `${BOT_USER}` | 644 | `RELAY_HOOK_PORT` (default `9999`) | `TELEGRAM_BOT_TOKEN` (`ln-033`) |
| `secrets.env.template` | `/etc/${PROJECT_NAME}/secrets.env` | root:`${BOT_USER}` | 640 | `PROJECT_NAME`, `SERVICE_PREFIX` | (operator fills values; ships with `RELAY_VERBOSITY=normal` and `RELAY_INBOUND_REACTIONS`) |

## Operator-side artifact (rendered → written LOCALLY to operator's project repo)

| Template | Local target | Substitution model |
|---|---|---|
| `dispatcher.md.template` | `${TARGET_REPO_PATH}/.claude/commands/dispatcher.md` | **NO install-time substitution.** The file uses bash `${VPS_*}` env-var reads at runtime, sourced from the operator's `.env.local` on each invocation. Skill copies the file as-is. |

The skill at install time also **adds these keys to operator's `.env.local`** (or prompts the operator to add them):

```text
VPS_HOST=<ip-or-hostname>
VPS_SSH_KEY=<path-to-private-key>
VPS_BOT_USER=agent-bot
VPS_PROJECT_NAME=<state-dir-name>
VPS_SERVICE_PREFIX=<systemd-unit-prefix>
VPS_TELEGRAM_CHAT_ID=<primary-operator-chat-id>
VPS_PROJECT_DIR=<repo-clone-path-on-vps>
VPS_GIT_PROVIDER=<github-or-gitlab>
VPS_REPO_SLUG=<owner/repo>
VPS_RELAY_HOOK_PORT=<relay-port>
VPS_DISPATCH_COMMAND_NAME=<slash-command-name>
VPS_AGENT_SKILLS_DIR=<skills-clone-path>
VPS_AGENT_SKILLS_PLUGINS=<agile-workflow-or-list>
```

`.env.local` should be git-ignored (most projects already have `.env.*` in `.gitignore`).

## Auth model references

Two viable Linux-user/auth shapes for a multi-project VPS. Pick one before bootstrap; both are supported by the workers.

| Reference | When to use | What it covers |
|---|---|---|
| `shared_user_pattern.md` | Fresh install. One operator owns all projects. | Canonical model: one shared `agent-bot` Linux user owns every project's god-session. One `~/.claude.json`, one OAuth, one nvm. Strongest cache locality. |
| `shared_auth_state.md` | Existing fleet already uses per-project bot users (`<project>-bot`). Adding a new project to it without burning another Claude Max device slot. | Symlink-based shared-state pattern: per-bot Linux/systemd isolation preserved, but `~/.claude`, `~/.claude.json`, `~/.codex` symlink to `/var/lib/claude-shared/` (group `claude-shared` + ACL setgid+default rwx). One device slot serves N bots. Includes migration script and one-time login flow. |

`troubleshooting.md` covers failure modes for both shapes (HTTP 401 between bots, ACL mask `---` after token rotation, `agent-update` `+x` bit loss, etc.). `ln-034-vps-environment-diagnostics` reads both references and inspects the active shape automatically.

## Fleet references

- `fleet_registry.md` documents the VPS-local `/etc/agent-fleet/environments/*.yaml` registry, required fields, collision rules, and the no-secrets contract.
- `fleet_plan_apply.md` documents `ln-030 plan` and `ln-030 apply`: read registry, discover live state, write a plan artifact, re-check before mutation, then invoke workers per selected environment.

## hex-relay architecture

`hex-relay/` is a systemd-managed Node.js/TypeScript service that owns the entire god-session state machine: Telegram ingress, durable delivery into tmux, session controls, hook ingestion, and outbound Telegram mirroring.

The Telegram bridge accepts plain text, media captions, photos, image documents, and general documents. Voice, audio, video, animations, stickers, and other unsupported media without usable text are recorded as `messages(status='rejected')` and receive an explanatory reply.

Components:

- **grammY polling** (Telegram inbound) → durable SQLite `messages(kind='text'|'image'|'document', status='queued')` queue → inbound worker delivers with `tmux send-keys "[tg id=<chat>:<msg>] <text>"` only when god-session is ready
- **Serialized control lane** — `/new_session`, Resume, Delete, and inbound delivery share one async queue/lock so operator text cannot be lost during tmux restarts
- **Fastify listener on `127.0.0.1:${RELAY_HOOK_PORT}`** — Claude Code HTTP hook receivers (`UserPromptSubmit`, `Stop`, `StopFailure`, `SessionStart`, `PostCompact` via SessionStart route, `SubagentStop`, `PreToolUse`, `PostToolUse`) + application API endpoints (`/tasks/poll`, `/dispatch/*`, `/memory/*`, `/health`)
- **Outbox worker** — drains a SQLite queue of outbound messages with retry/backoff. Stop hook never blocks on Telegram API; even Telegram outage doesn't lose messages
- **SQLite at `/var/lib/${PROJECT_NAME}/relay.db`** with core tables for messages, pending replies, outbox status routing, sessions/events, dispatch runs/phases, memories, health snapshots, auth rejects, allowed users, and todo state
- **SessionStart additionalContext injection** — claude sees recent memories + dispatch history at start of every new session

External `${SERVICE_PREFIX}-dispatch.timer` replaces the in-session `/loop` (which was fragile across tmux/claude respawn). Every 15 minutes, it calls hex-relay `POST /tasks/poll`. hex-relay lists open provider issues with control-plane secrets; empty queues only log, non-empty queues notify the primary operator to use `/tasks` at most once per 24 hours.

External `agent-update.timer` performs system-wide nightly host maintenance. It updates CLIs and plugins, verifies versions/config, then restarts active `*-god@*.service` user instances. Failed updates do not restart running god-sessions.

`agent-sandbox.sh` is the work-plane boundary. Each god instance runs with `HOME=${PROJECT_DIR}/.agent-home/users/<telegram_user_id>`. The shared VPS CLI runtime remains single: the sandbox bind-mounts `/home/${BOT_USER}/.claude` and `/home/${BOT_USER}/.codex` as writable directories under sandbox `$HOME` so Claude/Codex can rotate auth tokens and update their runtime state atomically, while the real `/home/${BOT_USER}` path stays hidden.

## Agent skills/plugins marketplace

`ln-030` installs the same LevNikolaevich marketplace surfaces used by `ln-013-config-syncer`, scoped to the VPS bot user. Claude uses native user-scope plugin install. Codex uses the native `[marketplaces.levnikolaevich-skills-marketplace]` and `[plugins."<name>@levnikolaevich-skills-marketplace"]` config entries. Do not symlink Claude plugin roots into Codex.

## Communication policy (5 layers)

The hex-relay surfaces claude's progress to Telegram in 5 layers, each non-blocking and routed through the durable `outbox` table:

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
- `codex-config.toml.template` ships with the default LevNikolaevich marketplace/plugin block enabled and optional MCP server blocks commented out. Enable additional plugin entries only when `AGENT_SKILLS_PLUGINS` explicitly requests them.
- `hex-relay/` builds on the VPS with Node 24: run `npm ci && npm run build && ./node_modules/.bin/tsc --version` in `/opt/${SERVICE_PREFIX}-hex-relay`. Do not commit or upload `dist/` or `node_modules/`.
- After hex-relay source changes, use `agents/hex-relay/docs/redeploy.md`: upload source only, rebuild on VPS with local devDependencies, restart `${SERVICE_PREFIX}-hex-relay.service`.
- `dispatcher.md.template` is the only operator-side template. It's written verbatim to operator's local repo; configuration comes from `.env.local` at runtime.
- The skill's substitution step is **install-time** for VPS-side templates (Claude reads template, replaceAll, ssh-uploads). Operator-side `dispatcher.md.template` is copied without substitution.

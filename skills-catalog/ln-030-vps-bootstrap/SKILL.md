---
name: ln-030-vps-bootstrap
description: "One-shot Linux VPS bootstrap for autonomous Claude Code + Codex workloads: packages, agent user, CLIs, MCP, god-session, hourly dispatch, usage, optional Telegram bridge."
license: MIT
allowed-tools: Bash, Read, mcp__hex-ssh__remote-ssh, mcp__hex-ssh__ssh-write-chunk, mcp__hex-ssh__ssh-edit-block, mcp__hex-ssh__ssh-read-lines, mcp__hex-ssh__ssh-download
---

<!-- markdownlint-disable MD012 MD022 MD032 MD040 MD041 MD060 -->
<!-- MD041: file starts with YAML frontmatter, not an h1 — by design.
     MD060: tables mix compact/aligned styles; consistent normalization is cosmetic churn.
     MD012/MD022/MD032/MD040: blank-line-around-block + code-fence language hints —
     pure cosmetics, suppressed at file scope to keep substantive content unobscured. -->


> **Paths:** File paths (`references/`, `../ln-*`) are relative to skills repo root. If not found at CWD, locate this SKILL.md directory and go up one level for repo root.

# ln-030-vps-bootstrap

**Type:** L2 Coordinator (one-shot, idempotent)
**Category:** 0XX Shared / Infrastructure
**Tested on:** Ubuntu 24.04 (apt + systemd base — Contabo, Hetzner, DigitalOcean)

Universal bootstrap of a Linux VPS into a self-contained Claude Code + Codex agent workload: system packages, dedicated `${BOT_USER}` user, agent CLIs, MCP servers, optional Telegram bot interface, an always-on god-session under tmux+systemd, and a project-specific operator dispatcher slash-command rendered into your local repo.

The skill is **parameterized** — instantiate it per-project by filling in the configuration block below. Optional integrations (Telegram, GitHub App, Cloudflare, MCP servers) auto-skip when the corresponding variable is empty.

---

## Scope: per-VPS vs per-project

Recommended deployment shape: **one project = one `${BOT_USER}` Linux user = one Telegram bot token = one set of systemd units**. The skill is parameterized so you can run it again on the same VPS for a second project — pick a new `${PROJECT_NAME}`, `${SERVICE_PREFIX}`, `${BOT_USER}`, `${PROJECT_DIR}`, `${TELEGRAM_BOT_TOKEN}`, and re-run.

| Layer | Scope | What lives here |
|---|---|---|
| **Global per-VPS** (one install per machine) | shared by every project | apt packages: `curl`, `wget`, `git`, `jq`, `gpg`, `pipx`, `python3`, `python3-venv`, `bubblewrap`, `unzip`, `tmux`; `gh` CLI from official apt repo. Step 1+2 are idempotent — running them twice is a no-op. |
| **Per-`${BOT_USER}`** (one bot user can host multiple projects but skill recommends 1:1 with project) | scoped to the user's home | `~/.nvm/`, Node 24, `claude` + `codex` CLIs (npm global within that user's nvm), `~/.claude/` (`settings.json`, `CLAUDE.md`, `statusline.sh`, `commands/`, `projects/<encoded-cwd>/<sid>.jsonl`), `~/.codex/` (`config.toml`, `notify.sh`), `~/.venv-relay/` (aiogram + aiohttp). |
| **Per-`${PROJECT_NAME}`** (state, config, logs) | scoped to project dir name | `/etc/${PROJECT_NAME}/secrets.env`, `/etc/${PROJECT_NAME}/github-app.pem`, `/var/lib/${PROJECT_NAME}/relay.db`, `/var/lib/${PROJECT_NAME}/god-command.json`, `/var/lib/${PROJECT_NAME}/sessions-dir.path`, `/var/lib/${PROJECT_NAME}/last-god-error.json`, `/var/log/${PROJECT_NAME}-god.log`. |
| **Per-`${SERVICE_PREFIX}`** (binaries, units, tmux) | scoped to systemd/binary prefix | `/usr/local/bin/${SERVICE_PREFIX}-god`, `/usr/local/bin/${SERVICE_PREFIX}-mint-gh-token`, systemd units `${SERVICE_PREFIX}-god.service`, `${SERVICE_PREFIX}-dispatch.timer`, `${SERVICE_PREFIX}-dispatch.service`, `${SERVICE_PREFIX}-relay-bot.service`, tmux session `${SERVICE_PREFIX}-god`. Keep it explicit; set it equal to `${PROJECT_NAME}` unless you intentionally want a separate service/binary prefix. |
| **Per-Telegram-bot** | one bot token per project | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`. Telegram allows only one polling session per token, so you cannot share a bot across projects. The HTTP listener at `127.0.0.1:${RELAY_HOOK_PORT}` is also per-relay-bot — if you run a second project on the same VPS, override `RELAY_HOOK_PORT` for the second instance. |
| **Per-cwd (Claude-managed, automatic)** | `~/.claude/projects/<encoded-cwd>/` | Claude Code itself isolates session JSONLs by the cwd it was started in. `~${BOT_USER}/.claude/projects/-opt-civic-skills-lab/<uuid>.jsonl` for `cd /opt/civic-skills-lab`. Resume safety: `--resume <id>` only works against an id that was created in the same cwd. Cross-project resume is impossible by design. |

**Multi-project on one VPS**: re-run Steps 3–8 with new vars. Steps 1+2 are skipped (apt no-ops). Each project ends up with its own bot user, state dir, units, and Telegram bot. The `claude-relay-bot.py` template uses install-time substitution of `${PROJECT_NAME}`/`${SERVICE_PREFIX}`/`${BOT_USER}` so each project's relay-bot is independent.

**Single-VPS-multi-project gotchas:**
- HTTP port `9999` is the default for `${SERVICE_PREFIX}-relay-bot.service`. Second project must set `RELAY_HOOK_PORT=9998` (or similar) in its `secrets.env`; rendered hooks and dispatcher config must use the same value.
- `/etc/sudoers.d/` rules (if any added later) must be `${SERVICE_PREFIX}`-scoped, not user-scoped.
- StateDirectory in `${SERVICE_PREFIX}-god.service` references `${PROJECT_NAME}` directly; systemd creates it under `/var/lib/${PROJECT_NAME}` regardless of unit name, so two projects with same `PROJECT_NAME` would collide — keep `PROJECT_NAME` unique per project.

---

## Configuration

The operator hands these values to Claude (in chat) before running the workflow. Claude substitutes them into every reference template at install time. Required vars without a value cause the skill to abort early with a clear message.

### Required

| Variable | Example | Used in |
|---|---|---|
| `PROJECT_NAME` | `myproj` | State/config dir name: `/etc/${PROJECT_NAME}/`, `/var/lib/${PROJECT_NAME}/`, `/var/log/${PROJECT_NAME}-god.log` |
| `SERVICE_PREFIX` | `myproj` | systemd unit + binary + tmux prefix: `${SERVICE_PREFIX}-god.service`, `${SERVICE_PREFIX}-dispatch.timer`, `/usr/local/bin/${SERVICE_PREFIX}-god`, tmux session `${SERVICE_PREFIX}-god`. Set equal to `PROJECT_NAME` unless the deployment intentionally separates state/config name from service/binary prefix. |
| `PROJECT_DIR` | `/opt/myproj` | Working directory on the VPS where the agent runs |
| `BOT_USER` | `agent-bot` | Linux user that owns the workload |
| `RELAY_HOOK_PORT` | `9999` | Project-local relay-bot HTTP port on `127.0.0.1`; override for a second project on the same VPS |
| `DISPATCH_COMMAND_NAME` | `myproj-dispatch` | VPS slash command name injected by `${SERVICE_PREFIX}-dispatch.timer`; default `${SERVICE_PREFIX}-dispatch` |
| `VPS_HOST` | `203.0.113.42` | SSH target (IP or hostname) |
| `VPS_SSH_KEY` | `~/.ssh/myproj_vps` | Local path to the SSH private key |
| `TARGET_REPO_PATH` | `D:\Development\me\myproj` | Local path to the operator's project repo (where `.claude/commands/dispatcher.md` will be rendered) |
| `GITHUB_REPO` | `me/myproj` | `<owner>/<repo>` for the project |

Defaults before rendering: if `RELAY_HOOK_PORT` is unset, set it to `9999`; if `DISPATCH_COMMAND_NAME` is unset, set it to `${SERVICE_PREFIX}-dispatch`. These are still rendered values, not hardcoded template constants.

### Optional (leave blank to skip the corresponding workflow section)

| Variable | What enables | Skips when blank |
|---|---|---|
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | Telegram bot interface (inbound + `/usage` command + status pings) | Steps 7b (statusLine cache), 7c (claude-relay-bot install), 8b (Codex notify hook) |
| `GITHUB_APP_ID`, `GITHUB_INSTALLATION_ID`, `GITHUB_APP_PRIVATE_KEY_PATH` | GitHub App auth for git push (`${SERVICE_PREFIX}-mint-gh-token`) | Step 8a (mint-gh-token install), GH App-related dispatcher rows |
| `CF_API_TOKEN`, `CF_ZONE_NAME` | Cloudflare DNS / Pages ops | Step 8b (Cloudflare integration) |
| `REF_API_KEY` | ref.tools MCP server | Server omitted from Step 5b |
| `CONTEXT7_API_KEY` | context7 MCP server | Server omitted from Step 5b |

### Substitution mechanism

Two distinct paths:

**VPS-side templates (install-time substitution).** All files in `references/` except `dispatcher.md.template` use `${VAR}` placeholders compatible with `envsubst`. Claude reads each, substitutes placeholders in-memory, then ssh-uploads to the VPS. A sufficiently-skilled operator can also run the workflow themselves with `envsubst < references/X > /tmp/X` and `scp`.

**Critical: pass ALL needed vars to envsubst** — `envsubst` without an explicit allow-list will substitute every `${...}` it sees, including bash variables that should remain literal (e.g. `${SESSIONS_DIR}`, `${SID}` in `god-session.sh`, `${VPS_*}` in operator-side files). Always use the allow-list form:

```bash
envsubst '$PROJECT_NAME $PROJECT_DIR $SERVICE_PREFIX $BOT_USER $RELAY_HOOK_PORT $DISPATCH_COMMAND_NAME $TELEGRAM_CHAT_ID' \
  < references/X > /tmp/X
```

**Forgetting `$DISPATCH_COMMAND_NAME` is the most common rendering bug** — `god-session.sh` references it, the wrapper has `set -euo pipefail`, and any unsubstituted `${DISPATCH_COMMAND_NAME}` will trigger «unbound variable» on boot, sending civic-god into a systemd Restart=always loop. Always include it in the envsubst allow-list (default value `${SERVICE_PREFIX}-dispatch` if your project uses the prefixed convention, plain `dispatch` if not).

**Operator-side template (runtime resolution).** `references/dispatcher.md.template` is the only operator-side artifact. It is **written verbatim** to `${TARGET_REPO_PATH}/.claude/commands/dispatcher.md` — do NOT envsubst it. The file uses bash `${VPS_*}` variables that are resolved at slash-command invocation by sourcing `.env.local` from the operator's repo. Substituting at install time would replace those placeholders with empty strings and break the slash command.

---

## Prerequisites

| Requirement | Check |
|---|---|
| SSH access as root to `${VPS_HOST}` | `ssh -i "${VPS_SSH_KEY}" root@${VPS_HOST} hostname` |
| `apt upgrade` already run | `apt list --upgradable 2>/dev/null \| wc -l` returns small number |
| Free RAM ≥ 3 GB | `free -h` available column |
| Operator has the listed Configuration values ready | `[ -n "$PROJECT_NAME" ] && [ -n "$PROJECT_DIR" ] && [ -n "$BOT_USER" ]` etc. |

All SSH commands run via `mcp__hex-ssh__remote-ssh` with `host=${VPS_HOST}`, `user=root`, `privateKeyPath=${VPS_SSH_KEY}`.

---

## Workflow

Run steps in order. Each step is idempotent — verify-then-install pattern. Optional steps are gated on the relevant variable being non-empty.

### 1. Base packages

Install system tools needed for the next steps. `bubblewrap` is for Codex CLI Linux sandbox; `python3-venv` is for the claude-relay-bot venv (Step 7c).

```bash
DEBIAN_FRONTEND=noninteractive apt-get install -y \
  curl wget git jq build-essential ca-certificates gnupg pipx \
  python3 python3-venv bubblewrap unzip tmux
```

**Verify:**

```bash
which curl wget git jq gpg pipx python3 bwrap unzip tmux && pipx --version && bwrap --version && tmux -V
```

Expected: all paths printed, pipx version ≥ 1.4.

### 2. gh CLI (official apt repo)

```bash
mkdir -p /etc/apt/keyrings && \
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
  | gpg --dearmor -o /etc/apt/keyrings/githubcli-archive-keyring.gpg && \
chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg && \
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
  > /etc/apt/sources.list.d/github-cli.list && \
apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y gh
```

**Verify:** `gh --version` → `gh version 2.x`.

### 3. Service user `${BOT_USER}`

```bash
id ${BOT_USER} 2>/dev/null && echo "exists, skipping" || ( \
  useradd -m -s /bin/bash ${BOT_USER} && \
  mkdir -p /home/${BOT_USER}/.ssh && \
  cp /root/.ssh/authorized_keys /home/${BOT_USER}/.ssh/authorized_keys && \
  chown -R ${BOT_USER}:${BOT_USER} /home/${BOT_USER}/.ssh && \
  chmod 700 /home/${BOT_USER}/.ssh && \
  chmod 600 /home/${BOT_USER}/.ssh/authorized_keys && \
  echo "created" \
)
```

**Verify:** `id ${BOT_USER} && ls -la /home/${BOT_USER}/.ssh/` — `uid=1000(${BOT_USER})`, owner-only `authorized_keys`.

### 4. nvm + Node 24 (under `${BOT_USER}`)

`nvm install` modifies PATH only when sourced — never pipe its output (e.g. `| tail -5`) or the side-effect is lost.

```bash
sudo -i -u ${BOT_USER} bash -lc 'curl -fsSL -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash'
sudo -i -u ${BOT_USER} bash -lc '. /home/${BOT_USER}/.nvm/nvm.sh && nvm install 24 && nvm alias default 24'
```

Add nvm to `.profile` (login shells; cron and `sudo -i` use this, not `.bashrc`):

```bash
printf '\n# Load nvm for login shells (cron/sudo -i)\nexport NVM_DIR="$HOME/.nvm"\n[ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"\n' \
  >> /home/${BOT_USER}/.profile && chown ${BOT_USER}:${BOT_USER} /home/${BOT_USER}/.profile
```

**Verify:** `sudo -i -u ${BOT_USER} bash -lc '. /home/${BOT_USER}/.nvm/nvm.sh && node --version && which node'` → `v24.x.x`.

### 5. Claude Code + Codex CLI

```bash
sudo -i -u ${BOT_USER} bash -lc '. /home/${BOT_USER}/.nvm/nvm.sh && npm install -g @anthropic-ai/claude-code @openai/codex'
```

**Verify:** `claude --version && codex --version` — expect `2.1.x (Claude Code)` and `codex-cli 0.x`.

### 5b. MCP servers (only the ones whose key is set)

**Claude side (HTTP MCP via CLI):**

```bash
# Only if REF_API_KEY non-empty
sudo -u ${BOT_USER} bash -lc 'claude mcp add --transport http -s user Ref https://api.ref.tools/mcp --header "x-ref-api-key: ${REF_API_KEY}"'

# Only if CONTEXT7_API_KEY non-empty
sudo -u ${BOT_USER} bash -lc 'claude mcp add --transport http -s user context7 https://mcp.context7.com/mcp --header "CONTEXT7_API_KEY: ${CONTEXT7_API_KEY}"'

sudo -u ${BOT_USER} bash -lc 'claude mcp list'
```

**Codex side:** render [`references/codex-config.toml.template`](references/codex-config.toml.template) with substitutions (uncomment the MCP block whose key is set), upload to `/home/${BOT_USER}/.codex/config.toml`. `codex mcp add` doesn't accept custom headers, so we write the file directly.

The template pins **headless-agent defaults** verified against the [Codex config reference](https://developers.openai.com/codex/config-reference): `model = "gpt-5.5"`, `model_reasoning_effort = "xhigh"`, `approval_policy = "never"`, `sandbox_mode = "danger-full-access"`. This eliminates interactive permission prompts and grants full filesystem + network. Only safe inside an isolated VPS dedicated to this workload. Codex still asks the operator via the `notify` script (Telegram); what's eliminated is the *TUI approval popup*, not user-facing communication.

**Verify:** `sudo -u ${BOT_USER} bash -lc 'codex mcp list'` — both servers show as configured.

### 6. Final sanity (mimics cron environment via `sudo -i`)

```bash
sudo -i -u ${BOT_USER} which claude codex node npm gh && \
sudo -i -u ${BOT_USER} claude --version && \
sudo -i -u ${BOT_USER} codex --version
```

All four must resolve. If `node` is missing under `sudo -i`, step 4's `.profile` patch did not apply — re-run that block.

### 7. God-session install (tmux + systemd + always-on Claude + scheduler)

The runtime layer that makes the workload always-on. Six artifacts (all installed regardless of Telegram — scheduler and agent config are independent of the Telegram bridge):

| Reference | Target | Owner | Mode |
|---|---|---|---|
| [`references/god-session.sh`](references/god-session.sh) | `/usr/local/bin/${SERVICE_PREFIX}-god` | root:root | 755 |
| [`references/god-session.service`](references/god-session.service) | `/etc/systemd/system/${SERVICE_PREFIX}-god.service` | root:root | 644 |
| [`references/dispatch.timer`](references/dispatch.timer) | `/etc/systemd/system/${SERVICE_PREFIX}-dispatch.timer` | root:root | 644 |
| [`references/dispatch.service`](references/dispatch.service) | `/etc/systemd/system/${SERVICE_PREFIX}-dispatch.service` | root:root | 644 |
| [`references/dispatch.md`](references/dispatch.md) | `/home/${BOT_USER}/.claude/commands/${DISPATCH_COMMAND_NAME}.md` | `${BOT_USER}`:`${BOT_USER}` | 644 |
| [`references/settings.agent-config.fragment.json`](references/settings.agent-config.fragment.json) | jq-merged into `/home/${BOT_USER}/.claude/settings.json` | `${BOT_USER}`:`${BOT_USER}` | 644 |

For each template: read the file, substitute `${VAR}` placeholders, upload via `mcp__hex-ssh__ssh-write-chunk`, set ownership and mode. Note the rename when uploading the dispatch unit files (they're named `dispatch.timer`/`dispatch.service` in the repo for clarity, but land as `${SERVICE_PREFIX}-dispatch.*` on the VPS).

**About `settings.agent-config.fragment.json`** — this fragment pins headless-agent defaults that must NOT depend on a TTY:

```json
{
  "model": "opus",
  "effortLevel": "xhigh",
  "permissions": { "defaultMode": "bypassPermissions" }
}
```

- `model: "opus"` resolves to the latest Opus on the Anthropic API (currently Opus 4.7 per [model-config docs](https://code.claude.com/docs/en/model-config#available-models)). Pinning it keeps the god-session on Opus instead of auto-falling back to Sonnet at usage thresholds.
- `effortLevel: "xhigh"` forces deep reasoning. On Opus 4.7 this is the default since v2.1.117 — pinning protects against future default changes and against runs on Sonnet 4.6 where default is `high`.
- `permissions.defaultMode: "bypassPermissions"` removes interactive permission prompts even when something starts `claude` without `--dangerously-skip-permissions`. The flag in `god-session.sh` plus this default give belt-and-braces. Per [permission-modes docs](https://code.claude.com/docs/en/permission-modes#skip-all-checks-with-bypasspermissions-mode): protected paths still prompt; only safe inside isolated VPS dedicated to this workload. The agent still asks the operator via Telegram (relay-bot Stop hook → outbox) — what's eliminated is the *TUI permission popup*, not user-facing communication.

**Install + enable:**

```bash
install -d -o ${BOT_USER} -g ${BOT_USER} -m 755 /var/lib/${PROJECT_NAME}
touch /var/log/${PROJECT_NAME}-god.log && chown ${BOT_USER}:${BOT_USER} /var/log/${PROJECT_NAME}-god.log
sudo -u ${BOT_USER} mkdir -p /home/${BOT_USER}/.claude/commands

# Ensure settings.json exists, then jq-merge agent-config fragment
sudo -u ${BOT_USER} bash -lc 'mkdir -p ~/.claude && [ -f ~/.claude/settings.json ] || echo "{}" > ~/.claude/settings.json'
# (after uploading references/settings.agent-config.fragment.json to /tmp/agent-config.json)
sudo -u ${BOT_USER} bash -lc 'jq -s ".[0] * .[1]" ~/.claude/settings.json /tmp/agent-config.json > ~/.claude/settings.json.new && mv ~/.claude/settings.json.new ~/.claude/settings.json'
rm /tmp/agent-config.json

loginctl enable-linger ${BOT_USER}
systemctl daemon-reload
systemctl enable --now ${SERVICE_PREFIX}-god.service
systemctl enable --now ${SERVICE_PREFIX}-dispatch.timer
```

**Verify:**

```bash
systemctl status ${SERVICE_PREFIX}-god.service --no-pager | head -10
systemctl list-timers ${SERVICE_PREFIX}-dispatch.timer --no-pager
sudo -u ${BOT_USER} tmux ls
sudo -u ${BOT_USER} tmux capture-pane -t ${SERVICE_PREFIX}-god -p -S -200 | tail -40
tail -10 /var/log/${PROJECT_NAME}-god.log
```

Expected timeline:
- t+0s: wrapper boots, log `[${SERVICE_PREFIX}-god] boot`.
- t+1s: tmux session `${SERVICE_PREFIX}-god` exists.
- t+5s: log `fresh session up; ${SERVICE_PREFIX}-dispatch.timer will inject /${DISPATCH_COMMAND_NAME} hourly`.
- next `:07`: `${SERVICE_PREFIX}-dispatch.service` fires and tmux pane receives `/${DISPATCH_COMMAND_NAME}`.
- Telegram inbound (Step 7c, optional) is wired separately via `${SERVICE_PREFIX}-relay-bot.service`. The pane should NOT contain a `Listening for channel messages` line.

### 7b. `/usage` Telegram command — statusLine cache (only if `TELEGRAM_BOT_TOKEN` is set)

The Telegram bot exposes `/usage` so the operator sees the same Session-5h-% / Weekly-7d-% as Claude Code's UI USAGE panel. Data flows from `rate_limits` in every API response → statusLine script → cache file → reporter script.

**Why statusLine, not `/api/oauth/usage`:** the OAuth endpoint exists but is undocumented and rate-limit-prone. The official path is the [statusLine API](https://code.claude.com/docs/en/statusline). Trade-off: statusLine exposes only `five_hour` and `seven_day` (not `seven_day_sonnet`).

Three artifacts:

| Reference | Target | Owner | Mode |
|---|---|---|---|
| [`references/statusline.sh`](references/statusline.sh) | `/home/${BOT_USER}/.claude/statusline.sh` | `${BOT_USER}`:`${BOT_USER}` | 755 |
| [`references/claude-usage-report.sh`](references/claude-usage-report.sh) | `/usr/local/bin/claude-usage-report` | root:root | 755 |
| [`references/operator.CLAUDE.md`](references/operator.CLAUDE.md) | `/home/${BOT_USER}/.claude/CLAUDE.md` | `${BOT_USER}`:`${BOT_USER}` | 644 |

Upload each, render placeholders, then merge the statusLine fragment into `~${BOT_USER}/.claude/settings.json`:

```bash
sudo -u ${BOT_USER} bash -lc 'jq ". + $(cat ~/.claude/.staging/settings.statusline.fragment.json)" ~/.claude/settings.json > ~/.claude/settings.json.new && mv ~/.claude/settings.json.new ~/.claude/settings.json'
```

(Use [`references/settings.statusline.fragment.json`](references/settings.statusline.fragment.json), substitute `${BOT_USER}`, scp to `~/.claude/.staging/`, run the jq merge, remove the staging file.)

**Restart god-session** so the new statusLine config takes effect:

```bash
systemctl restart ${SERVICE_PREFIX}-god.service
sleep 10
sudo -u ${BOT_USER} ls -la /home/${BOT_USER}/.claude/cache/usage.json   # expect file modified <30s ago
```

**Verify:** `sudo -u ${BOT_USER} claude-usage-report` prints the two-line report. From Telegram: send `/usage` to the bot — same text appears within ~3-5 seconds.

### 7c. Text-only Telegram bridge + central state-store (claude-relay-bot v6)

**Gated on `TELEGRAM_BOT_TOKEN`.** If you skip Telegram, the god-session and scheduler from Step 7 still work — only the inbound-from-operator and outbound-mirror paths are absent.

The operator's incoming Telegram text needs to reach claude in the god-session, and claude's replies must mirror back to Telegram. The intuitive answer would be `claude --channels plugin:telegram@claude-plugins-official` — but that bun-based MCP child silently dies after long idle / network blips and is not respawned ([anthropics/claude-plugins-official#788](https://github.com/anthropics/claude-plugins-official/issues/788), [#917](https://github.com/anthropics/claude-plugins-official/issues/917), [#1478](https://github.com/anthropics/claude-plugins-official/issues/1478)).

We replace it with **`${SERVICE_PREFIX}-relay-bot.service`** — a separate systemd-managed Python daemon that owns the entire god-session state machine. The bridge is intentionally text-only: plain text and media captions are accepted; voice, audio, files, images, videos, and stickers without captions are rejected and audited.

- **Inbound**: aiogram polls Telegram → text/caption is saved to durable SQLite `messages(kind='text', status='queued')` → an inbound worker delivers it to `${SERVICE_PREFIX}-god` only through the serialized control lane. Stable inbound IDs in the prefix give idempotent correlation across `/resume` / `/compact`.
- **Rejected media**: unsupported media without text/caption is written as `messages(status='rejected')`, replied to with “Сейчас поддерживаются только текстовые сообщения”, and never reaches Claude.
- **Control lane**: `/new_session`, Resume, Delete, and inbound delivery are serialized by one asyncio control queue; Telegram handlers never send text directly to tmux.
- **Outbound**: documented Claude Code `Stop` hook (POST to `http://127.0.0.1:${RELAY_HOOK_PORT}/hook/stop`) enqueues `last_assistant_message` into a SQLite outbox; an asyncio worker drains the queue with retry/backoff. Stop hook never blocks on Telegram API. claude doesn't carry the bot token in its context — hooks deliver structured JSON to relay-bot.
- **Audit & memory**: SQLite at `/var/lib/${PROJECT_NAME}/relay.db` — messages, outbox, sessions, session_events, dispatch_runs, dispatch_phases, memories, health_snapshots, auth_rejects, allowed_users. SessionStart hook injects recent memories + dispatch history into the new session as `additionalContext` (claude sees its own past).
- **Local API**: `http://127.0.0.1:${RELAY_HOOK_PORT}` — 6 hook receivers + 7 application endpoints (`/dispatch/*` for pipeline tracking, `/memory/*` for persistent facts, `/health`). claude calls these from bash blocks; operator calls them via the local `dispatcher.md` slash-command.
- **Sessions feature**: relay-bot intercepts `/new_session`, `/sessions`, `/sessions all`, `/sessions delete <id>` Telegram commands and handles them WITHOUT forwarding to claude. Wraps Claude Code's session model (one `.jsonl` per session in `~${BOT_USER}/.claude/projects/<encoded-cwd>/`) with a Telegram UI:
  - **Default god-session boot** = `claude --continue` (resume latest); fresh start only on first-ever boot or after operator's `/new_session`.
  - **Atomic command queue** at `/var/lib/${PROJECT_NAME}/god-command.json` (written by relay-bot via `tempfile + os.rename` under flock; consumed by `god-session.sh` on tmux fresh-create).
  - **`/sessions` UI**: cards with `[▶ Resume]` `[🗑 Delete]` inline buttons; UUID-validated callback_data; per-sid `asyncio.Lock` prevents Resume/Delete races.
  - **Fail-loud**: invalid resume target → `god-session.sh` writes `last-god-error.json` → relay-bot pushes alert «⚠️ Resume failed for `<id>` — started fresh».
  - **Sessions dir auto-discovery**: relay-bot scans `~/.claude/projects/*` and matches by `cwd` field in the first JSONL line — no hard-coded encoding assumption. Cached at `/var/lib/${PROJECT_NAME}/sessions-dir.path`.

Note: scheduling (the `${SERVICE_PREFIX}-dispatch.timer` that replaces the fragile in-session `/loop`) is part of Step 7 — installed regardless of Telegram. It only depends on tmux + systemd, not on the relay-bot.

**Hermes-borrowed code patterns** (from `nousresearch/hermes-agent` `gateway/platforms/telegram.py`): UTF-16-aware 4096-char split, `TelegramRetryAfter` retry, `TelegramNetworkError` → `unknown` (not retried, since Telegram may have received).

**Artifacts:**

| Reference | Target | Owner | Mode |
|---|---|---|---|
| [`references/claude-relay-bot.py`](references/claude-relay-bot.py) | `/usr/local/bin/claude-relay-bot.py` | root:root | 755 |
| [`references/claude-relay-bot.service`](references/claude-relay-bot.service) | `/etc/systemd/system/${SERVICE_PREFIX}-relay-bot.service` | root:root | 644 |
| [`references/settings.hooks.fragment.json`](references/settings.hooks.fragment.json) | rendered, then jq-merged into `/home/${BOT_USER}/.claude/settings.json` | (BOT) | 644 |

**Install:**

```bash
# 1. Install aiogram + aiohttp in dedicated venv
sudo -u ${BOT_USER} python3 -m venv /home/${BOT_USER}/.venv-relay
sudo -u ${BOT_USER} /home/${BOT_USER}/.venv-relay/bin/pip install --quiet aiogram aiohttp

# 2. Render claude-relay-bot.py (substitute ${PROJECT_NAME}, ${SERVICE_PREFIX}, ${BOT_USER}) → /usr/local/bin/, mode 755
# 3. Render claude-relay-bot.service → /etc/systemd/system/${SERVICE_PREFIX}-relay-bot.service, mode 644
# 4. Render settings.hooks.fragment.json with RELAY_HOOK_PORT → /tmp/hooks.json, then jq-merge:
sudo -u ${BOT_USER} bash -lc 'jq -s ".[0] * .[1]" ~/.claude/settings.json /tmp/hooks.json > ~/.claude/settings.json.new && mv ~/.claude/settings.json.new ~/.claude/settings.json'

# 5. Enable + reload claude
systemctl daemon-reload
systemctl enable --now ${SERVICE_PREFIX}-relay-bot.service
systemctl restart ${SERVICE_PREFIX}-god.service   # so claude reloads settings.json with hooks
```

**Verify:**

```bash
# Relay listening + DB ready
curl -fsS http://127.0.0.1:${RELAY_HOOK_PORT}/health | jq .
sqlite3 /var/lib/${PROJECT_NAME}/relay.db '.tables'   # 12 tables expected

# Hook fires verified (after operator sends Telegram message)
sqlite3 /var/lib/${PROJECT_NAME}/relay.db 'SELECT direction,status,substr(text,1,40) FROM messages ORDER BY id DESC LIMIT 5'

# Sessions feature: after the first claude run, relay-bot resolves and caches the sessions dir
cat /var/lib/${PROJECT_NAME}/sessions-dir.path   # /home/${BOT_USER}/.claude/projects/...

# End-to-end: operator sends "hi" → claude responds in pane → outbox row sent → operator sees reply in Telegram
```

The pane should NOT contain `Listening for channel messages from: plugin:telegram@...` — that's the deprecated Channels-plugin path.

**Sessions-feature runtime files (created at runtime, not by skill):**

| Path | Owner | Created by | Purpose |
|---|---|---|---|
| `/var/lib/${PROJECT_NAME}/god-command.json` | `${BOT_USER}` | relay-bot on `/new_session` or [Resume] click | Atomic queue for wrapper. Schema: `{command_id, ts, action, session_id, operator_chat_id}`. Consumed (`unlink`) by wrapper on next tmux fresh-create. |
| `/var/lib/${PROJECT_NAME}/.cmd-lock` | `${BOT_USER}` | wrapper (`flock` target) | Lock file for atomic command-file consume. |
| `/var/lib/${PROJECT_NAME}/sessions-dir.path` | `${BOT_USER}` | relay-bot first-run | Cached path to Claude Code's per-cwd sessions dir (auto-discovered by matching JSONL `cwd` field, not by hardcoded encoding). |
| `/var/lib/${PROJECT_NAME}/last-god-error.json` | `${BOT_USER}` | wrapper on resume_invalid etc. | Polled by relay-bot every 5s; pushed to operator as Telegram alert; deleted after delivery. |

The skill creates the parent `/var/lib/${PROJECT_NAME}/` automatically via `StateDirectory=${PROJECT_NAME}` in `god-session.service` (mode 0700).

### 8. Optional integrations

#### 8a. GitHub App (only if `GITHUB_APP_ID` is set)

Mints fresh installation tokens (~1h) on demand for `git push` / `gh` calls inside agent runs.

| Reference | Target | Owner | Mode |
|---|---|---|---|
| [`references/mint-gh-token.sh`](references/mint-gh-token.sh) | `/usr/local/bin/${SERVICE_PREFIX}-mint-gh-token` | root:`${BOT_USER}` | 750 |

Install + secrets-side prep:

```bash
# After uploading mint-gh-token.sh as /usr/local/bin/${SERVICE_PREFIX}-mint-gh-token
install -d -o root -g ${BOT_USER} -m 750 /etc/${PROJECT_NAME}
# Operator places the App PEM at ${GITHUB_APP_PRIVATE_KEY_PATH} (chown root:${BOT_USER}, mode 640)
# Operator fills /etc/${PROJECT_NAME}/secrets.env from references/secrets.env.template (mode 640)
```

**Verify:** `sudo -u ${BOT_USER} ${SERVICE_PREFIX}-mint-gh-token | head -c 8` → `ghs_...` prefix.

Wire `git` to use the minter as credential helper:

```bash
sudo -u ${BOT_USER} git config --global credential.helper '!f() { echo "username=x-access-token"; echo "password=$('${SERVICE_PREFIX}'-mint-gh-token)"; }; f'
```

#### 8b. Codex notify hook (only if `TELEGRAM_BOT_TOKEN` is set)

| Reference | Target | Owner | Mode |
|---|---|---|---|
| [`references/codex-notify.sh`](references/codex-notify.sh) | `/home/${BOT_USER}/.codex/notify.sh` | `${BOT_USER}`:`${BOT_USER}` | 755 |

`config.toml` already wires it via the `notify = ["bash", ...]` line (rendered in Step 5b).

#### 8c. Cloudflare (only if `CF_API_TOKEN` is set)

Skill scope intentionally minimal — Cloudflare ops are project-specific. The `secrets.env.template` documents the variable names; the operator wires their own tooling against them.

### 9. Operator dispatcher install (LOCAL machine, NOT VPS)

Two parts: (a) copy the dispatcher slash-command **verbatim**, (b) seed the operator's `.env.local` with the keys it reads at runtime.

**(a) Copy `dispatcher.md.template` verbatim** to `${TARGET_REPO_PATH}/.claude/commands/dispatcher.md`. Do NOT envsubst — the file uses `${VPS_*}` placeholders that are intentionally resolved at slash-command invocation by sourcing `.env.local`. Substituting at install time would replace them with empty strings.

```
mkdir -p ${TARGET_REPO_PATH}/.claude/commands
cp references/dispatcher.md.template ${TARGET_REPO_PATH}/.claude/commands/dispatcher.md
```

**(b) Seed `.env.local`.** Append the 9 `VPS_*` keys to `${TARGET_REPO_PATH}/.env.local` (with the values from this skill's Configuration block). Skip any key already present.

```bash
cat >> ${TARGET_REPO_PATH}/.env.local <<EOF
VPS_HOST=${VPS_HOST}
VPS_SSH_KEY=${VPS_SSH_KEY}
VPS_BOT_USER=${BOT_USER}
VPS_PROJECT_NAME=${PROJECT_NAME}
VPS_SERVICE_PREFIX=${SERVICE_PREFIX}
VPS_PROJECT_DIR=${PROJECT_DIR}
VPS_GITHUB_REPO=${GITHUB_REPO}
VPS_RELAY_HOOK_PORT=${RELAY_HOOK_PORT}
VPS_DISPATCH_COMMAND_NAME=${DISPATCH_COMMAND_NAME}
EOF
```

Confirm `.env.local` is git-ignored (most projects already have `.env.*` in `.gitignore`).

**Verify:**
- `grep -E '\$\{(?!VPS_)[A-Z_]+\}' ${TARGET_REPO_PATH}/.claude/commands/dispatcher.md` — empty (only `${VPS_*}` placeholders remain; no other `${VAR}` should exist).
- `grep -E '^VPS_(HOST|SSH_KEY|BOT_USER|PROJECT_NAME|SERVICE_PREFIX|PROJECT_DIR|GITHUB_REPO|RELAY_HOOK_PORT|DISPATCH_COMMAND_NAME)=' ${TARGET_REPO_PATH}/.env.local` — 9 lines.

---

## Manual follow-up (operator, not the agent)

The bootstrap stops at "agents installed but not authenticated". The next steps need the operator's hands because they involve 2FA, browser-only flows, and tokens that must never touch the agent's context.

**Verified non-automatable** (each requires a human at a browser or 2FA device):

| # | Action | Why operator, not agent |
|---|--------|-------------------------|
| 1 | `claude /login` on the VPS | OAuth + 2FA at Anthropic. Open URL on the laptop, paste code back. SSH local-forward `-L 8080:localhost:8080` for redirect-callback flavour. **Alternative**: pre-issue a long-lived OAuth token via `claude setup-token` on the operator's laptop (also interactive, but only once) and paste into VPS's `~${BOT_USER}/.claude/credentials.json`. |
| 2 | `codex login` on the VPS | Same browser+2FA flow with ChatGPT account. |
| 3 | (If Telegram) Create bot via `@BotFather` | Telegram doesn't expose a public API for bot creation — must chat with `@BotFather`, type `/newbot`, pick a name, copy `BOT_TOKEN`. Get operator's `chat_id` via `https://api.telegram.org/bot<TOKEN>/getUpdates` after sending `/start` to the new bot. |
| 4 | **(If Telegram) Lock the bot down in `@BotFather`** — see «Telegram bot hardening» below | BotFather settings (Allow Groups, Group Privacy) are NOT exposed via Bot API; only the BotFather chat UI can change them. **Critical** because the bot username is publicly discoverable. |
| 5 | (If GitHub App) Create the GitHub App | github.com web UI only — no API for App registration. Permissions: Contents R/W, Issues R/W, Pull requests R/W, Metadata R. Install on the target repo. Download PEM file. |
| 6 | Fill `/etc/${PROJECT_NAME}/secrets.env` | Use [`references/secrets.env.template`](references/secrets.env.template) as scaffold. Mode 640, owner `root:${BOT_USER}`. |
| 7 | Place GitHub App PEM at `${GITHUB_APP_PRIVATE_KEY_PATH}` | Operator's local download → scp to VPS. Mode 640, owner `root:${BOT_USER}`. |

### Telegram bot hardening (item #4 expanded)

Defense-in-depth: the relay-bot's `AllowlistMiddleware` already drops every event from non-allowlisted user_ids (and audits to `auth_rejects`). But Telegram-side settings further reduce attack surface. **Do this immediately after creating the bot in step #3:**

1. Open `@BotFather` → `/mybots` → select your bot.
2. **Bot Settings** → **Allow Groups?** → **Turn off**. Now the bot can only be DM'd; nobody can add it to a group to flood with messages.
3. **Bot Settings** → **Group Privacy** → **Enable** (default; verify). Belt-and-braces — even if Allow Groups gets re-enabled, the bot only sees commands in groups, not all messages.
4. Verify via Bot API:
   ```bash
   curl -fsS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe" | jq '.result | {username, can_join_groups, can_read_all_group_messages}'
   ```
   Expected: `can_join_groups: false`, `can_read_all_group_messages: false`.
5. **Token rotation procedure** (on suspected leak): `@BotFather` → `/mybots` → bot → **API Token** → **Revoke current token**. Update `/etc/${PROJECT_NAME}/secrets.env` with the new token (preserve mode 640, owner `root:${BOT_USER}`), then `systemctl restart ${SERVICE_PREFIX}-relay-bot.service`. Old token becomes 401 immediately.

The bot's `AllowlistMiddleware` is the primary control regardless of these settings — but combining application-level filtering with Telegram-side restrictions is best practice (Telegram official guidance: «Your backend should always verify that the user was authorized to use them»).

**Automatable AFTER `TELEGRAM_BOT_TOKEN` is set in secrets.env** (skill could do this in a Step 7d, currently left to the operator for clarity):

| # | Action | How to automate |
|---|--------|------------------|
| A | Register BotFather menu commands `/usage`, `/new_session`, `/sessions`, `/users` | `curl -fsS -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setMyCommands" -H 'Content-Type: application/json' -d '{"commands":[{"command":"usage","description":"Текущие лимиты Claude"},{"command":"new_session","description":"Старт новой сессии Claude"},{"command":"sessions","description":"Сессии (Resume / Delete)"},{"command":"users","description":"Управление доступом (только primary)"}]}'`. Idempotent. |
| B | Set bot description + about | `setMyDescription`, `setMyShortDescription` Bot API. Optional cosmetic. |

**Currently NOT automated by this skill** — the operator runs the curl command from the table above once after the bot token is in secrets.env. Adding this to the skill is a small TODO; the manual curl works for now.

### Multi-user onboarding

After the primary operator is set up, additional users join via the bot's pending → `/users` approval flow. There is no env-var allowlist — DB is the only source of truth.

1. New user (e.g. a colleague) finds the bot username and DMs it for the first time.
2. `AllowlistMiddleware` sees no row in `allowed_users` for that user_id → INSERT pending + auto-reply to user «⏳ Your access is pending approval» + alert to primary operator: «🆕 New user request: @<username> (id=<X>) — type `/users` to manage».
3. Primary types `/users` in their DM → bot replies with N cards (one per known user). The new user shows up with status `pending` and inline buttons `[✓ Allow] [⛔ Block] [🗑 Delete]`.
4. Primary clicks `[✓ Allow]` → DB row updates to `status='allowed'`, allowlist cache refreshes, bot DMs the new user «✓ Access granted by operator. You can use the bot now.»
5. New user can now DM normally; their messages forward to the shared pane with prefix `[tg id=<chat>:<msg> user=<name>] <text>` so claude sees who asked.
6. Their `/sessions` shows only own sessions (created via `/new_session` from their account); Resume/Delete restricted to own. Pane content is shared.

To revoke: primary types `/users` → finds the user → `[⛔ Block]` (silent revoke, no notification) or `[🗑 Delete]` (removes row entirely; user re-enters pending if they DM again).

Primary's own card has no action buttons — labelled «🛡 primary operator (protected)». You cannot block or delete the primary via the bot. To replace primary: change `TELEGRAM_CHAT_ID` in `secrets.env`, restart `${SERVICE_PREFIX}-relay-bot.service` — bootstrap inserts the new primary; old primary becomes a regular allowed user (or you can delete via `/users` then).

---

## Verification & smoke

End-to-end after install + manual follow-up:

```
| Component                         | Version / Status               |
|-----------------------------------|--------------------------------|
| Claude Code                       | 2.1.x (auth: ✓)               |
| Codex CLI                         | 0.x   (auth: ✓)               |
| Node                              | v24.x.x                        |
| gh CLI                            | 2.x   (auth via App: ✓)       |
| ${BOT_USER} user                  | UID 1000                       |
| ${SERVICE_PREFIX}-god.service     | active (running)               |
| ${SERVICE_PREFIX}-dispatch.timer  | active (waiting), next fire armed |
| tmux ${SERVICE_PREFIX}-god        | exists                         |
| /home/${BOT_USER}/.claude/cache/usage.json | populated within 30s of restart |
| Telegram bidirectional smoke      | bot replies to /usage with %    |
| ${TARGET_REPO_PATH}/.claude/commands/dispatcher.md | copied verbatim; only `${VPS_*}` placeholders remain |
| ${TARGET_REPO_PATH}/.env.local    | 9 `VPS_*` keys present         |
| `/dispatcher status` (from operator's repo) | reports healthy |
```

---

## Troubleshooting

| Issue | Solution |
|---|---|
| `nvm install` says success but `node` not found in next command | The pipe `\| tail` ran `nvm install` in a subshell; PATH side-effect lost. Re-run without piping. |
| `sudo -i -u ${BOT_USER} which node` returns empty | `.profile` patch missing. Re-run step 4's `printf >> .profile` block. |
| `command contains null bytes or newlines` from `mcp__hex-ssh__remote-ssh` | Tool rejects literal `\n` in command string. Use `&&` chains or `printf '\n...'` for embedded newlines. |
| `claude /login` redirect to `localhost:8080` fails | SSH session was opened without `-L 8080:localhost:8080`. Reconnect with `ssh -i ${VPS_SSH_KEY} -L 8080:localhost:8080 -L 8081:localhost:8081 ${BOT_USER}@${VPS_HOST}`. |
| Modern paste-code login flow vs OAuth callback | CLI prints the URL — read what it says. Paste-code: enter long auth code shown on the auth-success page. OAuth callback: leave SSH `-L` open, browser redirect lands via tunnel. |
| Co-tenant container OOM during agent activity | RAM is tight. Either lower `MemoryMax` in `god-session.service`, or move `${BOT_USER}` workload to a dedicated small VPS (~€5/mo). |
| `gh auth login` says token has insufficient scopes | If using PAT instead of GH App: re-issue PAT with Contents R/W, Issues R/W, Pull requests R/W, Metadata R. Partial scopes silently break `gh issue edit --add-label`. |
| `tput: unknown terminal "unknown"` warning during scripted runs | Cosmetic. Caused by no TTY. Ignore or `export TERM=dumb` in the wrapper. |
| `Codex could not find bubblewrap on PATH ... will use the vendored bubblewrap` | System `bwrap` is missing — Step 1's apt install didn't run on this snapshot. `apt-get install -y bubblewrap`. |
| `gh` reports "You are not logged into any GitHub hosts" despite `GH_TOKEN=val gh ...` | `sudo -i -u <user>` spawns a subshell where bash inline-assignment doesn't propagate. Use `sudo -u <user> bash -lc '...'` (without `-i`). The `-l` flag still loads `.profile`. |
| `claude-usage-report` says «Кэш ещё не заполнен» | God-session has not made an API call since last restart. Send any Telegram message (or `tmux send-keys -t ${SERVICE_PREFIX}-god "ping" Enter`) to trigger the first response — statusLine fires on the API tick and writes the cache. |
| `/api/oauth/usage` returns `OAuth authentication is currently not supported` | Wrong/missing `anthropic-beta: oauth-2025-04-20` header. The endpoint is undocumented anyway — prefer the official statusLine path in Step 7b. |
| `claude-usage-report` percentages don't match the UI panel on the laptop | Cache is stale (script prints `⚠️ Данные обновлены N мин назад`). Send any Telegram message; statusLine fires on the next API tick and refreshes the cache. |

---

## Definition of Done

This DoD covers every step of the workflow. Run through it after the operator's manual follow-up. Each unchecked item points back to the step that creates it.

### System packages & user (Steps 1–3)
- [ ] All required Configuration vars are set; optional vars explicitly empty if the corresponding step is skipped
- [ ] `which curl wget git jq gpg pipx python3 bwrap unzip tmux gh` — all paths resolved (Step 1+2)
- [ ] `id ${BOT_USER}` returns UID (typically 1000); `~${BOT_USER}/.ssh/authorized_keys` mode 600 (Step 3)
- [ ] `loginctl show-user ${BOT_USER} | grep Linger=yes` — linger enabled so user units survive logout (Step 7)

### Agents (Steps 4–6)
- [ ] `sudo -i -u ${BOT_USER} bash -lc 'node --version'` → `v24.x.x` (Step 4)
- [ ] `sudo -i -u ${BOT_USER} bash -lc 'claude --version'` → `2.1.x (Claude Code)`; auth completed (Manual #1)
- [ ] `sudo -i -u ${BOT_USER} bash -lc 'codex --version'` → `codex-cli 0.x`; auth completed (Manual #2)
- [ ] (If `REF_API_KEY` or `CONTEXT7_API_KEY`) `sudo -u ${BOT_USER} bash -lc 'claude mcp list'` shows the corresponding server (Step 5b)
- [ ] (Same for codex side) `sudo -u ${BOT_USER} bash -lc 'codex mcp list'` shows the corresponding server (Step 5b)

### Headless config (Steps 5b + 7)
- [ ] **Claude headless config**: `~${BOT_USER}/.claude/settings.json` has `model: "opus"`, `effortLevel: "xhigh"`, `permissions.defaultMode: "bypassPermissions"` (verify: `sudo -u ${BOT_USER} jq '.model,.effortLevel,.permissions.defaultMode' ~/.claude/settings.json`)
- [ ] **Codex headless config**: `~${BOT_USER}/.codex/config.toml` has `model = "gpt-5.5"`, `model_reasoning_effort = "xhigh"`, `approval_policy = "never"`, `sandbox_mode = "danger-full-access"` (verify: `sudo -u ${BOT_USER} grep -E '^(model|model_reasoning_effort|approval_policy|sandbox_mode)\b' ~/.codex/config.toml`)

### God-session + scheduler (Step 7)
- [ ] `${SERVICE_PREFIX}-god.service` is `active (running)` and the tmux session `${SERVICE_PREFIX}-god` exists
- [ ] `${SERVICE_PREFIX}-dispatch.timer` is `active (waiting)`; `systemctl list-timers ${SERVICE_PREFIX}-dispatch.timer` shows next fire armed
- [ ] `/var/lib/${PROJECT_NAME}/` exists, mode 0700, owner `${BOT_USER}` (created by `StateDirectory=${PROJECT_NAME}`)
- [ ] `/var/log/${PROJECT_NAME}-god.log` writable by `${BOT_USER}`; pane content visible via `tmux capture-pane`
- [ ] Pane footer shows `[Opus 4.7 (1M context)] N% ctx` and `bypass permissions on (shift+tab to cycle)` — confirms model + effort + permissions are live

### statusLine + /usage (Step 7b, gated on `TELEGRAM_BOT_TOKEN`)
- [ ] `~${BOT_USER}/.claude/statusline.sh` mode 755
- [ ] `~${BOT_USER}/.claude/cache/usage.json` populated within ~30s of god restart (statusLine fires on first API tick)
- [ ] `sudo -u ${BOT_USER} claude-usage-report` prints two-line report; `/usage` from Telegram returns same text

### Telegram bridge + sessions feature (Step 7c, gated on `TELEGRAM_BOT_TOKEN`)
- [ ] `${SERVICE_PREFIX}-relay-bot.service` is active; `curl -fsS http://127.0.0.1:${RELAY_HOOK_PORT}/health` returns `{"ok":true,"version":"v6",...}` with `god_session_ready`, `inbound_queued`, `inbound_failed`, `inbound_rejected`, `outbox_unknown`, `control_busy`, `control_pending`
- [ ] `sqlite3 /var/lib/${PROJECT_NAME}/relay.db '.tables'` shows 12 tables (messages, pending_reply, outbox, sessions, session_events, dispatch_runs, dispatch_phases, memories, health_snapshots, auth_rejects, allowed_users, todo_state)
- [ ] After first claude run, `/var/lib/${PROJECT_NAME}/sessions-dir.path` exists and points to a real dir under `~${BOT_USER}/.claude/projects/`
- [ ] `/sessions` from Telegram returns at least one card with `[▶ Resume] [🗑 Delete]` inline buttons; `/sessions all` returns text list
- [ ] Restart of `${SERVICE_PREFIX}-god.service` resumes the latest session (pane shows prior conversation content, NOT a fresh «Welcome to Claude»)
- [ ] `/new_session` from Telegram produces a fresh pane within ~5–10s; `god-command.json` was created and consumed (gone)
- [ ] **BotFather menu**: `/usage`, `/new_session`, `/sessions` are registered (verify: `curl -fsS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMyCommands" \| jq '.result[].command'`). If missing, run `setMyCommands` (see Manual follow-up table A).
- [ ] **Bot hardening (security)**: `curl -fsS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe" \| jq '.result \| {can_join_groups, can_read_all_group_messages}'` returns `{"can_join_groups": false, "can_read_all_group_messages": false}` — bot is DM-only and cannot read group history. BotFather instructions should tell operators to send text, not voice/audio.
- [ ] **Allowlist middleware**: `sqlite3 /var/lib/${PROJECT_NAME}/relay.db ".schema auth_rejects"` returns the audit table. After deployment, an unauthorized DM attempt (e.g. test from a second account) appears in `SELECT * FROM auth_rejects ORDER BY ts DESC LIMIT 5` with status «silent drop, no reply».
- [ ] **`/users` allowlist management**: `sqlite3 /var/lib/${PROJECT_NAME}/relay.db "SELECT user_id, status FROM allowed_users"` shows primary operator with `status='allowed'` (and any approved colleagues). `/users` from primary's Telegram → list with `[✓ Allow] [⛔ Block] [🗑 Delete]` cards (primary card has no buttons — protected). Second account DMs the bot → status='pending' row appears + primary gets «🆕 New user request» alert. After Allow, second account can interact normally.
- [ ] **Per-user session ownership**: `sqlite3 /var/lib/${PROJECT_NAME}/relay.db "PRAGMA table_info(sessions)"` shows `created_by_user_id` column. Second user's `/sessions` returns empty until they create their own; their Resume/Delete on primary's session ID is rejected with «not your session».
- [ ] Text-only inbound smoke: send plain text and a media message with caption → both create `messages(kind='text', status='queued')` rows and then become `delivered`; send voice/audio/photo without caption → row is `rejected`, Telegram replies «Сейчас поддерживаются только текстовые сообщения», and claude receives nothing
- [ ] Durable inbound smoke: send a Telegram message while `${SERVICE_PREFIX}-god` is restarting; `messages.status='queued'` until tmux returns, then `delivered`
- [ ] Control-lane smoke: trigger `/new_session` and immediately send text; the text stays queued until the tmux session is ready, then is delivered after the control action completes
- [ ] End-to-end smoke: send «hi» from Telegram → inbound row delivered → claude responds → reply mirrored back via Stop hook → outbox row sent

### Communication policy (Step 7c-2, 5 layers L1–L5)
- [ ] `RELAY_VERBOSITY` is in `/etc/${PROJECT_NAME}/secrets.env` (default `normal`); `RELAY_INBOUND_REACTIONS` is set or omitted for the default reaction pool
- [ ] `sqlite3 /var/lib/${PROJECT_NAME}/relay.db "PRAGMA table_info(outbox)" \| grep event_type` returns the column; `sqlite3 ... ".schema todo_state"` returns the diff-tracking table
- [ ] `sudo -u ${BOT_USER} jq '.hooks \| keys' ~/.claude/settings.json` includes `PreToolUse` and `PostToolUse` (in addition to UserPromptSubmit, Stop, StopFailure, SessionStart, PostCompact, SubagentStop)
- [ ] **L1 inbound ack**: send any accepted text/caption → reaction from `RELAY_INBOUND_REACTIONS` (or ❤ fallback) appears on operator bubble within 1–2s after queueing
- [ ] **L2 Skill announce**: trigger a Skill → `🔧 Skill: <name>` arrives in Telegram before claude runs the skill
- [ ] **L3 Todo transitions**: trigger `TodoWrite` with status flips → each `🟡 Started:` and `✅ Done:` arrives as separate Telegram message
- [ ] **L4 Subagent boundary**: spawn an Explore/Plan subagent → on completion `✅ Subagent: <type> done` arrives
- [ ] **L5 final reply prefix**: claude's normal turn-end reply arrives with `💬 ` prefix
- [ ] **Token bucket**: trigger 10 Skills in 30s → first 5 reach Telegram with `🔧`, rest dropped silently. Confirm via `SELECT count(*) FROM outbox WHERE event_type='status_skill' AND ts > strftime('%s','now','-1 minute')` ≤ 5
- [ ] **Verbosity quiet**: `sed -i 's/^RELAY_VERBOSITY=.*/RELAY_VERBOSITY=quiet/' /etc/${PROJECT_NAME}/secrets.env && systemctl restart ${SERVICE_PREFIX}-relay-bot.service` → only L1+L5 reach Telegram (regression vs normal)
- [ ] **TodoWrite matcher empirical check**: `journalctl -u ${SERVICE_PREFIX}-relay-bot.service \| grep "tool_name=TodoWrite"` returns hits after a TodoWrite call. If missing → matcher mismatch; remove matcher and let endpoint filter inside Python

### GitHub App + git (Step 8a, gated on `GITHUB_APP_ID`)
- [ ] `/etc/${PROJECT_NAME}/github-app.pem` mode 640, owner `root:${BOT_USER}`
- [ ] `sudo -u ${BOT_USER} ${SERVICE_PREFIX}-mint-gh-token | head -c 8` → `ghs_...` prefix
- [ ] `sudo -u ${BOT_USER} git config --global credential.helper` includes `${SERVICE_PREFIX}-mint-gh-token` invocation

### Codex notify hook (Step 8b, gated on `TELEGRAM_BOT_TOKEN`)
- [ ] `~${BOT_USER}/.codex/notify.sh` mode 755; `~${BOT_USER}/.codex/config.toml` has `notify = ["bash", ...]` line
- [ ] (Optional) trigger a long-running Codex run and confirm Telegram notification arrives

### Operator dispatcher (Step 9, LOCAL machine)
- [ ] `${TARGET_REPO_PATH}/.claude/commands/dispatcher.md` exists, copied verbatim (only `${VPS_*}` placeholders remain — verify with `grep -E '\${(?!VPS_)[A-Z_]+}'` returning empty)
- [ ] `${TARGET_REPO_PATH}/.env.local` has the 9 `VPS_*` keys (HOST, SSH_KEY, BOT_USER, PROJECT_NAME, SERVICE_PREFIX, PROJECT_DIR, GITHUB_REPO, RELAY_HOOK_PORT, DISPATCH_COMMAND_NAME)
- [ ] `.env.local` is git-ignored
- [ ] `/dispatcher status` from operator's local repo reports healthy (all services active, queue empty or expected, RAM ok)
- [ ] `/dispatcher audit 3` returns last 3 dispatch runs from SQLite

---

## Related Documentation

- [Claude Code Channels](https://code.claude.com/docs/en/channels.md) — the Channels-plugin path Step 7c deliberately avoids; useful for understanding the trade-off
- [Claude Code statusLine](https://code.claude.com/docs/en/statusline) — `rate_limits` JSON schema (Step 7b)
- [Claude Code hooks](https://code.claude.com/docs/en/hooks) — UserPromptSubmit, Stop, SessionStart, PostCompact, StopFailure (Step 7c)
- [Codex CLI config](https://github.com/openai/codex/blob/main/docs/config.md) — `notify`, `mcp_servers`
- [Claude Code Scheduled Tasks](https://code.claude.com/docs/en/scheduled-tasks.md) — `/loop` semantics (replaced by external systemd timer)
- [systemd.timer](https://www.freedesktop.org/software/systemd/man/systemd.timer.html) — `OnCalendar`, `Persistent`, `Requires`

---

**Version:** 1.0.0
**Last Updated:** 2026-04-30

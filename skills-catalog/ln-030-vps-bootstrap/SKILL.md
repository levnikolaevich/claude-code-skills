---
name: ln-030-vps-bootstrap
description: "Use when bootstrapping a Linux VPS for autonomous Claude Code + Codex: packages, agent user, CLIs, MCP, god-session, scheduler, optional Telegram bridge."
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

**Type:** L3 Standalone
**Category:** 0XX Shared / Infrastructure
**Tested on:** Ubuntu 24.04 (apt + systemd base — Contabo, Hetzner, DigitalOcean)

Universal bootstrap of a Linux VPS into a self-contained Claude Code + Codex agent workload: system packages, dedicated `${BOT_USER}` user, agent CLIs, MCP servers, optional Telegram bot interface, an always-on god-session under tmux+systemd, and a project-specific operator dispatcher slash-command rendered into your local repo.

The skill is **parameterized** — instantiate it per-project by filling in the configuration block below. Optional integrations (Telegram, GitHub App, Cloudflare, MCP servers) auto-skip when the corresponding variable is empty.

---

## Scope: per-VPS vs per-project

**MANDATORY READ:** Load `references/scope_layers.md`

Recommended deployment shape: **one project = one `${BOT_USER}` Linux user = one Telegram bot token = one set of systemd units**. Re-run the skill with new vars for a second project on the same VPS — Steps 1+2 are idempotent (apt no-ops); each project ends up with its own bot user, state dir, units, and Telegram bot. Override `RELAY_HOOK_PORT` if the default `9999` collides.

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

**MANDATORY READ:** Load `references/substitution_rules.md`

VPS-side templates use install-time `envsubst`; the operator-side `dispatcher.md.template` is copied **verbatim** (do NOT envsubst). Always pass an explicit allow-list to `envsubst`, and **always include `$DISPATCH_COMMAND_NAME`** — forgetting it sends civic-god into a `Restart=always` loop on boot:

```bash
envsubst '$PROJECT_NAME $PROJECT_DIR $SERVICE_PREFIX $BOT_USER $RELAY_HOOK_PORT $DISPATCH_COMMAND_NAME $TELEGRAM_CHAT_ID' \
  < references/X > /tmp/X
```

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

Install system tools needed for the next steps. `bubblewrap` is for Codex CLI Linux sandbox; `python3` remains available for native npm build tooling used by some dependencies.

```bash
DEBIAN_FRONTEND=noninteractive apt-get install -y \
  curl wget git jq sqlite3 build-essential ca-certificates gnupg pipx \
  python3 bubblewrap unzip tmux
```

**Verify:**

```bash
which curl wget git jq sqlite3 gpg pipx python3 bwrap unzip tmux && pipx --version && bwrap --version && tmux -V
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

### 7c. Node.js Telegram bridge + central state-store (claude-relay-bot v6)

**Gated on `TELEGRAM_BOT_TOKEN`.** If you skip Telegram, the god-session and scheduler from Step 7 still work — only the inbound-from-operator and outbound-mirror paths are absent.

**MANDATORY READ:** Load `references/README.md` (Telegram bridge architecture v6, Communication policy 5 layers L1–L5, runtime files).

The bridge is a separate systemd-managed Node.js service (`${SERVICE_PREFIX}-relay-bot.service`) owning the entire god-session state machine. It preserves the Python relay's public contracts while using TypeScript, grammY, Fastify, and better-sqlite3. The deprecated Channels-plugin path (`claude --channels plugin:telegram@claude-plugins-official`) silently dies and is not respawned ([anthropics/claude-plugins-official#788](https://github.com/anthropics/claude-plugins-official/issues/788), [#917](https://github.com/anthropics/claude-plugins-official/issues/917), [#1478](https://github.com/anthropics/claude-plugins-official/issues/1478)) — we replace it.

Note: scheduling (the `${SERVICE_PREFIX}-dispatch.timer` that replaces the fragile in-session `/loop`) is part of Step 7 — installed regardless of Telegram. It only depends on tmux + systemd, not on the relay-bot.

**Artifacts:**

| Reference | Target | Owner | Mode |
|---|---|---|---|
| [`references/relay-bot/`](references/relay-bot/) | `/opt/${SERVICE_PREFIX}-relay-bot` | `${BOT_USER}`:`${BOT_USER}` | 755 dirs / 644 files |
| [`references/claude-relay-bot.service`](references/claude-relay-bot.service) | `/etc/systemd/system/${SERVICE_PREFIX}-relay-bot.service` | root:root | 644 |
| [`references/settings.hooks.fragment.json`](references/settings.hooks.fragment.json) | rendered, then jq-merged into `/home/${BOT_USER}/.claude/settings.json` | (BOT) | 644 |

**Install:**

```bash
# 1. Upload references/relay-bot/{package.json,package-lock.json,tsconfig.json,src/}
#    to /opt/${SERVICE_PREFIX}-relay-bot. Do not upload dist/ or node_modules/.
install -d -o ${BOT_USER} -g ${BOT_USER} -m 755 /opt/${SERVICE_PREFIX}-relay-bot
chown -R ${BOT_USER}:${BOT_USER} /opt/${SERVICE_PREFIX}-relay-bot

# 2. Build on target using the Node 24 installed in Step 4.
sudo -i -u ${BOT_USER} bash -lc 'cd /opt/${SERVICE_PREFIX}-relay-bot && . /home/${BOT_USER}/.nvm/nvm.sh && npm ci && npm run build && npm prune --omit=dev'

# 3. Render claude-relay-bot.service with PROJECT_NAME, PROJECT_DIR, SERVICE_PREFIX, BOT_USER → /etc/systemd/system/${SERVICE_PREFIX}-relay-bot.service, mode 644
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
systemctl status ${SERVICE_PREFIX}-relay-bot.service --no-pager
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

### Telegram bot hardening + multi-user onboarding

**MANDATORY READ:** Load `references/telegram_operator_runbook.md`

After creating the bot in step #4 above, the operator runs the runbook to lock down BotFather settings (Allow Groups off, Group Privacy on), register menu commands via `setMyCommands`, and onboard additional users through the `/users` pending→allow flow. The relay-bot's `AllowlistMiddleware` is the primary control; Telegram-side settings are defense-in-depth.

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

## Definition of Done

**MANDATORY READ:** Load `references/verification_recipes.md`

DoD covers every step of the workflow. Each unchecked item points back to the step that creates it; full verification commands (SQL, curl, jq pipelines) live in `references/verification_recipes.md`.

### System packages & user (Steps 1–3)
- [ ] All required Configuration vars set; optional vars explicitly empty when their step is skipped
- [ ] `which curl wget git jq sqlite3 gpg pipx python3 bwrap unzip tmux gh` — all paths resolved (Step 1+2)
- [ ] `id ${BOT_USER}` returns UID; `.ssh/authorized_keys` mode 600; `loginctl show-user ${BOT_USER}` shows `Linger=yes` (Steps 3, 7)

### Agents (Steps 4–6, 5b)
- [ ] `node --version`, `claude --version`, `codex --version` all OK; auth completed (Manual #1, #2)
- [ ] Headless configs (Claude `settings.json` + Codex `config.toml`) match expected values per `references/verification_recipes.md`
- [ ] If `REF_API_KEY` / `CONTEXT7_API_KEY`: `claude mcp list` and `codex mcp list` show the server

### God-session + scheduler (Step 7)
- [ ] `${SERVICE_PREFIX}-god.service` active and tmux session exists
- [ ] `${SERVICE_PREFIX}-dispatch.timer` active and armed (`systemctl list-timers`)
- [ ] `/var/lib/${PROJECT_NAME}/` exists, mode 0700, owner `${BOT_USER}`
- [ ] Pane footer shows model + effort + `bypass permissions on`

### statusLine + /usage (Step 7b, gated on `TELEGRAM_BOT_TOKEN`)
- [ ] `~${BOT_USER}/.claude/statusline.sh` mode 755; `usage.json` populated within ~30s of god restart
- [ ] `claude-usage-report` and `/usage` from Telegram return matching two-line report

### Telegram bridge + sessions (Step 7c, gated on `TELEGRAM_BOT_TOKEN`)
- [ ] `${SERVICE_PREFIX}-relay-bot.service` active; `/health` returns v6 with all fields and `relay.db` has 12 tables (per `references/verification_recipes.md`)
- [ ] BotFather menu + bot hardening verified per `references/telegram_operator_runbook.md` + `references/verification_recipes.md`
- [ ] Allowlist, per-user session ownership, and inbound smokes pass per `references/verification_recipes.md`
- [ ] End-to-end: «hi» from Telegram → claude responds → reply mirrored back via Stop hook

### Communication policy (Step 7c-2, 5 layers L1–L5)
- [ ] `RELAY_VERBOSITY` configured in `secrets.env`; `outbox.event_type` and `todo_state` schema present
- [ ] All 5 layers reach Telegram and token bucket / `verbosity=quiet` regression pass per `references/verification_recipes.md`

### GitHub App + git (Step 8a, gated on `GITHUB_APP_ID`)
- [ ] `/etc/${PROJECT_NAME}/github-app.pem` mode 640, owner `root:${BOT_USER}`
- [ ] `${SERVICE_PREFIX}-mint-gh-token` returns `ghs_...` prefix and is wired into git credential.helper

### Codex notify hook (Step 8b, gated on `TELEGRAM_BOT_TOKEN`)
- [ ] `~${BOT_USER}/.codex/notify.sh` mode 755; `config.toml` has `notify = ["bash", ...]`

### Operator dispatcher (Step 9, LOCAL machine)
- [ ] `${TARGET_REPO_PATH}/.claude/commands/dispatcher.md` exists with only `${VPS_*}` placeholders remaining
- [ ] `${TARGET_REPO_PATH}/.env.local` has all 9 `VPS_*` keys; `.env.local` is git-ignored
- [ ] `/dispatcher status` reports healthy; `/dispatcher audit 3` returns last 3 runs

---

## References

- `references/README.md` — artifact templates index, Telegram bridge architecture, Communication policy 5 layers
- `references/scope_layers.md` — per-VPS / per-project / per-bot-user scoping
- `references/substitution_rules.md` — envsubst allow-list rules (install-time vs runtime)
- `references/telegram_operator_runbook.md` — BotFather hardening, `/users` multi-user onboarding
- `references/troubleshooting.md` — common install/auth/MCP failure modes
- `references/verification_recipes.md` — DoD verification commands (SQL, curl, jq)

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

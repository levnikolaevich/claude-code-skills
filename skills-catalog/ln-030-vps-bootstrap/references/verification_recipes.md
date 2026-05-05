# Verification recipes — ln-030-vps-bootstrap

Detailed verification commands referenced from `SKILL.md` Definition of Done. Each section maps to a DoD gate.

## Two operational notes BEFORE running anything in this file

### Always run state-file inspection AS the owning user

When verifying SQLite databases, JSON state files, or anything that's auto-created on touch, **always run as the owning user** (typically `${BOT_USER}`):

```bash
# WRONG — creates the file as root if it doesn't yet exist
sqlite3 /var/lib/${PROJECT_NAME}/relay.db '.tables'

# RIGHT — runs as ${BOT_USER}, fails cleanly if the file doesn't exist yet
sudo -u ${BOT_USER} sqlite3 /var/lib/${PROJECT_NAME}/relay.db '.tables'
```

The hex-relay service runs as `${BOT_USER}`. If verification commands (run as root) accidentally create the SQLite file before the service starts, the file is owned by root → hex-relay crashes with `SQLITE_READONLY` on its first pragma write. Same risk applies to `cat`/`tail`/`jq` on any file that may not yet exist (those don't create files, but a stray `>` or `tee` would). Default: **`sudo -u ${BOT_USER}`** for ALL verification touching `/var/lib/${PROJECT_NAME}/`, `/home/${BOT_USER}/`, `${PROJECT_DIR}/`.

### AI-agent execution constraint

When this skill is run via `mcp__hex-ssh__remote-ssh` (or similar), commands must be **single-line** (literal newlines are rejected by the tool). Use `;` and `&&` separators. Also, the tool blocks `rm -rf` on root/home paths — use `find ... -delete`, `unlink`, or `rmdir` for cleanup. Wrap all snippets below into single-line form when invoking from an AI agent.

## Headless config (`ln-031` / `ln-032`)

```bash
# Claude headless config
sudo -u ${BOT_USER} jq '.model,.effortLevel,.permissions.defaultMode' ~/.claude/settings.json
# Expected: "opus", "xhigh", "bypassPermissions"

# Codex headless config
sudo -u ${BOT_USER} grep -E '^(model|model_reasoning_effort|approval_policy|sandbox_mode)\b' ~/.codex/config.toml
# Expected: model = "gpt-5.5", model_reasoning_effort = "xhigh",
#           approval_policy = "never", sandbox_mode = "workspace-write"
```

## Agent skills/plugins marketplace (`ln-031`)

```bash
# Skills repo source
sudo -i -u ${BOT_USER} bash -lc 'cd ${AGENT_SKILLS_DIR} && git status --short && git rev-parse --abbrev-ref HEAD && git rev-parse --short HEAD'
# Expected: clean status, branch/ref matches AGENT_SKILLS_REF

# Marketplace manifests + Codex adapters
sudo -i -u ${BOT_USER} bash -lc 'cd ${AGENT_SKILLS_DIR} && test -r .claude-plugin/marketplace.json && test -r .agents/plugins/marketplace.json'
sudo -i -u ${BOT_USER} bash -lc 'cd ${AGENT_SKILLS_DIR} && . /home/${BOT_USER}/.nvm/nvm.sh && node skills-catalog/shared/scripts/marketplace/sync-codex-adapters.mjs validate'

# Claude marketplace/plugins
sudo -i -u ${BOT_USER} bash -lc '. /home/${BOT_USER}/.nvm/nvm.sh && claude plugin list --json' | jq .
# Expected: levnikolaevich-skills-marketplace and selected plugins, including agile-workflow by default

# Codex marketplace/plugins: exactly one active marketplace block and selected plugin entries
sudo -u ${BOT_USER} grep -Ec '^\[marketplaces\.levnikolaevich-skills-marketplace\]$' ~/.codex/config.toml
# Expected: 1
sudo -u ${BOT_USER} grep -E '^\[plugins\."(agile-workflow|[^"]+)@levnikolaevich-skills-marketplace"\]$' ~/.codex/config.toml
```

## Nightly agent updates (`ln-031`)

```bash
# Timer armed
systemctl list-timers agent-update.timer --no-pager
# Expected: one active timer with next fire around 03:37 local time (+ randomized delay)

# Manual smoke: updates CLIs + skills/plugins, verifies, then restarts every enabled *-god@*.service.
systemctl start agent-update.service
journalctl -u agent-update.service -n 120 --no-pager
# Expected: claude update succeeds, Codex npm install succeeds, skills repo fast-forwards,
#           marketplace validation passes, selected plugins update, version checks print both CLIs,
#           then "shared toolchain updated; restarting all god-services"

sudo -i -u ${BOT_USER} bash -lc '. /home/${BOT_USER}/.nvm/nvm.sh && claude --version && codex --version'
sudo -i -u ${BOT_USER} bash -lc 'cd ${AGENT_SKILLS_DIR} && git status --short && git rev-parse --short HEAD'
systemctl status ${SERVICE_PREFIX}-god@${TELEGRAM_CHAT_ID}.service --no-pager
# Expected: CLI versions print, skills repo is clean, and god-session is active after the maintenance restart.
```

## Project repo + tmux socket isolation (`ln-032`)

```bash
sudo -u ${BOT_USER} git -C ${PROJECT_DIR} remote get-url origin | grep -Fx "${REPO_URL}"
sudo -u ${BOT_USER} git -C ${PROJECT_DIR} branch --show-current
sudo -u ${BOT_USER} git -C ${PROJECT_DIR} status --short
sudo -u ${BOT_USER} tmux -L ${SERVICE_PREFIX} ls | grep -F "${SERVICE_PREFIX}-god-${TELEGRAM_CHAT_ID}"
systemctl cat ${SERVICE_PREFIX}-god@.service ${SERVICE_PREFIX}-dispatch.service ${SERVICE_PREFIX}-hex-relay.service | grep -E "tmux -L ${SERVICE_PREFIX}|RELAY_HOOK_PORT=${RELAY_HOOK_PORT}|god@"
```

Expected: repo URL/ref match configuration, status is clean except intentional project-scope `.claude` files, and all project tmux operations use the same non-default socket.

## hex-relay + sessions (`ln-033`)

```bash
# Relay listening + DB ready
curl -fsS http://127.0.0.1:${RELAY_HOOK_PORT}/health | jq .
# Expected fields: ok=true, version="v6", god_session_ready, inbound_queued,
#                  inbound_failed, inbound_rejected, outbox_unknown,
#                  control_busy, control_pending

# DB schema
sqlite3 /var/lib/${PROJECT_NAME}/relay.db '.tables'
# Expected: core tables are present — messages, pending_reply, outbox, sessions,
#           session_events, dispatch_runs, dispatch_phases, memories,
#           health_snapshots, auth_rejects, allowed_users, todo_state

# hex-relay build output exists and build-only dependencies were pruned
test -d /opt/${SERVICE_PREFIX}-hex-relay/dist
test -x /opt/${SERVICE_PREFIX}-hex-relay/node_modules/.bin/tsc

# Telegram Bot API menu commands registered
curl -fsS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMyCommands" | jq '.result'
# Expected English descriptions:
# [{"command":"usage","description":"Show Claude usage limits"},
#  {"command":"new_session","description":"Start a new Claude session"},
#  {"command":"sessions","description":"Resume or delete Claude sessions"},
#  {"command":"tasks","description":"List open tasks"},
#  {"command":"users","description":"Manage bot access"}]
# If missing, rerun `ln-033-hex-relay-lifecycle` or /usr/local/bin/${SERVICE_PREFIX}-register-telegram-commands

# Bot hardening (DM-only, no group reads)
curl -fsS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe" \
  | jq '.result | {can_join_groups, can_read_all_group_messages}'
# Expected: {"can_join_groups": false, "can_read_all_group_messages": false}

# Allowlist audit table populated on unauthorized DM
sqlite3 /var/lib/${PROJECT_NAME}/relay.db ".schema auth_rejects"
sqlite3 /var/lib/${PROJECT_NAME}/relay.db "SELECT * FROM auth_rejects ORDER BY ts DESC LIMIT 5"

# Allowlist primary present
sqlite3 /var/lib/${PROJECT_NAME}/relay.db "SELECT user_id, status FROM allowed_users"
# Expected: primary operator with status='allowed'

# Task polling endpoint: non-empty queues notify primary only once per 24 hours; empty queues log only.
curl -fsS -X POST http://127.0.0.1:${RELAY_HOOK_PORT}/tasks/poll | jq .
systemctl list-timers ${SERVICE_PREFIX}-dispatch.timer --no-pager
# Expected: JSON {ok:true,count:N}; timer cadence is 15 minutes.

# Per-user session ownership and inbound routing columns exist
sqlite3 /var/lib/${PROJECT_NAME}/relay.db "PRAGMA table_info(sessions)"
# Expected: created_by_user_id column present
sqlite3 /var/lib/${PROJECT_NAME}/relay.db "PRAGMA table_info(messages)"
# Expected: from_user_id column present
test -f /var/lib/${PROJECT_NAME}/users/${TELEGRAM_CHAT_ID}/last-session.id
test -f /var/lib/${PROJECT_NAME}/users/${TELEGRAM_CHAT_ID}/sessions-dir.path
grep -F "/home/${BOT_USER}/.claude/projects/" \
  /var/lib/${PROJECT_NAME}/users/${TELEGRAM_CHAT_ID}/sessions-dir.path
```

### Inbound smoke

- Send plain text → creates `messages(kind='text', status='queued')` and then becomes `delivered`.
- Send photo, image document, and a general document → each saves under `/var/lib/${PROJECT_NAME}/tg-media/`, creates `messages(kind='image'|'document', status='queued')`, and then becomes `delivered`.
- Send voice/audio/video/sticker without usable text → row is `rejected`, Telegram replies with the unsupported-media explanation, claude receives nothing.
- Send a Telegram message while `${SERVICE_PREFIX}-god@<your_user_id>` is restarting → `messages.status='queued'` until that user's tmux target returns, then `delivered`.
- Trigger `/new_session` and immediately send text → text stays queued until your personal tmux target is ready, then is delivered after the control action completes.
- With two allowed users: each sends `/new_session` and text; `tmux -L ${SERVICE_PREFIX} ls` shows two `${SERVICE_PREFIX}-god-<user_id>` targets, `/sessions` shows only each user's own sessions, and cross-user Resume/Delete is rejected.
- Sandbox boundary: inside each `${SERVICE_PREFIX}-god-<user_id>` pane, `echo $HOME` is `${PROJECT_DIR}/.agent-home/users/<user_id>`; `$HOME/.claude` and `$HOME/.codex` are writable directory binds to the one shared VPS CLI runtime so Claude/Codex can rotate auth and update runtime state atomically. `/home/${BOT_USER}/.claude`, `/etc/${PROJECT_NAME}/secrets.env`, `/var/lib/${PROJECT_NAME}/relay.db`, sibling `/opt/*`, and host `systemctl` are denied.
- End-to-end: send «hi» from Telegram → inbound row delivered → claude responds → reply mirrored back via Stop hook → outbox row sent.
- Plan-first gate: send a mutating request → claude replies with a plan only; no file diff, branch, service restart, label change, commit, PR, or MR appears before explicit approval. Send `approve` → claude creates todos and starts implementation.
- Task gate: `/tasks` lists all open provider issues for every allowed user. Pressing [Take] injects the selected issue into the clicking user's `${SERVICE_PREFIX}-god@<user_id>` session without creating a new session. Scheduled polling notifies only the primary operator when count > 0, at most once per 24 hours, and sends nothing when count = 0.

## Communication policy (`ln-033`, 5 layers L1-L5)

```bash
# Outbox event_type column exists
sqlite3 /var/lib/${PROJECT_NAME}/relay.db "PRAGMA table_info(outbox)" | grep event_type
sqlite3 /var/lib/${PROJECT_NAME}/relay.db ".schema todo_state"

# Hooks registered
sudo -u ${BOT_USER} jq '.hooks | keys' ${PROJECT_DIR}/.claude/settings.json
# Expected: includes PreToolUse, PostToolUse (plus UserPromptSubmit, Stop,
#           StopFailure, SessionStart, PostCompact, SubagentStop)
```

### Layer smoke (per `references/README.md` — Communication policy)

- **L1 inbound ack**: send any accepted text → reaction from `RELAY_INBOUND_REACTIONS` (or ❤ fallback) appears within 1–2s.
- **L2 Skill announce**: trigger a Skill → `🔧 Skill: <name>` arrives before claude runs the skill.
- **L3 Todo transitions**: trigger `TodoWrite` with status flips → each `🟡 Started:` and `✅ Done:` arrives separately.
- **L4 Subagent boundary**: spawn an Explore/Plan subagent → `✅ Subagent: <type> done` arrives on completion.
- **L5 final reply prefix**: claude's normal turn-end reply arrives with `💬 ` prefix.

```bash
# Token bucket: trigger 10 Skills in 30s → first 5 reach Telegram, rest dropped silently
sqlite3 /var/lib/${PROJECT_NAME}/relay.db \
  "SELECT count(*) FROM outbox WHERE event_type='status_skill' AND ts > strftime('%s','now','-1 minute')"
# Expected: ≤ 5

# Verbosity quiet regression
sed -i 's/^RELAY_VERBOSITY=.*/RELAY_VERBOSITY=quiet/' /etc/${PROJECT_NAME}/secrets.env
systemctl restart ${SERVICE_PREFIX}-hex-relay.service
# Expected: only L1+L5 reach Telegram

# TodoWrite matcher empirical check
journalctl -u ${SERVICE_PREFIX}-hex-relay.service | grep "tool_name=TodoWrite"
# Expected: hits after a TodoWrite call. If missing → matcher mismatch;
# remove the matcher and let the Fastify endpoint filter by tool_name.
```

## GitHub App + git (`ln-032`)

```bash
sudo -u ${BOT_USER} ${SERVICE_PREFIX}-mint-gh-token | head -c 8
# Expected: ghs_... prefix

sudo -u ${BOT_USER} git config --global credential.helper
# Expected: includes ${SERVICE_PREFIX}-mint-gh-token invocation
```

## GitLab git + API (`ln-032`)

```bash
sudo -u ${BOT_USER} test -s ~/.git-credentials && sudo -u ${BOT_USER} stat -c '%a' ~/.git-credentials
# Expected: 600

sudo -u ${BOT_USER} git -C ${PROJECT_DIR} ls-remote --heads origin | head -3

sudo -u ${BOT_USER} bash -lc 'set -a && . /etc/${PROJECT_NAME}/secrets.env && set +a && GITLAB_HOST=$GITLAB_HOST GITLAB_TOKEN=$GITLAB_API_TOKEN glab issue list --repo $REPO_SLUG --opened --output json | jq length'
```

## Operator dispatcher (`ln-032`)

```bash
# Verbatim copy check — only ${VPS_*} placeholders should remain.
# Portable two-step pipeline because POSIX ERE has no lookahead `(?!...)`.
grep -oE '\$\{[A-Z_][A-Z_]*\}' ${TARGET_REPO_PATH}/.claude/commands/dispatcher.md | grep -v '^\$\{VPS_'
# Expected: empty output

# .env.local has the required VPS_* keys
for key in HOST SSH_KEY BOT_USER PROJECT_NAME SERVICE_PREFIX TELEGRAM_CHAT_ID PROJECT_DIR GIT_PROVIDER REPO_SLUG RELAY_HOOK_PORT DISPATCH_COMMAND_NAME AGENT_SKILLS_DIR AGENT_SKILLS_PLUGINS; do
  grep -q "^VPS_${key}=" ${TARGET_REPO_PATH}/.env.local || echo "missing VPS_${key}"
done
# Expected: no missing VPS_* output
```

## Runtime approval gate

```bash
grep -F "Plan first for mutating work" ${PROJECT_DIR}/.claude/CLAUDE.md
grep -F "No implementation before approval" ${PROJECT_DIR}/.claude/CLAUDE.md
grep -F "waiting_approval" /home/${BOT_USER}/.claude/commands/${DISPATCH_COMMAND_NAME}.md
grep -F "approve #N" /home/${BOT_USER}/.claude/commands/${DISPATCH_COMMAND_NAME}.md
```

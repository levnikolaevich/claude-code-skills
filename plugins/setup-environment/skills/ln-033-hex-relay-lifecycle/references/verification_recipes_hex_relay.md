<!-- SOURCE-OF-TRUTH: shared/references/verification_recipes_hex_relay.md. Edit ONLY here; run `node tools/marketplace/shared.mjs sync` -->

# Verification Recipes - hex-relay

hex-relay, session, and communication-policy verification recipes.
## hex-relay + sessions (`ln-033`)

```bash
# Relay listening + DB ready
curl -fsS http://127.0.0.1:${RELAY_HOOK_PORT}/health | jq .
# Expected fields: ok=true, version="v6.3", relay_schema_version="v6.3",
#                  god_session_ready, inbound_queued, inbound_failed,
#                  inbound_rejected, outbox_unknown, control_busy, control_pending

# DB schema
sudo -u ${BOT_USER} sqlite3 /var/lib/${PROJECT_NAME}/relay.db '.tables'
# Expected: core tables are present — messages, pending_reply, outbox, sessions,
#           session_events, dispatch_runs, dispatch_phases, memories,
#           health_snapshots, auth_rejects, allowed_users, todo_state

# hex-relay build output exists and build-only dependencies were pruned
test -d /opt/${SERVICE_PREFIX}-hex-relay/dist
test -x /opt/${SERVICE_PREFIX}-hex-relay/node_modules/.bin/tsc

# Telegram Bot API menu commands registered
curl -fsS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMyCommands" | jq '.result'
# Expected English descriptions:
# [{"command":"usage","description":"Show Claude/Codex usage limits"},
#  {"command":"set_buddy","description":"Switch default agent"},
#  {"command":"new_session","description":"Start a new Claude session"},
#  {"command":"sessions","description":"Resume or delete Claude sessions"},
#  {"command":"tasks","description":"List open tasks"},
#  {"command":"users","description":"Manage bot access"}]
# If missing, rerun `ln-033-hex-relay-lifecycle` or /usr/local/bin/${SERVICE_PREFIX}-register-telegram-commands

# The command menu must also be registered for all private chats; Telegram keeps scopes separately.
curl -fsS -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMyCommands" \
  -d 'scope={"type":"all_private_chats"}' | jq '.result'
# Expected: same six commands and descriptions as the default scope.

# Bot hardening (DM-only, no group reads)
curl -fsS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe" \
  | jq '.result | {can_join_groups, can_read_all_group_messages}'
# Expected: {"can_join_groups": false, "can_read_all_group_messages": false}

# Allowlist audit table populated on unauthorized DM
sudo -u ${BOT_USER} sqlite3 /var/lib/${PROJECT_NAME}/relay.db ".schema auth_rejects"
sudo -u ${BOT_USER} sqlite3 /var/lib/${PROJECT_NAME}/relay.db "SELECT * FROM auth_rejects ORDER BY ts DESC LIMIT 5"

# Allowlist primary present
sudo -u ${BOT_USER} sqlite3 /var/lib/${PROJECT_NAME}/relay.db "SELECT user_id, status FROM allowed_users"
# Expected: primary operator with status='allowed'

# Task polling endpoint: non-empty queues notify primary only once per 24 hours; empty queues log only.
curl -fsS -X POST -H "Authorization: Bearer ${RELAY_HTTP_TOKEN}" http://127.0.0.1:${RELAY_HOOK_PORT}/tasks/poll | jq .
systemctl list-timers ${SERVICE_PREFIX}-dispatch.timer --no-pager
# Expected: JSON {ok:true,count:N}; timer cadence is 15 minutes.

# Drift catch (the timer can end up enabled-but-inactive after daemon-reload, e.g. ${SERVICE_PREFIX}-dispatch.timer)
test "$(systemctl is-active ${SERVICE_PREFIX}-dispatch.timer)" = active
# Expected: "active" (not "inactive"). NextElapseUSec must not be empty/infinity.
systemctl show ${SERVICE_PREFIX}-dispatch.timer -p ActiveState,SubState,NextElapseUSecRealtime,LastTriggerUSec
journalctl -u ${SERVICE_PREFIX}-dispatch.service --since '24h ago' --no-pager | tail -8
# Expected: at least one Started/Finished pair within the last 16 minutes; "No entries" means timer never fired.

# tmux/god parity (catches the silent case where ${SERVICE_PREFIX}-god@<id>.service is `active` but its tmux pane is missing)
for U in $(systemctl list-units --type=service --state=active --no-pager --plain --no-legend \
            | awk -v p="^${SERVICE_PREFIX}-god@" '$1 ~ p {sub(/.service$/, "", $1); sub(/^.*@/, "", $1); print $1}'); do
  sudo -u ${BOT_USER} tmux -L ${SERVICE_PREFIX} has-session -t "=${SERVICE_PREFIX}-god-${U}" 2>/dev/null \
    || echo "DRIFT: god@${U} active but tmux session ${SERVICE_PREFIX}-god-${U} missing on socket -L ${SERVICE_PREFIX}"
done
# Expected: no DRIFT lines. Use exact-match `=name` form because default is prefix-match on shared sockets.

# Multi-line payload smoke (regression for tmux send-keys -l flag-line bug, e.g. "---\n-flag\n")
# Send via Telegram or directly: a markdown-bullet message that starts a line with `-`.
# Expected: relay logs `INBOUND delivered to tmux` with attempts=0; no `send-keys -l rc=1 invalid flag` entries.
sudo -u ${BOT_USER} bash -lc 'tmux -L ${SERVICE_PREFIX} set-buffer -b smoke -- "line1\n- bullet starting with hyphen\n— em-dash" \
  && tmux -L ${SERVICE_PREFIX} paste-buffer -d -p -r -b smoke -t =${SERVICE_PREFIX}-god-${TELEGRAM_CHAT_ID} \
  && echo "smoke: paste-buffer succeeded"'

# Per-user session ownership and inbound routing columns exist
sudo -u ${BOT_USER} sqlite3 /var/lib/${PROJECT_NAME}/relay.db "PRAGMA table_info(sessions)"
# Expected: created_by_user_id column present
sudo -u ${BOT_USER} sqlite3 /var/lib/${PROJECT_NAME}/relay.db "PRAGMA table_info(messages)"
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
sudo -u ${BOT_USER} sqlite3 /var/lib/${PROJECT_NAME}/relay.db "PRAGMA table_info(outbox)" | grep event_type
sudo -u ${BOT_USER} sqlite3 /var/lib/${PROJECT_NAME}/relay.db ".schema todo_state"

# Hooks registered
sudo -u ${BOT_USER} jq '.hooks | keys' ${PROJECT_DIR}/.claude/settings.json
# Expected: includes PreToolUse, PostToolUse (plus UserPromptSubmit, Stop,
#           StopFailure, SessionStart, PostCompact, SubagentStop)

# Hooks carry per-project Bearer auth and the correct relay port.
sudo -u ${BOT_USER} jq -e --arg port ":${RELAY_HOOK_PORT}" '
  (.hooks | has("UserPromptSubmit") and has("Stop") and has("StopFailure") and has("SessionStart") and has("PostCompact") and has("SubagentStop") and has("PreToolUse") and has("PostToolUse")) and
  ([.hooks[][]?.hooks[]? | (.type == "http" and (.url | contains($port)) and (.url | contains("${") | not) and (.headers.Authorization | startswith("Bearer ")))] | all) and
  ([.hooks.PreToolUse[]?.matcher] | sort == ["Agent","Skill","TodoWrite"]) and
  ([.hooks.PostToolUse[]?.matcher] == ["Skill"])
' ${PROJECT_DIR}/.claude/settings.json

# HTTP auth behavior smoke. Do not print RELAY_HTTP_TOKEN.
test -n "${RELAY_HTTP_TOKEN}"
test "$(curl -sS -o /tmp/${SERVICE_PREFIX}-hook-unauth.out -w '%{http_code}' \
  -X POST http://127.0.0.1:${RELAY_HOOK_PORT}/hook/stop \
  -H 'Content-Type: application/json' -d '{}')" = 401
test "$(curl -sS -o /tmp/${SERVICE_PREFIX}-hook-valid.out -w '%{http_code}' \
  -X POST http://127.0.0.1:${RELAY_HOOK_PORT}/hook/session-start \
  -H 'Content-Type: application/json' -H "Authorization: Bearer ${RELAY_HTTP_TOKEN}" \
  -d "{\"session_id\":\"hook-smoke-${SERVICE_PREFIX}-$(date +%s)\",\"source\":\"startup\",\"agent\":\"claude\"}")" = 200
```

### Layer smoke (per `references/README.md` — Communication policy)

- **L1 inbound ack**: send any accepted text → reaction from `RELAY_INBOUND_REACTIONS` (or ❤ fallback) appears within 1–2s.
- **L2 Skill announce**: trigger a Skill → `🔧 Skill: <name>` arrives before claude runs the skill.
- **L3 Todo transitions**: trigger `TodoWrite` with status flips → each `🟡 Started:` and `✅ Done:` arrives separately.
- **L4 Subagent boundary**: spawn an Explore/Plan subagent → `✅ Subagent: <type> done` arrives on completion.
- **L5 final reply prefix**: claude's normal turn-end reply arrives with `💬 ` prefix.

```bash
# Token bucket: trigger 10 Skills in 30s → first 5 reach Telegram, rest dropped silently
sudo -u ${BOT_USER} sqlite3 /var/lib/${PROJECT_NAME}/relay.db \
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

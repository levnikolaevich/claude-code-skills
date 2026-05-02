# Verification recipes — ln-030-vps-bootstrap

Detailed verification commands referenced from `SKILL.md` Definition of Done. Each section maps to a DoD gate.

## Headless config (Steps 5b + 7)

```bash
# Claude headless config
sudo -u ${BOT_USER} jq '.model,.effortLevel,.permissions.defaultMode' ~/.claude/settings.json
# Expected: "opus", "xhigh", "bypassPermissions"

# Codex headless config
sudo -u ${BOT_USER} grep -E '^(model|model_reasoning_effort|approval_policy|sandbox_mode)\b' ~/.codex/config.toml
# Expected: model = "gpt-5.5", model_reasoning_effort = "xhigh",
#           approval_policy = "never", sandbox_mode = "danger-full-access"
```

## Telegram bridge + sessions (Step 7c)

```bash
# Relay listening + DB ready
curl -fsS http://127.0.0.1:${RELAY_HOOK_PORT}/health | jq .
# Expected fields: ok=true, version="v6", god_session_ready, inbound_queued,
#                  inbound_failed, inbound_rejected, outbox_unknown,
#                  control_busy, control_pending

# DB schema
sqlite3 /var/lib/${PROJECT_NAME}/relay.db '.tables'
# Expected: 12 tables — messages, pending_reply, outbox, sessions,
#           session_events, dispatch_runs, dispatch_phases, memories,
#           health_snapshots, auth_rejects, allowed_users, todo_state

# BotFather menu commands registered
curl -fsS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMyCommands" | jq '.result[].command'
# Expected: "usage", "new_session", "sessions", "users"
# If missing, run setMyCommands per references/telegram_operator_runbook.md step A

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

# Per-user session ownership column exists
sqlite3 /var/lib/${PROJECT_NAME}/relay.db "PRAGMA table_info(sessions)"
# Expected: created_by_user_id column present
```

### Inbound smoke

- Send plain text → creates `messages(kind='text', status='queued')` and then becomes `delivered`.
- Send photo, image document, and a general document → each saves under `/var/lib/${PROJECT_NAME}/tg-media/`, creates `messages(kind='image'|'document', status='queued')`, and then becomes `delivered`.
- Send voice/audio/video/sticker without usable text → row is `rejected`, Telegram replies with the unsupported-media explanation, claude receives nothing.
- Send a Telegram message while `${SERVICE_PREFIX}-god` is restarting → `messages.status='queued'` until tmux returns, then `delivered`.
- Trigger `/new_session` and immediately send text → text stays queued until the tmux session is ready, then is delivered after the control action completes.
- End-to-end: send «hi» from Telegram → inbound row delivered → claude responds → reply mirrored back via Stop hook → outbox row sent.

## Communication policy (Step 7c-2, 5 layers L1–L5)

```bash
# Outbox event_type column exists
sqlite3 /var/lib/${PROJECT_NAME}/relay.db "PRAGMA table_info(outbox)" | grep event_type
sqlite3 /var/lib/${PROJECT_NAME}/relay.db ".schema todo_state"

# Hooks registered
sudo -u ${BOT_USER} jq '.hooks | keys' ~/.claude/settings.json
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
systemctl restart ${SERVICE_PREFIX}-relay-bot.service
# Expected: only L1+L5 reach Telegram

# TodoWrite matcher empirical check
journalctl -u ${SERVICE_PREFIX}-relay-bot.service | grep "tool_name=TodoWrite"
# Expected: hits after a TodoWrite call. If missing → matcher mismatch;
# remove the matcher and let the Fastify endpoint filter by tool_name.
```

## GitHub App + git (Step 8a)

```bash
sudo -u ${BOT_USER} ${SERVICE_PREFIX}-mint-gh-token | head -c 8
# Expected: ghs_... prefix

sudo -u ${BOT_USER} git config --global credential.helper
# Expected: includes ${SERVICE_PREFIX}-mint-gh-token invocation
```

## Operator dispatcher (Step 9)

```bash
# Verbatim copy check — only ${VPS_*} placeholders should remain
grep -E '\${(?!VPS_)[A-Z_]+}' ${TARGET_REPO_PATH}/.claude/commands/dispatcher.md
# Expected: empty output

# .env.local has 9 VPS_* keys
grep -c '^VPS_' ${TARGET_REPO_PATH}/.env.local
# Expected: 9 (HOST, SSH_KEY, BOT_USER, PROJECT_NAME, SERVICE_PREFIX,
#               PROJECT_DIR, GITHUB_REPO, RELAY_HOOK_PORT, DISPATCH_COMMAND_NAME)
```

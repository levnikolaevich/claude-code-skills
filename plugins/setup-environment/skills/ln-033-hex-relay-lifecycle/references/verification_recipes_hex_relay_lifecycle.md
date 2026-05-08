# Verification Recipes - hex-relay Lifecycle

Deploy/redeploy verification for `ln-033`.

## Health and Schema

```bash
curl -fsS http://127.0.0.1:${RELAY_HOOK_PORT}/health | jq .
sudo -u ${BOT_USER} sqlite3 /var/lib/${PROJECT_NAME}/relay.db '.tables'
sudo -u ${BOT_USER} sqlite3 /var/lib/${PROJECT_NAME}/relay.db 'PRAGMA table_info(sessions)'
sudo -u ${BOT_USER} sqlite3 /var/lib/${PROJECT_NAME}/relay.db 'PRAGMA table_info(messages)'
```

Expected:
- health `ok=true`
- schema version matches deployed relay
- per-user session ownership columns exist

## Systemd, Timer, and tmux

```bash
systemctl is-active ${SERVICE_PREFIX}-hex-relay.service
systemctl is-active ${SERVICE_PREFIX}-dispatch.timer
systemctl show ${SERVICE_PREFIX}-dispatch.timer -p ActiveState,SubState,NextElapseUSecRealtime
for U in $(systemctl list-units --type=service --state=active --no-pager --plain --no-legend \
  | awk -v p="^${SERVICE_PREFIX}-god@" '$1 ~ p {sub(/.service$/, "", $1); sub(/^.*@/, "", $1); print $1}'); do
  sudo -u ${BOT_USER} tmux -L ${SERVICE_PREFIX} has-session -t "=${SERVICE_PREFIX}-god-${U}" \
    || echo "DRIFT: god@${U} active but tmux target missing"
done
```

Expected: active services/timer and no `DRIFT` lines.

## Telegram and Hooks

```bash
curl -fsS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMyCommands" | jq '.result'
sudo -u ${BOT_USER} jq '.hooks | keys' ${PROJECT_DIR}/.claude/settings.json
test -n "${RELAY_HTTP_TOKEN}"
test "$(curl -sS -o /tmp/${SERVICE_PREFIX}-hook-unauth.out -w '%{http_code}' \
  -X POST http://127.0.0.1:${RELAY_HOOK_PORT}/hook/stop \
  -H 'Content-Type: application/json' -d '{}')" = 401
```

Expected:
- menu commands registered
- project hooks present
- unauthenticated hook request rejected

## Inbound Smoke

Send one plain Telegram message and verify:
- `messages.status` reaches `delivered`
- Claude/Codex reply is mirrored through outbox
- unsupported media is rejected without reaching the agent

Record any drift as lifecycle findings, not bootstrap findings.

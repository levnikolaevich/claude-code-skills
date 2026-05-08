# Verification Recipes - hex-relay Bootstrap

Post-bootstrap smoke for `ln-030`.

```bash
curl -fsS http://127.0.0.1:${RELAY_HOOK_PORT}/health | jq '{ok,version,relay_schema_version,god_session_ready}'
sudo -u ${BOT_USER} sqlite3 /var/lib/${PROJECT_NAME}/relay.db '.tables'
test -d /opt/${SERVICE_PREFIX}-hex-relay/dist
systemctl is-active ${SERVICE_PREFIX}-hex-relay.service
systemctl is-active ${SERVICE_PREFIX}-dispatch.timer
sudo -u ${BOT_USER} tmux -L ${SERVICE_PREFIX} ls
```

Expected:
- health `ok=true`
- relay DB has core tables: `messages`, `outbox`, `sessions`, `allowed_users`
- hex-relay service active
- dispatch timer active
- at least one god-session tmux target for the primary operator when Telegram is enabled

Telegram checks:

```bash
curl -fsS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMyCommands" | jq '.result'
curl -fsS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe" \
  | jq '.result | {can_join_groups, can_read_all_group_messages}'
```

Expected:
- project command menu is registered
- `can_join_groups=false`
- `can_read_all_group_messages=false`

Record command, status, and short evidence in the `vps-bootstrap` summary.

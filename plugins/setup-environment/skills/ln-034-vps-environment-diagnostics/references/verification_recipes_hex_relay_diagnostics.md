# Verification Recipes - hex-relay Diagnostics

Read-only diagnostics for `ln-034`.

## Health Snapshot

```bash
curl -fsS http://127.0.0.1:${RELAY_HOOK_PORT}/health | jq .
systemctl status ${SERVICE_PREFIX}-hex-relay.service --no-pager
journalctl -u ${SERVICE_PREFIX}-hex-relay.service --since '30 min ago' --no-pager | tail -80
sudo -u ${BOT_USER} sqlite3 /var/lib/${PROJECT_NAME}/relay.db \
  "SELECT status, count(*) FROM messages GROUP BY status"
```

Classify failures as transport, auth, process, DB/schema, tmux/session, hook, or Telegram API.

## Drift Checks

```bash
systemctl is-active ${SERVICE_PREFIX}-dispatch.timer
systemctl show ${SERVICE_PREFIX}-dispatch.timer -p ActiveState,SubState,NextElapseUSecRealtime,LastTriggerUSec
sudo -u ${BOT_USER} tmux -L ${SERVICE_PREFIX} ls
sudo -u ${BOT_USER} jq -e '.hooks' ${PROJECT_DIR}/.claude/settings.json >/dev/null
```

Expected:
- timer active with a finite next trigger
- tmux targets match active god services
- project hooks parse as JSON

## Communication Policy Smoke

Use when diagnosing missing status messages:

```bash
sudo -u ${BOT_USER} sqlite3 /var/lib/${PROJECT_NAME}/relay.db '.schema outbox'
sudo -u ${BOT_USER} sqlite3 /var/lib/${PROJECT_NAME}/relay.db '.schema todo_state'
journalctl -u ${SERVICE_PREFIX}-hex-relay.service --since '30 min ago' --no-pager \
  | grep -E 'tool_name=TodoWrite|status_skill|SubagentStop|Stop'
```

Expected:
- outbox has event typing
- Todo state table exists
- recent hook logs match the reported failure mode

Only `repair_safe` may apply bounded repairs documented by the skill; `inspect` and `verify` stay read-only.

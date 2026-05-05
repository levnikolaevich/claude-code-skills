# hex-relay deploy

<!-- SCOPE: hex-relay deployment and compatibility procedure for ln-030-vps-bootstrap. -->

Gated on `TELEGRAM_BOT_TOKEN`. If Telegram is skipped, the god-session can still run, but task polling, Telegram inbound, and outbound mirroring are absent.

## Compatibility gate

Fresh installs use `/opt/${SERVICE_PREFIX}-hex-relay` and `${SERVICE_PREFIX}-hex-relay.service`.

Before enabling the new service, detect old installs and disable them:

```bash
if systemctl list-unit-files "${SERVICE_PREFIX}-relay-bot.service" --no-legend 2>/dev/null | grep -q "${SERVICE_PREFIX}-relay-bot.service"; then
  systemctl disable --now ${SERVICE_PREFIX}-relay-bot.service || true
fi
if [ -d /opt/${SERVICE_PREFIX}-relay-bot ] && [ ! -d /opt/${SERVICE_PREFIX}-hex-relay ]; then
  mv /opt/${SERVICE_PREFIX}-relay-bot /opt/${SERVICE_PREFIX}-hex-relay
fi
```

Do not run both services for one project; they bind the same hook port and own the same SQLite state.

## Artifacts

| Source | Target | Owner | Mode |
|---|---|---|---|
| `agents/hex-relay/` | `/opt/${SERVICE_PREFIX}-hex-relay` | `${BOT_USER}`:`${BOT_USER}` | 755 dirs / 644 files |
| `references/hex-relay.service` | `/etc/systemd/system/${SERVICE_PREFIX}-hex-relay.service` | root:root | 644 |
| `references/settings.hooks.fragment.json` | `${PROJECT_DIR}/.claude/settings.json` | `${BOT_USER}`:`${BOT_USER}` | 644 |
| `references/register-telegram-commands.sh` | `/usr/local/bin/${SERVICE_PREFIX}-register-telegram-commands` | root:root | 755 |

Upload source files from `agents/hex-relay/`; do not upload `dist/` or `node_modules/`.

## Install

```bash
install -d -o ${BOT_USER} -g ${BOT_USER} -m 755 /opt/${SERVICE_PREFIX}-hex-relay
chown -R ${BOT_USER}:${BOT_USER} /opt/${SERVICE_PREFIX}-hex-relay

sudo -i -u ${BOT_USER} bash -lc 'cd /opt/${SERVICE_PREFIX}-hex-relay && . /home/${BOT_USER}/.nvm/nvm.sh && npm ci && npm run build && ./node_modules/.bin/tsc --version'

# Render hex-relay.service with PROJECT_NAME, PROJECT_DIR, SERVICE_PREFIX, BOT_USER, RELAY_HOOK_PORT.
# Install it at /etc/systemd/system/${SERVICE_PREFIX}-hex-relay.service.

# Render settings.hooks.fragment.json with RELAY_HOOK_PORT and install at project scope.
sudo -u ${BOT_USER} mkdir -p ${PROJECT_DIR}/.claude
sudo -u ${BOT_USER} install -o ${BOT_USER} -g ${BOT_USER} -m 644 /tmp/hooks.json ${PROJECT_DIR}/.claude/settings.json
sudo -u ${BOT_USER} bash -lc 'jq -e "has(\"hooks\")" ~/.claude/settings.json >/dev/null 2>&1 && jq "del(.hooks)" ~/.claude/settings.json > ~/.claude/settings.json.new && mv ~/.claude/settings.json.new ~/.claude/settings.json && echo "stripped stale user-scope hooks" || echo "user-scope hooks already absent"'

install -o root -g root -m 755 /tmp/register-telegram-commands.sh /usr/local/bin/${SERVICE_PREFIX}-register-telegram-commands
systemctl daemon-reload
systemctl enable --now ${SERVICE_PREFIX}-hex-relay.service
systemctl enable --now ${SERVICE_PREFIX}-dispatch.timer
/usr/local/bin/${SERVICE_PREFIX}-register-telegram-commands /etc/${PROJECT_NAME}/secrets.env
systemctl restart ${SERVICE_PREFIX}-god@${TELEGRAM_CHAT_ID}.service
```

`npm ci` is mandatory before `npm run build`: `tsc` is a devDependency and remains installed for later VPS-side rebuilds.

After source changes, use `agents/hex-relay/docs/redeploy.md`. Upload source, rebuild on VPS, restart `${SERVICE_PREFIX}-hex-relay.service`, and recheck `/health`. Do not hand-edit VPS `dist/`.

## Verify

```bash
systemctl status ${SERVICE_PREFIX}-hex-relay.service --no-pager
curl -fsS http://127.0.0.1:${RELAY_HOOK_PORT}/health | jq .
sudo -u ${BOT_USER} sqlite3 /var/lib/${PROJECT_NAME}/relay.db '.tables'
sudo -u ${BOT_USER} install -d -m 750 /var/lib/${PROJECT_NAME}/tg-media
sudo -u ${BOT_USER} test -w /var/lib/${PROJECT_NAME}/tg-media
curl -fsS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMyCommands" | jq '.result'
sudo -u ${BOT_USER} test -d /opt/${SERVICE_PREFIX}-hex-relay/dist
sudo -u ${BOT_USER} test -x /opt/${SERVICE_PREFIX}-hex-relay/node_modules/.bin/tsc
```

End-to-end: operator sends `hi` in Telegram, Claude responds in the tmux pane, the Stop hook queues the final reply, and Telegram receives it.

Runtime files are created under `/var/lib/${PROJECT_NAME}/users/<telegram_user_id>/` and
Telegram media under `/var/lib/${PROJECT_NAME}/tg-media`; both are outside `${PROJECT_DIR}`
and `/opt/${SERVICE_PREFIX}-hex-relay`. The service runs as `${BOT_USER}` and its systemd
sandbox grants writes to `/var/lib/${PROJECT_NAME}` only, so verification must not create
state files or media dirs as root.

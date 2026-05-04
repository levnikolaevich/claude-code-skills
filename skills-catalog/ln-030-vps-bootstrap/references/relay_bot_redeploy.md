# Relay-bot redeploy after source changes

<!-- SCOPE: Update procedure for ln-030 relay-bot code after the VPS is already bootstrapped. -->

Use this when any file under `references/relay-bot/` changes. Do not edit `dist/` on the VPS and do not upload `node_modules/`.

## Inputs

- `${SERVICE_PREFIX}`: project service prefix; tmux socket and relay-bot directory derive from it.
- `${PROJECT_NAME}`: state/config dir name.
- `${BOT_USER}`: shared Linux user that owns `/opt/${SERVICE_PREFIX}-relay-bot`.

## Procedure

```bash
# 1. Build artifact from local source, excluding generated/install output.
tar -czf /tmp/${SERVICE_PREFIX}-relay-bot-src.tgz \
  --exclude node_modules \
  --exclude dist \
  -C references/relay-bot .

# 2. Upload /tmp/${SERVICE_PREFIX}-relay-bot-src.tgz to the VPS.

# 3. Replace source on VPS, build there with Node from nvm, prune dev deps, restart service.
systemctl stop ${SERVICE_PREFIX}-relay-bot.service
install -d -o ${BOT_USER} -g ${BOT_USER} -m 755 /opt/${SERVICE_PREFIX}-relay-bot
find /opt/${SERVICE_PREFIX}-relay-bot -mindepth 1 -maxdepth 1 -exec rm -rf {} +
tar -xzf /tmp/${SERVICE_PREFIX}-relay-bot-src.tgz -C /opt/${SERVICE_PREFIX}-relay-bot
chown -R ${BOT_USER}:${BOT_USER} /opt/${SERVICE_PREFIX}-relay-bot
sudo -i -u ${BOT_USER} bash -lc 'cd /opt/${SERVICE_PREFIX}-relay-bot && . /home/${BOT_USER}/.nvm/nvm.sh && npm ci && npm run build && ./node_modules/.bin/tsc --version'
systemctl start ${SERVICE_PREFIX}-relay-bot.service
```

## Verify

```bash
systemctl is-active ${SERVICE_PREFIX}-relay-bot.service
curl -fsS http://127.0.0.1:${RELAY_HOOK_PORT}/health | jq .
test -d /opt/${SERVICE_PREFIX}-relay-bot/dist
test -x /opt/${SERVICE_PREFIX}-relay-bot/node_modules/.bin/tsc
journalctl -u ${SERVICE_PREFIX}-relay-bot.service -n 50 --no-pager
```

Restart active `${SERVICE_PREFIX}-god@*.service` instances only when hooks, project-scope `.claude/settings.json`, or god-session instructions changed. Relay-bot source-only changes require only `${SERVICE_PREFIX}-relay-bot.service` restart.

# God-session install

<!-- SCOPE: tmux, systemd, scheduler, sandbox, statusLine, and host updater setup for ln-030-vps-bootstrap. -->

## Core artifacts

Render placeholders, upload, set ownership/mode, and install these targets:

| Template | Target | Owner | Mode |
|---|---|---|---|
| `god-session.sh` | `/usr/local/bin/${SERVICE_PREFIX}-god` | root:root | 755 |
| `agent-sandbox.sh` | `/usr/local/bin/${SERVICE_PREFIX}-agent-sandbox` | root:root | 755 |
| `god-session.service` | `/etc/systemd/system/${SERVICE_PREFIX}-god@.service` | root:root | 644 |
| `dispatch.timer` | `/etc/systemd/system/${SERVICE_PREFIX}-dispatch.timer` | root:root | 644 |
| `dispatch.service` | `/etc/systemd/system/${SERVICE_PREFIX}-dispatch.service` | root:root | 644 |
| `dispatch.md` | `/home/${BOT_USER}/.claude/commands/${DISPATCH_COMMAND_NAME}.md` | `${BOT_USER}`:`${BOT_USER}` | 644 |
| `settings.agent-config.fragment.json` | jq-merged into `/home/${BOT_USER}/.claude/settings.json` | `${BOT_USER}`:`${BOT_USER}` | 644 |

Before enabling the god service, run `project_repo_bootstrap.md` to create or verify `${PROJECT_DIR}`.

```bash
install -d -o ${BOT_USER} -g ${BOT_USER} -m 700 /var/lib/${PROJECT_NAME}
install -d -o root -g ${BOT_USER} -m 750 /etc/${PROJECT_NAME}
install -o ${BOT_USER} -g ${BOT_USER} -m 644 /dev/null /var/log/${PROJECT_NAME}-god.log

sudo -u ${BOT_USER} bash -lc 'mkdir -p ${PROJECT_DIR}/.agent-home/users ${PROJECT_DIR}/.agent-cache && grep -qxF ".agent-home/" ${PROJECT_DIR}/.git/info/exclude || printf "\n.agent-home/\n.agent-cache/\n" >> ${PROJECT_DIR}/.git/info/exclude'

# Shared CLI runtime dirs are writable through sandbox $HOME, while the real host home path stays hidden.
sudo -u ${BOT_USER} env PROJECT_DIR=${PROJECT_DIR} PROJECT_NAME=${PROJECT_NAME} SERVICE_PREFIX=${SERVICE_PREFIX} BOT_USER=${BOT_USER} OPERATOR_USER_ID=${TELEGRAM_CHAT_ID} AGENT_SKILLS_DIR=${AGENT_SKILLS_DIR} /usr/local/bin/${SERVICE_PREFIX}-agent-sandbox sh -lc 'touch .sandbox-test ~/.claude/.sandbox-write-test ~/.codex/.sandbox-write-test && rm .sandbox-test ~/.claude/.sandbox-write-test ~/.codex/.sandbox-write-test && test -r "$AGENT_SKILLS_DIR" && test -w ~/.claude && test -w ~/.codex && test ! -r /etc/${PROJECT_NAME}/secrets.env && test ! -r /var/lib/${PROJECT_NAME}/relay.db && test ! -r /home/${BOT_USER}/.claude'

sudo -u ${BOT_USER} bash -lc 'mkdir -p ~/.claude/projects && [ -f ~/.claude/settings.json ] || echo "{}" > ~/.claude/settings.json'
sudo -u ${BOT_USER} bash -lc 'jq -s ".[0] * .[1]" ~/.claude/settings.json /tmp/agent-config.json > ~/.claude/settings.json.new && mv ~/.claude/settings.json.new ~/.claude/settings.json'
rm /tmp/agent-config.json
```

Allow `hex-relay` to control only this project's god template:

```bash
SYSTEMCTL=$(command -v systemctl)
cat > /etc/sudoers.d/${SERVICE_PREFIX}-god-control <<EOF
${BOT_USER} ALL=(root) NOPASSWD: ${SYSTEMCTL} start ${SERVICE_PREFIX}-god@*.service, ${SYSTEMCTL} restart ${SERVICE_PREFIX}-god@*.service, ${SYSTEMCTL} is-active ${SERVICE_PREFIX}-god@*.service, ${SYSTEMCTL} list-units ${SERVICE_PREFIX}-god@*.service *
EOF
chmod 440 /etc/sudoers.d/${SERVICE_PREFIX}-god-control
visudo -cf /etc/sudoers.d/${SERVICE_PREFIX}-god-control

loginctl enable-linger ${BOT_USER}
systemctl daemon-reload
systemctl enable --now ${SERVICE_PREFIX}-god@${TELEGRAM_CHAT_ID}.service
```

Verify:

```bash
systemctl status ${SERVICE_PREFIX}-god@${TELEGRAM_CHAT_ID}.service --no-pager | head -10
sudo -u ${BOT_USER} tmux -L ${SERVICE_PREFIX} ls
sudo -u ${BOT_USER} tmux -L ${SERVICE_PREFIX} capture-pane -t ${SERVICE_PREFIX}-god-${TELEGRAM_CHAT_ID} -p -S -200 | tail -40
tail -10 /var/log/${PROJECT_NAME}-god.log
```

## statusLine and `/usage`

Gated on `TELEGRAM_BOT_TOKEN`. Install:

| Template | Target | Owner | Mode |
|---|---|---|---|
| `statusline.sh` | `/home/${BOT_USER}/.claude/statusline.sh` | `${BOT_USER}`:`${BOT_USER}` | 755 |
| `claude-usage-report.sh` | `/usr/local/bin/claude-usage-report` | root:root | 755 |
| `operator.CLAUDE.md` | `${PROJECT_DIR}/.claude/CLAUDE.md` | `${BOT_USER}`:`${BOT_USER}` | 644 |

Merge `settings.statusline.fragment.json` into user-scope `~/.claude/settings.json`, but install `operator.CLAUDE.md` at project scope only. Under shared `${BOT_USER}`, user-scope `CLAUDE.md` would cross-route identity between projects.

```bash
sudo -u ${BOT_USER} bash -lc 'jq ". + $(cat ~/.claude/.staging/settings.statusline.fragment.json)" ~/.claude/settings.json > ~/.claude/settings.json.new && mv ~/.claude/settings.json.new ~/.claude/settings.json'
sudo -u ${BOT_USER} install -o ${BOT_USER} -g ${BOT_USER} -m 644 /tmp/operator.CLAUDE.md ${PROJECT_DIR}/.claude/CLAUDE.md
sudo -u ${BOT_USER} bash -lc 'test ! -f ~/.claude/CLAUDE.md || { echo "ERROR: ~/.claude/CLAUDE.md exists; remove it for shared-user model"; exit 1; }'

systemctl restart ${SERVICE_PREFIX}-god@${TELEGRAM_CHAT_ID}.service
sleep 10
sudo -u ${BOT_USER} ls -la /home/${BOT_USER}/.claude/cache/usage.json
sudo -u ${BOT_USER} claude-usage-report
```

## System-wide updater

One updater per VPS refreshes shared CLIs, `${AGENT_SKILLS_DIR}`, and selected plugins, then restarts active `*-god@*.service` instances only after verification succeeds.

| Template | Target | Owner | Mode |
|---|---|---|---|
| `agent-update.sh` | `/usr/local/bin/agent-update` | root:root | 755 |
| `agent-update.service` | `/etc/systemd/system/agent-update.service` | root:root | 644 |
| `agent-update.timer` | `/etc/systemd/system/agent-update.timer` | root:root | 644 |

```bash
install -o root -g root -m 755 /tmp/agent-update.sh /usr/local/bin/agent-update
install -o root -g root -m 644 references/templates/agent-update.service /etc/systemd/system/agent-update.service
install -o root -g root -m 644 references/templates/agent-update.timer /etc/systemd/system/agent-update.timer
install -d -o root -g root -m 755 /var/lib/agent-update
touch /var/log/agent-update.log
chmod 0644 /var/log/agent-update.log
systemctl daemon-reload
systemctl enable --now agent-update.timer
```

Verify:

```bash
systemctl list-timers agent-update.timer --no-pager
systemctl start agent-update.service
journalctl -u agent-update.service -n 100 --no-pager
systemctl list-units --type=service --state=active '*-god@*.service' --no-pager
```

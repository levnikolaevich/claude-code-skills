# Troubleshooting - ln-030-vps-bootstrap

Reactive lookup for issues that surface during or after install. The sections are ordered by operational impact: restore auth/service first, then isolation/session correctness, then updater/provider issues, then low-risk noise.

## P0 - Auth And Service Blockers

| Issue | Solution |
|---|---|
| Primary receives `[admin] god-session error: auth_failed`, `API Error: 401`, or `Please run /login` | First verify the sandbox mounts `$HOME/.claude` and `$HOME/.codex` as writable directories, not read-only single-file auth binds. A read-only `.credentials.json` lets the old access token work until expiry, then blocks refresh-token rotation. Re-render `/usr/local/bin/${SERVICE_PREFIX}-agent-sandbox`, restart every active `${SERVICE_PREFIX}-god@<telegram_user_id>.service`, then run `/login` or `claude auth login` as `${BOT_USER}` only if the existing refresh token is already unusable. |
| First start of `${SERVICE_PREFIX}-god@<user_id>` hangs on login/theme/trust prompt | The sandbox HOME lacks seeded non-secret Claude runtime files, or shared CLI runtime directories are missing/wrongly mounted. Keep one VPS auth in `/home/${BOT_USER}`; re-render `agent-sandbox.sh`, restart the affected god service, and verify `$HOME/.claude` and `$HOME/.codex` are writable inside the sandbox while `/home/${BOT_USER}/.claude` is not exposed. Theme/trust prompts may still need one operator Enter per new project/user HOME. |
| `god-session@USER.service` exits 3 with `FATAL: cannot read /etc/${PROJECT_NAME}/secrets.env` | The parent directory `/etc/${PROJECT_NAME}` blocks traversal or has the wrong group. Fix: `chown root:${BOT_USER} /etc/${PROJECT_NAME} && chmod 0750 /etc/${PROJECT_NAME}`. Always chown the directory itself, not just its contents. |
| `god-session@USER.service` crash-loops with `Permission denied` writing `/var/log/${PROJECT_NAME}-god.log` | Log file owner does not match systemd `User=${BOT_USER}`. Fix: `chown ${BOT_USER}:${BOT_USER} /var/log/${PROJECT_NAME}-god.log && systemctl restart ${SERVICE_PREFIX}-god@${TELEGRAM_CHAT_ID}.service`. |
| `hex-relay.service` fails with `SqliteError: SQLITE_READONLY` on first pragma write | The DB was created by another user, usually root during verification. Fix: `unlink /var/lib/${PROJECT_NAME}/relay.db && systemctl restart ${SERVICE_PREFIX}-hex-relay.service`; hex-relay recreates it as `${BOT_USER}`. For verification, always use `sudo -u ${BOT_USER} sqlite3 ...`. |
| `node`, `claude`, or updater cannot load nvm for `${BOT_USER}` | The shared nvm install/profile patch is missing or rendered for the wrong `BOT_USER`. Re-run the nvm/profile block without piping through `tail`; verify with `sudo -u ${BOT_USER} bash -lc 'source ~/.profile; command -v node'`; re-render `/usr/local/bin/agent-update` if the service still points at the wrong home. |
| `Codex could not find bubblewrap on PATH ... will use the vendored bubblewrap` | System `bwrap` is missing. Install it with `apt-get install -y bubblewrap`; the sandbox template expects host bubblewrap. |
| Co-tenant container OOM during agent activity | RAM is tight. Lower `MemoryMax` in `god-session.service`, reduce concurrent god sessions, or move `${BOT_USER}` workload to a dedicated small VPS. |

## P1 - Isolation And Session Correctness

| Issue | Solution |
|---|---|
| Bot for one project responds with another project's data | Under shared `BOT_USER`, `~/.claude/CLAUDE.md` exists at user-scope and Claude reads it for every project. Fix: `unlink /home/${BOT_USER}/.claude/CLAUDE.md`; render operator instructions only to `${PROJECT_DIR}/.claude/CLAUDE.md`; restart god-session. |
| Hooks fire to the wrong hex-relay port | `~/.claude/settings.json` has a user-scope `hooks` key. Fix: `sudo -u ${BOT_USER} bash -lc 'jq "del(.hooks)" ~/.claude/settings.json > ~/.claude/settings.json.new && mv ~/.claude/settings.json.new ~/.claude/settings.json'`, then ensure each project has `${PROJECT_DIR}/.claude/settings.json` with its own `RELAY_HOOK_PORT`. |
| `/sessions` shows another user's sessions or cannot delete own sessions | Relay ownership state is stale or missing. `sessions-dir.path` must be per user under `/var/lib/${PROJECT_NAME}/users/<telegram_user_id>/` and point to `/home/${BOT_USER}/.claude/projects/<encoded-cwd>` for this project cwd; DB `sessions.created_by_user_id` must match the Telegram user. Restart that user's god service and `${SERVICE_PREFIX}-hex-relay.service` after fixing. |
| Primary receives `[admin] god-session error: resume_crashed` or `session_crashed` | Claude/tmux exited before the session became stable. The wrapper writes `/var/lib/${PROJECT_NAME}/last-god-error.json`; hex-relay consumes it and alerts primary. If a resumed transcript crashes quickly, `last-session.id` is moved to `last-session.failed.<timestamp>.id` so the next restart starts fresh. |

## P2 - Login, Updater, And Marketplace

| Issue | Solution |
|---|---|
| `claude /login` redirect or paste-code flow fails | Read the CLI output and follow the flow it prints. Paste-code flow: open the URL and enter the long code from the auth-success page. OAuth callback flow: reconnect SSH with `-L 8080:localhost:8080 -L 8081:localhost:8081` and leave the tunnel open until browser redirect completes. |
| Claude plugin update fails for `levnikolaevich-skills-marketplace` | Marketplace was not installed by `ln-031` or Claude auth expired. Run `claude plugin marketplace add levnikolaevich/claude-code-skills` as `${BOT_USER}`, verify `claude plugin list --json`, then re-run `agent-update.service`. If it also shows 401/login errors, use the P0 auth row first. |
| `agent-update.service` fails during `claude update` or `npm i -g @openai/codex@latest` | Network/registry/upstream CLI failure. The script exits before restarting any `*-god@*.service`, so existing sessions keep running. Re-run `systemctl start agent-update.service` after upstream recovery. |
| `agent-update.service` fails with `selected plugin not found` | `AGENT_SKILLS_PLUGINS` names a plugin absent from `${AGENT_SKILLS_DIR}/.agents/plugins/marketplace.json`. Use `agile-workflow`, `all`, or an explicit comma-list from that manifest. |
| `agent-update.service` fails with multiple LevNikolaevich marketplace blocks in Codex config | `~/.codex/config.toml` has an unmanaged duplicate outside the `ln-030 managed LevNikolaevich marketplace` block. Remove the duplicate manually; do not symlink Claude plugin roots into Codex. |
| `agent-update.timer` is missing or nightly update ran after downtime | Render/install `agent-update.timer` and `agent-update.service`, run `systemctl daemon-reload`, then `systemctl enable --now agent-update.timer`. With `Persistent=true`, catch-up after VPS downtime is expected; check `journalctl -u agent-update.service -n 100 --no-pager`. |

## P3 - Provider Credentials

| Issue | Solution |
|---|---|
| `gh auth login` says token has insufficient scopes | If using PAT instead of GitHub App, re-issue PAT with Contents R/W, Issues R/W, Pull requests R/W, Metadata R. Partial scopes silently break `gh issue edit --add-label`. |
| `gh` reports "You are not logged into any GitHub hosts" despite `GH_TOKEN=val gh ...` | `sudo -i -u <user>` spawns a subshell where inline env assignment does not propagate. Use `sudo -u <user> bash -lc '...'` without `-i`; the `-l` flag still loads `.profile`. |

## P4 - Verification Noise And Low-Risk Warnings

| Issue | Solution |
|---|---|
| `claude-usage-report` says cache is empty or percentages differ from UI | Cache is stale or not populated until the next Claude API tick. Send any Telegram message or `tmux -L ${SERVICE_PREFIX} send-keys -t ${SERVICE_PREFIX}-god-${TELEGRAM_CHAT_ID} "ping" Enter`; statusLine refreshes cache on the next API call. |
| `/api/oauth/usage` returns `OAuth authentication is currently not supported` | Wrong/missing `anthropic-beta: oauth-2025-04-20` header. The endpoint is undocumented; prefer the official statusLine path installed by `ln-032`. |
| `tput: unknown terminal "unknown"` warning during scripted runs | Cosmetic, caused by no TTY. Ignore or `export TERM=dumb` in the wrapper. |
| `command contains null bytes or newlines` from `mcp__hex-ssh__remote-ssh` | Tool rejects literal `\n` in command strings. Use `&&` chains or `printf '\n...'` for embedded newlines. |

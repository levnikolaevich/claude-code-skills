# Troubleshooting — ln-030-vps-bootstrap

Reactive lookup for issues that surface during or after install.

| Issue | Solution |
|---|---|
| `nvm install` says success but `node` not found in next command | The pipe `\| tail` ran `nvm install` in a subshell; PATH side-effect lost. Re-run without piping. |
| `sudo -i -u ${BOT_USER} which node` returns empty | `.profile` patch missing. Re-run step 4's `printf >> .profile` block. |
| `command contains null bytes or newlines` from `mcp__hex-ssh__remote-ssh` | Tool rejects literal `\n` in command string. Use `&&` chains or `printf '\n...'` for embedded newlines. |
| `claude /login` redirect to `localhost:8080` fails | SSH session was opened without `-L 8080:localhost:8080`. Reconnect with `ssh -i ${VPS_SSH_KEY} -L 8080:localhost:8080 -L 8081:localhost:8081 ${BOT_USER}@${VPS_HOST}`. |
| Modern paste-code login flow vs OAuth callback | CLI prints the URL — read what it says. Paste-code: enter long auth code shown on the auth-success page. OAuth callback: leave SSH `-L` open, browser redirect lands via tunnel. |
| Co-tenant container OOM during agent activity | RAM is tight. Either lower `MemoryMax` in `god-session.service`, or move `${BOT_USER}` workload to a dedicated small VPS (~€5/mo). |
| `gh auth login` says token has insufficient scopes | If using PAT instead of GH App: re-issue PAT with Contents R/W, Issues R/W, Pull requests R/W, Metadata R. Partial scopes silently break `gh issue edit --add-label`. |
| `tput: unknown terminal "unknown"` warning during scripted runs | Cosmetic. Caused by no TTY. Ignore or `export TERM=dumb` in the wrapper. |
| `Codex could not find bubblewrap on PATH ... will use the vendored bubblewrap` | System `bwrap` is missing — Step 1's apt install didn't run on this snapshot. `apt-get install -y bubblewrap`. |
| `gh` reports "You are not logged into any GitHub hosts" despite `GH_TOKEN=val gh ...` | `sudo -i -u <user>` spawns a subshell where bash inline-assignment doesn't propagate. Use `sudo -u <user> bash -lc '...'` (without `-i`). The `-l` flag still loads `.profile`. |
| `claude-usage-report` says «Кэш ещё не заполнен» | God-session has not made an API call since last restart. Send any Telegram message (or `tmux send-keys -t ${SERVICE_PREFIX}-god "ping" Enter`) to trigger the first response — statusLine fires on the API tick and writes the cache. |
| `/api/oauth/usage` returns `OAuth authentication is currently not supported` | Wrong/missing `anthropic-beta: oauth-2025-04-20` header. The endpoint is undocumented anyway — prefer the official statusLine path in Step 7b. |
| `claude-usage-report` percentages don't match the UI panel on the laptop | Cache is stale (script prints `⚠️ Данные обновлены N мин назад`). Send any Telegram message; statusLine fires on the next API tick and refreshes the cache. |

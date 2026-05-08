<!-- SOURCE-OF-TRUTH: shared/references/shared_auth_state.md. Edit ONLY here; run `node tools/marketplace/shared.mjs sync` -->

# Shared Claude/Codex auth state (`/var/lib/claude-shared/`)

<!-- SCOPE: Multi-bot deployment pattern that lets one Claude Max OAuth + one Codex OAuth serve N project-bot Linux users on the same VPS without burning N device slots. -->

## Why this pattern

Claude Code generates a `userID` (SHA-256 hex) on first login and stores it in `~/.claude.json`. Anthropic binds the OAuth refresh token to that `userID` server-side. Codex stores OAuth in `~/.codex/auth.json`, but Codex also owns per-user runtime files under `~/.codex/` (`tmp/arg0`, SQLite state, logs, sessions, history). Those runtime files are not safe to share as one directory across multiple Linux users.

Empirical consequences (validated 2026-05-06):

- `userID` lives in `~/.claude.json` (top-level field), **not** inside `~/.claude/`
- The same shared OAuth identity (one `claudeAiOauth` block) refers to a per-user `userID`
- Copying just `~/.claude/.credentials.json` between users yields `HTTP 401 Invalid authentication credentials` because the per-user `userID` does not match the bound device server-side
- Copying `~/.claude.json` together with `~/.claude/.credentials.json` is also rejected when the auth refresh token rotates and re-binds to whatever process triggered rotation
- Same VPS does not imply same Anthropic device. Claude Max counts each Linux-user login as one device slot (default 5 max)

Two viable shapes:

1. **One shared Linux user** (`agent-bot`) for all projects. Strongest cache-locality. Documented in `shared_user_pattern.md`. Existing fleets do not always follow this pattern.
2. **Multi-Linux-user with shared state via filesystem** (`/var/lib/claude-shared/` + setgid group + ACL). Documented here. Lets per-project bot users keep filesystem and systemd isolation while sharing a single Claude Max device slot and a single Codex login. Claude state is shared by symlink; Codex uses a per-bot runtime directory with only `auth.json` shared.

Pick option (2) when:
- You already have per-project bot users (`civic-bot`, `prompsit-bot`, `btc-bot`, ...) and migrating to a shared user is expensive
- You want to add a new project without burning another Claude Max device slot
- You want each project's filesystem (`/opt/<project>`, `/etc/<project>`, `/var/lib/<project>`, log file, systemd units) to stay isolated under its own bot user

Pick option (1) when:
- You are starting a fresh VPS
- You want minimal shell-level surprises (`bash -lc`, `sudo -i -u`, nvm loading)
- You want to follow the original ln-030 design

## Layout

```text
/var/lib/claude-shared/                 ← canonical state, owner=<seed-bot>:claude-shared, mode 2770
├── .claude/                            ← shared (config, plugins, projects/, sessions/, commands/, statusline.sh)
├── .claude.json                        ← shared (userID + oauthAccount + cachedExperimentFeatures)
└── .codex/
    └── auth.json                       ← shared Codex OAuth file only

/home/<bot-A>/                          ← per-project bot home (still isolated)
├── .nvm/                               ← per-bot Node toolchain (bot-A's npm globals: claude, codex CLIs)
├── .profile                            ← MUST source ~/.nvm/nvm.sh for login shells
├── .claude       → /var/lib/claude-shared/.claude         (symlink)
├── .claude.json  → /var/lib/claude-shared/.claude.json    (symlink)
└── .codex/                              ← real per-bot dir, owner=<bot>, mode 0700
    ├── auth.json  → /var/lib/claude-shared/.codex/auth.json
    ├── config.toml
    ├── tmp/
    ├── sessions/
    └── ...

/home/<bot-B>/                          ← second project, same layout
└── ... (Claude symlinks point to the same shared dir; Codex runtime stays per-bot)
```

`group claude-shared` (any free GID) is the membership list. Add every bot that should share auth.

## Required permissions

Filesystem ACL gives the group rwx access without changing the canonical owner of individual files. Claude/Codex may still atomically replace auth files and chmod them back to `0600`, which collapses the effective ACL mask. Shared auth therefore requires both default ACLs and a persistent permission repair watcher:

```bash
groupadd claude-shared
usermod -aG claude-shared bot-A
usermod -aG claude-shared bot-B
usermod -aG claude-shared bot-C

install -d -o bot-A -g claude-shared -m 2770 /var/lib/claude-shared
# ... seed dirs ...
chown -R bot-A:claude-shared /var/lib/claude-shared
find /var/lib/claude-shared -type d -exec chmod 2770 {} +
find /var/lib/claude-shared -type f -exec chmod 0660 {} +
setfacl -R -m g:claude-shared:rwX /var/lib/claude-shared
setfacl -R -d -m g:claude-shared:rwX /var/lib/claude-shared
```

`acl` package required (`apt-get install -y acl`).

## Persistent permission repair

Install the repair helper and systemd path unit whenever `/var/lib/claude-shared/` is used. The helper repairs only owner group, mode, and ACL on the shared auth files; it never prints token contents.

```bash
install -o root -g root -m 755 references/scripts/claude-shared-auth-perms.sh /usr/local/bin/claude-shared-auth-perms
install -o root -g root -m 644 references/templates/claude-shared-auth-perms.service /etc/systemd/system/claude-shared-auth-perms.service
install -o root -g root -m 644 references/templates/claude-shared-auth-perms.path /etc/systemd/system/claude-shared-auth-perms.path
systemctl daemon-reload
systemctl enable --now claude-shared-auth-perms.path
systemctl start claude-shared-auth-perms.service
```

Manual `chmod 0660 /var/lib/claude-shared/.claude/.credentials.json` or `chmod 0660 /var/lib/claude-shared/.codex/auth.json` is only immediate recovery when the watcher is missing. It is not durable because the next token refresh can replace the file again.

Do not symlink `/home/<bot>/.codex` to `/var/lib/claude-shared/.codex`. Current Codex creates runtime paths such as `tmp/arg0` with mode `0700` and writes per-user SQLite/log/session files. Whole-directory sharing causes cross-user permission drift and startup failures. Share `auth.json` only.

## Migration script (idempotent)

Backs up existing per-bot state before symlinking. Safe to run once per VPS.

```bash
#!/bin/bash
set -euo pipefail
TS=$(date +%Y%m%d-%H%M%S)
SHARED=/var/lib/claude-shared
BOTS=(civic-bot prompsit-bot btc-bot)         # adjust per fleet
SEED_BOT=civic-bot                            # bot whose .claude/.codex contents seed shared

# 1. group + membership
getent group claude-shared >/dev/null || groupadd claude-shared
for bot in "${BOTS[@]}"; do usermod -aG claude-shared "$bot"; done

# 2. shared dir
install -d -o "$SEED_BOT" -g claude-shared -m 2770 "$SHARED"

# 3. seed from seed-bot (preserves existing Claude plugins and project trust blocks)
[[ -d "$SHARED/.claude" ]] || cp -a "/home/$SEED_BOT/.claude" "$SHARED/.claude"
install -d -o "$SEED_BOT" -g claude-shared -m 2770 "$SHARED/.codex"
if [[ ! -e "$SHARED/.codex/auth.json" && -e "/home/$SEED_BOT/.codex/auth.json" ]]; then
  cp -a "/home/$SEED_BOT/.codex/auth.json" "$SHARED/.codex/auth.json"
fi

# 4. drop existing creds — fresh /login below will recreate, bound to one device
for f in "$SHARED/.claude/.credentials.json" "$SHARED/.codex/auth.json"; do
  [[ -e "$f" ]] && unlink "$f"
done

# 5. perms
chown -R "$SEED_BOT":claude-shared "$SHARED"
find "$SHARED" -type d -exec chmod 2770 {} +
find "$SHARED" -type f -exec chmod 0660 {} +
setfacl -R    -m g:claude-shared:rwX "$SHARED"
setfacl -R -d -m g:claude-shared:rwX "$SHARED"
# Install and start claude-shared-auth-perms.service/.path before the login flow.

# 6. backup + link for each bot
for bot in "${BOTS[@]}"; do
  HOMEDIR="/home/$bot"
  for path in .claude .claude.json; do
    src="$HOMEDIR/$path"
    if   [[ -L "$src" ]]; then unlink "$src"
    elif [[ -e "$src" ]]; then mv "$src" "$src.before-shared-migration.$TS"
    fi
  done
  sudo -u "$bot" ln -s "$SHARED/.claude"      "$HOMEDIR/.claude"
  sudo -u "$bot" ln -s "$SHARED/.claude.json" "$HOMEDIR/.claude.json"

  if [[ -L "$HOMEDIR/.codex" ]]; then unlink "$HOMEDIR/.codex"; fi
  install -d -o "$bot" -g "$bot" -m 0700 "$HOMEDIR/.codex"
  find "$HOMEDIR/.codex" -mindepth 1 -maxdepth 1 \
    ! -name auth.json ! -name config.toml ! -name notify.sh ! -name plugins \
    -exec rm -rf {} +
  [[ -e "$HOMEDIR/.codex/auth.json" ]] && unlink "$HOMEDIR/.codex/auth.json"
  ln "$SHARED/.codex/auth.json" "$HOMEDIR/.codex/auth.json"
  chown "$bot:$bot" "$HOMEDIR/.codex"
done
```

## One-time login flow

After migration, run **one** `claude /login` and **one** `codex login --device-auth` as **any** bot. Claude writes to the shared dir through symlinks. Codex writes to that bot's real `~/.codex/auth.json` hardlink; all other bots inherit the same inode through their own hardlinks.

```bash
# Pre-seed a minimal .claude.json so the onboarding theme picker is skipped
cat > /var/lib/claude-shared/.claude.json <<EOF
{"hasCompletedOnboarding":true,"firstStartTime":"$(date -u +%FT%TZ)"}
EOF
chown "$SEED_BOT":claude-shared /var/lib/claude-shared/.claude.json
chmod 0660 /var/lib/claude-shared/.claude.json

# Claude login (interactive — paste-code flow)
sudo -u btc-bot tmux -L btc-login new-session -d -s login -x 200 -y 50 \
  'bash -lc "claude 2>&1; sleep 60"'
# Send Enter to confirm trust folder, then send "/login" + Enter, choose option 1 (subscription),
# read the URL from `tmux ... capture-pane`, complete in browser, paste the resulting code back.

# Codex login (use --device-auth on headless VPS — plain `codex login` opens a localhost:1455
# callback that the operator's local browser cannot reach)
sudo -u btc-bot tmux -L btc-codex-login new-session -d -s login -x 200 -y 50 \
  'bash -lc "codex login --device-auth 2>&1; sleep 180"'
# Show the operator the auth.openai.com/codex/device URL + 8-char code; codex picks the token up
# automatically when the browser flow completes.

# Repair ACL masks immediately after login; the path unit keeps future rotations healthy.
systemctl start claude-shared-auth-perms.service
```

## Migrating an existing fleet (per-bot → shared)

If god services were already running BEFORE the migration, they captured stale state at startup and will keep using it until restart:

1. Each running `claude` process **cached its refresh_token in JS memory** when it loaded `.credentials.json` once at boot. Disk replacement (real file → symlink) does not propagate to live processes; the next time that process tries to refresh its access_token, the stale in-memory refresh_token may already be invalidated by your fresh `/login`, surfacing as `[admin] god-session error: auth_failed` in Telegram.
2. Each running `bwrap` sandbox **captured the source inode at mount time** for `--bind /home/${BOT_USER}/.claude $AGENT_HOME/.claude`. The bind keeps pointing at the original (now-replaced) directory, not at the new symlink target.

After completing the one-time `claude /login` and `codex login --device-auth` against the shared dir, **restart every running god service** so each picks up shared state on disk and re-mounts the bind through the symlink:

```bash
for unit in $(systemctl list-units --type=service '*-god@*.service' '*-god-codex@*.service' --state=active --no-legend | awk '{print $1}'); do
  systemctl restart "$unit"
done
```

The `--resume <session-uuid>` flag (set automatically by the wrapper from each user's `last-session.id`) keeps each operator's conversation history — session JSONL files are local logs and survive the restart untouched.

## Sandbox compatibility

`agent-sandbox.sh` does two things for shared-auth bots:

1. **bind-mounts** `/home/${BOT_USER}/.claude` and `/home/${BOT_USER}/.codex` into `${AGENT_HOME}/.claude` and `${AGENT_HOME}/.codex` via `bwrap --bind`. The bind syscall resolves the Claude source symlink at mount time, so inside the sandbox `${AGENT_HOME}/.claude` shows the actual `/var/lib/claude-shared/.claude/` contents. Codex sees the bot's own real `~/.codex` directory, with only `auth.json` shared by hardlink.

2. **copies** the small per-cwd config file `~/.claude.json` into `${AGENT_HOME}/.claude.json` with `cp -aL` (dereference). **Do not use plain `cp -a`** — it preserves the symlink, and inside the sandbox the symlink target (`/var/lib/claude-shared/.claude.json`) is not reachable, so claude reads ENOENT, falls into onboarding, and regenerates a fresh `userID` that breaks the OAuth refresh-token binding for every bot sharing the dir.

If you migrate an existing fleet to shared-auth, audit each `${SERVICE_PREFIX}-agent-sandbox` script for `cp -a "$src" "$dst"` inside `copy_if_missing` and change it to `cp -aL`. The skills repo template `references/scripts/agent-sandbox.sh` already uses `cp -aL`. Recovery sequence if you hit this: (1) patch sandbox script, (2) `unlink ${PROJECT_DIR}/.agent-home/users/<id>/.claude.json`, (3) restart `${SERVICE_PREFIX}-god@<id>.service`, (4) one fresh `claude /login` from inside the sandbox to re-establish a consistent `(userID, refresh_token)` pair in the shared dir.

## What is NOT shared

- `~/.nvm/` — each bot keeps its own Node toolchain. nvm is per-user by design.
- `/etc/<project>/secrets.env`, `/etc/<project>/github-app.pem` — project secrets stay per-project.
- `/var/lib/<project>/relay.db` — relay DB is per-project, owned by the project's bot.
- systemd units — `<service-prefix>-god@.service`, `<service-prefix>-hex-relay.service` are per-project.
- god-session tmux socket — `tmux -L <service-prefix>` is per-project.
- `RELAY_HOOK_PORT` — each hex-relay listens on its own localhost port.

The shared part is exactly the LLM-account state (auth tokens, plugin marketplaces, command palettes, statusLine script). Everything else stays project-isolated.

## Smoke verification

```bash
systemctl is-active claude-shared-auth-perms.path

for bot in civic-bot prompsit-bot btc-bot; do
  sudo -u "$bot" test -r /home/"$bot"/.claude/.credentials.json
  sudo -u "$bot" test -w /home/"$bot"/.claude/.credentials.json
  sudo -u "$bot" test -r /home/"$bot"/.claude.json
  sudo -u "$bot" test -w /home/"$bot"/.claude.json
  sudo -u "$bot" test -r /home/"$bot"/.codex/auth.json
  sudo -u "$bot" test -w /home/"$bot"/.codex/auth.json
done

for bot in civic-bot prompsit-bot btc-bot; do
  echo "-- $bot --"
  sudo -u "$bot" bash -c ". /home/$bot/.nvm/nvm.sh && echo 'reply ok' | timeout 30 claude --print 2>&1" | head -1
  sudo -u "$bot" bash -c ". /home/$bot/.nvm/nvm.sh && codex login status 2>&1" | head -3
done
```

All three should return non-401 claude output and `Logged in using ChatGPT` for codex.

## Failure modes (see also `troubleshooting.md`)

- **`HTTP 401 Invalid authentication credentials`** after migration: ACL mask is `---` because token rotation wrote mode `0600`, or the shared-auth repair watcher is missing. Immediate fix: `systemctl start claude-shared-auth-perms.service` if installed, or `chmod 0660 /var/lib/claude-shared/.claude/.credentials.json` as one-shot recovery. Durable fix: install and enable `claude-shared-auth-perms.path`.
- **`Claude configuration file not found at: /home/<bot>/.claude.json`**: the symlink target does not exist. The first `claude` run creates it through the symlink; if you see this message, just complete the login flow once.
- **`getfacl: cannot get extended attributes`**: filesystem does not support ACLs. Mount with `acl` option (most modern ext4 mounts have it on by default).
- **Service restart breaks auth**: a long-running god-session held an in-memory token bound to the OLD per-bot userID. Restarting it forces a fresh disk read; the new shared userID + token will work because both are now consistent on disk.

---

**Version:** 1.0.0
**Last Updated:** 2026-05-06

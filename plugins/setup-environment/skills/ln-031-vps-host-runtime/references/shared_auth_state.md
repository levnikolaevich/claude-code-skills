# Shared Claude/Codex auth state (`/var/lib/claude-shared/`)

<!-- SCOPE: Multi-bot deployment pattern that lets one Claude Max OAuth + one Codex OAuth serve N project-bot Linux users on the same VPS without burning N device slots. -->

## Why this pattern

Claude Code generates a `userID` (SHA-256 hex) on first login and stores it in `~/.claude.json`. Anthropic binds the OAuth refresh token to that `userID` server-side. The same is true for Codex with `~/.codex/auth.json` + `~/.codex/installation_id`.

Empirical consequences (validated 2026-05-06):

- `userID` lives in `~/.claude.json` (top-level field), **not** inside `~/.claude/`
- The same shared OAuth identity (one `claudeAiOauth` block) refers to a per-user `userID`
- Copying just `~/.claude/.credentials.json` between users yields `HTTP 401 Invalid authentication credentials` because the per-user `userID` does not match the bound device server-side
- Copying `~/.claude.json` together with `~/.claude/.credentials.json` is also rejected when the auth refresh token rotates and re-binds to whatever process triggered rotation
- Same VPS does not imply same Anthropic device. Claude Max counts each Linux-user login as one device slot (default 5 max)

Two viable shapes:

1. **One shared Linux user** (`agent-bot`) for all projects. Strongest cache-locality. Documented in `shared_user_pattern.md`. Existing fleets do not always follow this pattern.
2. **Multi-Linux-user with shared state via filesystem** (`/var/lib/claude-shared/` + symlinks + setgid group + ACL). Documented here. Lets per-project bot users keep filesystem and systemd isolation while sharing a single Claude Max device slot and a single Codex login.

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
└── .codex/                             ← shared (auth.json, config.toml, installation_id, history)

/home/<bot-A>/                          ← per-project bot home (still isolated)
├── .nvm/                               ← per-bot Node toolchain (bot-A's npm globals: claude, codex CLIs)
├── .profile                            ← MUST source ~/.nvm/nvm.sh for login shells
├── .claude       → /var/lib/claude-shared/.claude         (symlink)
├── .claude.json  → /var/lib/claude-shared/.claude.json    (symlink)
└── .codex        → /var/lib/claude-shared/.codex          (symlink)

/home/<bot-B>/                          ← second project, same layout
└── ... (symlinks point to the same shared dir)
```

`group claude-shared` (any free GID) is the membership list. Add every bot that should share auth.

## Required permissions

Filesystem ACL gives the group rwx access without changing the canonical owner of individual files (so token rotation that writes mode `0600` still leaves the file readable through the ACL mask):

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

After `claude /login` writes `.credentials.json` with mode `0600`, run `chmod 0660 /var/lib/claude-shared/.claude/.credentials.json` once so the ACL mask becomes `rw-` (otherwise `getfacl` shows `mask::---` and group access is effectively zero).

Same fix applies to `/var/lib/claude-shared/.codex/auth.json` after `codex login --device-auth` writes it `0600`.

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

# 3. seed from seed-bot (preserves existing plugins, project trust blocks, etc.)
[[ -d "$SHARED/.claude" ]] || cp -a "/home/$SEED_BOT/.claude" "$SHARED/.claude"
[[ -d "$SHARED/.codex"  ]] || cp -a "/home/$SEED_BOT/.codex"  "$SHARED/.codex"

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

# 6. backup + symlink for each bot
for bot in "${BOTS[@]}"; do
  HOMEDIR="/home/$bot"
  for path in .claude .codex .claude.json; do
    src="$HOMEDIR/$path"
    if   [[ -L "$src" ]]; then unlink "$src"
    elif [[ -e "$src" ]]; then mv "$src" "$src.before-shared-migration.$TS"
    fi
  done
  sudo -u "$bot" ln -s "$SHARED/.claude"      "$HOMEDIR/.claude"
  sudo -u "$bot" ln -s "$SHARED/.codex"       "$HOMEDIR/.codex"
  sudo -u "$bot" ln -s "$SHARED/.claude.json" "$HOMEDIR/.claude.json"
done
```

## One-time login flow

After migration, run **one** `claude /login` and **one** `codex login --device-auth` as **any** bot. Both write to the shared dir; all other bots inherit through their symlinks.

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

# Fix ACL masks (claude/codex write mode 0600; chmod 0660 lets ACL group=rwX become effective)
chmod 0660 /var/lib/claude-shared/.claude/.credentials.json
chmod 0660 /var/lib/claude-shared/.codex/auth.json
```

## Migrating an existing fleet (per-bot → shared)

If god services were already running BEFORE the migration, they captured stale state at startup and will keep using it until restart:

1. Each running `claude` process **cached its refresh_token in JS memory** when it loaded `.credentials.json` once at boot. Disk replacement (real file → symlink) does not propagate to live processes; the next time that process tries to refresh its access_token, the stale in-memory refresh_token may already be invalidated by your fresh `/login`, surfacing as `[admin] god-session error: auth_failed` in Telegram.
2. Each running `bwrap` sandbox **captured the source inode at mount time** for `--bind /home/${BOT_USER}/.claude $AGENT_HOME/.claude`. The bind keeps pointing at the original (now-replaced) directory, not at the new symlink target.

After completing the one-time `claude /login` and `codex login --device-auth` against the shared dir, **restart every running god service** so each picks up shared state on disk and re-mounts the bind through the symlink:

```bash
for unit in $(systemctl list-units --type=service '*-god@*.service' --state=active --no-legend | awk '{print $1}'); do
  systemctl restart "$unit"
done
```

The `--resume <session-uuid>` flag (set automatically by the wrapper from each user's `last-session.id`) keeps each operator's conversation history — session JSONL files are local logs and survive the restart untouched.

## Sandbox compatibility

`agent-sandbox.sh` does two things for shared-auth bots:

1. **bind-mounts** `/home/${BOT_USER}/.claude` and `/home/${BOT_USER}/.codex` into `${AGENT_HOME}/.claude` and `${AGENT_HOME}/.codex` via `bwrap --bind`. The bind syscall resolves the source symlink at mount time, so inside the sandbox `${AGENT_HOME}/.claude` shows the actual `/var/lib/claude-shared/.claude/` contents (incl. `.credentials.json`, plugins, projects). No sandbox config change is required for this.

2. **copies** the small per-cwd config file `~/.claude.json` into `${AGENT_HOME}/.claude.json` with `cp -aL` (dereference). **Do not use plain `cp -a`** — it preserves the symlink, and inside the sandbox the symlink target (`/var/lib/claude-shared/.claude.json`) is not reachable, so claude reads ENOENT, falls into onboarding, and regenerates a fresh `userID` that breaks the OAuth refresh-token binding for every bot sharing the dir. Same applies to `~/.codex/config.toml` if it ever becomes a symlink.

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
for bot in civic-bot prompsit-bot btc-bot; do
  echo "-- $bot --"
  sudo -u "$bot" bash -c ". /home/$bot/.nvm/nvm.sh && echo 'reply ok' | timeout 30 claude --print 2>&1" | head -1
  sudo -u "$bot" bash -c ". /home/$bot/.nvm/nvm.sh && codex login status 2>&1" | head -3
done
```

All three should return non-401 claude output and `Logged in using ChatGPT` for codex.

## Failure modes (see also `troubleshooting.md`)

- **`HTTP 401 Invalid authentication credentials`** after migration: ACL mask is `---` because token rotation wrote mode `0600`. Fix: `chmod 0660 /var/lib/claude-shared/.claude/.credentials.json` (sets ACL mask to `rw-`).
- **`Claude configuration file not found at: /home/<bot>/.claude.json`**: the symlink target does not exist. The first `claude` run creates it through the symlink; if you see this message, just complete the login flow once.
- **`getfacl: cannot get extended attributes`**: filesystem does not support ACLs. Mount with `acl` option (most modern ext4 mounts have it on by default).
- **Service restart breaks auth**: a long-running god-session held an in-memory token bound to the OLD per-bot userID. Restarting it forces a fresh disk read; the new shared userID + token will work because both are now consistent on disk.

---

**Version:** 1.0.0
**Last Updated:** 2026-05-06

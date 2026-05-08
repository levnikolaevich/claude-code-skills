<!-- SOURCE-OF-TRUTH: shared/references/scope_layers.md. Edit ONLY here; run `node tools/marketplace/shared.mjs sync` -->

# Scope Layers

Topology and path guard for VPS agent environments.

## Canonical Shape

One VPS has one shared `BOT_USER=agent-bot` for Claude/Codex runtime state. Each project has its own Telegram bot token, systemd units, relay database, hooks, logs, and project working directory.

| Layer | Scope | Owns |
|---|---|---|
| Global VPS | machine-wide | apt packages, `gh`, `glab`, update service/timer |
| Shared `BOT_USER` | one Linux user across projects | nvm/Node, Claude/Codex CLIs, user-scope plugins, shared `.claude` and `.codex` runtime auth |
| Project name | `/etc`, `/var/lib`, `/var/log` project state | secrets, relay DB, per-operator state, logs |
| Service prefix | systemd/binaries/tmux namespace | god services, hex-relay service, tmux socket/targets |
| Project dir | repo checkout and project Claude config | git clone, project `.claude/CLAUDE.md`, project `.claude/settings.json`, sandbox home/cache |
| Telegram bot | one bot token per project | Telegram polling session and relay hook port |
| Telegram user | per-operator runtime | personal god-session target and Claude project JSONLs |

## Guard Rules

- `PROJECT_NAME`, `SERVICE_PREFIX`, and `RELAY_HOOK_PORT` must be unique per project on the same VPS.
- Telegram bot tokens cannot be shared across projects because polling is single-consumer.
- User-scope `CLAUDE.md` and hooks are forbidden under the shared `BOT_USER`; render project instructions under `${PROJECT_DIR}/.claude/`.
- Work-plane sessions must not access `/etc/${PROJECT_NAME}`, `/var/lib/${PROJECT_NAME}`, relay source under `/opt`, sibling projects, or host systemd.
- Shared auth across separate bot users is conditional legacy/migration mode; load `shared_auth_state.md` only when `/var/lib/claude-shared/` or per-project bot users exist.

## Multi-Project Flow

For another project on the same VPS:
1. Reuse global VPS and shared `BOT_USER` layers.
2. Create unique project/service/port state.
3. Deploy a separate hex-relay instance.
4. Verify tmux, systemd, port, DB, hooks, and Telegram command isolation.

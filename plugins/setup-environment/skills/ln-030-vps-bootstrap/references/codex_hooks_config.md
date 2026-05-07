<!-- SOURCE-OF-TRUTH: shared/references/codex_hooks_config.md. Edit ONLY here; run `node tools/marketplace/shared.mjs sync` -->

# Codex hooks config

> **SCOPE:** Reference for codex hook integration. Loaded only when ln-013-config-syncer aligns codex hooks.

Codex CLI 0.120+ supports a hook system that mirrors Claude Code's. We use it to deliver
the same observability events (UserPromptSubmit, Stop, SessionStart, Pre/PostToolUse) into
the hex-relay listener so a Codex-driven god-session shows the same Telegram surface as a
Claude-driven one.

## 1. Where the config lives

Codex reads its config from `~/.codex/config.toml` for the user it runs as. Discovery
order:

1. `$CODEX_HOME/config.toml` (when set)
2. `~/.codex/config.toml`
3. project-scoped `.codex/config.toml` under the current `cwd` (lower precedence; requires
   `trust_level = "trusted"` for the project)

We manage the user-scope file under `${BOT_USER}` because the bwrap sandbox in
`agent-sandbox.sh` bind-mounts `~/.codex` as writable into each god-session.

## 2. Canonical block

The block below must be inserted between markers managed by `ln-013-config-syncer`:

```toml
# BEGIN ln-013 managed codex hooks
[features]
codex_hooks = true

[[hooks.UserPromptSubmit]]
command = ["/usr/local/bin/hex-relay-codex-hook.sh", "UserPromptSubmit"]
timeout_ms = 30000

[[hooks.Stop]]
command = ["/usr/local/bin/hex-relay-codex-hook.sh", "Stop"]
timeout_ms = 30000

[[hooks.SessionStart]]
command = ["/usr/local/bin/hex-relay-codex-hook.sh", "SessionStart"]
timeout_ms = 30000

[[hooks.PreToolUse]]
command = ["/usr/local/bin/hex-relay-codex-hook.sh", "PreToolUse"]
timeout_ms = 30000

[[hooks.PostToolUse]]
command = ["/usr/local/bin/hex-relay-codex-hook.sh", "PostToolUse"]
timeout_ms = 30000

[[hooks.PermissionRequest]]
command = ["/usr/local/bin/hex-relay-codex-hook.sh", "PermissionRequest"]
timeout_ms = 30000
# END ln-013 managed codex hooks
```

Notes:

- Codex does not emit `StopFailure` or `SubagentStop`. Those routes stay Claude-only.
- `timeout_ms` is set to 30s to align with Codex's default upper bound. The shim itself
  uses a 5s curl timeout and always exits 0; the larger Codex-side budget tolerates slow
  relay startup without breaking turns.
- `PermissionRequest` is included because the relay's hook routes treat unknown event
  types soft-validated (`z.passthrough()`); future relay support can consume them without
  another config rewrite.

## 3. Trust requirement for project-scope configs

Project-scoped `.codex/config.toml` files (under a repo) are ignored unless the project
appears under `[projects."<absolute_path>"]` in the user-scope config with
`trust_level = "trusted"`. The shared host runtime already writes that block per project
(see `agent_runtime_install.md`), so the user-scope hook block above is the authoritative
configuration for every god-session.

## 4. Verification

After writing the block, a god-session start should produce hex-relay log entries.

```bash
# 1. Restart Codex god-session and wait for SessionStart
sudo -u "${BOT_USER}" systemctl --user restart "${SERVICE_PREFIX}-god-codex@${TELEGRAM_CHAT_ID}.service"
sleep 4

# 2. Tail relay journal for hook arrivals (relay logs include event_type)
journalctl -u "${SERVICE_PREFIX}-hex-relay.service" -n 50 --no-pager | grep -E 'HOOK|user-prompt-submit|session-start'

# 3. Confirm health endpoint counters move
curl -s "http://127.0.0.1:${RELAY_HOOK_PORT}/health" | jq '{
  ok,
  god_session_ready,
  inbound_failed,
  outbox_abandoned,
  pending_fanout_acks_total
}'
```

Expected:

- `/health` returns `ok: true` and `pending_fanout_acks_total` is a non-negative integer
  that increments when a Codex prompt is acked from a fan-out cohort (one Telegram inbound
  delivered to both Claude and Codex sessions).
- The journal shows `HOOK user-prompt-submit pending set` (or similar) with the matching
  `session_id` slice once the operator types into the Codex pane.

If the shim is missing or `/usr/local/bin/hex-relay-codex-hook.sh` is not executable,
Codex will print `hook command not found` once at startup and skip the hook. The TUI
itself stays usable — hex-relay simply degrades to claude-only observability.

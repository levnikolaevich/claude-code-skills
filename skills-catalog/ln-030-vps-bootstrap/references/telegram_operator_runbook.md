# Telegram operator runbook — ln-030-vps-bootstrap

Operator-side playbooks for the Telegram bridge. Applies after `TELEGRAM_BOT_TOKEN` is in `/etc/${PROJECT_NAME}/secrets.env` and `${SERVICE_PREFIX}-relay-bot.service` is active.

## Bot hardening

Defense-in-depth: the relay-bot's `AllowlistMiddleware` already drops every event from non-allowlisted user_ids (and audits to `auth_rejects`). But Telegram-side settings further reduce attack surface. **Do this immediately after creating the bot:**

1. Open `@BotFather` → `/mybots` → select your bot.
2. **Bot Settings** → **Allow Groups?** → **Turn off**. Now the bot can only be DM'd; nobody can add it to a group to flood with messages.
3. **Bot Settings** → **Group Privacy** → **Enable** (default; verify). Belt-and-braces — even if Allow Groups gets re-enabled, the bot only sees commands in groups, not all messages.
4. Verify via Bot API:
   ```bash
   curl -fsS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe" | jq '.result | {username, can_join_groups, can_read_all_group_messages}'
   ```
   Expected: `can_join_groups: false`, `can_read_all_group_messages: false`.
5. **Token rotation procedure** (on suspected leak): `@BotFather` → `/mybots` → bot → **API Token** → **Revoke current token**. Update `/etc/${PROJECT_NAME}/secrets.env` with the new token (preserve mode 640, owner `root:${BOT_USER}`), then `systemctl restart ${SERVICE_PREFIX}-relay-bot.service`. Old token becomes 401 immediately.

The bot's `AllowlistMiddleware` is the primary control regardless of these settings — but combining application-level filtering with Telegram-side restrictions is best practice (Telegram official guidance: «Your backend should always verify that the user was authorized to use them»).

### Step A — repair Telegram menu commands

Step 7c registers these commands with English descriptions automatically through Bot API after `${SERVICE_PREFIX}-relay-bot.service` starts. Run this block only to repair or update an existing bot. It is idempotent.

```bash
/usr/local/bin/${SERVICE_PREFIX}-register-telegram-commands /etc/${PROJECT_NAME}/secrets.env
```

Optional cosmetic: `setMyDescription`, `setMyShortDescription` Bot API calls.

Registered commands:
- `/usage` — show Claude usage limits.
- `/new_session` — start a new Claude session for the current Telegram user.
- `/sessions` — resume or delete the current user's sessions.
- `/tasks` — list open provider issues; [Take] sends one selected task to the clicking user's current session.
- `/users` — manage bot access.

## Multi-user onboarding

After the primary operator is set up, additional users join via the bot's pending → `/users` approval flow. There is no env-var allowlist — the DB is the only source of truth.

1. New user (e.g. a colleague) finds the bot username and DMs it for the first time.
2. `AllowlistMiddleware` sees no row in `allowed_users` for that user_id → INSERT pending + auto-reply to user «⏳ Your access is pending approval» + alert to primary operator: «🆕 New user request: @<username> (id=<X>) — type `/users` to manage».
3. Primary types `/users` in their DM → bot replies with N cards (one per known user). The new user shows up with status `pending` and inline buttons `[✓ Allow] [⛔ Block] [🗑 Delete]`.
4. Primary clicks `[✓ Allow]` → DB row updates to `status='allowed'`, allowlist cache refreshes, bot DMs the new user «✓ Access granted by operator. You can use the bot now.»
5. New user can now DM normally; their messages forward to the shared pane with prefix `[tg id=<chat>:<msg> user=<name>] <text>` so claude sees who asked.
6. Their `/sessions` shows only own sessions (created via `/new_session` from their account); Resume/Delete restricted to own. Pane content is shared.

**Revoke:** primary types `/users` → finds the user → `[⛔ Block]` (silent revoke, no notification) or `[🗑 Delete]` (removes row entirely; user re-enters pending if they DM again).

**Primary's own card has no action buttons** — labelled «🛡 primary operator (protected)». You cannot block or delete the primary via the bot. To replace primary: change `TELEGRAM_CHAT_ID` in `secrets.env`, restart `${SERVICE_PREFIX}-relay-bot.service` — bootstrap inserts the new primary; old primary becomes a regular allowed user (or you can delete via `/users` then).

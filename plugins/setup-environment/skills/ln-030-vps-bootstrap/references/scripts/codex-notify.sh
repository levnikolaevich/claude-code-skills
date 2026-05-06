#!/bin/bash
# Codex notify hook — fires on agent-turn-complete, sends Telegram message.
# Wired into ~/.codex/config.toml as: notify = ["bash", "/home/${BOT_USER}/.codex/notify.sh"]
set -euo pipefail
SECRETS=/etc/${PROJECT_NAME}/secrets.env
[[ -r "$SECRETS" ]] || exit 0   # silent: notify is non-critical
set -a; . "$SECRETS"; set +a
[[ -n "${TELEGRAM_BOT_TOKEN:-}" && -n "${TELEGRAM_CHAT_ID:-}" ]] || exit 0

JSON="${1:-}"
[[ -z "$JSON" ]] && exit 0

TYPE=$(echo "$JSON" | jq -r '.type // empty' 2>/dev/null || echo "")
[[ "$TYPE" != "agent-turn-complete" ]] && exit 0

THREAD=$(echo "$JSON" | jq -r '."thread-id" // empty' 2>/dev/null | head -c 8)
LAST=$(echo "$JSON" | jq -r '."last-assistant-message" // "(no message)"' 2>/dev/null | head -c 400)

TEXT="[codex#${THREAD:-?}] turn complete: $LAST"

curl -fsS -X POST \
  -d "chat_id=$TELEGRAM_CHAT_ID" \
  --data-urlencode "text=$TEXT" \
  "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" \
  >/dev/null || true

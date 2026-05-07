#!/usr/bin/env bash
set -euo pipefail

env_file="${1:?usage: register-telegram-commands.sh /etc/<project>/secrets.env}"

if [[ ! -r "${env_file}" ]]; then
  echo "ERROR: Telegram secrets file is not readable: ${env_file}" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
. "${env_file}"
set +a

if [[ -z "${TELEGRAM_BOT_TOKEN:-}" ]]; then
  echo "ERROR: TELEGRAM_BOT_TOKEN is empty in ${env_file}" >&2
  exit 1
fi

commands='{"commands":[
    {"command":"usage","description":"Show Claude/Codex usage limits"},
    {"command":"new_session","description":"Start a new Claude session"},
    {"command":"sessions","description":"Resume or delete Claude sessions"},
    {"command":"tasks","description":"List open tasks"},
    {"command":"users","description":"Manage bot access"}
  ]}'

curl -fsS -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setMyCommands" \
  -H 'Content-Type: application/json' \
  -d "${commands}" >/dev/null

curl -fsS -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setMyCommands" \
  -H 'Content-Type: application/json' \
  -d "$(printf '%s' "${commands}" | jq -c '. + {scope:{type:"all_private_chats"}}')" >/dev/null

curl -fsS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMyCommands" \
  | jq -e '.result == [
      {"command":"usage","description":"Show Claude/Codex usage limits"},
      {"command":"new_session","description":"Start a new Claude session"},
      {"command":"sessions","description":"Resume or delete Claude sessions"},
      {"command":"tasks","description":"List open tasks"},
      {"command":"users","description":"Manage bot access"}
    ]' >/dev/null

curl -fsS -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMyCommands" \
  -d 'scope={"type":"all_private_chats"}' \
  | jq -e '.result == [
      {"command":"usage","description":"Show Claude/Codex usage limits"},
      {"command":"new_session","description":"Start a new Claude session"},
      {"command":"sessions","description":"Resume or delete Claude sessions"},
      {"command":"tasks","description":"List open tasks"},
      {"command":"users","description":"Manage bot access"}
    ]' >/dev/null

echo "telegram commands registered"

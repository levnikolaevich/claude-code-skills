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

script_name="$(basename "$0")"
service_prefix="${script_name%-register-telegram-commands}"
relay_dir="${HEX_RELAY_DIR:-/opt/${service_prefix}-hex-relay}"
commands_helper="${relay_dir}/dist/scripts/telegram-commands-json.js"

if [[ ! -r "${commands_helper}" ]]; then
  echo "ERROR: Telegram command helper is not readable: ${commands_helper}" >&2
  echo "Build hex-relay first with: cd ${relay_dir} && npm ci && npm run build" >&2
  exit 1
fi

node_bin="${NODE_BIN:-}"
if [[ -z "${node_bin}" ]] && command -v node >/dev/null 2>&1; then
  node_bin="$(command -v node)"
fi
if [[ -z "${node_bin}" ]]; then
  relay_owner="$(stat -c '%U' "${relay_dir}" 2>/dev/null || true)"
  if [[ -n "${relay_owner}" ]]; then
    for candidate in "/home/${relay_owner}/.nvm/versions/node"/*/bin/node; do
      if [[ -x "${candidate}" ]]; then
        node_bin="${candidate}"
        break
      fi
    done
  fi
fi
if [[ -z "${node_bin}" || ! -x "${node_bin}" ]]; then
  echo "ERROR: node executable not found. Set NODE_BIN or install Node for the relay owner." >&2
  exit 1
fi

commands="$("${node_bin}" "${commands_helper}")"
expected="$(printf '%s' "${commands}" | jq -c '.commands')"

curl -fsS -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setMyCommands" \
  -H 'Content-Type: application/json' \
  -d "${commands}" >/dev/null

curl -fsS -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setMyCommands" \
  -H 'Content-Type: application/json' \
  -d "$(printf '%s' "${commands}" | jq -c '. + {scope:{type:"all_private_chats"}}')" >/dev/null

curl -fsS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMyCommands" \
  | jq -e --argjson expected "${expected}" '.result == $expected' >/dev/null

curl -fsS -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMyCommands" \
  -d 'scope={"type":"all_private_chats"}' \
  | jq -e --argjson expected "${expected}" '.result == $expected' >/dev/null

echo "telegram commands registered"

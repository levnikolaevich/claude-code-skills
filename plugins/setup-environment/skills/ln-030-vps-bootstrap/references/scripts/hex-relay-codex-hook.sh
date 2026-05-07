#!/bin/bash
# hex-relay-codex-hook.sh — POSIX shim that forwards Codex CLI hook events into hex-relay.
#
# Codex calls this script for each configured hook event (e.g. UserPromptSubmit, Stop)
# with the event JSON on stdin. We:
#   1. Read stdin JSON
#   2. Inject "agent": "codex" so the relay's agent-aware schemas accept the payload
#   3. POST to http://127.0.0.1:${RELAY_HOOK_PORT}/hook/<kebab-cased-event>
#
# Arguments:
#   $1 — Codex event name in CamelCase (UserPromptSubmit, Stop, SessionStart,
#        PreToolUse, PostToolUse). Codex does not emit StopFailure or SubagentStop,
#        so those routes are never invoked from this shim.
#
# Environment:
#   RELAY_HOOK_PORT   hex-relay listener port
#   RELAY_HTTP_TOKEN  bearer token for protected hex-relay hook routes
#
# Exit policy:
#   Always exit 0. Hex-relay observability hooks must never block a Codex turn — a
#   failed POST is logged to stderr and swallowed. The relay is the source of truth
#   for delivery retries via its outbox.
#
# Required tools: bash, jq, curl. Provided by ln-031-vps-host-runtime base packages.
set -euo pipefail

: "${RELAY_HOOK_PORT:?RELAY_HOOK_PORT is required}"
: "${RELAY_HTTP_TOKEN:?RELAY_HTTP_TOKEN is required}"
PORT="${RELAY_HOOK_PORT}"
EVENT_NAME="${1:-}"

warn() { printf '%s [hex-relay-codex-hook] %s\n' "$(date -Iseconds)" "$*" >&2; }

if [[ -z "$EVENT_NAME" ]]; then
  warn "missing event name argument; nothing to forward"
  exit 0
fi

# Codex emits CamelCase; hex-relay routes are kebab-case under /hook/<name>.
# Map by inserting a hyphen before each interior uppercase letter, then lowercase.
KEBAB=$(printf '%s' "$EVENT_NAME" | sed -E 's/([a-z0-9])([A-Z])/\1-\2/g; s/([A-Z]+)([A-Z][a-z])/\1-\2/g' | tr '[:upper:]' '[:lower:]')

if ! command -v jq >/dev/null 2>&1; then
  warn "jq not on PATH; cannot inject agent field for event=$EVENT_NAME"
  exit 0
fi

if ! command -v curl >/dev/null 2>&1; then
  warn "curl not on PATH; cannot POST hook event=$EVENT_NAME"
  exit 0
fi

# `jq -c` collapses whitespace; `--arg agent codex` is safer than string concat.
# If stdin is empty/invalid, fall back to a minimal envelope so the relay can still
# observe the event (it stays soft-validated via z.passthrough()).
PAYLOAD=$(jq -c '. + {agent: "codex"}' 2>/dev/null) || PAYLOAD='{"agent":"codex"}'
if [[ -z "$PAYLOAD" ]]; then
  PAYLOAD='{"agent":"codex"}'
fi

URL="http://127.0.0.1:${PORT}/hook/${KEBAB}"

if ! curl -sS --max-time 5 -X POST -H 'Content-Type: application/json' \
     -H "Authorization: Bearer ${RELAY_HTTP_TOKEN}" \
     --data "$PAYLOAD" "$URL" >/dev/null 2>&1; then
  warn "POST $URL failed (event=$EVENT_NAME); soft-failing"
fi

exit 0

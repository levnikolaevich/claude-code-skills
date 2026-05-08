#!/bin/bash
# claude-usage-report - live Claude subscription quota for Telegram /usage.
#
# Source of truth: the same Claude OAuth usage endpoint used by Claude Code's
# /usage screen. This script reads the shared Claude OAuth store, refreshes the
# access token when it is close to expiry, and never prints token material.
set -euo pipefail

CREDENTIALS="${CLAUDE_CREDENTIALS_FILE:-$HOME/.claude/.credentials.json}"
TOKEN_URL="https://platform.claude.com/v1/oauth/token"
USAGE_URL="https://api.anthropic.com/api/oauth/usage"
CLIENT_ID="9d1c250a-e61b-44d9-88ed-5944d1962f5e"
SCOPES="user:profile user:inference user:sessions:claude_code user:mcp_servers user:file_upload"

fail_report() {
  local message="$1"
  cat <<EOF
📊 Claude usage

⚠️ $message
EOF
}

require_file() {
  if [[ ! -r "$CREDENTIALS" || ! -w "$CREDENTIALS" ]]; then
    fail_report "Cannot read/write Claude OAuth credentials at $CREDENTIALS."
    exit 0
  fi
}

json_field() {
  jq -r "$1 // empty" "$CREDENTIALS"
}

refresh_access_token_if_needed() {
  local access refresh expires_at now_ms
  access=$(json_field '.claudeAiOauth.accessToken')
  refresh=$(json_field '.claudeAiOauth.refreshToken')
  expires_at=$(json_field '.claudeAiOauth.expiresAt')
  now_ms=$(( $(date +%s) * 1000 ))

  if [[ -z "$access" ]]; then
    fail_report "Claude OAuth access token is missing. Run /login once as the shared bot user."
    exit 0
  fi
  if [[ "$expires_at" =~ ^[0-9]+$ && "$expires_at" -gt $(( now_ms + 60000 )) ]]; then
    printf '%s\n' "$access"
    return
  fi
  if [[ -z "$refresh" ]]; then
    fail_report "Claude OAuth access token is expired and refresh token is missing. Run /login once as the shared bot user."
    exit 0
  fi

  local response tmp status body new_access new_refresh expires_in new_expires scope
  response=$(mktemp)
  tmp=$(mktemp "$(dirname "$CREDENTIALS")/.credentials.XXXXXX.json")
  status=$(
    curl -sS -o "$response" -w '%{http_code}' \
      -H 'Content-Type: application/json' \
      --data "$(jq -cn \
        --arg refresh "$refresh" \
        --arg client_id "$CLIENT_ID" \
        --arg scope "$SCOPES" \
        '{grant_type:"refresh_token",refresh_token:$refresh,client_id:$client_id,scope:$scope}')" \
      "$TOKEN_URL" || true
  )
  if [[ "$status" != "200" ]]; then
    rm -f "$response" "$tmp"
    fail_report "Claude OAuth refresh failed with HTTP $status. Run /login if the refresh token has already been invalidated."
    exit 0
  fi

  new_access=$(jq -r '.access_token // empty' "$response")
  new_refresh=$(jq -r --arg old "$refresh" '.refresh_token // $old' "$response")
  expires_in=$(jq -r '.expires_in // empty' "$response")
  scope=$(jq -r '.scope // empty' "$response")
  rm -f "$response"
  if [[ -z "$new_access" || ! "$expires_in" =~ ^[0-9]+$ ]]; then
    rm -f "$tmp"
    fail_report "Claude OAuth refresh response was missing required fields."
    exit 0
  fi

  new_expires=$(( now_ms + expires_in * 1000 ))
  umask 007
  jq \
    --arg access "$new_access" \
    --arg refresh "$new_refresh" \
    --argjson expires "$new_expires" \
    --arg scope "$scope" \
    '.claudeAiOauth.accessToken = $access
     | .claudeAiOauth.refreshToken = $refresh
     | .claudeAiOauth.expiresAt = $expires
     | if $scope != "" then .claudeAiOauth.scopes = ($scope | split(" ")) else . end' \
    "$CREDENTIALS" > "$tmp"
  chmod 660 "$tmp"
  mv "$tmp" "$CREDENTIALS"
  printf '%s\n' "$new_access"
}

format_eta_iso() {
  local iso="$1"
  [[ -n "$iso" && "$iso" != "null" ]] || { echo "unknown"; return; }
  local reset now delta d h m
  reset=$(date -d "$iso" +%s 2>/dev/null || true)
  [[ "$reset" =~ ^[0-9]+$ ]] || { echo "unknown"; return; }
  now=$(date +%s)
  delta=$(( reset - now ))
  if (( delta <= 0 )); then echo "now"; return; fi
  d=$(( delta / 86400 ))
  h=$(( (delta % 86400) / 3600 ))
  m=$(( (delta % 3600) / 60 ))
  if   (( d > 0 )); then echo "${d}d ${h}h"
  elif (( h > 0 )); then echo "${h}h ${m}m"
  else                   echo "${m}m"
  fi
}

format_pct() {
  local value="$1"
  [[ "$value" =~ ^-?[0-9]+([.][0-9]+)?$ ]] || { echo "unknown"; return; }
  printf '%.0f%%' "$value"
}

require_file
ACCESS_TOKEN=$(refresh_access_token_if_needed)

usage_body=$(mktemp)
usage_status=$(
  curl -sS -o "$usage_body" -w '%{http_code}' \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H 'Accept: application/json' \
    -H 'anthropic-version: 2023-06-01' \
    -H 'anthropic-beta: oauth-2025-04-20' \
    -H 'User-Agent: claude-code-skills/ln-030' \
    "$USAGE_URL" || true
)
if [[ "$usage_status" != "200" ]]; then
  rm -f "$usage_body"
  fail_report "Claude OAuth usage endpoint failed with HTTP $usage_status."
  exit 0
fi

five_pct=$(jq -r '.five_hour.utilization // empty' "$usage_body")
five_reset=$(jq -r '.five_hour.resets_at // empty' "$usage_body")
week_pct=$(jq -r '.seven_day.utilization // empty' "$usage_body")
week_reset=$(jq -r '.seven_day.resets_at // empty' "$usage_body")
sonnet_pct=$(jq -r '.seven_day_sonnet.utilization // empty' "$usage_body")
opus_pct=$(jq -r '.seven_day_opus.utilization // empty' "$usage_body")
rm -f "$usage_body"

if [[ -z "$five_pct" && -z "$week_pct" && -z "$sonnet_pct" && -z "$opus_pct" ]]; then
  fail_report "Claude usage is unavailable for this account or token scope."
  exit 0
fi

cat <<EOF
📊 Claude usage

Current session: $(format_pct "$five_pct") used — resets in $(format_eta_iso "$five_reset")
Current week:    $(format_pct "$week_pct") used — resets in $(format_eta_iso "$week_reset")
EOF

if [[ -n "$sonnet_pct" ]]; then
  printf 'Sonnet week:     %s used\n' "$(format_pct "$sonnet_pct")"
elif [[ -n "$opus_pct" ]]; then
  printf 'Opus week:       %s used\n' "$(format_pct "$opus_pct")"
fi

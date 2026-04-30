#!/bin/bash
# god-session statusLine: archives the full session JSON (incl. rate_limits) to a
# cache file so claude-usage-report can read official subscription quota numbers
# without hitting any HTTP endpoint. Output to stdout is a minimal status string.
# Reference: https://code.claude.com/docs/en/statusline
set -u

CACHE_DIR="$HOME/.claude/cache"
CACHE_FILE="$CACHE_DIR/usage.json"
mkdir -p "$CACHE_DIR"

INPUT=$(cat)

# Atomic write: only persist when rate_limits is present (skip early-session ticks
# where the field hasn't materialised yet — keeps last-good cache intact).
if jq -e '.rate_limits and (.rate_limits | length > 0)' <<<"$INPUT" >/dev/null 2>&1; then
  TMP=$(mktemp "$CACHE_DIR/usage.XXXXXX.json")
  jq -c --arg ts "$(date +%s)" '{
    captured_at: ($ts | tonumber),
    rate_limits: .rate_limits,
    model: (.model // null),
    session_id: (.session_id // null),
    version: (.version // null)
  }' <<<"$INPUT" >"$TMP" && mv "$TMP" "$CACHE_FILE"
fi

# Minimal statusline output for the TUI prompt area.
jq -r '"[\(.model.display_name // .model.id // "claude")] \(.context_window.used_percentage // 0 | floor)% ctx"' <<<"$INPUT" 2>/dev/null || echo ""

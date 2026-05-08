#!/bin/bash
# god-session statusLine: emits a minimal TUI status string.
# /usage does not read statusLine cache; it queries live provider usage APIs.
# Reference: https://code.claude.com/docs/en/statusline
set -u

INPUT=$(cat)

# Minimal statusline output for the TUI prompt area.
jq -r '"[\(.model.display_name // .model.id // "claude")] \(.context_window.used_percentage // 0 | floor)% ctx"' <<<"$INPUT" 2>/dev/null || echo ""

#!/bin/bash
# claude-usage-report — official Claude Max subscription quota for Telegram replies.
#
# Source of truth: rate_limits payload from the god-session's Claude Code session,
# mirrored to ~/.claude/cache/usage.json by ~/.claude/statusline.sh (statusLine API).
# Same numbers shown in Claude Code's UI USAGE panel.
# Reference: https://code.claude.com/docs/en/statusline
set -euo pipefail

CACHE="$HOME/.claude/cache/usage.json"
if [[ ! -r "$CACHE" ]]; then
  cat <<'EOF'
📊 Claude usage

⚠️ Кэш ещё не заполнен.
   God-session не делала ни одного API-вызова с момента последнего рестарта.
   Попробуй через минуту.
EOF
  exit 0
fi

format_eta_unix() {
  local ts="$1"
  [[ "$ts" =~ ^[0-9]+$ && "$ts" -gt 0 ]] || { echo "??"; return; }
  local now
  now=$(date +%s)
  local delta=$(( ts - now ))
  if (( delta <= 0 )); then echo "now"; return; fi
  local d=$(( delta / 86400 ))
  local h=$(( (delta % 86400) / 3600 ))
  local m=$(( (delta % 3600) / 60 ))
  if   (( d > 0 )); then echo "${d}d"
  elif (( h > 0 )); then echo "${h}h ${m}m"
  else                   echo "${m}m"
  fi
}

CAPTURED=$(jq -r '.captured_at // 0' "$CACHE")
NOW=$(date +%s)
AGE_S=$(( NOW - CAPTURED ))

S5_PCT=$(jq -r '.rate_limits.five_hour.used_percentage // 0'  "$CACHE")
S5_RST=$(jq -r '.rate_limits.five_hour.resets_at // 0'        "$CACHE")
W7_PCT=$(jq -r '.rate_limits.seven_day.used_percentage // 0'  "$CACHE")
W7_RST=$(jq -r '.rate_limits.seven_day.resets_at // 0'        "$CACHE")

S5_PCT_INT=$(printf '%.0f' "$S5_PCT")
W7_PCT_INT=$(printf '%.0f' "$W7_PCT")

S5_ETA=$(format_eta_unix "$S5_RST")
W7_ETA=$(format_eta_unix "$W7_RST")

STALE_NOTE=""
if (( AGE_S > 600 )); then
  STALE_NOTE=$(printf "\n⚠️ Данные обновлены %d мин назад (god-session молчит)." $(( AGE_S / 60 )))
fi

cat <<EOF
📊 Claude usage

Session (5hr):    $S5_PCT_INT% потрачено — сброс через $S5_ETA
Weekly (7 day):   $W7_PCT_INT% потрачено — сброс через $W7_ETA$STALE_NOTE
EOF

#!/bin/bash
# ${SERVICE_PREFIX}-god-codex@<telegram_user_id> — per-user long-running Codex CLI wrapper.
# Mirrors god-session.sh but launches Codex CLI inside the bwrap sandbox instead of Claude.
#
#   socket:  ${SERVICE_PREFIX}
#   target:  ${SERVICE_PREFIX}-god-codex-<telegram_user_id>
#   service: ${SERVICE_PREFIX}-god-codex@<id>.service
#   state:   /var/lib/${PROJECT_NAME}/users/<telegram_user_id>/
#
# State files are shared with the Claude god-session (god-command.json, last-session.id)
# because hex-relay routes per-agent via the buddy column on user_buddy. Codex's session
# resume semantics differ from Claude's `--resume <uuid>`; for v1 we always launch the
# Codex TUI fresh and let Codex's own /resume handle history.
set -euo pipefail

OPERATOR_USER_ID=${OPERATOR_USER_ID:-${1:-}}
[[ "$OPERATOR_USER_ID" =~ ^[0-9]+$ ]] || { echo "FATAL: OPERATOR_USER_ID must be numeric" >&2; exit 4; }

SESSION=${SERVICE_PREFIX}-god-codex-${OPERATOR_USER_ID}
SECRETS=/etc/${PROJECT_NAME}/secrets.env
STATE_DIR=/var/lib/${PROJECT_NAME}
USER_STATE_DIR=$STATE_DIR/users/$OPERATOR_USER_ID
LOG=/var/log/${PROJECT_NAME}-god.log
ERROR_FILE=$STATE_DIR/last-god-error.json

mkdir -p "$USER_STATE_DIR"
log() { echo "$(date -Iseconds) [${SERVICE_PREFIX}-god-codex user=$OPERATOR_USER_ID] $*" >> "$LOG"; }

json_escape() {
  printf '%s' "$1" | sed \
    -e 's/\\/\\\\/g' \
    -e 's/"/\\"/g' \
    -e 's/\t/\\t/g' \
    -e 's/\r/\\r/g' \
    -e 's/\n/\\n/g'
}

write_error() {
  local kind=${1:-unknown}
  local reason=${2:-}
  local details=${3:-}
  local runtime=${4:-}
  local tmp="${ERROR_FILE}.$$"
  {
    printf '{'
    printf '"ts":%s' "$(date +%s)"
    printf ',"kind":"%s"' "$(json_escape "$kind")"
    printf ',"reason":"%s"' "$(json_escape "$reason")"
    printf ',"details":"%s"' "$(json_escape "$details")"
    printf ',"agent":"codex"'
    printf ',"project_name":"%s"' "$(json_escape "$PROJECT_NAME")"
    printf ',"service_prefix":"%s"' "$(json_escape "$SERVICE_PREFIX")"
    printf ',"user_id":"%s"' "$(json_escape "$OPERATOR_USER_ID")"
    printf ',"session":"%s"' "$(json_escape "$SESSION")"
    [[ -n "$runtime" ]] && printf ',"runtime_seconds":%s' "$runtime"
    printf '}\n'
  } > "$tmp" 2>/dev/null && mv -f "$tmp" "$ERROR_FILE" 2>/dev/null || true
}

fatal() {
  local exit_code=$1
  local kind=$2
  local details=$3
  log "FATAL: $details"
  write_error "$kind" "god-session-codex startup failed" "$details"
  exit "$exit_code"
}

case "$SESSION" in
  *'$'*) fatal 4 "config_placeholder" "SERVICE_PREFIX placeholder not substituted (got SESSION=$SESSION)" ;;
esac
TMUX=(tmux -L "$SERVICE_PREFIX")

export NVM_DIR="$HOME/.nvm"
# shellcheck disable=SC1091
[[ -s "$NVM_DIR/nvm.sh" ]] && . "$NVM_DIR/nvm.sh"

command -v codex >/dev/null || fatal 2 "missing_runtime" "codex not on PATH"
command -v tmux  >/dev/null || fatal 2 "missing_runtime" "tmux not on PATH"
command -v jq    >/dev/null || fatal 2 "missing_runtime" "jq not on PATH"
[[ -r "$SECRETS" ]] || fatal 3 "secrets_unreadable" "cannot read $SECRETS"
set -a; . "$SECRETS"; set +a

# RELAY_HOOK_PORT is read by hex-relay-codex-hook.sh inside the sandbox. Default
# matches the relay listener default; the per-project secrets.env can override it.
RELAY_HOOK_PORT=${RELAY_HOOK_PORT:-8090}

# Codex runs the interactive TUI by default. workspace-write keeps the agent confined
# to the project tree at the Codex layer; bwrap still enforces the host-level boundary.
CODEX_BASE="OPERATOR_USER_ID=$OPERATOR_USER_ID AGENT_SKILLS_DIR=${AGENT_SKILLS_DIR:-/opt/agent-skills} RELAY_HOOK_PORT=$RELAY_HOOK_PORT /usr/local/bin/${SERVICE_PREFIX}-agent-sandbox codex --sandbox workspace-write"
CODEX_CMD="$CODEX_BASE"

TMUX_TARGET="=$SESSION"

verify_session_alive() {
  "${TMUX[@]}" has-session -t "$TMUX_TARGET" 2>/dev/null \
    && "${TMUX[@]}" list-sessions -F '#{session_name}' 2>/dev/null \
         | grep -qx -- "$SESSION"
}

ensure_tmux_session() {
  local attempt=0 max_attempts=5
  while (( attempt < max_attempts )); do
    if verify_session_alive; then
      [[ $attempt -gt 0 ]] && log "tmux session $SESSION present after attempt $attempt"
      return 0
    fi
    attempt=$((attempt + 1))
    log "creating tmux session $SESSION (attempt $attempt/$max_attempts; cmd: $CODEX_CMD)"
    STARTED_AT=$(date +%s)
    if "${TMUX[@]}" new-session -d -s "$SESSION" -x 200 -y 50 \
         "cd ${PROJECT_DIR} && $CODEX_CMD" 2>>"$LOG"; then
      sleep 1
      verify_session_alive && { log "tmux + codex launched (verified)"; return 0; }
      log "WARN: new-session rc=0 but $SESSION not in list-sessions; retrying after backoff"
    else
      log "WARN: tmux new-session attempt $attempt failed (likely socket-${SERVICE_PREFIX} race)"
    fi
    sleep $((attempt * 2))
  done
  return 1
}

if verify_session_alive; then
  log "tmux session $SESSION already exists; attaching as watcher"
else
  if ! ensure_tmux_session; then
    fatal 5 "tmux_create_failed" "could not create tmux session $SESSION after retries on socket -L $SERVICE_PREFIX"
  fi
fi

while verify_session_alive; do
  sleep 5
done

ENDED_AT=$(date +%s)
RUNTIME=$((ENDED_AT - ${STARTED_AT:-ENDED_AT}))
if [[ "$RUNTIME" -le 20 ]]; then
  write_error "session_crashed" "god-session-codex tmux exited quickly" "tmux session disappeared before it became stable" "$RUNTIME"
fi

log "tmux session $SESSION disappeared; exiting (systemd will restart this user instance)"
exit 1

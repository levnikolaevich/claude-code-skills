#!/bin/bash
# ${SERVICE_PREFIX}-god-codex@<telegram_user_id> — per-user long-running Codex CLI wrapper.
# Mirrors god-session.sh but launches Codex CLI inside the bwrap sandbox instead of Claude.
#
#   socket:  ${SERVICE_PREFIX}
#   target:  ${SERVICE_PREFIX}-god-codex-<telegram_user_id>
#   service: ${SERVICE_PREFIX}-god-codex@<id>.service
#   state:   /var/lib/${PROJECT_NAME}/users/<telegram_user_id>/
#
# State files are agent-scoped (last-session-codex.id) so the Claude sibling can
# stay running independently. Codex resume uses `codex resume <SESSION_ID>` and
# falls back to a fresh launch when the session id is missing/unknown.
set -euo pipefail

OPERATOR_USER_ID=${OPERATOR_USER_ID:-${1:-}}
[[ "$OPERATOR_USER_ID" =~ ^[0-9]+$ ]] || { echo "FATAL: OPERATOR_USER_ID must be numeric" >&2; exit 4; }

SESSION=${SERVICE_PREFIX}-god-codex-${OPERATOR_USER_ID}
SECRETS=/etc/${PROJECT_NAME}/secrets.env
STATE_DIR=/var/lib/${PROJECT_NAME}
USER_STATE_DIR=$STATE_DIR/users/$OPERATOR_USER_ID
LOG=/var/log/${PROJECT_NAME}-god.log
ERROR_FILE=$STATE_DIR/last-god-error.json
LAST_SID_FILE=$USER_STATE_DIR/last-session-codex.id

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

# RELAY_HOOK_PORT is read by hex-relay-codex-hook.sh inside the sandbox.
# It must come from the systemd unit so hooks target the project relay.
[[ -n "${RELAY_HOOK_PORT:-}" ]] || fatal 3 "missing_config" "RELAY_HOOK_PORT is required"

# Codex runs the interactive TUI by default. workspace-write keeps the agent confined
# to the project tree at the Codex layer; bwrap still enforces the host-level boundary.
CODEX_BASE="OPERATOR_USER_ID=$OPERATOR_USER_ID AGENT_SKILLS_DIR=${AGENT_SKILLS_DIR:-/opt/agent-skills} RELAY_HOOK_PORT=$RELAY_HOOK_PORT /usr/local/bin/${SERVICE_PREFIX}-agent-sandbox codex"
CODEX_TAIL="--sandbox workspace-write"
CODEX_CMD="$CODEX_BASE $CODEX_TAIL"
BOOT_RESUME_SID=""
RESUME_SOURCE=""

# Default resume from last-session-codex.id (written by codex SessionStart hook).
if [[ -r "$LAST_SID_FILE" ]]; then
  LAST_SID=$(cat "$LAST_SID_FILE" 2>/dev/null | tr -d '[:space:]')
  if [[ "$LAST_SID" =~ ^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$ ]]; then
    log "default: codex resume $LAST_SID (from user last-session-codex.id)"
    CODEX_CMD="$CODEX_BASE resume $LAST_SID $CODEX_TAIL"
    BOOT_RESUME_SID="$LAST_SID"
    RESUME_SOURCE="last-session"
  else
    log "WARN: last-session-codex.id present but invalid uuid: $LAST_SID"
  fi
else
  log "no prior codex session for this user; fresh start"
fi

TMUX_TARGET="=$SESSION"

verify_session_alive() {
  "${TMUX[@]}" has-session -t "$TMUX_TARGET" 2>/dev/null \
    && "${TMUX[@]}" list-sessions -F '#{session_name}' 2>/dev/null \
         | grep -qx -- "$SESSION"
}

# Returns 0 if the tmux pane's process tree contains a codex/node agent.
# Returns 1 if the tmux session is alive but no agent is running inside (orphan).
pane_has_agent_running() {
  local roots descendants p
  roots=$("${TMUX[@]}" list-panes -s -t "$TMUX_TARGET" -F '#{pane_pid}' 2>/dev/null) || return 1
  [[ -z "$roots" ]] && return 1
  # Walk pid tree once via ps, then check each pane root for codex/node descendant.
  for p in $roots; do
    descendants=$(ps -e -o pid=,ppid=,comm= 2>/dev/null | awk -v root="$p" '
      { pid[$1]=$1; ppid[$1]=$2; comm[$1]=$3 }
      END {
        for (k in pid) {
          cur = k
          for (i = 0; i < 64 && cur != "" && cur != "0" && cur != "1"; i++) {
            if (cur == root) {
              c = comm[k]
              if (c == "codex" || c ~ /^codex/ || c == "node" || c == "bwrap") { print "found"; exit }
              break
            }
            cur = ppid[cur]
          }
        }
      }')
    [[ "$descendants" == "found" ]] && return 0
  done
  return 1
}

kill_orphan_session() {
  log "WARN: tmux session $SESSION alive but codex process not found; killing orphan"
  "${TMUX[@]}" kill-session -t "$TMUX_TARGET" 2>/dev/null || true
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

# Cleanly tear down tmux on systemctl stop so the watchdog actually frees memory.
cleanup_on_term() {
  log "received TERM/INT; killing tmux session $SESSION"
  "${TMUX[@]}" kill-session -t "$TMUX_TARGET" 2>/dev/null || true
  exit 0
}
trap cleanup_on_term TERM INT

if verify_session_alive; then
  if pane_has_agent_running; then
    log "tmux session $SESSION already exists; attaching as watcher"
  else
    kill_orphan_session
    sleep 1
    if ! ensure_tmux_session; then
      fatal 5 "tmux_create_failed" "could not recreate tmux session $SESSION after orphan cleanup"
    fi
  fi
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
if [[ -n "$BOOT_RESUME_SID" && "$RUNTIME" -le 20 ]]; then
  CURRENT_LAST=""
  [[ -r "$LAST_SID_FILE" ]] && CURRENT_LAST=$(cat "$LAST_SID_FILE" 2>/dev/null | tr -d '[:space:]')
  if [[ "$CURRENT_LAST" == "$BOOT_RESUME_SID" ]]; then
    FAILED_LAST_FILE=$USER_STATE_DIR/last-session-codex.failed.$(date -u +%Y%m%dT%H%M%SZ).id
    mv -f "$LAST_SID_FILE" "$FAILED_LAST_FILE" 2>/dev/null || true
    jq -n --arg sid "$BOOT_RESUME_SID" --arg user "$OPERATOR_USER_ID" \
      --arg source "$RESUME_SOURCE" --arg failed_last "$FAILED_LAST_FILE" \
      --arg project "$PROJECT_NAME" --arg prefix "$SERVICE_PREFIX" --arg session "$SESSION" --argjson runtime "$RUNTIME" \
      '{ts: now, kind: "resume_crashed", agent: "codex", reason: "codex resume crashed quickly", user_id: $user, session_id: $sid, source: $source, runtime_seconds: $runtime, failed_last_session_file: $failed_last, project_name: $project, service_prefix: $prefix, session: $session}' \
      > "$ERROR_FILE" 2>/dev/null || true
    log "WARN: codex resume sid=$BOOT_RESUME_SID crashed after ${RUNTIME}s; moved last-session-codex.id aside so restart starts fresh"
  fi
elif [[ "$RUNTIME" -le 20 ]]; then
  write_error "session_crashed" "god-session-codex tmux exited quickly" "tmux session disappeared before it became stable" "$RUNTIME"
fi

log "tmux session $SESSION disappeared; exiting (systemd will restart this user instance)"
exit 1

#!/bin/bash
# ${SERVICE_PREFIX}-god@<telegram_user_id> — per-user long-running Claude wrapper.
# Each allowed Telegram user gets a separate tmux session in the same project:
#   socket:  ${SERVICE_PREFIX}
#   target:  ${SERVICE_PREFIX}-god-<telegram_user_id>
#   state:   /var/lib/${PROJECT_NAME}/users/<telegram_user_id>/
set -euo pipefail

OPERATOR_USER_ID=${OPERATOR_USER_ID:-${1:-}}
[[ "$OPERATOR_USER_ID" =~ ^[0-9]+$ ]] || { echo "FATAL: OPERATOR_USER_ID must be numeric" >&2; exit 4; }

SESSION=${SERVICE_PREFIX}-god-${OPERATOR_USER_ID}
SECRETS=/etc/${PROJECT_NAME}/secrets.env
STATE_DIR=/var/lib/${PROJECT_NAME}
USER_STATE_DIR=$STATE_DIR/users/$OPERATOR_USER_ID
LOG=/var/log/${PROJECT_NAME}-god.log
CMD_FILE=$USER_STATE_DIR/god-command.json
LAST_CMD_FILE=$USER_STATE_DIR/last-god-command.json
ERROR_FILE=$STATE_DIR/last-god-error.json
LOCK_FILE=$USER_STATE_DIR/.cmd-lock

mkdir -p "$USER_STATE_DIR"
SESSIONS_DIR_FILE=$USER_STATE_DIR/sessions-dir.path
LAST_SID_FILE=$USER_STATE_DIR/last-session.id
log() { echo "$(date -Iseconds) [${SERVICE_PREFIX}-god user=$OPERATOR_USER_ID] $*" >> "$LOG"; }
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
  local session_id=${4:-}
  local runtime=${5:-}
  local tmp="${ERROR_FILE}.$$"
  {
    printf '{'
    printf '"ts":%s' "$(date +%s)"
    printf ',"kind":"%s"' "$(json_escape "$kind")"
    printf ',"reason":"%s"' "$(json_escape "$reason")"
    printf ',"details":"%s"' "$(json_escape "$details")"
    printf ',"project_name":"%s"' "$(json_escape "$PROJECT_NAME")"
    printf ',"service_prefix":"%s"' "$(json_escape "$SERVICE_PREFIX")"
    printf ',"user_id":"%s"' "$(json_escape "$OPERATOR_USER_ID")"
    printf ',"session":"%s"' "$(json_escape "$SESSION")"
    [[ -n "$session_id" ]] && printf ',"session_id":"%s"' "$(json_escape "$session_id")"
    [[ -n "$runtime" ]] && printf ',"runtime_seconds":%s' "$runtime"
    printf '}\n'
  } > "$tmp" 2>/dev/null && mv -f "$tmp" "$ERROR_FILE" 2>/dev/null || true
}
classify_session_failure() {
  local sid=${1:-}
  local default_kind=${2:-session_crashed}
  local transcript=""
  if [[ -n "$sid" && -n "${SESSIONS_DIR:-}" ]]; then
    transcript="$SESSIONS_DIR/$sid.jsonl"
  fi
  if [[ -n "$transcript" && -r "$transcript" ]]; then
    if tail -200 "$transcript" | grep -Eiq 'authentication_error|Invalid authentication credentials|Please run /login|API Error: 401'; then
      echo "auth_failed"
      return 0
    fi
    if tail -200 "$transcript" | grep -Eiq 'context_length|Context low|compaction'; then
      echo "context_failure"
      return 0
    fi
  fi
  echo "$default_kind"
}
fatal() {
  local exit_code=$1
  local kind=$2
  local details=$3
  log "FATAL: $details"
  write_error "$kind" "god-session startup failed" "$details"
  exit "$exit_code"
}

case "$SESSION" in
  *'$'*) fatal 4 "config_placeholder" "SERVICE_PREFIX placeholder not substituted (got SESSION=$SESSION)" ;;
esac
TMUX=(tmux -L "$SERVICE_PREFIX")

export NVM_DIR="$HOME/.nvm"
# shellcheck disable=SC1091
[[ -s "$NVM_DIR/nvm.sh" ]] && . "$NVM_DIR/nvm.sh"

command -v claude >/dev/null || fatal 2 "missing_runtime" "claude not on PATH"
command -v tmux   >/dev/null || fatal 2 "missing_runtime" "tmux not on PATH"
command -v jq     >/dev/null || fatal 2 "missing_runtime" "jq not on PATH"
[[ -r "$SECRETS" ]] || fatal 3 "secrets_unreadable" "cannot read $SECRETS"
set -a; . "$SECRETS"; set +a

SESSIONS_DIR=""
if [[ -r "$SESSIONS_DIR_FILE" ]]; then
  SESSIONS_DIR=$(cat "$SESSIONS_DIR_FILE" 2>/dev/null | tr -d '[:space:]')
  [[ -d "$SESSIONS_DIR" ]] || { log "WARN: sessions-dir.path points to non-existent dir: $SESSIONS_DIR"; SESSIONS_DIR=""; }
fi

CLAUDE_BASE="OPERATOR_USER_ID=$OPERATOR_USER_ID AGENT_SKILLS_DIR=${AGENT_SKILLS_DIR:-/opt/agent-skills} /usr/local/bin/${SERVICE_PREFIX}-agent-sandbox claude --dangerously-skip-permissions"
CLAUDE_CMD="$CLAUDE_BASE"
RESOLVED=""
BOOT_RESUME_SID=""
RESUME_SOURCE=""

if [[ -f "$CMD_FILE" ]]; then
  RESOLVED=$(
    (
      flock -x 200
      CMD_JSON=$(cat "$CMD_FILE" 2>/dev/null || echo '{}')
      cp -f "$CMD_FILE" "$LAST_CMD_FILE" 2>/dev/null || true
      rm -f "$CMD_FILE"
      if ! echo "$CMD_JSON" | jq -e . >/dev/null 2>&1; then
        write_error "command_invalid_json" "invalid god-command.json" "$CMD_FILE"
        echo ""
        exit 0
      fi
      ACTION=$(echo "$CMD_JSON" | jq -r '.action // empty')
      SID=$(echo "$CMD_JSON" | jq -r '.session_id // empty')
      case "$ACTION" in
        default)
          echo ""
          ;;
        new)
          echo "fresh"
          ;;
        resume)
          if [[ -n "$SID" && "$SID" =~ ^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$ \
                && -n "$SESSIONS_DIR" && -f "$SESSIONS_DIR/$SID.jsonl" ]]; then
            echo "resume:$SID"
          else
            AVAIL=$(ls "$SESSIONS_DIR" 2>/dev/null | head -20 | jq -R . | jq -s . 2>/dev/null || echo '[]')
            jq -n --arg sid "$SID" --arg user "$OPERATOR_USER_ID" --argjson avail "$AVAIL" \
              --arg project "$PROJECT_NAME" --arg prefix "$SERVICE_PREFIX" --arg session "$SESSION" \
              '{ts: now, kind: "resume_invalid", user_id: $user, requested_sid: $sid, available_sids: $avail, project_name: $project, service_prefix: $prefix, session: $session}' \
              > "$ERROR_FILE" 2>/dev/null || true
            echo "fresh"
          fi
          ;;
        *)
          echo ""
          ;;
      esac
    ) 200>"$LOCK_FILE"
  )
fi

case "$RESOLVED" in
  fresh)
    log "command consumed: action=new (fresh start)"
    CLAUDE_CMD="$CLAUDE_BASE"
    ;;
  resume:*)
    SID=${RESOLVED#resume:}
    log "command consumed: action=resume sid=$SID"
    CLAUDE_CMD="$CLAUDE_BASE --resume $SID ."
    BOOT_RESUME_SID="$SID"
    RESUME_SOURCE="command"
    ;;
  "")
    CHOSE=""
    if [[ -r "$LAST_SID_FILE" ]] && [[ -n "$SESSIONS_DIR" ]]; then
      LAST_SID=$(cat "$LAST_SID_FILE" 2>/dev/null | tr -d '[:space:]')
      if [[ "$LAST_SID" =~ ^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$ ]] \
         && [[ -f "$SESSIONS_DIR/$LAST_SID.jsonl" ]]; then
        log "default: --resume $LAST_SID (from user last-session.id)"
        CLAUDE_CMD="$CLAUDE_BASE --resume $LAST_SID ."
        CHOSE="resume_explicit"
        BOOT_RESUME_SID="$LAST_SID"
        RESUME_SOURCE="last-session"
      fi
    fi
    if [[ -z "$CHOSE" ]]; then
      log "no prior session for this user; fresh start"
    fi
    ;;
esac

if "${TMUX[@]}" has-session -t "$SESSION" 2>/dev/null; then
  log "tmux session $SESSION already exists; attaching as watcher"
  if [[ -n "$RESOLVED" ]]; then
    log "WARN: command was consumed but tmux already alive; command had no effect on this boot"
  fi
else
  log "creating tmux session $SESSION (cmd: $CLAUDE_CMD)"
  STARTED_AT=$(date +%s)
  "${TMUX[@]}" new-session -d -s "$SESSION" -x 200 -y 50 \
    "cd ${PROJECT_DIR} && $CLAUDE_CMD"
  log "tmux + claude launched"
fi

while "${TMUX[@]}" has-session -t "$SESSION" 2>/dev/null; do
  sleep 5
done

ENDED_AT=$(date +%s)
RUNTIME=$((ENDED_AT - ${STARTED_AT:-ENDED_AT}))
if [[ -n "$BOOT_RESUME_SID" && "$RUNTIME" -le 20 ]]; then
  CURRENT_LAST=""
  [[ -r "$LAST_SID_FILE" ]] && CURRENT_LAST=$(cat "$LAST_SID_FILE" 2>/dev/null | tr -d '[:space:]')
  if [[ "$CURRENT_LAST" == "$BOOT_RESUME_SID" ]]; then
    FAILED_LAST_FILE=$USER_STATE_DIR/last-session.failed.$(date -u +%Y%m%dT%H%M%SZ).id
    mv -f "$LAST_SID_FILE" "$FAILED_LAST_FILE" 2>/dev/null || true
    ERROR_KIND=$(classify_session_failure "$BOOT_RESUME_SID" "resume_crashed")
    jq -n --arg sid "$BOOT_RESUME_SID" --arg user "$OPERATOR_USER_ID" \
      --arg source "$RESUME_SOURCE" --arg failed_last "$FAILED_LAST_FILE" --arg kind "$ERROR_KIND" \
      --arg project "$PROJECT_NAME" --arg prefix "$SERVICE_PREFIX" --arg session "$SESSION" --argjson runtime "$RUNTIME" \
      '{ts: now, kind: $kind, reason: "resume crashed quickly", user_id: $user, session_id: $sid, source: $source, runtime_seconds: $runtime, failed_last_session_file: $failed_last, project_name: $project, service_prefix: $prefix, session: $session}' \
      > "$ERROR_FILE" 2>/dev/null || true
    log "WARN: resume sid=$BOOT_RESUME_SID crashed after ${RUNTIME}s; moved last-session.id aside so restart starts fresh"
  fi
elif [[ "$RUNTIME" -le 20 ]]; then
  ERROR_KIND=$(classify_session_failure "" "session_crashed")
  write_error "$ERROR_KIND" "god-session tmux exited quickly" "tmux session disappeared before it became stable" "" "$RUNTIME"
fi

log "tmux session $SESSION disappeared; exiting (systemd will restart this user instance)"
exit 1

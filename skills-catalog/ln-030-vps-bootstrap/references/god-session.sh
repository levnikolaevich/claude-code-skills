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
log() { echo "$(date -Iseconds) [${SERVICE_PREFIX}-god user=$OPERATOR_USER_ID] $*" >> "$LOG"; }

case "$SESSION" in
  *'$'*) log "FATAL: SERVICE_PREFIX placeholder not substituted (got SESSION=$SESSION)"; exit 4 ;;
esac
TMUX=(tmux -L "$SERVICE_PREFIX")

export NVM_DIR="$HOME/.nvm"
# shellcheck disable=SC1091
[[ -s "$NVM_DIR/nvm.sh" ]] && . "$NVM_DIR/nvm.sh"

command -v claude >/dev/null || { log "FATAL: claude not on PATH"; exit 2; }
command -v tmux   >/dev/null || { log "FATAL: tmux not on PATH"; exit 2; }
command -v jq     >/dev/null || { log "FATAL: jq not on PATH"; exit 2; }
[[ -r "$SECRETS" ]] || { log "FATAL: cannot read $SECRETS"; exit 3; }
set -a; . "$SECRETS"; set +a

SESSIONS_DIR=""
if [[ -r "$SESSIONS_DIR_FILE" ]]; then
  SESSIONS_DIR=$(cat "$SESSIONS_DIR_FILE" 2>/dev/null | tr -d '[:space:]')
  [[ -d "$SESSIONS_DIR" ]] || { log "WARN: sessions-dir.path points to non-existent dir: $SESSIONS_DIR"; SESSIONS_DIR=""; }
fi

CLAUDE_BASE="OPERATOR_USER_ID=$OPERATOR_USER_ID AGENT_SKILLS_DIR=${AGENT_SKILLS_DIR:-/opt/agent-skills} /usr/local/bin/${SERVICE_PREFIX}-agent-sandbox claude --dangerously-skip-permissions"
CLAUDE_CMD="$CLAUDE_BASE"
RESOLVED=""

if [[ -f "$CMD_FILE" ]]; then
  RESOLVED=$(
    (
      flock -x 200
      CMD_JSON=$(cat "$CMD_FILE" 2>/dev/null || echo '{}')
      cp -f "$CMD_FILE" "$LAST_CMD_FILE" 2>/dev/null || true
      rm -f "$CMD_FILE"
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
              '{ts: now, kind: "resume_invalid", user_id: $user, requested_sid: $sid, available_sids: $avail}' \
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
    ;;
  "")
    LAST_SID_FILE=$USER_STATE_DIR/last-session.id
    CHOSE=""
    if [[ -r "$LAST_SID_FILE" ]] && [[ -n "$SESSIONS_DIR" ]]; then
      LAST_SID=$(cat "$LAST_SID_FILE" 2>/dev/null | tr -d '[:space:]')
      if [[ "$LAST_SID" =~ ^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$ ]] \
         && [[ -f "$SESSIONS_DIR/$LAST_SID.jsonl" ]]; then
        log "default: --resume $LAST_SID (from user last-session.id)"
        CLAUDE_CMD="$CLAUDE_BASE --resume $LAST_SID ."
        CHOSE="resume_explicit"
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
  "${TMUX[@]}" new-session -d -s "$SESSION" -x 200 -y 50 \
    "cd ${PROJECT_DIR} && $CLAUDE_CMD"
  log "tmux + claude launched"
fi

while "${TMUX[@]}" has-session -t "$SESSION" 2>/dev/null; do
  sleep 5
done

log "tmux session $SESSION disappeared; exiting (systemd will restart this user instance)"
exit 1

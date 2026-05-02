#!/bin/bash
# ${SERVICE_PREFIX}-god — long-running god-session wrapper, started by systemd.
# Maintains a tmux session named `${SERVICE_PREFIX}-god` with a single claude TUI
# running headless. systemd Restart=always covers crashes.
#
# Idempotent: if tmux session exists, attaches as watcher; otherwise creates fresh.
# Scheduling is external: ${SERVICE_PREFIX}-dispatch.timer (systemd) injects /${DISPATCH_COMMAND_NAME}
# hourly via tmux send-keys; this wrapper does NOT register an in-session /loop.
#
# Resume-by-default: on fresh tmux create, if a prior session exists for ${PROJECT_DIR},
# claude is started with --continue (latest) or --resume <id> based on the atomic
# command file ${STATE_DIR}/god-command.json (written by relay-bot on
# /new_session or [▶ Resume] button click).
#
# Telegram integration is handled by a SEPARATE ${SERVICE_PREFIX}-relay-bot.service that
# uses tmux send-keys to deliver inbound messages into this session's pane and
# owns the command-queue + Telegram /sessions UI.
set -euo pipefail

SESSION=${SERVICE_PREFIX}-god
SECRETS=/etc/${PROJECT_NAME}/secrets.env
STATE_DIR=/var/lib/${PROJECT_NAME}
LOG=/var/log/${PROJECT_NAME}-god.log
CMD_FILE=$STATE_DIR/god-command.json
LAST_CMD_FILE=$STATE_DIR/last-god-command.json
ERROR_FILE=$STATE_DIR/last-god-error.json
SESSIONS_DIR_FILE=$STATE_DIR/sessions-dir.path
LOCK_FILE=$STATE_DIR/.cmd-lock

mkdir -p "$STATE_DIR"
log() { echo "$(date -Iseconds) [${SERVICE_PREFIX}-god] $*" >> "$LOG"; }

log "boot: uid=$(id -u) user=$(whoami)"

# Verify SERVICE_PREFIX was substituted at install time (envsubst should have
# replaced the literal). If still "${SERVICE_PREFIX}", template was uploaded
# verbatim — abort to avoid creating a tmux session named literally "${SERVICE_PREFIX}-god".
case "$SESSION" in
  *'$'*) log "FATAL: SERVICE_PREFIX placeholder not substituted (got SESSION=$SESSION)"; exit 4 ;;
esac

# Bring nvm into PATH (cron-style minimal env)
export NVM_DIR="$HOME/.nvm"
# shellcheck disable=SC1091
[[ -s "$NVM_DIR/nvm.sh" ]] && . "$NVM_DIR/nvm.sh"

command -v claude >/dev/null || { log "FATAL: claude not on PATH"; exit 2; }
command -v tmux   >/dev/null || { log "FATAL: tmux not on PATH"; exit 2; }
command -v jq     >/dev/null || { log "FATAL: jq not on PATH"; exit 2; }
[[ -r "$SECRETS" ]] || { log "FATAL: cannot read $SECRETS"; exit 3; }
set -a; . "$SECRETS"; set +a

# Resolve sessions dir (auto-discovered by relay-bot at first run).
# Empty string is OK — fallback to fresh start.
SESSIONS_DIR=""
if [[ -r "$SESSIONS_DIR_FILE" ]]; then
  SESSIONS_DIR=$(cat "$SESSIONS_DIR_FILE" 2>/dev/null | tr -d '[:space:]')
  [[ -d "$SESSIONS_DIR" ]] || { log "WARN: sessions-dir.path points to non-existent dir: $SESSIONS_DIR"; SESSIONS_DIR=""; }
fi

CLAUDE_BASE="claude --dangerously-skip-permissions"
CLAUDE_CMD="$CLAUDE_BASE"
RESOLVED=""

# Atomic command consume under flock. Wrapper deletes the file after read.
# Use a subshell so the fd-200 redirect lives only as long as needed.
if [[ -f "$CMD_FILE" ]]; then
  RESOLVED=$(
    (
      flock -x 200
      CMD_JSON=$(cat "$CMD_FILE" 2>/dev/null || echo '{}')
      # Preserve a copy so relay-bot's SessionStart hook can attribute the
      # new session to the operator who issued the command (operator_chat_id).
      cp -f "$CMD_FILE" "$LAST_CMD_FILE" 2>/dev/null || true
      rm -f "$CMD_FILE"
      ACTION=$(echo "$CMD_JSON" | jq -r '.action // empty')
      SID=$(echo "$CMD_JSON" | jq -r '.session_id // empty')
      case "$ACTION" in
        new)
          echo "fresh"
          ;;
        resume)
          if [[ -n "$SID" && "$SID" =~ ^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$ \
                && -n "$SESSIONS_DIR" && -f "$SESSIONS_DIR/$SID.jsonl" ]]; then
            echo "resume:$SID"
          else
            AVAIL=$(ls "$SESSIONS_DIR" 2>/dev/null | head -20 | jq -R . | jq -s . 2>/dev/null || echo '[]')
            jq -n --arg sid "$SID" --argjson avail "$AVAIL" \
              '{ts: now, kind: "resume_invalid", requested_sid: $sid, available_sids: $avail}' \
              > "$ERROR_FILE" 2>/dev/null || true
            echo "fresh"
          fi
          ;;
        *)
          echo "fresh"
          ;;
      esac
    ) 200>"$LOCK_FILE"
  )
fi

# Apply resolved command, or default to --continue if any session exists.
case "$RESOLVED" in
  fresh)
    log "command consumed: action=new (fresh start)"
    CLAUDE_CMD="$CLAUDE_BASE"
    ;;
  resume:*)
    SID=${RESOLVED#resume:}
    log "command consumed: action=resume sid=$SID"
    # Claude Code 2.1.126+: --resume requires a prompt arg (deferred-tool-marker check)
    CLAUDE_CMD="$CLAUDE_BASE --resume $SID ."
    ;;
  "")
    # No command file. Default behavior: explicit --resume of last-active
    # session-id (Fix #4b). Claude Code 2.1.123's --continue cannot find
    # legacy jsonl on session-index changes; using --resume <uuid> from
    # last-session.id (written by relay-bot SessionStart hook) is reliable.
    LAST_SID_FILE=$STATE_DIR/last-session.id
    CHOSE=""
    if [[ -r "$LAST_SID_FILE" ]] && [[ -n "$SESSIONS_DIR" ]]; then
      LAST_SID=$(cat "$LAST_SID_FILE" 2>/dev/null | tr -d '[:space:]')
      if [[ "$LAST_SID" =~ ^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$ ]] \
         && [[ -f "$SESSIONS_DIR/$LAST_SID.jsonl" ]]; then
        log "default: --resume $LAST_SID (from last-session.id)"
        CLAUDE_CMD="$CLAUDE_BASE --resume $LAST_SID ."
        CHOSE="resume_explicit"
      fi
    fi
    if [[ -z "$CHOSE" ]] && [[ -n "$SESSIONS_DIR" ]] && compgen -G "$SESSIONS_DIR/*.jsonl" >/dev/null 2>&1; then
      # Don't fall back to --continue (broken on Claude Code 2.1.123).
      # Pick newest jsonl by mtime, validate UUID, --resume it.
      NEWEST_SID=$(ls -1t "$SESSIONS_DIR"/*.jsonl 2>/dev/null | head -1 | xargs -n1 basename 2>/dev/null | sed 's/\.jsonl$//')
      if [[ -n "$NEWEST_SID" ]] \
         && [[ "$NEWEST_SID" =~ ^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$ ]]; then
        log "fallback: --resume $NEWEST_SID (newest jsonl by mtime; last-session.id missing)"
        CLAUDE_CMD="$CLAUDE_BASE --resume $NEWEST_SID ."
        CHOSE="resume_mtime"
      fi
    fi
    if [[ -z "$CHOSE" ]]; then
      log "no prior sessions; fresh start"
    fi
    ;;
esac

# If already running, just keep this process alive watching tmux. systemd will
# restart us if tmux dies; we restart tmux if claude dies inside.
if tmux has-session -t "$SESSION" 2>/dev/null; then
  log "tmux session $SESSION already exists; attaching as watcher"
  if [[ -n "$RESOLVED" ]]; then
    log "WARN: command was consumed but tmux already alive — command had no effect on this boot"
  fi
else
  log "creating fresh tmux session $SESSION (cmd: $CLAUDE_CMD)"
  # No fallback. If `claude --continue` cannot find a prior session, or
  # `claude --resume <id>` fails, or claude crashes — the pane closes,
  # tmux session dies, the watcher loop exits, and systemd restarts the
  # wrapper. Operator gets a visible signal (journal + /sessions list)
  # instead of a silently-spawned fresh session that would hijack the
  # next ${SERVICE_PREFIX}-dispatch.timer fire as its first user input.
  # Rule: a new session is created ONLY when (a) no prior sessions exist
  # at all, or (b) the operator explicitly issues /new_session.
  tmux new-session -d -s "$SESSION" -x 200 -y 50 \
    "cd ${PROJECT_DIR} && $CLAUDE_CMD"
  log "tmux + claude launched"

  # Scheduling is external (${SERVICE_PREFIX}-dispatch.timer fires /${DISPATCH_COMMAND_NAME} via
  # tmux send-keys hourly at :07). The wrapper does NOT register an in-session
  # /loop because tmux/claude respawn must be controlled by systemd.
  sleep 5
  log "fresh session up; ${SERVICE_PREFIX}-dispatch.timer will inject /${DISPATCH_COMMAND_NAME} hourly"
fi

# Watcher loop: keep this systemd process alive while tmux session lives.
# If tmux dies, exit non-zero so systemd restarts us (and we re-create tmux).
# Sleep 5s (was 30s in v3) for snappier respawn after /new_session kill-session.
while tmux has-session -t "$SESSION" 2>/dev/null; do
  sleep 5
done

log "tmux session $SESSION disappeared; exiting (systemd will restart)"
exit 1

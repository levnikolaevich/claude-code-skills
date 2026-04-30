#!/bin/bash
# ${SERVICE_PREFIX}-god — long-running god-session wrapper, started by systemd.
# Maintains a tmux session named `${SERVICE_PREFIX}-god` with a single claude TUI
# running headless. systemd Restart=always covers crashes.
#
# Idempotent: if tmux session exists, attaches as watcher; otherwise creates fresh.
# Scheduling is external: ${SERVICE_PREFIX}-dispatch.timer (systemd) injects /dispatch
# hourly via tmux send-keys; this wrapper does NOT register an in-session /loop.
#
# Resume-by-default: on fresh tmux create, if a prior session exists for ${PROJECT_DIR},
# claude is started with --continue (latest) or --resume <id> based on the atomic
# command file ${STATE_DIR}/god-command.json (written by claude-relay-bot.py on
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

# Bring nvm + bun into PATH (cron-style minimal env)
export NVM_DIR="$HOME/.nvm"
# shellcheck disable=SC1091
[[ -s "$NVM_DIR/nvm.sh" ]] && . "$NVM_DIR/nvm.sh"
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

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
    CLAUDE_CMD="$CLAUDE_BASE --resume $SID"
    ;;
  "")
    # No command file. Default behavior: resume latest if any session exists.
    if [[ -n "$SESSIONS_DIR" ]] && compgen -G "$SESSIONS_DIR/*.jsonl" >/dev/null 2>&1; then
      log "default: --continue (latest session in $SESSIONS_DIR)"
      CLAUDE_CMD="$CLAUDE_BASE --continue"
    else
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
  tmux new-session -d -s "$SESSION" -x 200 -y 50 \
    "cd ${PROJECT_DIR} && $CLAUDE_CMD ; bash -l"
  log "tmux + claude launched"

  # Scheduling is external (${SERVICE_PREFIX}-dispatch.timer fires /dispatch via
  # tmux send-keys hourly at :07). The wrapper does NOT register an in-session
  # /loop — that pattern is fragile across tmux/claude respawn (see ln-030 v5.1).
  sleep 5
  log "fresh session up; ${SERVICE_PREFIX}-dispatch.timer will inject /dispatch hourly"
fi

# Watcher loop: keep this systemd process alive while tmux session lives.
# If tmux dies, exit non-zero so systemd restarts us (and we re-create tmux).
# Sleep 5s (was 30s in v3) for snappier respawn after /new_session kill-session.
while tmux has-session -t "$SESSION" 2>/dev/null; do
  sleep 5
done

log "tmux session $SESSION disappeared; exiting (systemd will restart)"
exit 1

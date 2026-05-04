#!/bin/bash
# agent-update — system-wide nightly maintenance for the shared agent toolchain
# (Claude Code CLI, Codex CLI, marketplace clone, selected plugins). Restarts
# every project's active god-service instances after the toolchain is verified, so each project
# picks up the new versions on its next pane respawn.
#
# Under the shared `${BOT_USER}` model, all projects share one nvm + Node, one
# `~/.claude/.credentials.json`, one `~/.codex/auth.json`, and one
# `${AGENT_SKILLS_DIR}` clone. This script updates that shared state ONCE per
# night, then enumerates `*-god@*.service` units to restart active project/user sessions.
set -euo pipefail

BOT_USER='${BOT_USER}'
AGENT_SKILLS_REPO_URL='${AGENT_SKILLS_REPO_URL}'
AGENT_SKILLS_REF='${AGENT_SKILLS_REF}'
AGENT_SKILLS_DIR='${AGENT_SKILLS_DIR}'
AGENT_SKILLS_PLUGINS='${AGENT_SKILLS_PLUGINS}'

STATE_DIR="/var/lib/agent-update"
LOCK_FILE="${STATE_DIR}/lock"
LOG="/var/log/agent-update.log"
NVM_SH="/home/${BOT_USER}/.nvm/nvm.sh"
CLAUDE_MARKETPLACE="levnikolaevich-skills-marketplace"
CODEX_CONFIG="/home/${BOT_USER}/.codex/config.toml"

log() {
  local msg
  msg="$(date -Iseconds) [agent-update] $*"
  echo "$msg"
  printf '%s\n' "$msg" >> "$LOG" 2>/dev/null || true
}

require_rendered() {
  local name=$1
  local value=$2
  case "$value" in
    ""|*'$'*|*'{'*|*'}'*)
      log "FATAL: $name placeholder not substituted (got '$value')"
      exit 4
      ;;
  esac
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    log "FATAL: required command not found: $1"
    exit 2
  }
}

run_as_bot() {
  sudo -i -u "$BOT_USER" bash -lc ". '$NVM_SH' && $*"
}

run_as_bot_in_skills_repo() {
  sudo -i -u "$BOT_USER" bash -lc ". '$NVM_SH' && cd '$AGENT_SKILLS_DIR' && $*"
}

require_bot_cmd() {
  local cmd=$1
  run_as_bot "command -v '$cmd' >/dev/null" || {
    log "FATAL: required ${BOT_USER} command not found after loading nvm: $cmd"
    exit 2
  }
}

ensure_skills_repo() {
  if [[ ! -d "$AGENT_SKILLS_DIR/.git" ]]; then
    if [[ -d "$AGENT_SKILLS_DIR" ]] && [[ -n "$(find "$AGENT_SKILLS_DIR" -mindepth 1 -maxdepth 1 -print -quit)" ]]; then
      log "FATAL: $AGENT_SKILLS_DIR exists but is not a git clone"
      exit 3
    fi
    install -d -o "$BOT_USER" -g "$BOT_USER" -m 755 "$AGENT_SKILLS_DIR"
    log "cloning skills repo $AGENT_SKILLS_REPO_URL#$AGENT_SKILLS_REF into $AGENT_SKILLS_DIR"
    sudo -i -u "$BOT_USER" git clone --branch "$AGENT_SKILLS_REF" "$AGENT_SKILLS_REPO_URL" "$AGENT_SKILLS_DIR"
  else
    log "updating skills repo in $AGENT_SKILLS_DIR"
    run_as_bot_in_skills_repo "git fetch --prune origin '$AGENT_SKILLS_REF' && git checkout '$AGENT_SKILLS_REF' && git pull --ff-only origin '$AGENT_SKILLS_REF'"
  fi

  [[ -r "$AGENT_SKILLS_DIR/.claude-plugin/marketplace.json" ]] || { log "FATAL: Claude marketplace manifest missing"; exit 3; }
  [[ -r "$AGENT_SKILLS_DIR/.agents/plugins/marketplace.json" ]] || { log "FATAL: Codex marketplace manifest missing"; exit 3; }
  run_as_bot_in_skills_repo 'node skills-catalog/shared/scripts/marketplace/sync-codex-adapters.mjs validate' \
    || log "WARN: codex-adapter validation reported a missing adapter (known upstream issue; non-fatal)"
}

selected_plugins() {
  {
    printf '%s\n' agile-workflow
    if [[ "$AGENT_SKILLS_PLUGINS" == "all" ]]; then
      jq -r '.plugins[].name' "$AGENT_SKILLS_DIR/.agents/plugins/marketplace.json"
    else
      printf '%s\n' "$AGENT_SKILLS_PLUGINS" | tr ',' '\n'
    fi
  } | sed 's/^[[:space:]]*//; s/[[:space:]]*$//' | awk 'NF && !seen[$0]++'
}

validate_selected_plugins() {
  local plugin
  while IFS= read -r plugin; do
    jq -e --arg plugin "$plugin" '.plugins[] | select(.name == $plugin)' \
      "$AGENT_SKILLS_DIR/.agents/plugins/marketplace.json" >/dev/null || {
      log "FATAL: selected plugin not found in Codex marketplace: $plugin"
      exit 3
    }
    [[ -d "$AGENT_SKILLS_DIR/plugins/$plugin" ]] || {
      log "FATAL: selected plugin directory missing: plugins/$plugin"
      exit 3
    }
  done < <(selected_plugins)
}

sync_codex_marketplace_config() {
  local tmp plugin marketplace_count
  install -d -o "$BOT_USER" -g "$BOT_USER" -m 700 "/home/${BOT_USER}/.codex"
  [[ -f "$CODEX_CONFIG" ]] || install -o "$BOT_USER" -g "$BOT_USER" -m 600 /dev/null "$CODEX_CONFIG"

  tmp=$(mktemp)
  awk '
    /^# BEGIN ln-030 managed LevNikolaevich marketplace$/ {skip=1; next}
    /^# END ln-030 managed LevNikolaevich marketplace$/ {skip=0; next}
    skip != 1 {print}
  ' "$CODEX_CONFIG" > "$tmp"

  {
    printf '\n# BEGIN ln-030 managed LevNikolaevich marketplace\n'
    while IFS= read -r plugin; do
      printf '[plugins."%s@levnikolaevich-skills-marketplace"]\n' "$plugin"
      printf 'enabled = true\n\n'
    done < <(selected_plugins)
    printf '[marketplaces.levnikolaevich-skills-marketplace]\n'
    printf 'source_type = "git"\n'
    printf 'source = "%s"\n' "$AGENT_SKILLS_REPO_URL"
    printf 'ref = "%s"\n' "$AGENT_SKILLS_REF"
    printf '# END ln-030 managed LevNikolaevich marketplace\n'
  } >> "$tmp"

  install -o "$BOT_USER" -g "$BOT_USER" -m 600 "$tmp" "$CODEX_CONFIG"
  rm -f "$tmp"

  marketplace_count=$(grep -Ec '^\[marketplaces\.levnikolaevich-skills-marketplace\]$' "$CODEX_CONFIG" || true)
  [[ "$marketplace_count" == "1" ]] || {
    log "FATAL: Codex config has $marketplace_count active LevNikolaevich marketplace blocks"
    exit 3
  }
}

update_claude_plugins() {
  local plugin
  run_as_bot "claude plugin marketplace update '$CLAUDE_MARKETPLACE'"
  while IFS= read -r plugin; do
    run_as_bot "claude plugin update '${plugin}@${CLAUDE_MARKETPLACE}' --scope user"
  done < <(selected_plugins)
  run_as_bot 'claude plugin list --json'
}

restart_all_god_services() {
  # Discover every active `*-god@*.service` and restart it. Each project/user
  # god-session is owned by its own systemd template instance.
  local services
  services=$(systemctl list-units --type=service --state=active --no-legend '*-god@*.service' 2>/dev/null \
    | awk '{print $1}')
  if [[ -z "$services" ]]; then
    log "no active *-god@*.service units found — nothing to restart"
    return 0
  fi
  log "restarting god-services: $(echo "$services" | tr '\n' ' ')"
  local svc
  while IFS= read -r svc; do
    [[ -n "$svc" ]] || continue
    if systemctl restart "$svc"; then
      log "restarted $svc OK"
    else
      log "WARN: failed to restart $svc — continuing with rest"
    fi
  done <<< "$services"
}

require_rendered BOT_USER "$BOT_USER"
require_rendered AGENT_SKILLS_REPO_URL "$AGENT_SKILLS_REPO_URL"
require_rendered AGENT_SKILLS_REF "$AGENT_SKILLS_REF"
require_rendered AGENT_SKILLS_DIR "$AGENT_SKILLS_DIR"
require_rendered AGENT_SKILLS_PLUGINS "$AGENT_SKILLS_PLUGINS"

for cmd in bash sudo systemctl flock install git jq sed awk mktemp grep; do
  require_cmd "$cmd"
done

[[ -r "$NVM_SH" ]] || { log "FATAL: cannot read $NVM_SH"; exit 3; }
install -d -o root -g root -m 755 "$STATE_DIR"
touch "$LOG"

(
  if ! flock -n 200; then
    log "another update is already running; exiting"
    exit 0
  fi

  log "starting system-wide agent toolchain update"

  for cmd in node npm claude codex; do
    require_bot_cmd "$cmd"
  done
  run_as_bot 'claude update'
  run_as_bot 'npm i -g @openai/codex@latest'
  run_as_bot 'claude --version && codex --version'
  ensure_skills_repo
  validate_selected_plugins
  update_claude_plugins
  sync_codex_marketplace_config

  log "shared toolchain updated; restarting all god-services"
  restart_all_god_services
  log "agent-update finished"
) 200>"$LOCK_FILE"

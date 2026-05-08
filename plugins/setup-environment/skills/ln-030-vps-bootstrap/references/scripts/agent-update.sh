#!/bin/bash
# agent-update - system-wide nightly maintenance for the shared agent toolchain.
# It updates Claude Code CLI, Codex CLI, the marketplace clone, selected plugins,
# and restarts active Claude/Codex god-service instances only after verification.
#
# BOT_USER is the canonical owner of ${AGENT_SKILLS_DIR}. RUNTIME_USERS is optional
# and is used by shared-auth fleets with per-project bot users. If unset or left as
# an unsubstituted placeholder, only BOT_USER is updated.
set -euo pipefail

BOT_USER='${BOT_USER}'
RUNTIME_USERS='${RUNTIME_USERS}'
AGENT_SKILLS_REPO_URL='${AGENT_SKILLS_REPO_URL}'
AGENT_SKILLS_REF='${AGENT_SKILLS_REF}'
AGENT_SKILLS_DIR='${AGENT_SKILLS_DIR}'
AGENT_SKILLS_PLUGINS='${AGENT_SKILLS_PLUGINS}'

STATE_DIR="/var/lib/agent-update"
LOCK_FILE="${STATE_DIR}/lock"
LOG="/var/log/agent-update.log"
CLAUDE_MARKETPLACE="levnikolaevich-skills-marketplace"

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

runtime_users() {
  {
    printf '%s\n' "$BOT_USER"
    if [[ -n "${RUNTIME_USERS:-}" && "$RUNTIME_USERS" != *'$'* && "$RUNTIME_USERS" != *'{'* && "$RUNTIME_USERS" != *'}'* ]]; then
      printf '%s\n' "$RUNTIME_USERS" | tr ', ' '\n\n'
    fi
  } | sed 's/^[[:space:]]*//; s/[[:space:]]*$//' | awk 'NF && !seen[$0]++'
}

user_home() {
  local user=$1
  getent passwd "$user" | cut -d: -f6
}

nvm_sh_for_user() {
  local user=$1
  local home
  home="$(user_home "$user")"
  [[ -n "$home" ]] || {
    log "FATAL: runtime user missing or has no passwd entry: $user"
    exit 3
  }
  printf '%s/.nvm/nvm.sh' "$home"
}

run_as_user() {
  local user=$1
  shift
  local nvm_sh
  nvm_sh="$(nvm_sh_for_user "$user")"
  sudo -i -u "$user" bash -lc ". '$nvm_sh' && $*"
}

run_as_bot() {
  run_as_user "$BOT_USER" "$@"
}

run_as_bot_in_skills_repo() {
  run_as_user "$BOT_USER" "cd '$AGENT_SKILLS_DIR' && $*"
}

require_user_cmd() {
  local user=$1
  local cmd=$2
  run_as_user "$user" "command -v '$cmd' >/dev/null" || {
    log "FATAL: required $user command not found after loading nvm: $cmd"
    exit 2
  }
}

ensure_runtime_user_ready() {
  local user=$1
  local nvm_sh
  nvm_sh="$(nvm_sh_for_user "$user")"
  [[ -r "$nvm_sh" ]] || {
    log "FATAL: cannot read $nvm_sh for runtime user $user"
    exit 3
  }
  for cmd in node npm claude codex; do
    require_user_cmd "$user" "$cmd"
  done
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
  run_as_bot_in_skills_repo 'node tools/marketplace/shared.mjs validate && node tools/marketplace/validate.mjs'
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
  local user=$1
  local home codex_dir codex_config tmp owner group mode marketplace_count

  home="$(user_home "$user")"
  codex_dir="${home}/.codex"
  codex_config="${codex_dir}/config.toml"
  group="$(id -gn "$user")"

  if [[ ! -e "$codex_dir" ]]; then
    install -d -o "$user" -g "$group" -m 700 "$codex_dir"
  fi
  if [[ ! -f "$codex_config" ]]; then
    install -o "$user" -g "$group" -m 600 /dev/null "$codex_config"
  fi

  owner="$(stat -c '%U' "$codex_config")"
  group="$(stat -c '%G' "$codex_config")"
  mode="$(stat -c '%a' "$codex_config")"

  tmp=$(mktemp)
  awk '
    /^# BEGIN ln-030 managed LevNikolaevich marketplace$/ {skip=1; next}
    /^# END ln-030 managed LevNikolaevich marketplace$/ {skip=0; next}
    skip != 1 {print}
  ' "$codex_config" > "$tmp"

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

  install -o "$owner" -g "$group" -m "$mode" "$tmp" "$codex_config"
  rm -f "$tmp"

  marketplace_count=$(grep -Ec '^\[marketplaces\.levnikolaevich-skills-marketplace\]$' "$codex_config" || true)
  [[ "$marketplace_count" == "1" ]] || {
    log "FATAL: $user Codex config has $marketplace_count active LevNikolaevich marketplace blocks"
    exit 3
  }
}

update_agent_clis() {
  local user
  while IFS= read -r user; do
    log "updating Claude/Codex CLIs for $user"
    run_as_user "$user" 'claude update'
    run_as_user "$user" 'npm i -g @openai/codex@latest'
    run_as_user "$user" 'claude --version && codex --version'
  done < <(runtime_users)
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
  # Discover every active Claude/Codex god service and restart it. Each project/user
  # god-session is owned by its own systemd template instance.
  local services
  services=$(systemctl list-units --type=service --state=active --no-legend '*-god@*.service' '*-god-codex@*.service' 2>/dev/null \
    | awk '{print $1}')
  if [[ -z "$services" ]]; then
    log "no active *-god@*.service or *-god-codex@*.service units found; nothing to restart"
    return 0
  fi
  log "restarting god-services: $(echo "$services" | tr '\n' ' ')"
  local svc
  while IFS= read -r svc; do
    [[ -n "$svc" ]] || continue
    if systemctl restart "$svc"; then
      log "restarted $svc OK"
    else
      log "WARN: failed to restart $svc; continuing with rest"
    fi
  done <<< "$services"
}

require_rendered BOT_USER "$BOT_USER"
require_rendered AGENT_SKILLS_REPO_URL "$AGENT_SKILLS_REPO_URL"
require_rendered AGENT_SKILLS_REF "$AGENT_SKILLS_REF"
require_rendered AGENT_SKILLS_DIR "$AGENT_SKILLS_DIR"
require_rendered AGENT_SKILLS_PLUGINS "$AGENT_SKILLS_PLUGINS"

for cmd in bash sudo systemctl flock install git jq sed awk mktemp grep getent cut id stat find; do
  require_cmd "$cmd"
done

install -d -o root -g root -m 755 "$STATE_DIR"
touch "$LOG"

(
  if ! flock -n 200; then
    log "another update is already running; exiting"
    exit 0
  fi

  log "starting system-wide agent toolchain update for runtime users: $(runtime_users | tr '\n' ' ')"

  while IFS= read -r user; do
    ensure_runtime_user_ready "$user"
  done < <(runtime_users)

  update_agent_clis
  ensure_skills_repo
  validate_selected_plugins
  update_claude_plugins

  while IFS= read -r user; do
    sync_codex_marketplace_config "$user"
  done < <(runtime_users)

  log "shared toolchain updated; restarting all god-services"
  restart_all_god_services
  log "agent-update finished"
) 200>"$LOCK_FILE"

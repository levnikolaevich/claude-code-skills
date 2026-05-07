#!/bin/bash
# Project-scoped bubblewrap sandbox for the LLM work plane.
# The control plane (systemd, hex-relay, secrets, DB, dispatcher) stays outside.
set -euo pipefail

: "${PROJECT_DIR:?PROJECT_DIR required}"
: "${PROJECT_NAME:?PROJECT_NAME required}"
: "${SERVICE_PREFIX:?SERVICE_PREFIX required}"
: "${BOT_USER:?BOT_USER required}"

AGENT_SKILLS_DIR=${AGENT_SKILLS_DIR:-/opt/agent-skills}
if [[ -z "${AGENT_HOME:-}" ]]; then
  if [[ -n "${OPERATOR_USER_ID:-}" ]]; then
    AGENT_HOME="${PROJECT_DIR}/.agent-home/users/${OPERATOR_USER_ID}"
  else
    AGENT_HOME="${PROJECT_DIR}/.agent-home/shared"
  fi
fi
AGENT_CACHE=${AGENT_CACHE:-${PROJECT_DIR}/.agent-cache}

[[ -d "$PROJECT_DIR" ]] || { echo "sandbox: PROJECT_DIR does not exist: $PROJECT_DIR" >&2; exit 64; }
[[ -d "$AGENT_SKILLS_DIR" ]] || { echo "sandbox: AGENT_SKILLS_DIR does not exist: $AGENT_SKILLS_DIR" >&2; exit 64; }

mkdir -p \
  "$AGENT_HOME" \
  "$AGENT_HOME/.claude" \
  "$AGENT_HOME/.codex" \
  "$AGENT_CACHE/npm" \
  "$AGENT_CACHE/pnpm" \
  "$AGENT_CACHE/yarn" \
  "$AGENT_CACHE/uv" \
  "$AGENT_CACHE/pip"

copy_if_missing() {
  local src=$1
  local dst=$2
  local mode=$3
  if [[ -e "$src" && ! -e "$dst" ]]; then
    # cp -aL dereferences source symlinks (required when ~/.claude.json or
    # ~/.claude/settings.json is a symlink to /var/lib/claude-shared/...).
    # cp -a alone preserves the symlink, which then resolves to a path that is
    # not bind-mounted into the sandbox; claude reads ENOENT and re-runs onboarding
    # with a fresh userID, breaking the OAuth refresh-token binding for everyone.
    # See `shared_auth_state.md` and `troubleshooting.md`.
    cp -aL "$src" "$dst"
    chmod "$mode" "$dst" 2>/dev/null || true
  fi
}

# Claude Code and Codex own mutable state under ~/.claude and ~/.codex:
# OAuth token rotation, sessions, memories, commands state, and plugin metadata.
# Bind both writable so the sandbox matches normal CLI auth/runtime behavior.
copy_if_missing "/home/${BOT_USER}/.claude.json" "$AGENT_HOME/.claude.json" 600
copy_if_missing "/home/${BOT_USER}/.claude/settings.json" "$AGENT_HOME/.claude/settings.json" 644
copy_if_missing "/home/${BOT_USER}/.codex/config.toml" "$AGENT_HOME/.codex/config.toml" 600

ro_bind_if_exists() {
  local src=$1
  local dst=$2
  [[ -e "$src" ]] && args+=(--ro-bind "$src" "$dst")
}

ro_bind_into_agent_home_if_exists() {
  local src=$1
  local dst=$2
  if [[ -e "$src" ]]; then
    mkdir -p "$(dirname "$dst")"
    if [[ -d "$src" ]]; then
      mkdir -p "$dst"
    else
      touch "$dst"
    fi
    args+=(--ro-bind "$src" "$dst")
  fi
}

rw_bind_into_agent_home_if_exists() {
  local src=$1
  local dst=$2
  if [[ -e "$src" ]]; then
    mkdir -p "$(dirname "$dst")"
    if [[ -d "$src" ]]; then
      mkdir -p "$dst"
    else
      touch "$dst"
    fi
    args+=(--bind "$src" "$dst")
  fi
}

args=(
  --die-with-parent
  --new-session
  --unshare-pid
  --unshare-ipc
  --unshare-uts
  --proc /proc
  --dev /dev
  --dev-bind /dev/pts /dev/pts
  --tmpfs /tmp
  --tmpfs /run
  --tmpfs /var
)

ro_bind_if_exists /usr /usr
ro_bind_if_exists /bin /bin
ro_bind_if_exists /lib /lib
ro_bind_if_exists /lib64 /lib64
ro_bind_if_exists /sbin /sbin

args+=(--tmpfs /etc)
ro_bind_if_exists /etc/ssl /etc/ssl
ro_bind_if_exists /etc/ca-certificates /etc/ca-certificates
ro_bind_if_exists /etc/resolv.conf /etc/resolv.conf
ro_bind_if_exists /etc/hosts /etc/hosts
ro_bind_if_exists /etc/nsswitch.conf /etc/nsswitch.conf
ro_bind_if_exists /etc/passwd /etc/passwd
ro_bind_if_exists /etc/group /etc/group

args+=(
  --tmpfs /home
  --dir "/home/${BOT_USER}"
)
ro_bind_if_exists "/home/${BOT_USER}/.nvm" "/home/${BOT_USER}/.nvm"

args+=(
  --dir /opt
  --bind "$PROJECT_DIR" "$PROJECT_DIR"
  --ro-bind "$AGENT_SKILLS_DIR" "$AGENT_SKILLS_DIR"
  --setenv HOME "$AGENT_HOME"
  --setenv XDG_CACHE_HOME "$AGENT_CACHE/xdg"
  --setenv npm_config_cache "$AGENT_CACHE/npm"
  --setenv PNPM_HOME "$AGENT_CACHE/pnpm-home"
  --setenv YARN_CACHE_FOLDER "$AGENT_CACHE/yarn"
  --setenv UV_CACHE_DIR "$AGENT_CACHE/uv"
  --setenv PIP_CACHE_DIR "$AGENT_CACHE/pip"
  --setenv TMPDIR /tmp
  --setenv PROJECT_DIR "$PROJECT_DIR"
  --setenv PROJECT_NAME "$PROJECT_NAME"
  --setenv SERVICE_PREFIX "$SERVICE_PREFIX"
  --setenv BOT_USER "$BOT_USER"
  --setenv AGENT_SKILLS_DIR "$AGENT_SKILLS_DIR"
  --setenv OPERATOR_USER_ID "${OPERATOR_USER_ID:-}"
  --chdir "$PROJECT_DIR"
)

# These mounts must be appended after PROJECT_DIR is bound, otherwise the
# project bind masks the runtime mounts under ${PROJECT_DIR}/.agent-home.
mkdir -p "/home/${BOT_USER}/.claude"
mkdir -p "/home/${BOT_USER}/.codex"
rw_bind_into_agent_home_if_exists "/home/${BOT_USER}/.claude" "$AGENT_HOME/.claude"
rw_bind_into_agent_home_if_exists "/home/${BOT_USER}/.codex" "$AGENT_HOME/.codex"

exec bwrap "${args[@]}" "$@"

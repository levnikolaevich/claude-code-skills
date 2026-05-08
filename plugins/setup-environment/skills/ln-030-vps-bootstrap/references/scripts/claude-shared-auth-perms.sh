#!/bin/bash
set -euo pipefail

# Claude/Codex can atomically replace auth files with mode 0600 during login or token refresh.
# This helper restores the shared group permissions without printing any credential contents.
SHARED_ROOT=${CLAUDE_SHARED_ROOT:-/var/lib/claude-shared}
SHARED_GROUP=${CLAUDE_SHARED_GROUP:-claude-shared}

if [[ ! -d "$SHARED_ROOT" ]]; then
  exit 0
fi

if ! getent group "$SHARED_GROUP" >/dev/null; then
  echo "missing shared auth group: $SHARED_GROUP" >&2
  exit 0
fi

if ! command -v setfacl >/dev/null; then
  echo "missing setfacl; install the acl package" >&2
  exit 1
fi

repair_dir() {
  local dir=$1
  [[ -d "$dir" ]] || return 0
  chgrp "$SHARED_GROUP" "$dir" 2>/dev/null || true
  chmod u+rwx,g+rwx,o-rwx "$dir" 2>/dev/null || true
  chmod g+s "$dir" 2>/dev/null || true
  setfacl -m "g:${SHARED_GROUP}:rwx" -m "m::rwx" "$dir"
  setfacl -d -m "g:${SHARED_GROUP}:rwx" -m "m::rwx" "$dir"
}

repair_file() {
  local file=$1
  [[ -f "$file" ]] || return 0
  chgrp "$SHARED_GROUP" "$file" 2>/dev/null || true
  chmod u+rw,g+rw,o-rwx "$file" 2>/dev/null || true
  setfacl -m "g:${SHARED_GROUP}:rw-" -m "m::rw-" "$file"
}

repair_dir "$SHARED_ROOT"
repair_dir "$SHARED_ROOT/.claude"
repair_dir "$SHARED_ROOT/.codex"

repair_file "$SHARED_ROOT/.claude/.credentials.json"
repair_file "$SHARED_ROOT/.claude.json"
repair_file "$SHARED_ROOT/.codex/auth.json"

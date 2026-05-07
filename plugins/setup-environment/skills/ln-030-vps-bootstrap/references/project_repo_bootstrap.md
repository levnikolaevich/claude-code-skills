# Project repo bootstrap

<!-- SCOPE: Executable repo setup recipe for ln-032-vps-project-runtime. -->

Use this before starting `${SERVICE_PREFIX}-god@${TELEGRAM_CHAT_ID}.service`. `${PROJECT_DIR}` must be a persistent git clone, not a temporary worktree.

## Rules

- Allowed pre-clone state: missing directory, empty directory, or directory containing only `.claude/`.
- Abort on arbitrary non-git files. Do not delete or overwrite them.
- Preserve `.claude/` across clone because it holds project-scope runtime config.
- Verify remote URL, ref, and status after clone/fetch.
- Add runtime `.claude/CLAUDE.md` and `.claude/settings.json` to `.git/info/exclude` when they are local-only files.

## Recipe

```bash
install -d -o ${BOT_USER} -g ${BOT_USER} -m 755 ${PROJECT_DIR}
sudo -u ${BOT_USER} mkdir -p /home/${BOT_USER}/.claude/commands ${PROJECT_DIR}/.claude

if [ ! -d "${PROJECT_DIR}/.git" ]; then
  EXTRA=$(find "${PROJECT_DIR}" -mindepth 1 -maxdepth 1 ! -name .claude -print -quit)
  [ -z "$EXTRA" ] || { echo "ERROR: ${PROJECT_DIR} has non-git files; move them aside before bootstrap: $EXTRA"; exit 1; }
  TMP_CLAUDE=$(mktemp -d)
  [ ! -d "${PROJECT_DIR}/.claude" ] || mv "${PROJECT_DIR}/.claude" "$TMP_CLAUDE/.claude"
  rmdir "${PROJECT_DIR}"
  sudo -u ${BOT_USER} git clone --branch "${REPO_REF}" --single-branch "${REPO_URL}" "${PROJECT_DIR}"
  [ ! -d "$TMP_CLAUDE/.claude" ] || mv "$TMP_CLAUDE/.claude" "${PROJECT_DIR}/.claude"
  rmdir "$TMP_CLAUDE"
fi

sudo -u ${BOT_USER} git -C "${PROJECT_DIR}" remote get-url origin | grep -Fx "${REPO_URL}"
sudo -u ${BOT_USER} git -C "${PROJECT_DIR}" fetch --prune origin
sudo -u ${BOT_USER} git -C "${PROJECT_DIR}" checkout "${REPO_REF}"
for p in .claude/CLAUDE.md .claude/settings.json; do
  grep -qxF "$p" "${PROJECT_DIR}/.git/info/exclude" || echo "$p" >> "${PROJECT_DIR}/.git/info/exclude"
done
chown ${BOT_USER}:${BOT_USER} "${PROJECT_DIR}/.git/info/exclude"
sudo -u ${BOT_USER} git -C "${PROJECT_DIR}" status --short

# Pre-create sandbox runtime dirs that hex-relay.service references in ReadWritePaths=.
# Without these, the relay fails to start with status=226/NAMESPACE on a fresh project
# because systemd refuses to set up the mount namespace when ReadWritePaths targets a
# non-existent path. agent-sandbox.sh also creates these lazily, but the relay starts
# BEFORE any sandbox, so they must already exist.
install -d -o ${BOT_USER} -g ${BOT_USER} -m 0700 ${PROJECT_DIR}/.agent-home
install -d -o ${BOT_USER} -g ${BOT_USER} -m 0700 ${PROJECT_DIR}/.agent-home/users
install -d -o ${BOT_USER} -g ${BOT_USER} -m 0700 ${PROJECT_DIR}/.agent-cache
```

<!-- SOURCE-OF-TRUTH: shared/references/verification_recipes_project_runtime.md. Edit ONLY here; run `node tools/marketplace/shared.mjs sync` -->

# Verification Recipes - Project Runtime

Project repository, provider, git, and dispatcher verification recipes.
## Project repo + tmux socket isolation (`ln-032`)

```bash
sudo -u ${BOT_USER} git -C ${PROJECT_DIR} remote get-url origin | grep -Fx "${REPO_URL}"
sudo -u ${BOT_USER} git -C ${PROJECT_DIR} branch --show-current
sudo -u ${BOT_USER} git -C ${PROJECT_DIR} status --short
sudo -u ${BOT_USER} tmux -L ${SERVICE_PREFIX} ls | grep -F "${SERVICE_PREFIX}-god-${TELEGRAM_CHAT_ID}"
systemctl cat ${SERVICE_PREFIX}-god@.service ${SERVICE_PREFIX}-dispatch.service ${SERVICE_PREFIX}-hex-relay.service | grep -E "tmux -L ${SERVICE_PREFIX}|RELAY_HOOK_PORT=${RELAY_HOOK_PORT}|god@"
```

Expected: repo URL/ref match configuration, status is clean except intentional project-scope `.claude` files, and all project tmux operations use the same non-default socket.

## GitHub App + git (`ln-032`)

```bash
sudo -u ${BOT_USER} ${SERVICE_PREFIX}-mint-gh-token | head -c 8
# Expected: ghs_... prefix

sudo -u ${BOT_USER} git config --global credential.helper
# Expected: includes ${SERVICE_PREFIX}-mint-gh-token invocation
```

## GitLab git + API (`ln-032`)

```bash
sudo -u ${BOT_USER} test -s ~/.git-credentials && sudo -u ${BOT_USER} stat -c '%a' ~/.git-credentials
# Expected: 600

sudo -u ${BOT_USER} git -C ${PROJECT_DIR} ls-remote --heads origin | head -3

sudo -u ${BOT_USER} bash -lc 'set -a && . /etc/${PROJECT_NAME}/secrets.env && set +a && GITLAB_HOST=$GITLAB_HOST GITLAB_TOKEN=$GITLAB_API_TOKEN glab issue list --repo $REPO_SLUG --opened --output json | jq length'
```

## Operator dispatcher (`ln-032`)

```bash
# Verbatim copy check — only ${VPS_*} placeholders should remain.
# Portable two-step pipeline because POSIX ERE has no lookahead `(?!...)`.
grep -oE '\$\{[A-Z_][A-Z_]*\}' ${TARGET_REPO_PATH}/.claude/commands/dispatcher.md | grep -v '^\$\{VPS_'
# Expected: empty output

# .env.local has the required VPS_* keys
for key in HOST SSH_KEY BOT_USER PROJECT_NAME SERVICE_PREFIX TELEGRAM_CHAT_ID PROJECT_DIR GIT_PROVIDER REPO_SLUG RELAY_HOOK_PORT RELAY_HTTP_TOKEN DISPATCH_COMMAND_NAME AGENT_SKILLS_DIR AGENT_SKILLS_PLUGINS; do
  grep -q "^VPS_${key}=" ${TARGET_REPO_PATH}/.env.local || echo "missing VPS_${key}"
done
# Expected: no missing VPS_* output
```

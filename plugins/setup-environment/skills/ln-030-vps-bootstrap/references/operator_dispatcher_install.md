<!-- SOURCE-OF-TRUTH: shared/references/operator_dispatcher_install.md. Edit ONLY here; run `node tools/marketplace/shared.mjs sync` -->

# Operator dispatcher install

<!-- SCOPE: Local operator-side dispatcher command setup for ln-030-vps-bootstrap. -->

This step runs on the operator's local machine, not on the VPS.

## Copy slash command verbatim

Copy `dispatcher.md.template` to `${TARGET_REPO_PATH}/.claude/commands/dispatcher.md`. Do not run `envsubst`: the dispatcher reads `${VPS_*}` variables at runtime from `.env.local`.

```bash
mkdir -p ${TARGET_REPO_PATH}/.claude/commands
cp references/templates/dispatcher.md.template ${TARGET_REPO_PATH}/.claude/commands/dispatcher.md
```

## Seed `.env.local`

Append missing keys only.

```bash
touch ${TARGET_REPO_PATH}/.env.local
append_env() {
  key="$1"
  value="$2"
  grep -q "^${key}=" ${TARGET_REPO_PATH}/.env.local || printf '%s=%s\n' "$key" "$value" >> ${TARGET_REPO_PATH}/.env.local
}
append_env VPS_HOST "${VPS_HOST}"
append_env VPS_SSH_KEY "${VPS_SSH_KEY}"
append_env VPS_BOT_USER "${BOT_USER}"
append_env VPS_PROJECT_NAME "${PROJECT_NAME}"
append_env VPS_SERVICE_PREFIX "${SERVICE_PREFIX}"
append_env VPS_TELEGRAM_CHAT_ID "${TELEGRAM_CHAT_ID}"
append_env VPS_PROJECT_DIR "${PROJECT_DIR}"
append_env VPS_GIT_PROVIDER "${GIT_PROVIDER}"
append_env VPS_REPO_SLUG "${REPO_SLUG}"
append_env VPS_RELAY_HOOK_PORT "${RELAY_HOOK_PORT}"
append_env VPS_DISPATCH_COMMAND_NAME "${DISPATCH_COMMAND_NAME}"
append_env VPS_AGENT_SKILLS_DIR "${AGENT_SKILLS_DIR}"
append_env VPS_AGENT_SKILLS_PLUGINS "${AGENT_SKILLS_PLUGINS}"
```

Confirm `.env.local` is git-ignored.

## Verify

```bash
grep -oE '\$\{[A-Z_][A-Z_]*\}' ${TARGET_REPO_PATH}/.claude/commands/dispatcher.md | grep -v '^\$\{VPS_'
grep -E '^VPS_(HOST|SSH_KEY|BOT_USER|PROJECT_NAME|SERVICE_PREFIX|TELEGRAM_CHAT_ID|PROJECT_DIR|GIT_PROVIDER|REPO_SLUG|RELAY_HOOK_PORT|DISPATCH_COMMAND_NAME|AGENT_SKILLS_DIR|AGENT_SKILLS_PLUGINS)=' ${TARGET_REPO_PATH}/.env.local
```

The first command should be empty. The second should print 13 lines.

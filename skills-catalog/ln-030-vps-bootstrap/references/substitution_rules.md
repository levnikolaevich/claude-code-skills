# Substitution rules — ln-030-vps-bootstrap

Two distinct substitution paths exist in the skill. Confusing them silently breaks the install.

## VPS-side templates (install-time substitution)

All files in `references/` **except** `dispatcher.md.template` use `${VAR}` placeholders compatible with `envsubst`. The skill reads each, substitutes placeholders in-memory, then ssh-uploads to the VPS. A sufficiently-skilled operator can also run the workflow themselves with `envsubst < references/X > /tmp/X` and `scp`.

### Pass an explicit allow-list to envsubst

`envsubst` without an explicit allow-list will substitute **every** `${...}` it sees, including bash variables that should remain literal (e.g. `${SESSIONS_DIR}`, `${SID}` in `god-session.sh`, `${VPS_*}` in operator-side files). Always use the allow-list form:

```bash
envsubst '$PROJECT_NAME $PROJECT_DIR $SERVICE_PREFIX $BOT_USER $RELAY_HOOK_PORT $DISPATCH_COMMAND_NAME $TELEGRAM_CHAT_ID' \
  < references/X > /tmp/X
```

### Why `$DISPATCH_COMMAND_NAME` matters

Forgetting `$DISPATCH_COMMAND_NAME` in the allow-list is the most common rendering bug. `god-session.sh` references it, the wrapper has `set -euo pipefail`, and any unsubstituted `${DISPATCH_COMMAND_NAME}` will trigger «unbound variable» on boot, sending civic-god into a systemd `Restart=always` loop.

Always include it in the envsubst allow-list (default value `${SERVICE_PREFIX}-dispatch` if your project uses the prefixed convention, plain `dispatch` if not).

## Operator-side template (runtime resolution)

`references/dispatcher.md.template` is the only operator-side artifact. It is **written verbatim** to `${TARGET_REPO_PATH}/.claude/commands/dispatcher.md` — do **NOT** envsubst it. The file uses bash `${VPS_*}` variables that are resolved at slash-command invocation by sourcing `.env.local` from the operator's repo. Substituting at install time would replace those placeholders with empty strings and break the slash command.

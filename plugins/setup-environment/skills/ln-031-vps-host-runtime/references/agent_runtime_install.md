<!-- SOURCE-OF-TRUTH: shared/references/agent_runtime_install.md. Edit ONLY here; run `node tools/marketplace/shared.mjs sync` -->

# Agent runtime install

<!-- SCOPE: Node, Claude Code, Codex, MCP, and skills marketplace setup for ln-030-vps-bootstrap. -->

Run as root on the VPS. Commands switch to `${BOT_USER}` where user-scope auth/config is required.

## 1. Node 24

```bash
sudo -i -u ${BOT_USER} bash -lc 'curl -fsSL -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash'
sudo -i -u ${BOT_USER} bash -lc '. /home/${BOT_USER}/.nvm/nvm.sh && nvm install 24 && nvm alias default 24'
printf '\n# Load nvm for login shells (cron/sudo -i)\nexport NVM_DIR="$HOME/.nvm"\n[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"\n' \
  >> /home/${BOT_USER}/.profile
chown ${BOT_USER}:${BOT_USER} /home/${BOT_USER}/.profile
```

Verify:

```bash
sudo -i -u ${BOT_USER} bash -lc '. /home/${BOT_USER}/.nvm/nvm.sh && node --version && which node'
```

## 2. Claude Code and Codex

```bash
sudo -i -u ${BOT_USER} bash -lc '. /home/${BOT_USER}/.nvm/nvm.sh && npm install -g @anthropic-ai/claude-code @openai/codex'
```

Verify:

```bash
sudo -i -u ${BOT_USER} claude --version
sudo -i -u ${BOT_USER} codex --version
```

Manual follow-up: complete `claude /login` and **`codex login --device-auth`** for `${BOT_USER}` before starting unattended sessions. The `--device-auth` flag is required on headless VPS — plain `codex login` opens an HTTP callback on `localhost:1455` that the operator's local browser cannot reach without an SSH tunnel.

For the **shared-auth pattern** (one Claude Max device + one Codex login serving all project bots on this VPS), do these logins **once** as any single bot whose `~/.claude`, `~/.claude.json`, and `~/.codex` symlink to `/var/lib/claude-shared/`. See `shared_auth_state.md` for the full migration script and ACL/permissions required.

## 3. MCP servers and Codex config

Add optional Claude HTTP MCP servers only when their keys are set:

```bash
sudo -u ${BOT_USER} bash -lc 'claude mcp add --transport http -s user Ref https://api.ref.tools/mcp --header "x-ref-api-key: ${REF_API_KEY}"'
sudo -u ${BOT_USER} bash -lc 'claude mcp add --transport http -s user context7 https://mcp.context7.com/mcp --header "CONTEXT7_API_KEY: ${CONTEXT7_API_KEY}"'
sudo -u ${BOT_USER} bash -lc 'claude mcp list'
```

Codex config is shared across projects under `${BOT_USER}`. Render `codex-config.toml.template` only on first install, then append this project's trust block if absent:

```bash
if [ ! -f /home/${BOT_USER}/.codex/config.toml ]; then
  sudo -u ${BOT_USER} install -o ${BOT_USER} -g ${BOT_USER} -m 600 /tmp/codex-config.toml /home/${BOT_USER}/.codex/config.toml
fi

sudo -u ${BOT_USER} bash -lc '
  TARGET=/home/${BOT_USER}/.codex/config.toml
  grep -qF "[projects.\"${PROJECT_DIR}\"]" "$TARGET" ||
    printf "\n[projects.\"%s\"]\ntrust_level = \"trusted\"\n" "${PROJECT_DIR}" >> "$TARGET"
'
```

## 4. Skills marketplace

```bash
install -d -o ${BOT_USER} -g ${BOT_USER} -m 755 ${AGENT_SKILLS_DIR}
if [ ! -d "${AGENT_SKILLS_DIR}/.git" ]; then
  sudo -i -u ${BOT_USER} git clone --branch ${AGENT_SKILLS_REF} ${AGENT_SKILLS_REPO_URL} ${AGENT_SKILLS_DIR}
else
  sudo -i -u ${BOT_USER} bash -lc 'cd ${AGENT_SKILLS_DIR} && git fetch --prune && git checkout ${AGENT_SKILLS_REF} && git pull --ff-only'
fi

sudo -i -u ${BOT_USER} bash -lc 'cd ${AGENT_SKILLS_DIR} && test -r .claude-plugin/marketplace.json && test -r .agents/plugins/marketplace.json'
sudo -i -u ${BOT_USER} bash -lc 'cd ${AGENT_SKILLS_DIR} && . /home/${BOT_USER}/.nvm/nvm.sh && node tools/marketplace/validate.mjs' \
  || echo "WARN: marketplace validation reported drift; continuing."

SELECTED_PLUGINS=$(
  {
    echo agile-workflow
    if [ "${AGENT_SKILLS_PLUGINS}" = "all" ]; then
      jq -r '.plugins[].name' "${AGENT_SKILLS_DIR}/.agents/plugins/marketplace.json"
    else
      printf '%s\n' "${AGENT_SKILLS_PLUGINS}" | tr ',' '\n'
    fi
  } | sed 's/^[[:space:]]*//; s/[[:space:]]*$//' | awk 'NF && !seen[$0]++'
)

sudo -i -u ${BOT_USER} bash -lc '. /home/${BOT_USER}/.nvm/nvm.sh && claude plugin marketplace add levnikolaevich/claude-code-skills || claude plugin marketplace update levnikolaevich-skills-marketplace'
for plugin in ${SELECTED_PLUGINS}; do
  jq -e --arg plugin "$plugin" '.plugins[] | select(.name == $plugin)' "${AGENT_SKILLS_DIR}/.agents/plugins/marketplace.json" >/dev/null
  sudo -i -u ${BOT_USER} bash -lc ". /home/${BOT_USER}/.nvm/nvm.sh && claude plugin install ${plugin}@levnikolaevich-skills-marketplace --scope user || claude plugin update ${plugin}@levnikolaevich-skills-marketplace --scope user"
done
```

Verify:

```bash
sudo -i -u ${BOT_USER} which claude codex node npm gh
sudo -i -u ${BOT_USER} claude --version
sudo -i -u ${BOT_USER} codex --version
sudo -i -u ${BOT_USER} bash -lc 'cd ${AGENT_SKILLS_DIR} && git status --short && git rev-parse --abbrev-ref HEAD && git rev-parse --short HEAD'
sudo -i -u ${BOT_USER} bash -lc '. /home/${BOT_USER}/.nvm/nvm.sh && claude plugin list --json | jq .'
sudo -u ${BOT_USER} grep -E 'levnikolaevich-skills-marketplace|agile-workflow' /home/${BOT_USER}/.codex/config.toml
```

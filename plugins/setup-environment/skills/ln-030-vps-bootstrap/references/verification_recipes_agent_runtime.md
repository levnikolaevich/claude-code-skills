<!-- SOURCE-OF-TRUTH: shared/references/verification_recipes_agent_runtime.md. Edit ONLY here; run `node tools/marketplace/shared.mjs sync` -->

# Verification Recipes - Agent Runtime

Agent runtime, marketplace, auth, and updater verification recipes.
## Headless config (`ln-031` / `ln-032`)

```bash
# Claude headless config
sudo -u ${BOT_USER} jq '.model,.effortLevel,.permissions.defaultMode' ~/.claude/settings.json
# Expected: "opus", "xhigh", "bypassPermissions"

# Codex headless config
sudo -u ${BOT_USER} grep -E '^(model|model_reasoning_effort|approval_policy|sandbox_mode)\b' ~/.codex/config.toml
# Expected: model = "gpt-5.5", model_reasoning_effort = "xhigh",
#           approval_policy = "never", sandbox_mode = "workspace-write"
```

## Agent skills/plugins marketplace (`ln-031`)

```bash
# Skills repo source
sudo -i -u ${BOT_USER} bash -lc 'cd ${AGENT_SKILLS_DIR} && git status --short && git rev-parse --abbrev-ref HEAD && git rev-parse --short HEAD'
# Expected: clean status, branch/ref matches AGENT_SKILLS_REF

# Marketplace manifests + native plugin manifests
sudo -i -u ${BOT_USER} bash -lc 'cd ${AGENT_SKILLS_DIR} && test -r .claude-plugin/marketplace.json && test -r .agents/plugins/marketplace.json'
sudo -i -u ${BOT_USER} bash -lc 'cd ${AGENT_SKILLS_DIR} && . /home/${BOT_USER}/.nvm/nvm.sh && node tools/marketplace/validate.mjs'

# Claude marketplace/plugins
sudo -i -u ${BOT_USER} bash -lc '. /home/${BOT_USER}/.nvm/nvm.sh && claude plugin list --json' | jq .
# Expected: levnikolaevich-skills-marketplace and selected plugins, including agile-workflow by default

# Codex marketplace/plugins: exactly one active marketplace block and selected plugin entries
sudo -u ${BOT_USER} grep -Ec '^\[marketplaces\.levnikolaevich-skills-marketplace\]$' ~/.codex/config.toml
# Expected: 1
sudo -u ${BOT_USER} grep -E '^\[plugins\."(agile-workflow|[^"]+)@levnikolaevich-skills-marketplace"\]$' ~/.codex/config.toml
```

## Agent freshness and plugin cache consistency (`ln-031` / post-deploy)

Run after host update, `hex-relay` deploy/redeploy, or any manual replacement of `${AGENT_SKILLS_DIR}`. This is a separate gate from "service is active": a relay can be healthy while Claude/Codex still read stale plugin cache snapshots.

```bash
# CLI latest check. Use explicit nvm PATH in non-interactive SSH shells.
NODE_BIN=$(find /home/${BOT_USER}/.nvm/versions/node -path '*/bin/node' -type f | sort | tail -1)
NODE_DIR=$(dirname "$NODE_BIN")
sudo -u ${BOT_USER} env PATH="$NODE_DIR:/usr/bin:/bin" npm view @anthropic-ai/claude-code version
sudo -u ${BOT_USER} env PATH="$NODE_DIR:/usr/bin:/bin" claude --version
sudo -u ${BOT_USER} env PATH="$NODE_DIR:/usr/bin:/bin" npm view @openai/codex version
sudo -u ${BOT_USER} env PATH="$NODE_DIR:/usr/bin:/bin" codex --version
# Expected: installed versions match npm view outputs.

# Current skills source validates.
sudo -u ${BOT_USER} env PATH="$NODE_DIR:/usr/bin:/bin" bash -lc \
  'cd ${AGENT_SKILLS_DIR} && node tools/marketplace/shared.mjs validate && node tools/marketplace/validate.mjs'

# Claude active marketplace, Claude plugin cache, and Codex plugin cache all contain the same current skill files.
sha256sum \
  ${AGENT_SKILLS_DIR}/plugins/setup-environment/skills/ln-030-vps-bootstrap/SKILL.md \
  ~/.claude/plugins/marketplaces/levnikolaevich-skills-marketplace/plugins/setup-environment/skills/ln-030-vps-bootstrap/SKILL.md \
  ~/.claude/plugins/cache/levnikolaevich-skills-marketplace/setup-environment/*/plugins/setup-environment/skills/ln-030-vps-bootstrap/SKILL.md \
  ~/.codex/plugins/cache/levnikolaevich-skills-marketplace/setup-environment/1.0.0/skills/ln-030-vps-bootstrap/SKILL.md
# Expected: all hashes for the checked file match.

# Claude metadata points to the shared active locations, not stale /home/agent-bot paths.
jq -e '.["levnikolaevich-skills-marketplace"].installLocation
  | startswith("/var/lib/claude-shared/.claude/plugins/marketplaces/")
' ~/.claude/plugins/known_marketplaces.json
jq -r '.plugins | to_entries[] | select(.key|contains("@levnikolaevich-skills-marketplace")) | .value[].installPath' \
  ~/.claude/plugins/installed_plugins.json \
  | while read -r path; do test -d "$path" || echo "MISSING plugin cache path: $path"; done
# Expected: no MISSING lines.

# Cache hygiene: one LevNikolaevich snapshot per plugin for Claude and Codex after cleanup.
find ~/.claude/plugins/cache/levnikolaevich-skills-marketplace -mindepth 2 -maxdepth 2 -type d | wc -l
find ~/.codex/plugins/cache/levnikolaevich-skills-marketplace -mindepth 2 -maxdepth 2 -type d | wc -l
# Expected: equals the number of installed LevNikolaevich plugins in that runtime.
```

## Shared auth repair (`ln-031` / `ln-034`, conditional)

Run this section only when `/var/lib/claude-shared/` exists. It verifies the durable repair automation and read/write access for every bot in the `claude-shared` group without printing auth file contents.

```bash
systemctl is-active claude-shared-auth-perms.path
systemctl cat claude-shared-auth-perms.service claude-shared-auth-perms.path >/dev/null

for bot in $(getent group claude-shared | awk -F: '{print $4}' | tr ',' ' '); do
  sudo -u "$bot" test -r /home/"$bot"/.claude/.credentials.json
  sudo -u "$bot" test -w /home/"$bot"/.claude/.credentials.json
  sudo -u "$bot" test -r /home/"$bot"/.claude.json
  sudo -u "$bot" test -w /home/"$bot"/.claude.json
  sudo -u "$bot" test -r /home/"$bot"/.codex/auth.json
  sudo -u "$bot" test -w /home/"$bot"/.codex/auth.json
done

getfacl /var/lib/claude-shared/.claude/.credentials.json /var/lib/claude-shared/.claude.json /var/lib/claude-shared/.codex/auth.json \
  | grep -E '^(group:claude-shared:rw-|mask::rw-)'
```

## Nightly agent updates (`ln-031`)

```bash
# Timer armed
systemctl list-timers agent-update.timer --no-pager
# Expected: one active timer with next fire around 03:37 local time (+ randomized delay)

# Manual smoke: updates CLIs + skills/plugins, verifies, then restarts every active Claude/Codex god service.
systemctl start agent-update.service
journalctl -u agent-update.service -n 120 --no-pager
# Expected: claude update succeeds, Codex npm install succeeds, skills repo fast-forwards,
#           marketplace validation passes, selected plugins update, version checks print both CLIs,
#           then "shared toolchain updated; restarting all god-services"

sudo -i -u ${BOT_USER} bash -lc '. /home/${BOT_USER}/.nvm/nvm.sh && claude --version && codex --version'
sudo -i -u ${BOT_USER} bash -lc 'cd ${AGENT_SKILLS_DIR} && git status --short && git rev-parse --short HEAD'
systemctl status ${SERVICE_PREFIX}-god@${TELEGRAM_CHAT_ID}.service --no-pager
# Expected: CLI versions print, skills repo is clean, and god-session is active after the maintenance restart.
```

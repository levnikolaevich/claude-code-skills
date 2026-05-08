<!-- SOURCE-OF-TRUTH: shared/references/verification_recipes_common.md. Edit ONLY here; run `node tools/marketplace/shared.mjs sync` -->

# Verification Recipes Common Preflight

Shared preflight rules for VPS verification recipes. Load this before a specialized recipe file.
## Two operational notes BEFORE running anything in this file

### Always run state-file inspection AS the owning user

When verifying SQLite databases, JSON state files, or anything that's auto-created on touch, **always run as the owning user** (typically `${BOT_USER}`):

```bash
# WRONG — creates the file as root if it doesn't yet exist
sqlite3 /var/lib/${PROJECT_NAME}/relay.db '.tables'

# RIGHT — runs as ${BOT_USER}, fails cleanly if the file doesn't exist yet
sudo -u ${BOT_USER} sqlite3 /var/lib/${PROJECT_NAME}/relay.db '.tables'
```

The hex-relay service runs as `${BOT_USER}`. If verification commands (run as root) accidentally create the SQLite file before the service starts, the file is owned by root → hex-relay crashes with `SQLITE_READONLY` on its first pragma write. Same risk applies to `cat`/`tail`/`jq` on any file that may not yet exist (those don't create files, but a stray `>` or `tee` would). Default: **`sudo -u ${BOT_USER}`** for ALL verification touching `/var/lib/${PROJECT_NAME}/`, `/home/${BOT_USER}/`, `${PROJECT_DIR}/`.

### AI-agent execution constraint

When this skill is run via `mcp__hex-ssh__remote-ssh` (or similar), commands must be **single-line** (literal newlines are rejected by the tool). Use `;` and `&&` separators. Also, the tool blocks `rm -rf` on root/home paths — use `find ... -delete`, `unlink`, or `rmdir` for cleanup. Wrap all snippets below into single-line form when invoking from an AI agent.

## Runtime approval gate

```bash
grep -F "Plan first for mutating work" ${PROJECT_DIR}/.claude/CLAUDE.md
grep -F "No implementation before approval" ${PROJECT_DIR}/.claude/CLAUDE.md
grep -F "waiting_approval" /home/${BOT_USER}/.claude/commands/${DISPATCH_COMMAND_NAME}.md
grep -F "approve #N" /home/${BOT_USER}/.claude/commands/${DISPATCH_COMMAND_NAME}.md
```

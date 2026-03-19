# Hook Health Check

<!-- SCOPE: Shared reference for validating Claude Code hook configuration integrity. -->

## Validation Steps

### Step 1: Locate hooks.json

| Priority | Path | Description |
|----------|------|-------------|
| 1 | `{skills_repo_root}/hooks/hooks.json` | Plugin hooks (primary) |
| 2 | `.claude/settings.json` → `hooks` key | User-level hooks |

If neither found: report `hooks: not_configured` and SKIP remaining steps.

### Step 2: JSON Syntax Validation

Parse hooks.json. If parse fails: report `hooks: invalid_json` with error line/message.

### Step 3: Script Existence Check

For each hook entry with `type: "command"`:

1. Extract script path from `command` field (after `python3`/`bash`/`node` prefix)
2. Resolve `${CLAUDE_PLUGIN_ROOT}` to skills repo root
3. Check file exists at resolved path

| Result | Report |
|--------|--------|
| File exists | `{script}: ok` |
| File missing | `{script}: NOT FOUND` |

### Step 4: Dependency Check

Detect required dependencies from hook commands:

| Pattern in Command | Dependency | Check |
|-------------------|------------|-------|
| `python3` / `python` | Python 3 | `python3 --version` or `python --version` |
| `jq` | jq | `jq --version` |
| `node` | Node.js | `node --version` |
| `bash` | Bash | `bash --version` |

| Result | Report |
|--------|--------|
| Available | `{dep}: {version}` |
| Missing | `{dep}: NOT FOUND — install required` |

### Step 5: Event Coverage Summary

List which hook events have registered hooks:

```
Hook Events:
  PreToolUse (Bash): 1 hook — secret-scanner.mjs
  PostToolUse (Edit|Write): 1 hook — code-quality.mjs
  UserPromptSubmit: 1 hook — story-validator.mjs
  PostToolUse (Bash): none
```

## Output Format

```
Hook Health Check:
| Check       | Status | Detail                    |
|-------------|--------|---------------------------|
| hooks.json  | ok     | 3 events, 3 hooks         |
| Scripts     | ok     | 3/3 found                 |
| Dependencies| ok     | node 22.x                 |
```

If any check fails, show `ISSUE` status with actionable detail.

## Usage in SKILL.md

```markdown
**MANDATORY READ:** Load `shared/references/hook_health_check.md`
```

---
**Version:** 1.0.0
**Last Updated:** 2026-03-15

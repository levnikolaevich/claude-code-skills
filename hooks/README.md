# Claude Code Hooks

Automated validation hooks for Claude Code. These hooks run automatically during development to enforce quality and security standards.

## Hooks Overview

| Hook | Event | Purpose |
|------|-------|---------|
| **secret-scanner.mjs** | PreToolUse (Bash) | Blocks commits containing secrets |
| **story-validator.mjs** | UserPromptSubmit | Validates Story structure before execution |
| **code-quality.mjs** | PostToolUse (Edit/Write) | Reports DRY/KISS/YAGNI violations |

## Installation

### Option 1: Plugin (Recommended)

Install as a plugin — hooks load automatically with no path editing:

```bash
/plugin add levnikolaevich/claude-code-skills
```

Hooks use `${CLAUDE_PLUGIN_ROOT}` environment variable, which Claude Code resolves to the plugin's absolute path at runtime.

### Option 2: Manual (standalone usage)

Copy hooks configuration to `~/.claude/settings.json` (global) or `.claude/settings.json` (project-level), replacing `${CLAUDE_PLUGIN_ROOT}` with your actual path:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [{
          "type": "command",
          "command": "node /your/path/to/hooks/secret-scanner.mjs",
          "timeout": 30
        }]
      }
    ],
    "UserPromptSubmit": [
      {
        "hooks": [{
          "type": "command",
          "command": "node /your/path/to/hooks/story-validator.mjs",
          "timeout": 10
        }]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [{
          "type": "command",
          "command": "node /your/path/to/hooks/code-quality.mjs",
          "timeout": 15
        }]
      }
    ]
  }
}

## Hook Details

### 1. Secret Scanner (PreToolUse)

**Triggers on:** `git commit`, `git add` commands

**Detects:**
- AWS Access Keys (`AKIA...`)
- Hardcoded passwords and secrets
- JWT tokens
- Private keys
- GitHub tokens
- Database connection strings with passwords

**Behavior:** Blocks the git operation if secrets are found (exit code 2).

### 2. Story Validator (UserPromptSubmit)

**Triggers on:** Prompts containing `ln-400`, `ln-401`, `execute story`

**Validates:**
- 8 required sections (Overview, Context, Requirements, etc.)
- Standards Research subsection in Technical Notes
- Non-empty Acceptance Criteria

**Behavior:** Blocks Story execution if validation fails (exit code 2).

### 3. Code Quality (PostToolUse)

**Triggers on:** After Edit or Write on code files (`.ts`, `.tsx`, `.js`, `.jsx`, `.py`, `.cs`)

**Checks:**
- **KISS:** Functions > 50 lines, > 5 parameters
- **DRY:** Duplicate code blocks (8+ identical lines)
- **YAGNI:** Large commented code blocks, excessive TODOs

**Behavior:** Reports issues to Claude (exit code 2), but file is already written.

## Exit Codes

| Code | Meaning | Effect |
|------|---------|--------|
| 0 | Allow | Operation proceeds |
| 2 | Block/Feedback | PreToolUse: blocks operation. PostToolUse: shows feedback |
| 1 | Error | Hook failed, operation proceeds (graceful) |

## Customization

Edit the Node.js scripts to customize:
- `SECRET_PATTERNS` in secret-scanner.mjs
- `REQUIRED_SECTIONS` in story-validator.mjs
- `MAX_FUNCTION_LINES`, `MAX_FUNCTION_PARAMS` in code-quality.mjs

## Disabling Hooks

To temporarily disable a hook, remove or comment it out in your settings.json.

---

**Version:** 1.0.0
**Last Updated:** 2026-01-23

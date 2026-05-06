# Claude Code Hooks Reference

<!-- SCOPE: Hooks reference used in this repository: standard events, 4 hook types, matchers, decision control, and env vars. -->

Source: [Claude Code Docs](https://code.claude.com/docs/en/hooks) (verified 2026-04-11)

## Hook Events (21)

| # | Event | Description | Matcher | Key options |
|:-:|-------|-------------|---------|-------------|
| 1 | `PreToolUse` | Before tool call | `tool_name` | `tool_use_id` |
| 2 | `PermissionRequest` | When permission is needed | `tool_name` | `permission_suggestions` |
| 3 | `PostToolUse` | After tool success | `tool_name` | `tool_response`, `tool_use_id` |
| 4 | `PostToolUseFailure` | After tool failure | `tool_name` | `error`, `is_interrupt`, `tool_use_id` |
| 5 | `UserPromptSubmit` | Before Claude processes prompt | None | `prompt` |
| 6 | `Notification` | When notification is sent | `notification_type` | `message`, `title` |
| 7 | `Stop` | Claude finishes responding | None | `last_assistant_message`, `stop_hook_active` |
| 8 | `SubagentStart` | Subagent task starts | `agent_type` | `agent_id` |
| 9 | `SubagentStop` | Subagent task completes | `agent_type` | `agent_id`, `last_assistant_message`, `agent_transcript_path` |
| 10 | `PreCompact` | Before compaction | `trigger` | `once`, `custom_instructions` |
| 11 | `PostCompact` | After compaction | `trigger` | `compact_summary` |
| 12 | `SessionStart` | Session starts or resumes | `source` | `once`, `agent_type`, `model` |
| 13 | `SessionEnd` | Session ends | `reason` | `once` |
| 14 | `Setup` | `/setup` command runs | None | `timeout` |
| 15 | `ConfigChange` | Config file changes | `source` | `file_path` |
| 16 | `WorktreeCreate` | Worktree created | None | `name` |
| 17 | `WorktreeRemove` | Worktree removed | None | `worktree_path` |
| 18 | `InstructionsLoaded` | `CLAUDE.md` or related rules loaded | None | `file_path`, `memory_type`, `load_reason` |
| 19 | `Elicitation` | MCP requests user input | `mcp_server_name` | `message`, `mode`, `requested_schema` |
| 20 | `ElicitationResult` | User responds to elicitation | `mcp_server_name` | `action`, `content` |
| 21 | `PermissionDenied` | Auto-mode denied a tool call | `tool_name` | `reason`, `tool_use_id` |

**Repository note:** non-standard team-session hook events are intentionally excluded because this repository does not use team-session orchestration.

## Hook Types (4)

| Type | Description | Use case | Supported events |
|------|-------------|----------|-----------------|
| `command` | Shell command, receives JSON via stdin | Logging, notifications, scripts | All 21 |
| `prompt` | Single-turn LLM evaluation | Judgment-based decisions | Selected post/pre tool events and stop events |
| `agent` | Multi-turn subagent with limited tools | Complex verification | Same family as `prompt` hooks |
| `http` | POST JSON to a URL | External integration | Same family as `prompt` hooks |

## Matcher Reference

| Hook | Matcher field | Possible values |
|------|--------------|-----------------|
| `PreToolUse` | `tool_name` | `Bash`, `Read`, `Edit`, `Write`, `Glob`, `Grep`, `mcp__*` |
| `PermissionRequest` | `tool_name` | Same as `PreToolUse` |
| `PostToolUse` | `tool_name` | Same as `PreToolUse` |
| `PostToolUseFailure` | `tool_name` | Same as `PreToolUse` |
| `Notification` | `notification_type` | `permission_prompt`, `idle_prompt`, `auth_success`, `elicitation_dialog` |
| `SubagentStart` | `agent_type` | Built-in or custom subagent name |
| `SubagentStop` | `agent_type` | Same as `SubagentStart` |
| `SessionStart` | `source` | `startup`, `resume`, `clear`, `compact` |
| `SessionEnd` | `reason` | `clear`, `logout`, `prompt_input_exit`, `bypass_permissions_disabled`, `other` |
| `PreCompact` | `trigger` | `manual`, `auto` |
| `PostCompact` | `trigger` | `manual`, `auto` |
| `Elicitation` | `mcp_server_name` | MCP server name |
| `ElicitationResult` | `mcp_server_name` | MCP server name |
| `ConfigChange` | `source` | `user_settings`, `project_settings`, `local_settings`, `policy_settings`, `skills` |

## Decision Control

| Hook | Control method | Values |
|------|---------------|--------|
| `PreToolUse` | `hookSpecificOutput.permissionDecision` | `allow`, `deny`, `ask`, `defer` |
| `PreToolUse` | `hookSpecificOutput.autoAllow` | `true` |
| `PreToolUse` | `hookSpecificOutput.additionalContext` | Advisory hint text (no decision) |
| `PermissionRequest` | `hookSpecificOutput.decision.behavior` | `allow`, `deny` |
| `PostToolUse`, `PostToolUseFailure`, `Stop`, `SubagentStop`, `ConfigChange` | Top-level `decision` | `block` |
| `UserPromptSubmit` | Modified `prompt` field | Prompt rewrite |
| `UserPromptSubmit` | `hookSpecificOutput.sessionTitle` | Session title (renames session, 2.1.94) |
| `UserPromptSubmit` | `hookSpecificOutput.additionalContext` | Appended context |
| `WorktreeCreate` | Non-zero exit plus stdout path | Fails or redirects creation |
| `Elicitation`, `ElicitationResult` | `hookSpecificOutput.action` | `accept`, `decline`, `cancel` |

## Environment Variables

| Variable | Availability | Description |
|----------|-------------|-------------|
| `$CLAUDE_PROJECT_DIR` | All hooks | Project root directory |
| `$CLAUDE_ENV_FILE` | `SessionStart` only | File path for persisted shell env vars |
| `${CLAUDE_PLUGIN_ROOT}` | Plugin hooks | Plugin root directory |
| `${CLAUDE_SKILL_DIR}` | Skill hooks | Skill directory |
| `$CLAUDE_CODE_REMOTE` | All hooks | `"true"` in remote web environments |

## Common stdin JSON Fields

| Field | Type | Description |
|-------|------|-------------|
| `hook_event_name` | string | Event name |
| `session_id` | string | Current session ID |
| `transcript_path` | string | Path to conversation transcript JSON |
| `cwd` | string | Current working directory |
| `permission_mode` | string | `default`, `plan`, `acceptEdits`, `dontAsk`, `bypassPermissions` |
| `agent_id` | string | Subagent ID when running inside a subagent |
| `agent_type` | string | Subagent type name |

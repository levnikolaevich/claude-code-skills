# Hook Design Guide

> **SCOPE:** Architecture guide for Claude Code hooks. Event model, output protocol, patterns. Based on hex-line `hook.mjs` experience.

## 1. Event Types (hex-line hook subset)

hex-line hook handles 5 of 21 Claude Code events. Full list: [hooks_reference.md](../../skills-catalog/shared/references/hooks_reference.md).

| Event | When It Fires | What It Can Do | Exit 0 | Exit 2 |
|-------|---------------|----------------|--------|--------|
| `SessionStart` | Session begins | Inject preferences | `stdout` JSON `{systemMessage}` | N/A |
| `PreToolUse` | Before tool executes | Block/redirect/advise | Silent = approve | `stdout` JSON `{permissionDecision:"deny"}` = block |
| `PostToolUse` | After tool returns | Filter/compress output | Silent = pass through | `stderr` = shown to Claude as feedback |
| `ConfigChange` | Config file changes mid-session | Invalidate caches | Silent = no-op | N/A |
| `PermissionDenied` | Auto-mode denied a tool call | Observability/retry | Silent = no-op | N/A |

## 2. PreToolUse vs PostToolUse

| Decision | PreToolUse | PostToolUse |
|----------|-----------|-------------|
| Block dangerous commands | Yes -- saves round-trip | No -- damage done |
| Redirect to better tool | Yes -- wrong tool never runs | No -- already ran |
| Compress verbose output | No -- no output yet | Yes -- output available |
| Validate tool inputs | Yes -- reject early | No -- too late |
| Add metadata to results | No -- no results | Yes -- annotate/filter |
| Token budget enforcement | No -- unknown cost | Yes -- measure and truncate |

Pre = gate (block/redirect). Post = filter (compress/annotate).

## 3. Output Protocol

Hooks write JSON to stdout and exit with a code.

| Scenario | Exit | stdout JSON | Effect |
|----------|------|-------------|--------|
| Approve silently | 0 | (empty) | Tool proceeds unchanged |
| Inject info | 0 | `{"systemMessage":"..."}` | Added to agent context |
| Advisory hint (no decision) | 0 | `{"hookSpecificOutput":{"additionalContext":"..."}}` | Hint delivered, permission rules decide |
| Force allow | 0 | `{"hookSpecificOutput":{"permissionDecision":"allow"}}` | Tool runs, bypasses permission rules |
| Ask user | 0 | `{"hookSpecificOutput":{"permissionDecision":"ask"}}` | User prompt dialog |
| Non-interactive deferral | 0 | `{"hookSpecificOutput":{"permissionDecision":"defer"}}` | `claude -p` only; ignored in interactive sessions |
| Block tool (Pre) | 2 | `{"hookSpecificOutput":{"permissionDecision":"deny"}}` | Call cancelled |
| Feedback to Claude (Post) | 2 | filtered text | Shown as tool feedback |
| Rename session | 0 | `{"hookSpecificOutput":{"sessionTitle":"..."}}` | Session renamed (UserPromptSubmit, 2.1.94) |
| Hook error | 0 | (empty) | Fail open -- never block on crash |

Hooks MUST fail open. Unhandled exception = `exit(0)`, not agent crash.

### Decision semantics

- `allow` -- explicit green light, overrides permission rules. Use only when hook has positive proof this call is safe.
- `deny` -- hard block. Use for dangerous commands and redirect enforcement in blocking mode.
- `ask` -- force user prompt even if rules would allow. Use when hook detects ambiguity.
- `defer` -- non-interactive deferral only (`claude -p`); in interactive sessions ignored with a warning. `additionalContext` is also ignored when `defer` is used. **Do not use for advisory mode.**
- (omit `permissionDecision`) -- advisory mode pattern: deliver hint via `systemMessage` + `hookSpecificOutput.additionalContext` without overriding the permission decision. This is the correct advisory approach.

## 4. Matcher Patterns

| Pattern | Syntax | Matches | Use Case |
|---------|--------|---------|----------|
| Exact | `"Bash"` | Only Bash | Dangerous command blocker |
| OR list | `"Read\|Edit\|Write\|Grep"` | Any listed | Tool redirect |
| Wildcard | `"*"` | All tools | SessionStart injection |
| Regex | `"mcp__.*"` | All MCP tools | MCP-specific filtering |

Multiple entries with different matchers can point to the same hook file.

## 5. Settings Location

| Agent | Config Location | Format |
|-------|----------------|--------|
| Claude Code | `.claude/settings.local.json` -> `hooks` | `event -> [{matcher, hooks: [{type, command, timeout}]}]` |
| Claude (plugin) | Plugin's own hook declaration | Plugin-managed format |

```json
{"hooks":{"PreToolUse":[{"matcher":"Read|Edit|Write|Grep","hooks":[{"type":"command","command":"node hook.mjs","timeout":5}]}]}}
```

## 6. Cross-Agent Compatibility

| Feature | Claude Code | Codex (0.120+) |
|---------|-------------|----------------|
| Pre-tool hook | `PreToolUse` | N/A |
| Post-tool hook | `PostToolUse` | N/A |
| Session start | `SessionStart` (source: startup/resume/clear/compact) | `SessionStart` (since 0.120, distinguishes `/clear`) |
| Config change | `ConfigChange` | N/A |
| Permission denied | `PermissionDenied` | N/A |
| Input format | JSON on stdin | JSON on stdin |

Strategy: hooks for Claude; Codex gained `SessionStart` hook support in CLI 0.120 (2026-04-11). `AGENTS.md` instructions remain the no-hooks fallback.

## 7. One File Pattern -- one `hook.mjs` routes all events

| Benefit | How |
|---------|-----|
| Single codebase | Route by `data.hook_event_name` |
| Shared constants | `DANGEROUS_PATTERNS`, `BINARY_EXT`, `TOOL_MAP` once |
| Shared helpers | `block()`, `detectCommandType()` reused |
| Atomic deployment | One file to install, update, debug |

`stdin JSON -> parse -> switch(hook_event_name) -> SessionStart|PreToolUse|PostToolUse|ConfigChange|PermissionDenied`

## 8. Dangerous Command Blocker -- PreToolUse for Bash

| Pattern | Reason |
|---------|--------|
| `rm -rf /` or `rm -rf ~` | Data destruction |
| `git push --force` | Overwrites remote history |
| `git reset --hard` | Discards uncommitted changes |
| `DROP TABLE\|DATABASE` | Permanent data loss |
| `chmod 777` | Security violation |
| `mkfs`, `dd if=/dev/zero` | Filesystem destruction |

Bypass: `# hex-confirmed` comment after explicit user confirmation via `AskUserQuestion`.
Flow: block -> agent sees reason -> asks user -> confirms -> retries with bypass.

## 9. RTK Output Filter -- PostToolUse for Bash

| Stage | What It Does | Implementation |
|-------|-------------|----------------|
| Detect | Match command type (npm, test, build, pip, git) | Regex array -> type string |
| Threshold | Skip if output < N lines | `HOOK_OUTPUT_POLICY.lineThreshold = 50` |
| Deduplicate | Normalize UUIDs/IPs/timestamps, group identical | `deduplicateLines()` with `(xN)` |
| Truncate | First N + last N, gap indicator | `smartTruncate(text, 15, 15)` |
| Header | Type + compression ratio | `RTK FILTERED: npm-install (847 -> 30 lines)` |

Output to stderr + exit 2 = stderr is shown to Claude as feedback; output replacement is not guaranteed for Bash.

## 10. SessionStart Injection

| Layer | Role | Mechanism |
|-------|------|-----------|
| SessionStart (primary) | Tell agent tool preferences | `{systemMessage}` on stdout |
| PreToolUse (safety net) | Block wrong tool if injection ignored | Exit 2 with redirect |
| CLAUDE.md (docs) | Human-readable preference table | Reference for developers |

Two layers because LLMs sometimes ignore injections under heavy context. PreToolUse is the hard gate.

## 11. Three-Layer Enforcement

Hooks alone leave gaps. Combine all three layers:

| Layer | Role | Example | Weakness alone |
|-------|------|---------|----------------|
| CLAUDE.md | Declare rules | "Run tests before commit" | Agent often ignores |
| Skill | Instruct workflow | Test order, error interpretation, fix steps | Agent may skip steps |
| Hook | Hard gate | Block commit if tests fail | Can't handle nuanced judgments |

Without any one layer, coverage has holes. Together: significantly more stable.

## 12. Anti-Patterns

| Anti-Pattern | Problem | Fix |
|--------------|---------|-----|
| >10 lines stdout per hook call | Context bloat | Cap output, stderr for verbose |
| Semantic judgments in hooks | Hooks are not reviewers | Mechanical gates only |
| Silent exit 0 on error | Agent unaware of failure | Fail open, but log to stderr |
| No output cap on PostToolUse | 10K-line logs pass through | Always `smartTruncate` |
| Block without recovery action | Agent stuck in retry loop | Every block says what to do next |
| Hook reads files at runtime | Slow, fragile | Embed constants, config at startup |
| Multiple hook files per server | Scattered logic | One File Pattern (Section 7) |
| Timeout too short | Killed mid-op, fails open silently | 5s Pre, 10s Post |
| Using `defer` for advisory mode | `tool_deferred` in `-p`, ignored in interactive | Omit `permissionDecision`, use `additionalContext` |

## 13. Plan Mode Awareness

Hook input includes `permission_mode` on every event. MCP tool hooks MUST check this field to enforce plan mode for mutating tools.

```javascript
// Block mutating MCP tools in plan mode
if (data.permission_mode === "plan" && MUTATING_TOOLS.has(data.tool_name)) {
    block("PLAN_MODE: write tools blocked during planning.", "Use read-only tools.");
}
```

Claude Code blocks built-in Edit/Write in plan mode, but MCP tools bypass this layer. The hook is the enforcement point.

## 14. Session Title Override (UserPromptSubmit)

Claude Code 2.1.94 adds `hookSpecificOutput.sessionTitle` to UserPromptSubmit hook output. Setting this field renames the current session (equivalent to `/rename`). Use when a hook can detect scope from the first user message and auto-brand the session (e.g., "audit-mcp", "repo-bootstrap").

**Last Updated:** 2026-04-11

# Tools Configuration

<!-- SCOPE: Available tools, their status, detection instructions, and troubleshooting. Created by ln-111 or auto-bootstrapped by first skill needing external tools. Edit manually to override. -->

## Task Management

| Setting | Value |
|---------|-------|
| **Provider** | {{TASK_PROVIDER}} |
| **Status** | {{TASK_STATUS}} |
| **Team ID** | {{TEAM_ID}} |
| **Fallback** | file (docs/tasks/epics/) |

**Detection:** Call `list_teams()` via mcp__linear-server. If responds with teams → `active`. If tool not found → `unavailable`. If 401/403 → `auth expired`.

**Troubleshooting:**

| Problem | Fix |
|---------|-----|
| Tool not found | Add linear-server to MCP settings (claude_desktop_config.json or .mcp.json) |
| 401/403 Unauthorized | Regenerate Linear API token: Linear → Settings → API → Personal API keys |
| 429 Rate limit | Wait 60s or switch Provider to `file` |
| Timeout | Check network. If persistent, switch Provider to `file` |

**File Mode:** When Provider=file, tasks stored in `docs/tasks/epics/` structure. Operations per `shared/references/storage_mode_detection.md`.

---

## Research

| Setting | Value |
|---------|-------|
| **Provider** | {{RESEARCH_PROVIDER}} |
| **Fallback chain** | {{RESEARCH_CHAIN}} |
| **Status** | {{RESEARCH_STATUS}} |

**Detection:** Call `ref_search_documentation(query="test")`. If responds → `active`. For context7: call `resolve-library-id(libraryName="react")`. If both fail → `websearch`.

**Troubleshooting:**

| Problem | Fix |
|---------|-----|
| Ref not found | Add Ref MCP server to settings |
| Context7 not found | Add Context7 MCP server to settings |
| Both unavailable | Provider auto-degrades to `websearch` (built-in, always available) |

---

## File Editing

| Setting | Value |
|---------|-------|
| **Provider** | {{EDITING_PROVIDER}} |
| **Fallback** | standard (Read/Edit/Write) |

**Detection:** Call `mcp__hashline-edit__read_file` on any project file. If responds → `hashline-edit`. Else → `standard`.

**Troubleshooting:**

| Problem | Fix |
|---------|-----|
| hashline-edit not found | Add hashline-edit MCP server (optional, standard tools work fine) |

---

## External Agents

| Agent | Status | Comment |
|-------|--------|---------|
| codex | {{CODEX_STATUS}} | {{CODEX_COMMENT}} |
| gemini | {{GEMINI_STATUS}} | {{GEMINI_COMMENT}} |

**Detection:** Run `codex --version` and `gemini --version` via Bash. Exit 0 → `available`. Health check: `node shared/agents/agent_runner.mjs --health`.

**Troubleshooting:**

| Problem | Fix |
|---------|-----|
| Agent not in PATH | Install: `npm i -g @openai/codex` or see agent docs |
| Agent crashes (<5s) | Check stderr for MCP init errors. Common: missing API key |
| Both unavailable | Skills auto-fallback to Self-Review (Claude-only analysis) |

---

## Git

| Setting | Value |
|---------|-------|
| **Worktree** | {{GIT_WORKTREE}} |
| **Branch strategy** | {{GIT_STRATEGY}} |

**Detection:** Run `git worktree list`. If succeeds → `available`, strategy = `worktree`. If fails → `unavailable`, strategy = `branch`.

**Troubleshooting:**

| Problem | Fix |
|---------|-----|
| Worktree unavailable | Fallback: plain branches. Set Branch strategy = `branch` |
| Push fails (auth) | Check git credentials: `git config credential.helper` |
| Push fails (network) | Local changes safe. Retry when network restored |

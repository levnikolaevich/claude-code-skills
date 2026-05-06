---
description: "Audit Claude and Codex sessions for workflow, tool, token, and skill issues"
allowed-tools: "Skill, Bash, Read"
---

# Audit Agent Sessions

Thin Claude adapter for session analysis. Canonical behavior lives in `ln-002-session-analyzer`.

## Source

| Field | Value |
|-------|-------|
| Canonical Skill | `plugins/setup-environment/skills/ln-002-session-analyzer/SKILL.md` |
| Scope | Claude and Codex sessions |

## Execution

1. For a current or named session, invoke:

```text
Skill(skill: "ln-002-session-analyzer", args: "$ARGUMENTS")
```

2. For a multi-session audit, collect only Claude and Codex session inventories. Use the host shell; this repository is maintained primarily from Windows, so prefer the PowerShell form there.

PowerShell:

```powershell
Write-Output "=== CLAUDE SESSIONS ==="
Get-ChildItem "$HOME\.claude\projects" -Recurse -Filter "*.jsonl" -ErrorAction SilentlyContinue |
  Where-Object { $_.LastWriteTime -gt (Get-Date).AddDays(-3) } |
  Sort-Object FullName |
  Select-Object -ExpandProperty FullName

Write-Output "=== CODEX SESSIONS ==="
Get-ChildItem "$HOME\.codex\sessions" -Recurse -Filter "rollout-*.jsonl" -ErrorAction SilentlyContinue |
  Where-Object { $_.LastWriteTime -gt (Get-Date).AddDays(-3) } |
  Sort-Object FullName |
  Select-Object -ExpandProperty FullName
```

POSIX shell:

```bash
echo "=== CLAUDE SESSIONS ==="
find "$HOME/.claude/projects" -name "*.jsonl" -mtime -3 2>/dev/null | sort

echo "=== CODEX SESSIONS ==="
find "$HOME/.codex/sessions" -name "rollout-*.jsonl" -mtime -3 2>/dev/null | sort
```

3. Pass the collected session paths to `ln-002-session-analyzer` and report:

| Dimension | Required Output |
|-----------|-----------------|
| Tool usage | MCP vs shell/built-in patterns |
| Failures | repeated errors, retries, permission or edit failures |
| Tokens | real usage numbers where present |
| Skills | missed or misused skill opportunities |
| Actions | concrete repo/config fixes |

Do not add provider-specific branches here. Extend the primary skill if the repository adds another supported host.

---

**Last Updated:** 2026-05-06

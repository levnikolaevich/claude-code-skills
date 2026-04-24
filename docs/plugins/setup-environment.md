# Setup Environment

> One-command setup for multi-agent development workflows

## Install

```bash
# Add the marketplace once
/plugin marketplace add levnikolaevich/claude-code-skills

# Install this plugin
/plugin install setup-environment@levnikolaevich-skills-marketplace
```

## What it does

Sets up and maintains the multi-agent development environment. The coordinator is runtime-backed, writes durable environment state only at finalization, and delegates to standalone workers that return machine-readable summaries.

## Skills

| Skill | Description |
|-------|-------------|
| ln-001-push-all | Commit and push all changes to remote |
| ln-010-dev-environment-setup | Full environment setup coordinator |
| ln-011-agent-installer | Install or update Codex CLI and Claude Code |
| ln-012-mcp-configurator | Configure Claude-side MCP registration, hooks, permissions, and migrations |
| ln-013-config-syncer | Install/verify Claude and Codex marketplace plugins, align MCP state, and align Codex execution defaults |
| ln-014-agent-instructions-manager | Single owner of instruction file creation, audit, and MCP Tool Preferences sync |
| ln-015-hex-line-uninstaller | Standalone cleanup: remove Claude-side hex-line registration, permissions, hooks, and output style |
| ln-020-codegraph | Code knowledge graph for dependency analysis and impact checking |

## How it works

```
ln-010 (coordinator)
    → ln-011 (install agents)
    → ln-012 (configure MCP)
    → ln-013 (align marketplace plugins and config)
    → ln-014 (audit instructions)
```

`ln-010` scans the environment once, builds a selective dispatch plan, starts managed child runtimes for the selected workers, records structured worker artifacts, verifies the result, and writes `.hex-skills/environment_state.json` only after verification passes. Worker summaries are coordination artifacts; the final environment file remains the durable project output.

`ln-015` is packaged for direct cleanup use but is intentionally not part of the normal `ln-010` setup chain.

## Quick start

```bash
ln-010-dev-environment-setup  # Full setup (scan + install + configure + audit)
ln-001-push-all               # Quick push of all changes
```

## Related

- [All plugins](../../README.md)
- [Architecture guide](../architecture/SKILL_ARCHITECTURE_GUIDE.md)

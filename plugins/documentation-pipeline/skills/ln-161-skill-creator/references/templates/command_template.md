# Command Template

<!-- DO NOT add here: Creation workflow -> ln-161-skill-creator SKILL.md -->

Template for generated `.claude/commands/*.md` files. Based on real-world examples from production projects (prompsit-api).

## Template Structure

```markdown
---
description: {what it does}. Use when {trigger}
allowed-tools: {comma-separated: Read, Bash, Edit, Grep, Glob, Skill, AskUserQuestion, mcp__hex-line__outline, mcp__hex-line__verify}
---

# {Command Name}

{1-2 sentence purpose statement. What this command does and when to use it.}

## Source

| Field | Value |
|-------|-------|
| Source Document | [{source_doc}]({relative_path}) |
| Source Section | {section_header} |

## Arguments

**Mode:** `$ARGUMENTS` (default: {default_value})

| Mode | Target | Description |
|------|--------|-------------|
| {mode1} | {target} | {what it does} |

*(Include Arguments section only if command has multiple modes or parameters)*

## Prerequisites

| Requirement | Check Command | Install |
|-------------|---------------|---------|
| {requirement} | `{check}` | {install instruction} |

## Workflow

### 1. {Step Name}

{Imperative instructions with actual commands}

```bash
{actual command to execute}
```

**Verify:** {verification command or expected output}

### 2. {Step Name}

{Next step...}

## Troubleshooting

| Issue | Solution |
|-------|----------|
| {common problem} | {fix instruction} |

## Related Documentation

- [{source_doc}]({relative_path}) -- canonical source for this command
- {additional related docs if needed}

---
**Last Updated:** {YYYY-MM-DD}
```

## Template Rules

| Rule | Requirement |
|------|-------------|
| Frontmatter | `description` (max 100 chars, WHAT + "Use when" trigger) + `allowed-tools` with built-ins + relevant MCP tools |
| Description trigger | Must include "Use when {context}" after purpose |
| Title | H1, matches command purpose |
| Purpose | 1-2 sentences max, no jargon |
| Source | Required. Must identify source document and source section |
| Arguments | Only if command accepts `$ARGUMENTS` |
| Prerequisites | Table format, with check commands |
| Workflow | Numbered ### steps with imperative verbs |
| Code blocks | Use `bash` language tag for shell commands |
| Verification | After each significant step where applicable |
| Troubleshooting | Table format, common issues only (3-8 rows) |
| Related docs | Relative paths from project root |
| No doc shell | Do not copy doc metadata markers or `Quick Navigation` / `Agent Entry` / `Maintenance` sections |
| Last Updated | Always present at end |

## Sections to Omit

Do NOT include if source doc lacks relevant content:
- Arguments (if no modes/parameters)
- Prerequisites (if none required)
- Troubleshooting (if source doc has no troubleshooting info)

Minimal valid command: Frontmatter + Title + Purpose + Workflow + Last Updated.

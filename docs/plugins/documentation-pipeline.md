# Documentation Pipeline

> Auto-detect project type and generate complete documentation suite

## Install

```bash
# Add the marketplace once
/plugin marketplace add levnikolaevich/claude-code-skills

# Install this plugin
/plugin install documentation-pipeline@levnikolaevich-skills-marketplace
```

## What it does

Generates full project documentation in one command. Auto-detects project type (backend, frontend, devops) and creates appropriate docs: AGENTS.md (canonical), CLAUDE.md (`@AGENTS.md` import stub), README, architecture, requirements, API specs, runbooks, references, kanban, and test strategy. Also extracts procedural docs into reusable .claude/commands.

## Skills

| Skill | Description |
|-------|-------------|
| ln-100-documents-pipeline | Top orchestrator for complete doc system |
| ln-110-project-docs-coordinator | Detect project type, delegate to workers |
| ln-111-root-docs-creator | AGENTS.md canonical + CLAUDE.md stub, docs/README, standards, principles |
| ln-112-project-core-creator | Requirements, architecture, tech stack, patterns |
| ln-113-backend-docs-creator | API spec, database schema (when backend detected) |
| ln-114-frontend-docs-creator | Design guidelines (when frontend detected) |
| ln-115-devops-docs-creator | Infrastructure, runbook (when Docker detected) |
| ln-120-reference-docs-creator | ADRs, guides, manuals based on tech stack |
| ln-130-tasks-docs-creator | Task management docs, kanban board, Linear setup |
| ln-140-test-docs-creator | Testing strategy, test README |
| ln-160-docs-skill-extractor | Scan docs, classify procedural content |
| ln-161-skill-creator | Create .claude/commands from procedural sections |
| ln-162-skill-reviewer | Review skills (SKILL mode D1-D9 + COMMAND mode) |

## How it works

```
ln-100 -> ln-110 (auto-detect project type)
    -> ln-111-115 (type-specific doc workers)
    -> ln-120 (references) -> ln-130 (tasks)
    -> ln-140 (tests)
    -> ln-160 (skill extraction)
```

ln-100 delegates to ln-110, which auto-detects project type and spawns workers ln-111 through ln-115 for core documentation. Then ln-120 creates references, ln-130 sets up task tracking, ln-140 creates test strategy, and ln-160 extracts reusable commands from the generated docs.

## Quick start

```bash
ln-100-documents-pipeline   # Generate all docs in one command
```

## Related

- [All plugins](../../README.md)
- [Architecture guide](../architecture/SKILL_ARCHITECTURE_GUIDE.md)

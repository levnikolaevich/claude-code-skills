# Documentation

<!-- SCOPE: Index for docs/ directory. Each subdirectory owns one aspect of maintainer documentation. -->

## Structure

```text
docs/
|-- architecture/                    # Maintainer references for skill design
|   |-- ADR-001-tracker-abstraction.md
|   |-- SKILL_ARCHITECTURE_GUIDE.md  # Maintainer-only guide: plugin-first workflow, shared registry distribution, hierarchy
|   `-- AGENT_DELEGATION_PLATFORM_GUIDE.md # Skill vs subagent runtime, recovery, Windows
|-- best-practice/                   # Claude Code usage guidance
|   |-- COMPONENT_SELECTION.md
|   |-- HOOK_DESIGN_GUIDE.md
|   |-- MCP_TOOL_DESIGN_GUIDE.md     # MCP naming, bounded output, clean-cut migration, error classes
|   |-- MCP_OUTPUT_CONTRACT_GUIDE.md # Canonical MCP status/reason/next_action vocabulary
|   |-- PROMPT_CACHING_GUIDE.md
|   `-- WORKFLOW_TIPS.md
|-- plugins/                         # Per-plugin landing pages
|   |-- agile-workflow.md
|   |-- codebase-audit-suite.md
|   |-- documentation-pipeline.md
|   |-- project-bootstrap.md
|   |-- optimization-suite.md
|   |-- community-engagement.md
|   `-- setup-environment.md
|-- standards/                       # Documentation standards for generated project docs
|   |-- DOCUMENTATION_STANDARDS.md
|   |-- GITHUB_PAGES_BEST_PRACTICES.md
|   |-- GITHUB_README_BEST_PRACTICES.md
|   |-- NPM_PACKAGE_BEST_PRACTICES.md
|   `-- TOKEN_EFFICIENCY_PATTERNS.md
`-- TROUBLESHOOTING.md               # Known issues and solutions
```

## Plugins

| Plugin | Description |
|--------|-------------|
| [agile-workflow](plugins/agile-workflow.md) | Scope decomposition, artifact-first coordinators, stateful workers, quality gates, pipeline orchestration |
| [codebase-audit-suite](plugins/codebase-audit-suite.md) | Security, code quality, architecture, tests, persistence, performance audits |
| [documentation-pipeline](plugins/documentation-pipeline.md) | Auto-detect project type and generate complete documentation |
| [project-bootstrap](plugins/project-bootstrap.md) | Create or transform projects to Clean Architecture with Docker and CI/CD |
| [optimization-suite](plugins/optimization-suite.md) | Performance profiling, dependency upgrades, code modernization |
| [community-engagement](plugins/community-engagement.md) | GitHub triage, announcements, RFC debates, response automation |
| [setup-environment](plugins/setup-environment.md) | Install CLI agents, configure MCP servers, align marketplace plugins, audit instruction files |

## Responsibility Boundaries

| Directory | Owns | Does Not Own |
|-----------|------|--------------|
| `architecture/` | Maintainer references for skill design and subagent runtime | Runtime skill contracts or individual skill workflows |
| `best-practice/` | Claude Code usage guidance and component selection | Platform API reference |
| `plugins/` | Per-plugin landing pages, skill tables, workflow overviews | Skill internals |
| `standards/` | Documentation quality requirements for generated project docs | Skill-specific writing contracts |
| `TROUBLESHOOTING.md` | Known issues and solutions | Runtime protocols |

## Key Maintainer References

| Topic | File |
|-------|------|
| Skill development workflow | [architecture/SKILL_ARCHITECTURE_GUIDE.md](architecture/SKILL_ARCHITECTURE_GUIDE.md) |
| MCP tool design | [best-practice/MCP_TOOL_DESIGN_GUIDE.md](best-practice/MCP_TOOL_DESIGN_GUIDE.md) |
| MCP output contract | [best-practice/MCP_OUTPUT_CONTRACT_GUIDE.md](best-practice/MCP_OUTPUT_CONTRACT_GUIDE.md) |
| Loop Health contract | [../shared/references/loop_health_contract.md](../shared/references/loop_health_contract.md) |
| Procedural SOP/TWI guide | [../shared/references/procedural_skill_sop_guide.md](../shared/references/procedural_skill_sop_guide.md) |

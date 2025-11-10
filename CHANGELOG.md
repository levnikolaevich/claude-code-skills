# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-11-10

### Added

- Initial plugin release with 17 production-ready skills
- Complete Agile workflow automation for Linear
- Plugin manifest (`.claude-plugin/plugin.json`) and marketplace support (`.claude-plugin/marketplace.json`)
- Skills organized in 5 categories: Pre-Planning (5), Planning (4), Execution (5), Validation (2), Documentation (1)
- Mermaid workflow diagrams for all skills (`.mmd` and `.html` files)
- Comprehensive documentation (CLAUDE.md, README.md)
- MIT License
- Installation support via plugin system and git clone (backward compatible)

### Skills Included

**Pre-Planning (5 skills):**
- x-docs-creator v5.5.0 - Create comprehensive project documentation BEFORE development
- x-html-builder v2.3.1 - Build interactive HTML presentation from project documentation
- x-docs-system v1.0.2 - Orchestrator that creates complete documentation system
- x-docs-updater v2.1.0 - Update existing project documentation based on code changes
- x-adr-creator v3.0.0 - Create minimal Architecture Decision Records (ADRs)

**Planning (4 skills):**
- x-epic-creator v4.0.0 - Decompose scope/initiative into 3-7 Epics (Linear Projects)
- x-story-manager v7.0.0 - Universal Story operations (create/replan) with automatic Epic decomposition
- x-task-manager v5.0.0 - Universal task operations (create/replan) with automatic Story decomposition
- x-story-finalizer v4.1.0 - Create final Story task after manual testing passes

**Execution (5 skills):**
- x-story-executor v2.6.0 - Orchestrate Story execution through task workflow
- x-task-executor v10.0.0 - Execute implementation tasks ONLY (not test tasks)
- x-test-executor v4.0.0 - Execute Story Finalizer test tasks with Risk-Based Testing
- x-task-reviewer v7.3.0 - Review completed tasks for quality and correctness
- x-task-rework v5.1.0 - Fix tasks after review feedback

**Validation (2 skills):**
- x-story-verifier v9.3.1 - Auto-fix and approve Stories against industry standards before execution
- x-story-reviewer v3.5.0 - Two-pass Story review: manual testing + test verification

**Documentation (1 skill):**
- x-guide-creator v4.0.0 - Research and create minimal project guides with best practices

### Features

- **Linear Integration**: Full MCP support for creating/updating Epics, Stories, and Tasks
- **Risk-Based Testing**: E2E-first approach with Priority ≥15 scenarios (2-5 E2E, 3-8 Integration, 5-15 Unit tests per Story)
- **Decompose-First Pattern**: Automatic Epic → Stories → Tasks decomposition with KEEP/UPDATE/OBSOLETE/CREATE operations
- **Template Ownership**: Each skill owns templates in its `references/` directory (Single Source of Truth)
- **Consumer-First Principle**: API endpoint → Service → Repository task ordering
- **Industry Standards Compliance**: RFC/protocol compliance checks before KISS/YAGNI application
- **DAG Documentation Support**: SCOPE tags, Maintenance sections, README hub for structured documentation
- **Auto-Guide Creation**: Automatic best practices research and guide generation during Story verification

### Documentation

- Complete workflow diagrams (Mermaid) for all 17 skills
- Comprehensive CLAUDE.md with development principles and task hierarchy
- README.md with installation instructions for all methods
- Reference templates for Epics, Stories, Tasks, ADRs, and Guides

### Installation Methods

1. **Plugin System** (recommended): `/plugin marketplace add` + `/plugin install`
2. **Direct Plugin**: `/plugin add levnikolaevich/claude-code-skills`
3. **Git Clone** (backward compatible): `git clone` into `~/.claude/skills/`

---

## Future Releases

### Planned for v1.1.0
- Additional workflow optimizations
- Extended integration capabilities
- Community-contributed templates

---

**Links:**
- [Repository](https://github.com/levnikolaevich/claude-code-skills)
- [Issues](https://github.com/levnikolaevich/claude-code-skills/issues)
- [Contributing Guidelines](https://github.com/levnikolaevich/claude-code-skills#contributing)

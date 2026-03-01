# Claude Code Skills (Zoned Labs Fork)

![Version](https://img.shields.io/badge/version-4.0.0-blue)
![Skills](https://img.shields.io/badge/skills-54-green)
![License](https://img.shields.io/badge/license-MIT-green)

> Trimmed fork of [levnikolaevich/claude-code-skills](https://github.com/levnikolaevich/claude-code-skills) for a small team. Enterprise planning/decomposition removed, docs pipeline + execution + quality + full audit suite retained.

---

## What's Inside

```
claude-code-skills/                      # 1 plugin, 54 skills
|
|  ┌─ Plugin: zoned-labs-dev-skills ──────────────────┐
|
|-- ln-001-standards-researcher/       # Research standards via MCP Ref
|-- ln-002-best-practices-researcher/  # Create ADRs, guides, manuals
|-- ln-003-push-all/                   # Commit and push all changes
|-- ln-004-agent-sync/                 # Sync skills & MCP to Gemini/Codex
|-- ln-005-agent-reviewer/             # Universal context review (Codex + Gemini)
|
|-- ln-1XX-*/                          # DOCUMENTATION (13 skills)
|   |-- ln-100-documents-pipeline/     # Orchestrator: complete docs in one command
|   |-- ln-110-project-docs-coordinator/  # Detects project type, delegates to workers
|   |   |-- ln-111 through ln-115     # Root, core, backend, frontend, devops docs
|   |-- ln-120-reference-docs-creator/    # ADRs, guides, manuals structure
|   |-- ln-130-tasks-docs-creator/        # kanban_board.md (Linear config)
|   |-- ln-140-test-docs-creator/         # testing-strategy.md
|   |-- ln-150-presentation-creator/      # Interactive HTML presentation
|
|-- ln-4XX-*/                          # EXECUTION (3 skills)
|   |-- ln-401-task-executor/          # Execute implementation tasks
|   |-- ln-402-task-reviewer/          # Review completed tasks
|   |-- ln-404-test-executor/          # Execute test tasks (E2E-first)
|
|-- ln-5XX-*/                          # QUALITY (5 skills)
|   |-- ln-510-quality-coordinator/    # Standalone quality gate coordinator
|   |   |-- ln-511-code-quality-checker/  # DRY/KISS/YAGNI violations
|   |   |-- ln-512-tech-debt-cleaner/    # Automated safe tech debt cleanup
|   |   |-- ln-513-agent-reviewer/        # External agent review (Codex + Gemini)
|   |   |-- ln-514-regression-checker/    # Run existing test suite
|
|-- ln-6XX-*/                          # AUDIT (28 skills) [WORKS WITHOUT LINEAR]
|   |-- ln-600-docs-auditor/           # Documentation quality audit
|   |   |-- ln-601-semantic-content-auditor/
|   |-- ln-610-code-comments-auditor/  # Code comments audit
|   |-- ln-620-codebase-auditor/       # 9 parallel auditors (security, build,
|   |   |-- ln-621 through ln-629     #   principles, quality, deps, dead code,
|   |                                  #   observability, concurrency, lifecycle)
|   |-- ln-630-test-auditor/           # 5 test auditors
|   |   |-- ln-631 through ln-635
|   |-- ln-640-pattern-evolution-auditor/ # Architectural patterns + 6 sub-auditors
|   |   |-- ln-641 through ln-646
|   |-- ln-650-persistence-performance-auditor/ # DB performance + 3 sub-auditors
|   |   |-- ln-651 through ln-653
|
|  └──────────────────────────────────────────────┘
|
|-- hooks/                             # AUTOMATED VALIDATION HOOKS
|-- shared/css/diagram.css             # Universal diagram styles
|-- docs/SKILL_ARCHITECTURE_GUIDE.md   # Orchestrator-Worker Pattern (L0-L3)
|-- CLAUDE.md                          # Full documentation
```

---

## What Was Removed (52 skills)

| Category | Skills | Why |
|----------|--------|-----|
| **Planning** (7) | ln-200 through ln-230 | Epic/Story decomposition overkill for 2 people |
| **Task Management** (5) | ln-300 through ln-311 | 22-criteria validation, task factories unnecessary |
| **Orchestrators** (8) | ln-400, ln-403, ln-500, ln-520-523, ln-1000 | Pipeline orchestration, rework loops, test planning |
| **Bootstrap** (32) | ln-700 through ln-783 | Project scaffolding (entire plugin) |

---

## Installation

```bash
# As a plugin (from your fork)
/plugin add Zoned-Labs/claude-code-skills
```

---

## Quick Start

**Without Linear** (works immediately):
```bash
ln-620-codebase-auditor    # Audit your code for issues
ln-100-documents-pipeline  # Generate documentation
```

**With Linear** (task workflow):
```bash
ln-401-task-executor       # Execute a task
ln-402-task-reviewer       # Review completed task
ln-510-quality-coordinator # Run quality checks
```

---

## Workflow

```
ln-100-documents-pipeline  # 1. Documentation
         ↓
Create tasks in Linear     # 2. Manual or AI-assisted
         ↓
ln-401-task-executor       # 3. Execute task
         ↓
ln-402-task-reviewer       # 4. Review → Done or Rework
         ↓
ln-510-quality-coordinator # 5. Quality gate (standalone verdict)
```

---

## Hooks (Optional)

| Hook | Trigger | Action |
|------|---------|--------|
| **secret-scanner** | `git commit` | Blocks commits containing secrets |
| **story-validator** | `ln-401` prompt | Validates Story before execution |
| **code-quality** | After Edit/Write | Reports DRY/KISS/YAGNI violations |

See [hooks/README.md](hooks/README.md).

---

## MCP Servers (Optional)

| Server | Purpose | Used by |
|--------|---------|---------|
| **[Context7](https://github.com/upstash/context7)** | Library docs, APIs | ln-001, ln-002, ln-511, ln-640+ |
| **[Ref](https://docs.ref.tools/install)** | Standards, RFCs, best practices | ln-001, ln-002, ln-511, ln-640+ |
| **[Linear](https://linear.app/docs/mcp)** | Issue tracking | ln-401, ln-402, ln-510+ |

---

## Upstream

This is a permanent fork. Cherry-pick useful upstream changes rather than merge.

- **Upstream:** [levnikolaevich/claude-code-skills](https://github.com/levnikolaevich/claude-code-skills)
- **What changed:** See [CHANGELOG.md](CHANGELOG.md) entry for 2026-03-01

---

**Fork maintainer:** [Zoned Labs](https://github.com/Zoned-Labs) · **License:** MIT · **Upstream author:** [@levnikolaevich](https://github.com/levnikolaevich)

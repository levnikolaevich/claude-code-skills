# Claude Code Skills

![Version](https://img.shields.io/badge/version-2026.04.05-blue)
![Skills](https://img.shields.io/badge/skills-129-green)
![License](https://img.shields.io/badge/license-MIT-green)
[![GitHub stars](https://img.shields.io/github/stars/levnikolaevich/claude-code-skills?style=social)](https://github.com/levnikolaevich/claude-code-skills)

> **7 plugins. One marketplace.** Install only what you need and automate your full delivery workflow —
> from project bootstrap to code audit to production quality gates.
> Works standalone or as a complete Agile pipeline.

> [!TIP]
> **Multi-Model AI Review** — Delegate code & story reviews to Codex and Gemini agents running in parallel, with automatic fallback to Claude Opus. Ship faster with 3x review coverage.

[Plugins](#plugins) · [Installation](#installation) · [Quick Start](#quick-start) · [Workflow](#workflow) · [MCP](#mcp-servers-optional) · [AI Review](#ai-review-models-optional) · [FAQ](#faq) · [Full Skill Tree](#whats-inside) · [Links](#links)

---

## Plugins

Add the marketplace once, then install only the plugins you need. Each works independently.

```bash
# Add the marketplace once
/plugin marketplace add levnikolaevich/claude-code-skills

# Install any plugin you need
/plugin install agile-workflow@levnikolaevich-skills-marketplace
/plugin install documentation-pipeline@levnikolaevich-skills-marketplace
/plugin install codebase-audit-suite@levnikolaevich-skills-marketplace
/plugin install project-bootstrap@levnikolaevich-skills-marketplace
/plugin install optimization-suite@levnikolaevich-skills-marketplace
/plugin install community-engagement@levnikolaevich-skills-marketplace
/plugin install setup-environment@levnikolaevich-skills-marketplace
```

| Plugin | Description |
|--------|-------------|
| **agile-workflow** | Scope decomposition, Story/Task management, Execution, Quality gates, Orchestration |
| **documentation-pipeline** | Full project docs pipeline with auto-detection (backend/frontend/devops) |
| **codebase-audit-suite** | Documentation, Security, Build, Code quality, Tests, Architecture, Performance |
| **project-bootstrap** | CREATE or TRANSFORM projects to production-ready Clean Architecture |
| **optimization-suite** | Performance optimization, Dependency upgrades, Code modernization |
| **community-engagement** | GitHub community management: triage, announcements, RFCs, responses |
| **setup-environment** | Install CLI agents, configure MCP servers, sync settings, audit instruction files |

Browse and discover individual skills at [skills.sh](https://skills.sh/LevNikolaevich/claude-code-skills).

> [!NOTE]
> **skills.sh is a showcase only.** Skills depend on shared resources (`shared/` directory) that are not copied by `npx skills add`. Use `/plugin marketplace add` and `/plugin install` for a working installation.

---

## Installation

**Prerequisites:** [Claude Code](https://docs.anthropic.com/en/docs/claude-code)

```bash
/plugin marketplace add levnikolaevich/claude-code-skills
/plugin install setup-environment@levnikolaevich-skills-marketplace
```

Verify: run `ln-010-dev-environment-setup`

---

## Quick Start

**Standalone** (works immediately, no setup):
```bash
ln-010-dev-environment-setup  # Set up agents, MCP, sync configs
ln-620-codebase-auditor       # Audit your code for issues
ln-100-documents-pipeline     # Generate documentation
```

**Full Agile workflow** (Linear or File Mode — auto-detected):
```bash
ln-200-scope-decomposer    # Scope -> Epics -> Stories
ln-1000-pipeline-orchestrator  # Artifact-driven pipeline: tasks → validation → execution → quality gate
```

**Manual step-by-step** (if you prefer control over each stage):
```bash
ln-400-story-executor      # Execute Story tasks
ln-500-story-quality-gate  # Quality gate + test planning
```

---

## Workflow

```
ln-010-dev-environment-setup    # 0. Set up dev environment (once)
         ↓
ln-100-documents-pipeline       # 1. Documentation
         ↓
ln-200-scope-decomposer         # 2. Scope -> Epics -> Stories
         ↓
ln-1000-pipeline-orchestrator   # 3. Full artifact-driven pipeline: 300 → 310 → 400 → 500 → Done
```

---

## MCP Servers (Optional)

Bundled MCP servers extend agent capabilities — hash-verified editing, code intelligence, and remote access. All skills work without MCP (fallback to built-in tools), but MCP servers improve accuracy and save tokens.

### Bundled servers

| Server | What it does | Tools | Docs |
|--------|-------------|-------|------|
| **[hex-line-mcp](mcp/hex-line-mcp/)** | Every line carries a content hash — edits prove the agent sees current content. Prevents stale-context corruption. Includes validation hooks. | 9 | [README](mcp/hex-line-mcp/README.md) · [npm](https://www.npmjs.com/package/@levnikolaevich/hex-line-mcp) |
| **[hex-graph-mcp](mcp/hex-graph-mcp/)** | Indexes codebases into a deterministic SQLite graph with framework-aware overlays, capability-first quality tooling, optional SCIP interop, and architecture/reference analysis. | 14 | [README](mcp/hex-graph-mcp/README.md) · [npm](https://www.npmjs.com/package/@levnikolaevich/hex-graph-mcp) |
| **[hex-ssh-mcp](mcp/hex-ssh-mcp/)** | Hash-verified remote file editing and SFTP transfer over SSH. Normalized output for minimal token usage. | 8 | [README](mcp/hex-ssh-mcp/README.md) · [npm](https://www.npmjs.com/package/@levnikolaevich/hex-ssh-mcp) |

Deterministic scope rule: `hex-line` and `hex-graph` keep `path` as the project anchor. In normal use the agent fills it automatically from the active file or project root, so users usually do not need to type it manually. `hex-ssh` runs on Windows/macOS/Linux hosts; remote shell tools stay POSIX-oriented, while SFTP transfers support platform-aware remote paths.

<!-- GENERATED:HEX_GRAPH_MCP_STATUS:START -->
`hex-graph-mcp` quality snapshot: `90/90` tests passing, `1` curated corpus, `1` pinned external corpora, parser-first `green`.
<!-- GENERATED:HEX_GRAPH_MCP_STATUS:END -->

### External servers

| Server | Purpose | API Key | Used by |
|--------|---------|---------|---------|
| **[Context7](https://context7.com)** | Library docs, APIs, migration guides | Optional ([dashboard](https://context7.com/dashboard)) | ln-310, ln-511, ln-640+ |
| **[Ref](https://docs.ref.tools/install)** | Standards, RFCs, best practices | Required ([ref.tools/keys](https://ref.tools/keys)) | ln-310, ln-511, ln-640+ |
| **[Linear](https://linear.app/docs/mcp)** | Issue tracking (Agile workflow) | OAuth via browser | ln-300+, ln-400+, ln-500+ |

**CLI setup:**
```bash
# hex-line — hash-verified file editing (bundled)
npm i -g @levnikolaevich/hex-line-mcp
claude mcp add -s user hex-line -- hex-line-mcp

# hex-ssh — token-efficient SSH with hash verification (bundled)
npm i -g @levnikolaevich/hex-ssh-mcp
claude mcp add -s user hex-ssh -- hex-ssh-mcp

# hex-graph — code knowledge graph (bundled)
npm i -g @levnikolaevich/hex-graph-mcp
claude mcp add -s user hex-graph -- hex-graph-mcp

# Context7 — library documentation (HTTP, optional API key)
claude mcp add -s user --transport http --header "CONTEXT7_API_KEY: YOUR_KEY" context7 https://mcp.context7.com/mcp

# Ref — standards & best practices (HTTP, API key required)
claude mcp add -s user --transport http --header "x-ref-api-key: YOUR_KEY" Ref https://api.ref.tools/mcp

# Linear — issue tracking (HTTP, OAuth via browser)
claude mcp add -s user --transport http linear-server https://mcp.linear.app/mcp
```


### Agent steering

MCP servers can be installed correctly and still lose to built-ins in practice. `hex-line-mcp` keeps Claude aligned through one output style and three Claude hook events:

| Mechanism | How it works |
|-----------|-------------|
| **[Output style](mcp/hex-line-mcp/output-style.md)** | Injected into system prompt — maps built-in tools to MCP equivalents (`Read` → `hex-line read_file`, `Edit` → `hex-line edit_file`) |
| **SessionStart hook** | Injects a compact bootstrap hint and defers to the active `hex-line` output style when present |
| **PreToolUse hook** | Advises small `Read`/`Edit`, redirects heavier `Read`/`Edit` plus `Write`/`Grep`, selectively redirects simple Bash, blocks dangerous commands |
| **PostToolUse hook** | Filters only verbose Bash output (50+ lines), keeping first 15 + last 15 lines after normalization and dedupe |

Hooks and output style auto-sync on `hex-line-mcp` startup. First run after install performs the initial sync automatically.

---

## AI Review Models (Optional)

Multi-model review uses external AI agents (Codex + Gemini) for parallel code/story analysis. Both agents run simultaneously with automatic fallback to Claude Opus if unavailable.

| Model | CLI | Version | Used by | Settings |
|-------|-----|---------|---------|----------|
| **[Codex](https://github.com/anthropics/codex-cli)** | `codex` | gpt-5.4 | ln-310, ln-510, ln-813 | `--json --full-auto` (read-only, internet access) |
| **[Gemini](https://github.com/google/gemini-cli)** | `gemini` | Auto (Gemini 3) | ln-310, ln-510, ln-813 | `--yolo` (sandbox, auto-approve, auto model selection) |

**Review Workflow:**
1. **Parallel Execution** — Both agents run simultaneously (background tasks)
2. **Critical Verification** — Claude validates each suggestion (AGREE/DISAGREE/UNCERTAIN)
3. **Debate Protocol** — Challenge rounds (max 2) for controversial findings
4. **Filtering** — Only high-confidence (≥90%), high-impact (>2%) suggestions surface
5. **Fallback** — Self-Review (Claude Opus) if agents unavailable

**Installation:**
```bash
# Codex (OpenAI)
npm install -g @anthropic/codex-cli
codex login

# Gemini (Google)
npm install -g @google/gemini-cli
gemini auth login
```

**Configuration:**
Review agents auto-configure via `shared/agents/agent_registry.json`. No manual setup required.

**Audit Trail:**
All prompts/results saved to `.agent-review/{agent}/` for transparency:
```
.agent-review/
├── codex/
│   ├── PROJ-123_storyreview_prompt.md
│   ├── PROJ-123_storyreview_result.md
│   └── PROJ-123_session.json
└── gemini/
    └── (same structure)
```

<details>
<summary><b>Skills using external AI review</b></summary>

- **ln-310-multi-agent-validator** — Story/Tasks validation with inline agent review (Codex + Gemini)
- **ln-510-quality-coordinator** — Code implementation review with inline agent review (Codex + Gemini)
- **ln-813-optimization-plan-validator** — Optimization plan review before strike execution (Codex + Gemini)

All skills support:
- Session Resume for multi-round debates
- Zero timeout (wait for completion)
- Read-only analysis (no project modifications)
- Internet access for research

</details>

<details>
<summary><b>Sharing skills & MCP between agents</b></summary>

**Share skills** — symlink/junction plugin directory:

| OS | Command |
|----|---------|
| Windows (PowerShell) | `New-Item -ItemType Junction -Path "C:\Users\<USER>\.gemini\skills" -Target "<PLUGIN_DIR>"` |
| Windows (CMD) | `mklink /J "C:\Users\<USER>\.gemini\skills" "<PLUGIN_DIR>"` |
| macOS / Linux | `ln -s ~/.claude/plugins/<PLUGIN_DIR> ~/.gemini/skills` |

Same for `.codex/skills`. Or use **ln-013-config-syncer** to automate symlinks + MCP sync.

**MCP settings locations** (for manual sharing):

| Agent | Config File | Format | Docs |
|-------|------------|--------|------|
| **Claude Code** | `~/.claude/settings.json` | JSON (`mcpServers: {}`) | [docs](https://docs.anthropic.com/en/docs/claude-code) |
| **Gemini CLI** | `~/.gemini/settings.json` | JSON (`mcpServers: {}`) | [docs](https://github.com/google/gemini-cli) |
| **Codex CLI** | `~/.codex/config.toml` | TOML (`[mcp_servers.name]`) | [docs](https://developers.openai.com/codex/mcp) |

**Note:** Claude and Gemini use identical JSON format for `mcpServers` — copy the block directly. Codex uses TOML — convert manually.

</details>

---

## FAQ

<details>
<summary><b>What is Claude Code Skills?</b></summary>

A plugin for [Claude Code](https://claude.ai/code) that provides production-ready skills automating the full Agile development lifecycle — from project bootstrap and documentation through scope decomposition, task execution, quality gates, and comprehensive code audits.

</details>

<details>
<summary><b>How does it automate the Agile workflow?</b></summary>

Skills form a complete pipeline: `ln-700` bootstraps the project → `ln-100` generates documentation → `ln-200` decomposes scope into Epics and Stories → `ln-1000` drives `ln-300 -> ln-310 -> ln-400 -> ln-500` through coordinator stage artifacts. Task-plan, execution, quality, and test-planning workers are stateful and resumable, while coordinators make decisions only from machine-readable artifacts.

</details>

<details>
<summary><b>Does it require Linear or any external dependencies?</b></summary>

No. All skills work without Linear or any external tools. Linear integration is optional — when unavailable, skills fallback to a standalone flow using local markdown files (`kanban_board.md`) as the task management backend. No API keys, no paid services required.

</details>

<details>
<summary><b>What AI models does it use?</b></summary>

Claude Opus is the primary model. For code and story reviews, skills delegate to external agents (OpenAI Codex, Google Gemini) for parallel multi-model review with automatic fallback to Claude Opus if external agents are unavailable.

</details>

<details>
<summary><b>How do I install it?</b></summary>

```bash
# Add the marketplace once
/plugin marketplace add levnikolaevich/claude-code-skills

# Install one plugin
/plugin install agile-workflow@levnikolaevich-skills-marketplace

# Or install the full suite
/plugin install agile-workflow@levnikolaevich-skills-marketplace
/plugin install documentation-pipeline@levnikolaevich-skills-marketplace
/plugin install codebase-audit-suite@levnikolaevich-skills-marketplace
/plugin install project-bootstrap@levnikolaevich-skills-marketplace
/plugin install optimization-suite@levnikolaevich-skills-marketplace
/plugin install community-engagement@levnikolaevich-skills-marketplace
/plugin install setup-environment@levnikolaevich-skills-marketplace
```

</details>

<details>
<summary><b>Which plugin do I need?</b></summary>

| If you want to... | Install |
|---|---|
| Run full Agile pipeline (plan → execute → review) | `agile-workflow` |
| Generate project documentation | `documentation-pipeline` |
| Audit existing code for issues | `codebase-audit-suite` |
| Scaffold a new project or restructure existing | `project-bootstrap` |
| Optimize performance, dependencies, bundle size | `optimization-suite` |
| Manage GitHub community (triage, announcements, RFCs) | `community-engagement` |
| Set up multi-agent dev environment | `setup-environment` |
| Everything | `/plugin marketplace add levnikolaevich/claude-code-skills` + all 7 `/plugin install ...@levnikolaevich-skills-marketplace` commands |

Add the marketplace once, then install only what you need.

</details>

<details>
<summary><b>Can I run individual skills without the full pipeline?</b></summary>

Yes. Most skills work standalone — just invoke them directly (e.g., `/ln-620-codebase-auditor` for a full code audit). Pipeline orchestrators (`ln-1000`, `ln-400`, `ln-510`, `ln-520`) coordinate other skills but are not required, and their workers remain standalone-capable. In managed runs, coordinators pass deterministic `runId` and exact `summaryArtifactPath`; in standalone runs, workers create their own runtime state and summary path.

</details>

<details>
<summary><b>Can I use it on an existing project?</b></summary>

Yes. `ln-700-project-bootstrap` has a TRANSFORM mode that restructures existing projects to Clean Architecture without starting from scratch. Audit skills (`ln-6XX`) work standalone on any codebase — no setup required.

</details>

<details>
<summary><b>How does it handle "almost right" AI-generated code?</b></summary>

Through automated review loops. `ln-402-task-reviewer` checks every task output, `ln-403-task-rework` fixes issues and resubmits for review, and `ln-500-story-quality-gate` runs a 4-level gate (PASS/CONCERNS/REWORK/FAIL) before any Story is marked Done. Code is never shipped without passing quality checks.

</details>

<details>
<summary><b>Does it replace human code review?</b></summary>

No — it augments human review. Multi-model cross-checking (Claude + Codex + Gemini) catches issues before human reviewers see the code. Human approval points are built into the workflow at Story validation (`ln-310`) and quality gates (`ln-500`). The goal is to reduce reviewer burden, not eliminate oversight.

</details>

<details>
<summary><b>How does it maintain context across large codebases?</b></summary>

Through the Orchestrator-Worker pattern plus persisted runtime state. Instead of feeding the entire codebase into one prompt, orchestrators advance stages from coordinator artifacts, coordinators consume worker artifacts, and workers execute with minimal, targeted context. Each layer loads only the files it needs and can resume from checkpoints instead of replaying long chat history.

</details>

<details>
<summary><b>What can the audit skills detect?</b></summary>

Audit skills in 5 groups: documentation quality (structure, semantics, fact-checking, inline code documentation), codebase health (security, build, DRY/KISS/YAGNI, complexity, dependencies, dead code, observability, concurrency, lifecycle), test suites (business logic, E2E coverage, value scoring, coverage gaps, isolation), architecture (patterns, layer boundaries, API contracts, dependency graphs, OSS replacements, project structure, env configuration), and persistence performance (query efficiency, transactions, runtime, resource lifecycle).

</details>

<details>
<summary><b>How is it different from custom prompts or slash commands?</b></summary>

Custom prompts are ad-hoc and context-free. Claude Code Skills provides coordinated skills with an [Orchestrator-Worker architecture](docs/architecture/SKILL_ARCHITECTURE_GUIDE.md) — L0 meta-orchestrator drives L1 coordinators via sequential Skill() calls, which delegate to L2 coordinators and L3 workers, each with single responsibility and token-efficient context loading. Skills build on each other's outputs across the full lifecycle.

</details>

<details>
<summary><b>What is the Orchestrator-Worker pattern?</b></summary>

A 4-level hierarchy: L0 orchestrator (`ln-1000-pipeline-orchestrator`) advances the pipeline from coordinator stage artifacts, L1 coordinators (for example `ln-300`, `ln-400`, `ln-510`, `ln-520`) manage one domain workflow, and L3 workers execute bounded responsibilities with their own runtime state. Dependency direction stays one-way: orchestrators know coordinator artifacts, coordinators know worker artifacts, and workers do not know their parent hierarchy. See [SKILL_ARCHITECTURE_GUIDE.md](docs/architecture/SKILL_ARCHITECTURE_GUIDE.md).

</details>

<details>
<summary><b>Can it catch technical debt from AI-generated code?</b></summary>

Yes. Audit skills specifically target AI-induced tech debt: `ln-623` checks DRY/KISS/YAGNI violations, `ln-626` finds dead code and unused imports, `ln-640` audits architectural pattern evolution, `ln-644` detects dependency cycles and coupling metrics, `ln-645` finds custom code that can be replaced by battle-tested open-source packages, and `ln-646` validates project structure against framework-specific conventions. Run `ln-620-codebase-auditor` to scan all 9 categories in parallel.

</details>

<details>
<summary><b>How does it handle multi-stack or polyglot projects?</b></summary>

Bootstrap skills (`ln-7XX`) support React, .NET, and Python project structures. Audit skills are language-aware — `ln-622-build-auditor` checks compiler/type errors across stacks, `ln-625-dependencies-auditor` scans npm, NuGet, and pip packages, and `ln-651-query-efficiency-auditor` catches N+1 queries regardless of ORM.

</details>

<details>
<summary><b>Can I share these skills with Gemini CLI or OpenAI Codex?</b></summary>

Yes — create symlinks/junctions to the plugin directory, or use `ln-013-config-syncer` to automate it. See [AI Review Models > Sharing skills & MCP between agents](#ai-review-models-optional) for commands and MCP config paths.

</details>

---

## What's Inside

<details>
<summary><b>Full Skill Tree (129 skills)</b></summary>

```
claude-code-skills/                      # MARKETPLACE
|-- skills-catalog/                              # ALL SKILLS + SHARED
|   |-- shared/                          # References, templates, agents
|   |
|   |  ┌─ Plugin: agile-workflow ──────────────────────┐
|   |
|   |-- ln-2XX-*/                        # PLANNING
|   |-- ln-200-scope-decomposer/       # TOP: scope -> Epics -> Stories (one command)
|   |-- ln-201-opportunity-discoverer/ # Traffic-First KILL funnel for growth direction
|   |-- ln-210-epic-coordinator/       # CREATE/REPLAN 3-7 Epics
|   |-- ln-220-story-coordinator/      # CREATE/REPLAN Stories + standards research
|   |   |-- ln-221-story-creator/      # Creates from IDEAL plan
|   |   |-- ln-222-story-replanner/    # Replans when requirements change
|   |-- ln-230-story-prioritizer/      # RICE prioritization + market research
|
|-- ln-3XX-*/                          # TASK MANAGEMENT
|   |-- ln-300-task-coordinator/       # Artifact-first task planning coordinator
|   |   |-- ln-301-task-creator/       # Stateful task-plan worker (create)
|   |   |-- ln-302-task-replanner/     # Stateful task-plan worker (replan)
|   |-- ln-310-multi-agent-validator/   # 20 criteria (8 groups), penalty points system + inline agent review
|
|-- ln-4XX-*/                          # EXECUTION
|   |-- ln-400-story-executor/         # Artifact-first execution coordinator
|   |-- ln-401-task-executor/          # Stateful implementation worker
|   |-- ln-402-task-reviewer/          # Stateful review worker and final task outcome
|   |-- ln-403-task-rework/            # Stateful rework worker
|   |-- ln-404-test-executor/          # Stateful test execution worker
|
|-- ln-5XX-*/                          # QUALITY
|   |-- ln-500-story-quality-gate/     # Thin orchestrator: verdict + Quality Score
|   |-- ln-510-quality-coordinator/    # Artifact-first quality coordinator
|   |   |-- ln-511-code-quality-checker/  # Stateful quality worker
|   |   |-- ln-512-tech-debt-cleaner/    # Stateful autofix worker
|   |   |-- ln-513-regression-checker/    # Stateful regression worker
|   |   |-- ln-514-test-log-analyzer/    # Stateful log-analysis worker
|   |-- ln-520-test-planner/           # Artifact-first test-planning coordinator
|   |   |-- ln-521-test-researcher/    # Stateful research worker
|   |   |-- ln-522-manual-tester/      # Stateful manual-testing worker
|   |   |-- ln-523-auto-test-planner/  # Stateful automated test-planning worker
|
|-- ln-10XX-*/                           # ORCHESTRATION
|   |-- ln-1000-pipeline-orchestrator/   # L0 Meta: coordinator artifacts drive the 4-stage pipeline
|
|  └──────────────────────────────────────────────┘
|  ┌─ Plugin: documentation-pipeline ──────────────┐
|
|-- ln-1XX-*/                          # DOCUMENTATION
|   |-- ln-100-documents-pipeline/     # L1 Orchestrator: complete docs in one command
|   |-- ln-110-project-docs-coordinator/  # Detects project type, delegates to workers
|   |   |-- ln-111-root-docs-creator/     # AGENTS.md, CLAUDE.md, principles.md
|   |   |-- ln-112-project-core-creator/  # requirements.md, architecture.md
|   |   |-- ln-113-backend-docs-creator/  # api_spec.md, database_schema.md
|   |   |-- ln-114-frontend-docs-creator/ # design_guidelines.md
|   |   |-- ln-115-devops-docs-creator/   # infrastructure.md, runbook.md
|   |-- ln-120-reference-docs-creator/    # ADRs, guides, manuals structure
|   |-- ln-130-tasks-docs-creator/        # kanban_board.md, task provider setup
|   |-- ln-140-test-docs-creator/         # testing-strategy.md
|   |-- ln-160-docs-skill-extractor/     # Scan docs, classify, extract to .claude/commands
|   |   |-- ln-161-skill-creator/        # Transform doc sections into commands
|   |   |-- ln-162-skill-reviewer/       # Review SKILL.md and .claude/commands quality
|
|  └──────────────────────────────────────────────┘
|  ┌─ Plugin: codebase-audit-suite ────────────────┐
|
|-- ln-6XX-*/                          # AUDIT
|   |-- ln-610-docs-auditor/           # Documentation audit coordinator (4 workers)
|   |   |-- ln-611-docs-structure-auditor/  # Hierarchy, SSOT, compression, freshness
|   |   |-- ln-612-semantic-content-auditor/ # Scope alignment
|   |   |-- ln-613-code-comments-auditor/   # WHY-not-WHAT, density, docstrings
|   |   |-- ln-614-docs-fact-checker/       # Claims extraction, cross-doc verification
|   |-- ln-620-codebase-auditor/       # 9 parallel auditors:
|   |   |-- ln-621-security-auditor/      # Secrets, SQL injection, XSS
|   |   |-- ln-622-build-auditor/         # Compiler/type errors
|   |   |-- ln-623-code-principles-auditor/# DRY/KISS/YAGNI, TODOs, DI
|   |   |-- ln-624-code-quality-auditor/  # Complexity, magic numbers
|   |   |-- ln-625-dependencies-auditor/  # Outdated packages + CVE vulnerabilities
|   |   |-- ln-626-dead-code-auditor/     # Unused code
|   |   |-- ln-627-observability-auditor/ # Logging, metrics
|   |   |-- ln-628-concurrency-auditor/   # Race conditions
|   |   |-- ln-629-lifecycle-auditor/     # Bootstrap, shutdown
|   |-- ln-630-test-auditor/           # 7 test auditors:
|   |   |-- ln-631-test-business-logic-auditor/ # Framework vs business logic tests
|   |   |-- ln-632-test-e2e-priority-auditor/   # E2E coverage for critical paths
|   |   |-- ln-633-test-value-auditor/          # Risk-based test value scoring
|   |   |-- ln-634-test-coverage-auditor/       # Missing tests for critical paths
|   |   |-- ln-635-test-isolation-auditor/      # Isolation + anti-patterns
|   |   |-- ln-636-manual-test-auditor/        # Manual test quality (harness, golden files, fail-fast)
|   |   |-- ln-637-test-structure-auditor/      # Test file organization + directory layout
|   |-- ln-640-pattern-evolution-auditor/ # Architectural pattern analysis + 4-score model
|   |   |-- ln-641-pattern-analyzer/      # Pattern scoring worker
|   |   |-- ln-642-layer-boundary-auditor/# Layer violations, I/O isolation
|   |   |-- ln-643-api-contract-auditor/  # Layer leakage, missing DTOs
|   |   |-- ln-644-dependency-graph-auditor/ # Cycles, coupling metrics (Ca/Ce/I)
|   |   |-- ln-645-open-source-replacer/ # Goal-based OSS replacement audit + migration plan
|   |   |-- ln-646-project-structure-auditor/ # Physical structure audit with framework-specific rules
|   |   |-- ln-647-env-config-auditor/ # Env var config, sync, naming, startup validation
|   |-- ln-650-persistence-performance-auditor/ # DB performance coordinator:
|   |   |-- ln-651-query-efficiency-auditor/    # N+1, over-fetching, missing bulk ops
|   |   |-- ln-652-transaction-correctness-auditor/ # Scope, rollback, long-held txns
|   |   |-- ln-653-runtime-performance-auditor/ # Blocking IO, allocations, sync sleep
|   |   |-- ln-654-resource-lifecycle-auditor/  # Session scope mismatch, pool config, cleanup
|
|  └──────────────────────────────────────────────┘
|  ┌─ Plugin: project-bootstrap ───────────────────┐
|
|-- ln-7XX-*/                          # BOOTSTRAP
|   |-- ln-700-project-bootstrap/      # L1: CREATE or TRANSFORM project
|   |-- ln-720-structure-migrator/     # SCAFFOLD or RESTRUCTURE to Clean Architecture
|   |   |-- ln-721-frontend-restructure/ # React component-based architecture
|   |   |-- ln-722-backend-generator/    # .NET Clean Architecture from entities
|   |   |-- ln-723-seed-data-generator/  # Generate seed data from ORM schemas
|   |   |-- ln-724-artifact-cleaner/     # Remove platform-specific artifacts
|   |-- ln-730-devops-setup/           # Docker, CI/CD, env
|   |   |-- ln-731-docker-generator/      # Dockerfiles, docker-compose
|   |   |-- ln-732-cicd-generator/        # GitHub Actions
|   |   |-- ln-733-env-configurator/      # .env.example
|   |-- ln-740-quality-setup/          # Linters, pre-commit, tests
|   |   |-- ln-741-linter-configurator/  # ESLint, Prettier, Ruff, mypy
|   |   |-- ln-742-precommit-setup/      # Husky, lint-staged, commitlint
|   |   |-- ln-743-test-infrastructure/  # Vitest, xUnit, pytest setup
|   |-- ln-760-security-setup/         # Security scanning
|   |   |-- ln-761-secret-scanner/       # Detect hardcoded secrets
|   |-- ln-770-crosscutting-setup/     # Logging, CORS, health checks
|   |   |-- ln-771-logging-configurator/ # Structured JSON logging
|   |   |-- ln-772-error-handler-setup/  # Global exception middleware
|   |   |-- ln-773-cors-configurator/    # CORS policy config
|   |   |-- ln-774-healthcheck-setup/    # K8s readiness/liveness probes
|   |   |-- ln-775-api-docs-generator/   # Swagger/OpenAPI docs
|   |-- ln-780-bootstrap-verifier/     # Build, test, Docker verification
|   |   |-- ln-781-build-verifier/       # Verify compilation
|   |   |-- ln-782-test-runner/          # Run test suites
|   |   |-- ln-783-container-launcher/   # Docker health check
|
|  └──────────────────────────────────────────────┘
|  ┌─ Plugin: optimization-suite ──────────────────┐
|
|-- ln-8XX-*/                          # OPTIMIZATION
|   |-- ln-810-performance-optimizer/       # Performance optimization:
|   |   |-- ln-811-performance-profiler/     # Full-stack request tracing, bottleneck classification
|   |   |-- ln-812-optimization-researcher/  # Competitive benchmarks, solution research, hypotheses
|   |   |-- ln-813-optimization-plan-validator/ # Agent-validated plan review (Codex + Gemini)
|   |   |-- ln-814-optimization-executor/    # Strike-first hypothesis execution (keep/discard)
|   |-- ln-820-dependency-optimization-coordinator/  # Dependency upgrades:
|   |   |-- ln-821-npm-upgrader/             # npm/yarn/pnpm with breaking change handling
|   |   |-- ln-822-nuget-upgrader/           # .NET NuGet with migration support
|   |   |-- ln-823-pip-upgrader/             # pip/poetry/pipenv with security audit
|   |-- ln-830-code-modernization-coordinator/       # Code modernization:
|   |   |-- ln-831-oss-replacer/             # Replace custom code with OSS packages
|   |   |-- ln-832-bundle-optimizer/         # JS/TS bundle size reduction
|   |-- ln-840-benchmark-compare/           # A/B comparison: built-in vs hex-line tools
|
|  └──────────────────────────────────────────────┘
|  ┌─ Plugin: community-engagement ───────────────┐
|
|-- ln-9XX-*/                          # COMMUNITY ENGAGEMENT
|   |-- ln-910-community-engagement/   # L2: Analyze health, consult strategy, delegate
|   |-- ln-911-github-triager/         # Triage issues/PRs/discussions
|   |-- ln-912-community-announcer/    # Compose + publish GitHub Discussion announcements
|   |-- ln-913-community-debater/      # Launch RFC/debate/poll discussions
|   |-- ln-914-community-responder/    # Respond to unanswered discussions/issues
|
|  └──────────────────────────────────────────────┘
|  ┌─ Plugin: setup-environment ──────────────────────┐
|
|-- ln-001-push-all/                   # Commit and push all changes in one command
|-- ln-002-session-analyzer/           # Analyze sessions for optimization opportunities
|-- ln-0XX-*/                          # SETUP ENVIRONMENT
|   |-- ln-010-dev-environment-setup/  # L2: Full environment setup coordinator
|   |-- ln-011-agent-installer/        # Install/update Codex, Gemini & Claude CLI
|   |-- ln-012-mcp-configurator/       # MCP server setup & budget analysis
|   |-- ln-013-config-syncer/          # Sync settings to Gemini/Codex
|   |-- ln-014-agent-instructions-manager/ # Create + audit CLAUDE.md/AGENTS.md/GEMINI.md
|   |-- ln-015-hex-line-uninstaller/   # Remove hex-line hooks and output style from system
|-- ln-020-codegraph/                  # Code knowledge graph for dependency analysis & impact checking
|
|  └──────────────────────────────────────────────┘
|
|
|-- docs/
|   |-- architecture/                  # Skill patterns & delegation runtime
|   |-- best-practice/                 # Claude Code usage tips & component selection
|   |-- standards/                     # Documentation & README standards
|-- AGENTS.md                          # Canonical agent-facing repo map
|-- CLAUDE.md                          # Thin Anthropic compatibility shim
```

</details>

---

## Links

| | |
|---|---|
| **Documentation** | [AGENTS.md](AGENTS.md) |
| **Architecture** | [SKILL_ARCHITECTURE_GUIDE.md](docs/architecture/SKILL_ARCHITECTURE_GUIDE.md) |
| **Agent Delegation** | [AGENT_DELEGATION_PLATFORM_GUIDE.md](docs/architecture/AGENT_DELEGATION_PLATFORM_GUIDE.md) |
| **Component Selection** | [COMPONENT_SELECTION.md](docs/best-practice/COMPONENT_SELECTION.md) |
| **Workflow Tips** | [WORKFLOW_TIPS.md](docs/best-practice/WORKFLOW_TIPS.md) |
| **Discussions** | [GitHub Discussions](https://github.com/levnikolaevich/claude-code-skills/discussions) |
| **Issues** | [GitHub Issues](https://github.com/levnikolaevich/claude-code-skills/issues) |
| **Contributing** | [CONTRIBUTING.md](CONTRIBUTING.md) |
| **Browse Skills** | [skills.sh](https://skills.sh/LevNikolaevich/claude-code-skills) |

<details>
<summary><b>Research & Influences</b></summary>

Papers, docs, and methodologies studied and implemented in the skill architecture.

| Source | Learned | Changed |
|--------|---------|---------|
| [STAR Framework](https://arxiv.org/abs/2602.21814) (2025) | Forced goal articulation: +85pp accuracy; structured reasoning > context injection 2.83x | [`goal_articulation_gate.md`](skills-catalog/shared/references/goal_articulation_gate.md) — 4-question gate in 6 skills + 6 templates |
| [Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) (Anthropic, 2024) | Orchestrator-Worker, prompt chaining, evaluator-optimizer patterns | Core 4-level hierarchy (L0→L3), single responsibility per skill |
| [Multi-Agent Research System](https://www.anthropic.com/engineering/multi-agent-research-system) (Anthropic, 2025) | Production orchestration: 90.2% perf improvement with specialized agents | `ln-1000` pipeline orchestrator, parallel agent reviews (`ln-310`, `ln-510`) |
| [Scheduler Agent Supervisor](https://learn.microsoft.com/azure/architecture/patterns/scheduler-agent-supervisor) (Microsoft) | Separation of scheduling, execution, and supervision | `ln-400`/`ln-402`/`ln-500` executor-reviewer-gate split |
| [DIATAXIS](https://diataxis.fr) | 4-type docs: Tutorial / How-to / Reference / Explanation | Documentation levels in AGENTS.md/docs, progressive disclosure |
| [Sinks, Not Pipes](https://ianbull.com/posts/software-architecture) (Ian Bull, 2026) | "The architecture is the prompt" — AI agents can't reason about side-effect chains >2 levels deep; sinks (self-contained) > pipes (cascading) | [`ai_ready_architecture.md`](skills-catalog/shared/references/ai_ready_architecture.md) — cascade depth, architectural honesty, flat orchestration checks across 12 skills |
| [Test Desiderata](https://testdesiderata.com/) (Kent Beck, 2019) | 12 properties of valuable tests — behavioral, predictive, specific, inspiring, deterministic... No numerical targets, only usefulness | [`risk_based_testing_guide.md`](skills-catalog/shared/references/risk_based_testing_guide.md) — 6 Test Usefulness Criteria (Risk Priority ≥15, Confidence ROI, Behavioral, Predictive, Specific, Non-Duplicative) |
| Vertical Slicing ([Humanizing Work](https://www.humanizingwork.com/the-humanizing-work-guide-to-splitting-user-stories/)) | "Never split by architectural layer" | Foundation-First task ordering |
| [Claude Code Picks](https://amplifying.ai/research/claude-code-picks) (Amplifying AI, 2026) | Claude's tool preferences are learned maturity signals, not bias — Drizzle/Vitest/Zustand chosen for objective quality. Build-not-buy in 12/20 categories. "Correcting" valid preferences = recommending worse tools | Research-to-Action Gate in AGENTS.md — require concrete defect before turning research into skill changes |
| [autoresearch](https://github.com/karpathy/autoresearch) (Karpathy, 2025) | Autoresearch loop: modify → benchmark → binary keep/discard; compound baselines; simplicity criterion (marginal gain + ugly code = discard) | [`ln-814-optimization-executor`](skills-catalog/ln-814-optimization-executor/SKILL.md) — keep/discard with adaptive thresholds, multi-file support, compound baselines, experiment log |
| [The Complete Guide to Building Skills](https://resources.anthropic.com/hubfs/The-Complete-Guide-to-Building-Skill-for-Claude.pdf) (Anthropic, 2026) | WHAT+WHEN descriptions, trigger testing, capability vs preference classification, negative triggers, 3-level progressive disclosure | Check #14 (trigger quality), negative trigger pattern, `metadata.skill-type` classification, functional DoD, M6 advisory |

</details>

---

## License

[MIT](LICENSE)

---

**Author:** [@levnikolaevich](https://github.com/levnikolaevich)

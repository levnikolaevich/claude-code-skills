# Claude-Codex Skills

[![MCP Toplist](https://mcptoplist.com/badge/io.github.levnikolaevich%2Fhex-line-mcp.svg)](https://mcptoplist.com/server/io.github.levnikolaevich%2Fhex-line-mcp)

A compact marketplace of standalone engineering skills for Claude Code and Codex.

Supports the portable [Agent Plugins v1 standard](https://agent-plugins.org/specification) while retaining native Claude Code and Codex distribution compatibility.

> **Why this repository is intentionally small:** Earlier coding models needed a large orchestration and evaluation harness to follow complex workflows reliably. Modern Claude and Codex models work better with concise procedural guidance, so that machinery has been removed. These skills retain only the domain knowledge, decision gates, tool guidance, and evidence checklists worth bringing into context.

[Browse the skills catalog](https://levnikolaevich.github.io/claude-code-skills/) or install only the plugins you need below.

The repository intentionally contains only the skills, minimal plugin manifests, two host-specific marketplace catalogs, documentation, and a static catalog site. It has no MCP servers, orchestration hierarchy, distributed shared resources, generated skill copies, or evaluation harness.

## Plugins

### Review Suite

| Index | Skill | Purpose |
|---:|---|---|
| 11 | [Plan Reviewer](plugins/review-suite/skills/ln-11-plan-reviewer/SKILL.md) | Validate an implementation plan against repository evidence before execution. |
| 12 | [Delivery Reviewer](plugins/review-suite/skills/ln-12-delivery-reviewer/SKILL.md) | Review completed code through independent risk-selected perspectives. |

### Codebase Audit Suite

| Index | Skill | Purpose |
|---:|---|---|
| 21 | [Documentation Auditor](plugins/codebase-audit-suite/skills/ln-21-documentation-auditor/SKILL.md) | Audit documentation trust, coverage, structure, and factual accuracy. |
| 22 | [Codebase Auditor](plugins/codebase-audit-suite/skills/ln-22-codebase-auditor/SKILL.md) | Audit cross-cutting code health, security, delivery, and maintainability. |
| 23 | [Test Suite Auditor](plugins/codebase-audit-suite/skills/ln-23-test-suite-auditor/SKILL.md) | Audit test value, coverage, isolation, and oracle strength. |
| 24 | [Architecture Auditor](plugins/codebase-audit-suite/skills/ln-24-architecture-auditor/SKILL.md) | Audit system boundaries, ownership, contracts, and dependency topology. |
| 25 | [Persistence Auditor](plugins/codebase-audit-suite/skills/ln-25-persistence-auditor/SKILL.md) | Audit queries, transactions, consistency, and resource lifecycle. |

### Optimization Suite

| Index | Skill | Purpose |
|---:|---|---|
| 31 | [Performance Optimizer](plugins/optimization-suite/skills/ln-31-performance-optimizer/SKILL.md) | Profile, experiment, and keep only measured improvements. |
| 32 | [Dependency Upgrader](plugins/optimization-suite/skills/ln-32-dependency-upgrader/SKILL.md) | Upgrade dependencies in reversible, verified batches. |
| 33 | [Code Modernizer](plugins/optimization-suite/skills/ln-33-code-modernizer/SKILL.md) | Replace or simplify bounded capabilities when net value is proven. |
| 34 | [Benchmark Comparator](plugins/optimization-suite/skills/ln-34-benchmark-comparator/SKILL.md) | Compare alternatives with a frozen, reproducible experiment contract. |
| 35 | [Surgical Change Implementer](plugins/optimization-suite/skills/ln-35-surgical-change-implementer/SKILL.md) | Implement a bounded change through the smallest complete root-cause solution. |

### Testing Suite

| Index | Skill | Purpose |
|---:|---|---|
| 41 | [Test Strategy Planner](plugins/testing-suite/skills/ln-41-test-strategy-planner/SKILL.md) | Design a risk-based, decision-complete test strategy without changing code. |
| 42 | [Acceptance Test Builder](plugins/testing-suite/skills/ln-42-acceptance-test-builder/SKILL.md) | Create reproducible acceptance tests through observable product boundaries. |

### Product Discovery Suite

| Index | Skill | Purpose |
|---:|---|---|
| 51 | [Opportunity Evaluator](plugins/product-discovery-suite/skills/ln-51-opportunity-evaluator/SKILL.md) | Compare product opportunities using current evidence and a low-cost validation path. |

### Maintainer Suite

Optional maintainer toolkit: skill 61 reviews skill repositories, skill 62 publishes any Git repository with equivalent remote evidence, and skills 63–64 publish GitHub releases and Discussions. Users who only consume the engineering skills do not need to install it.

| Index | Skill | Purpose |
|---:|---|---|
| 61 | [Skill Reviewer](plugins/maintainer-suite/skills/ln-61-skill-reviewer/SKILL.md) | Review standalone skills and configured distribution surfaces before publication. |
| 62 | [Repository Publisher](plugins/maintainer-suite/skills/ln-62-repository-publisher/SKILL.md) | Validate, commit, push, and remotely verify approved repository changes. |
| 63 | [Release Publisher](plugins/maintainer-suite/skills/ln-63-release-publisher/SKILL.md) | Prepare and publish an approved tagged GitHub release. |
| 64 | [Community Announcer](plugins/maintainer-suite/skills/ln-64-community-announcer/SKILL.md) | Draft and publish fact-checked GitHub Discussions project announcements. |

### Architecture Suite

Creates durable architecture artifacts without coupling the skills to one another. Each workflow operates independently and communicates only through optional repository documents.

| Index | Skill | Purpose |
|---:|---|---|
| 71 | [System Design Baseline Builder](plugins/architecture-suite/skills/ln-71-system-design-baseline-builder/SKILL.md) | Establish measurable architecture drivers and constraints in one project baseline. |
| 72 | [Current Architecture Documenter](plugins/architecture-suite/skills/ln-72-current-architecture-documenter/SKILL.md) | Document implemented architecture from repository evidence. |
| 73 | [System Design Proposal Builder](plugins/architecture-suite/skills/ln-73-system-design-proposal-builder/SKILL.md) | Turn requirements and constraints into a decision-complete target design. |
| 74 | [Architecture Decision Recorder](plugins/architecture-suite/skills/ln-74-architecture-decision-recorder/SKILL.md) | Record one significant decision with alternatives and consequences. |
| 75 | [Architecture Diagram Builder](plugins/architecture-suite/skills/ln-75-architecture-diagram-builder/SKILL.md) | Create evidence-backed current or target architecture views. |
| 76 | [Architecture Migration Planner](plugins/architecture-suite/skills/ln-76-architecture-migration-planner/SKILL.md) | Plan a reversible current-to-target transition with compatibility and rollback. |

## Install in Claude Code

Add the marketplace and install only the suites you need:

```text
/plugin marketplace add levnikolaevich/claude-code-skills
/plugin install review-suite@levnikolaevich-skills-marketplace
/plugin install codebase-audit-suite@levnikolaevich-skills-marketplace
/plugin install optimization-suite@levnikolaevich-skills-marketplace
/plugin install testing-suite@levnikolaevich-skills-marketplace
/plugin install product-discovery-suite@levnikolaevich-skills-marketplace
/plugin install maintainer-suite@levnikolaevich-skills-marketplace
/plugin install architecture-suite@levnikolaevich-skills-marketplace
/reload-plugins
```

Invoke a skill by its namespaced name, for example `/review-suite:ln-12-delivery-reviewer`.

For local development, load one plugin directly:

```bash
claude --plugin-dir ./plugins/review-suite
```

## Install in Codex

```bash
codex plugin marketplace add levnikolaevich/claude-code-skills
codex plugin add review-suite@levnikolaevich-skills-marketplace
codex plugin add codebase-audit-suite@levnikolaevich-skills-marketplace
codex plugin add optimization-suite@levnikolaevich-skills-marketplace
codex plugin add testing-suite@levnikolaevich-skills-marketplace
codex plugin add product-discovery-suite@levnikolaevich-skills-marketplace
codex plugin add maintainer-suite@levnikolaevich-skills-marketplace
codex plugin add architecture-suite@levnikolaevich-skills-marketplace
```

## Repository layout

```text
.
├── .agents/plugins/marketplace.json       # Codex catalog
├── .claude-plugin/marketplace.json        # Claude Code catalog
└── plugins/
    ├── review-suite/
    ├── codebase-audit-suite/
    ├── optimization-suite/
    ├── testing-suite/
    ├── product-discovery-suite/
    ├── maintainer-suite/
    └── architecture-suite/
```

Each plugin contains a portable Agent Plugins v1 `plugin.json`, the current `.codex-plugin/plugin.json` OpenAI host adapter, and one shared `skills/<skill>/SKILL.md` tree.

This is the smallest practical shared layout for distributed plugins:

- Both hosts use `skills/<name>/SKILL.md`, so each skill has one canonical copy.
- Agent Plugins clients discover the portable package through root `plugin.json`; its minimal manifest owns only the schema target and stable name.
- Current ChatGPT and Codex packaging still requires `.codex-plugin/plugin.json`, which remains the single owner of mutable version, description, publisher, and interface metadata.
- Claude Code scans each marketplace source's standard `skills/` directory, so a duplicate Claude-specific plugin manifest is unnecessary.
- `agents/openai.yaml`, references, scripts, assets, hooks, agents, and MCP configuration are optional and omitted until a concrete need appears.

The structure follows the [Agent Plugins v1 specification](https://agent-plugins.org/specification), current [OpenAI plugin guide](https://developers.openai.com/plugins/build/plugins), [Agent Skills specification](https://agentskills.io/specification), [Claude Code skill guide](https://code.claude.com/docs/en/skills), and [Claude Code plugin reference](https://code.claude.com/docs/en/plugins-reference).

## Indexing

The first digit identifies the plugin and the second identifies the skill within it: `1x` review, `2x` audit, `3x` optimization, `4x` testing, `5x` product discovery, `6x` repository maintenance, and `7x` architecture artifact creation. See the canonical allocation and overflow rules in [AGENTS.md](AGENTS.md#index-system).

## License

[MIT](LICENSE)

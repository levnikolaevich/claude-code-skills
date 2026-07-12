# Claude-Codex Skills

A compact marketplace of standalone engineering skills for Claude Code and Codex.

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

### Testing Suite

| Index | Skill | Purpose |
|---:|---|---|
| 41 | [Test Strategy Planner](plugins/testing-suite/skills/ln-41-test-strategy-planner/SKILL.md) | Design a risk-based, decision-complete test strategy without changing code. |
| 42 | [Acceptance Test Builder](plugins/testing-suite/skills/ln-42-acceptance-test-builder/SKILL.md) | Create reproducible acceptance tests through observable product boundaries. |

### Product Discovery Suite

| Index | Skill | Purpose |
|---:|---|---|
| 51 | [Opportunity Evaluator](plugins/product-discovery-suite/skills/ln-51-opportunity-evaluator/SKILL.md) | Compare product opportunities using current evidence and a low-cost validation path. |

## Install in Claude Code

Add the marketplace and install only the suites you need:

```text
/plugin marketplace add levnikolaevich/claude-code-skills
/plugin install review-suite@levnikolaevich-skills-marketplace
/plugin install codebase-audit-suite@levnikolaevich-skills-marketplace
/plugin install optimization-suite@levnikolaevich-skills-marketplace
/plugin install testing-suite@levnikolaevich-skills-marketplace
/plugin install product-discovery-suite@levnikolaevich-skills-marketplace
```

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
    └── product-discovery-suite/
```

Each plugin contains `.codex-plugin/plugin.json` for Codex and a shared `skills/<skill>/SKILL.md` tree used by both hosts.

This is the smallest practical shared layout for distributed plugins:

- Both hosts use `skills/<name>/SKILL.md`, so each skill has one canonical copy.
- Codex requires `.codex-plugin/plugin.json` for a plugin.
- Claude Code can expose a standard `skills/` directory from the marketplace entry, so duplicate per-plugin Claude manifests are unnecessary here.
- `agents/openai.yaml`, references, scripts, assets, hooks, agents, and MCP configuration are optional and omitted until a concrete need appears.

The structure follows the current official [Codex skill guide](https://learn.chatgpt.com/docs/build-skills), [Codex plugin guide](https://learn.chatgpt.com/docs/build-plugins), [Claude Code skill guide](https://code.claude.com/docs/en/skills), and [Claude Code plugin reference](https://code.claude.com/docs/en/plugins-reference).

## Indexing

The first digit identifies the plugin and the second identifies the skill within it: `1x` review, `2x` audit, `3x` optimization, `4x` testing, and `5x` product discovery. See the canonical allocation and overflow rules in [AGENTS.md](AGENTS.md#index-system).

## License

[MIT](LICENSE)

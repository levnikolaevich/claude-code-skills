# Claude-Codex Skills

**Give your AI agent a clear finish line.**

You ask for a fix and get a new abstraction. A review lists generic advice. The agent says “done,” but you still have to work out what it checked.

These skills give Claude Code and Codex a concrete way to finish the task: establish the intended outcome, work within scope, verify the result, and make remaining gaps explicit. Choose the skill for the problem in front of you.

[Project page](https://levnikolaevich.com/projects/claude-code-skills) · [Install](#install) · [Full catalog](#lifecycle-and-plugins)

## What changes in your workflow

- **A clearer target.** Turn an idea, bug report, or incident into an outcome the agent can check.
- **Focused work.** Reuse existing capabilities, fix the owning cause, and remove what the change makes obsolete.
- **A result you can assess.** See the evidence, failed or unavailable checks, and remaining risks behind the verdict.
- **Control over consequential actions.** Reviews report findings; implementation stays within the agreed scope; publication and deployment follow their authorization boundaries.

## Choose a route

Start where you need help. Each skill works independently; a small fix does not require a full lifecycle or audit.

| Your problem | Plugin to install | Useful result |
|---|---|---|
| Is this idea worth building? | `product-discovery-suite` | A reasoned opportunity decision, clear requirements, or a usable interaction design. |
| How should this system change? | `architecture-suite` | An evidence-backed system map, design decision, or migration approach. |
| Is this plan ready to implement? | `delivery-planning-suite` | Missing decisions exposed, work sequenced, and verification planned. |
| Fix, upgrade, simplify, or speed up this code. | `implementation-suite` | A bounded change checked against the intended behavior and benefit. |
| What could go wrong with this delivery or codebase? | `quality-assurance-suite` | Prioritized findings tied to evidence, or acceptance tests for the agreed scope. |
| Get this change published or deployed. | `delivery-suite` | The authorized destination updated and the observed result checked. |
| Why did this fail, or did the feature help? | `operations-suite` | An evidence-backed diagnosis or product outcome assessment. |
| Can I trust the instructions in this skill? | `skill-maintenance-suite` | A review of its boundaries, consistency, and distribution readiness. |

For a larger task, combine only the steps needed to resolve decisions and produce evidence. Supplied requirements, existing designs, and current tests are valid starting points. Implementation includes its own verification; a separate test-building or review skill is optional.

## Install

For a feature or fix, start with `implementation-suite`. Replace it with another plugin from [Choose a route](#choose-a-route) for a different task.

Claude Code:

```text
/plugin marketplace add levnikolaevich/claude-code-skills
/plugin install implementation-suite@levnikolaevich-skills-marketplace
/reload-plugins
```

Codex:

```text
codex plugin marketplace add levnikolaevich/claude-code-skills
codex plugin add implementation-suite@levnikolaevich-skills-marketplace
```

Invoke a skill by its full name: `/implementation-suite:ln-41-surgical-change-implementer` in Claude Code or `$ln-41-surgical-change-implementer` in Codex, followed by your task. For example: “Fix the total calculation when an item has a discount. Preserve the current rounding rules.”

## Lifecycle and plugins

Standalone skills for Claude Code and Codex, grouped by the work you need to do. Browse the outcomes below to find the right skill for your task.

```text
1 Product discovery → 2 Architecture → 3 Delivery planning
 → 4 Implementation → 5 Quality assurance → 6 Delivery → 7 Operations
 ↑ Product feedback / architecture changes / operational remediation ↵

8 Skill maintenance supports the collection itself.
```

The numbers group skills by task. Install one family or combine the capabilities you need.

### Product Discovery Suite

Decide what is worth building, who it serves, and what a useful first version must do.

| Index | Skill | Purpose |
|---:|---|---|
| 11 | [Opportunity Evaluator](plugins/product-discovery-suite/skills/ln-11-opportunity-evaluator/SKILL.md) | Evaluates new product opportunities through demand, channels and economics before committing to build. |
| 12 | [Product Requirements Builder](plugins/product-discovery-suite/skills/ln-12-product-requirements-builder/SKILL.md) | Defines product requirements, business rules and acceptance criteria for a committed intent; edits product docs only. |
| 13 | [Interaction Design Builder](plugins/product-discovery-suite/skills/ln-13-interaction-design-builder/SKILL.md) | Designs user flows, interaction states and mockups for a defined product scope; does not implement UI code. |

### Architecture Suite

Understand the system you have and choose changes with clear boundaries, tradeoffs, and recovery paths.

| Index | Skill | Purpose |
|---:|---|---|
| 21 | [System Design Baseline Builder](plugins/architecture-suite/skills/ln-21-system-design-baseline-builder/SKILL.md) | Defines measurable architecture drivers and constraints before system design; edits architecture docs only. |
| 22 | [Current Architecture Documenter](plugins/architecture-suite/skills/ln-22-current-architecture-documenter/SKILL.md) | Documents current architecture from implementation evidence; does not propose a target or audit fitness. |
| 23 | [System Design Proposal Builder](plugins/architecture-suite/skills/ln-23-system-design-proposal-builder/SKILL.md) | Designs target system boundaries, contracts and tradeoffs from requirements; does not plan tasks or implement. |
| 24 | [Architecture Decision Recorder](plugins/architecture-suite/skills/ln-24-architecture-decision-recorder/SKILL.md) | Records one architecture decision with alternatives, consequences and status; does not design the whole system. |
| 25 | [Architecture Diagram Builder](plugins/architecture-suite/skills/ln-25-architecture-diagram-builder/SKILL.md) | Creates evidence-backed current or target architecture diagrams; not UI design. |
| 26 | [Architecture Migration Planner](plugins/architecture-suite/skills/ln-26-architecture-migration-planner/SKILL.md) | Plans architecture migrations with compatibility, data safety, rollout and recovery; does not execute them. |

### Delivery Planning Suite

Find missing decisions and risky dependencies before they become implementation rework.

| Index | Skill | Purpose |
|---:|---|---|
| 31 | [Delivery Plan Builder](plugins/delivery-planning-suite/skills/ln-31-delivery-plan-builder/SKILL.md) | Builds dependency-ordered delivery plans from requirements and repository evidence; read-only. |
| 32 | [Test Strategy Planner](plugins/delivery-planning-suite/skills/ln-32-test-strategy-planner/SKILL.md) | Plans risk-based test portfolios and acceptance evidence; does not write or execute tests. |
| 33 | [Plan Reviewer](plugins/delivery-planning-suite/skills/ln-33-plan-reviewer/SKILL.md) | Reviews a concrete implementation plan for missing decisions, feasibility and risk before execution; read-only. |

### Implementation Suite

Fix the cause, reuse what already works, and keep changes focused on a verified outcome.

| Index | Skill | Purpose |
|---:|---|---|
| 41 | [Surgical Change Implementer](plugins/implementation-suite/skills/ln-41-surgical-change-implementer/SKILL.md) | Implements one scoped feature or fix through the smallest complete solution; not upgrades or performance tuning. |
| 42 | [Dependency Upgrader](plugins/implementation-suite/skills/ln-42-dependency-upgrader/SKILL.md) | Upgrades dependencies in reversible batches with version-specific compatibility and regression checks. |
| 43 | [Code Modernizer](plugins/implementation-suite/skills/ln-43-code-modernizer/SKILL.md) | Modernizes a bounded capability to reduce demonstrated maintenance cost; not routine upgrades or performance tuning. |
| 44 | [Performance Optimizer](plugins/implementation-suite/skills/ln-44-performance-optimizer/SKILL.md) | Profiles and improves a measured performance bottleneck; retains only verified improvements. |
| 45 | [Benchmark Comparator](plugins/implementation-suite/skills/ln-45-benchmark-comparator/SKILL.md) | Compares tools or implementations through controlled benchmarks and independent correctness checks. |

### Quality Assurance Suite

Find gaps that could break a release, mislead a maintainer, or make a passing test meaningless.

| Index | Skill | Purpose |
|---:|---|---|
| 51 | [Acceptance Test Builder](plugins/quality-assurance-suite/skills/ln-51-acceptance-test-builder/SKILL.md) | Builds, updates or retires scoped acceptance tests and verifies execution; does not repair product code. |
| 52 | [Delivery Reviewer](plugins/quality-assurance-suite/skills/ln-52-delivery-reviewer/SKILL.md) | Reviews a completed change for acceptance, regressions and release risk; read-only, not a whole-codebase audit. |
| 53 | [Documentation Auditor](plugins/quality-assurance-suite/skills/ln-53-documentation-auditor/SKILL.md) | Audits documentation and comments for trust, coverage, consistency and freshness; read-only. |
| 54 | [Codebase Auditor](plugins/quality-assurance-suite/skills/ln-54-codebase-auditor/SKILL.md) | Audits cross-cutting codebase health, security and maintainability; not a single-change review or specialist audit. |
| 55 | [Test Suite Auditor](plugins/quality-assurance-suite/skills/ln-55-test-suite-auditor/SKILL.md) | Audits existing tests for risk coverage, reliable oracles and maintenance value; does not edit tests. |
| 56 | [Architecture Auditor](plugins/quality-assurance-suite/skills/ln-56-architecture-auditor/SKILL.md) | Audits implemented architecture boundaries, dependencies and ownership; not target design or plan review. |
| 57 | [Persistence Auditor](plugins/quality-assurance-suite/skills/ln-57-persistence-auditor/SKILL.md) | Audits queries, transactions, consistency and persistence resource lifetimes; read-only. |

### Delivery Suite

Publish the intended changes and verify what reached the remote repository or target environment.

| Index | Skill | Purpose |
|---:|---|---|
| 61 | [Repository Publisher](plugins/delivery-suite/skills/ln-61-repository-publisher/SKILL.md) | Commits, pushes and remotely verifies authorized repository changes; does not create releases. |
| 62 | [Release Publisher](plugins/delivery-suite/skills/ln-62-release-publisher/SKILL.md) | Prepares and publishes an explicitly requested tagged GitHub release; does not deploy applications. |
| 63 | [Deployment Engineer](plugins/delivery-suite/skills/ln-63-deployment-engineer/SKILL.md) | Prepares CI/CD and infrastructure, then executes authorized deployments with health and recovery checks. |
| 64 | [Community Announcer](plugins/delivery-suite/skills/ln-64-community-announcer/SKILL.md) | Drafts or publishes authorized, fact-checked GitHub Discussions announcements; does not create releases. |

### Operations Suite

Turn incidents and product signals into evidence for the next recovery or product decision.

| Index | Skill | Purpose |
|---:|---|---|
| 71 | [Operations Investigator](plugins/operations-suite/skills/ln-71-operations-investigator/SKILL.md) | Diagnoses incidents from operational evidence and proposes recovery; does not change live systems. |
| 72 | [Product Outcome Evaluator](plugins/operations-suite/skills/ln-72-product-outcome-evaluator/SKILL.md) | Evaluates observed product outcomes against a prior hypothesis; does not run experiments or change user treatment. |

### Skill Maintenance Suite

Make skills easier to invoke correctly, follow consistently, and verify before distribution.

| Index | Skill | Purpose |
|---:|---|---|
| 81 | [Skill Reviewer](plugins/skill-maintenance-suite/skills/ln-81-skill-reviewer/SKILL.md) | Reviews skill instructions, trigger boundaries and distribution contracts; not product code. |

## License

[MIT](LICENSE)

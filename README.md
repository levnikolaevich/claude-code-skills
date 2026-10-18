# Claude-Codex Skills

Open-source standalone agent skills, distributed as plugins for Claude Code and OpenAI Codex, help turn product ideas, code fixes, architecture reviews and deployments into scoped work with a verifiable result. Each workflow defines what to check, what it may change, and how to report evidence and remaining gaps.

[Project page](https://levnikolaevich.com/projects/claude-code-skills) · [Install](#install) · [Full catalog](#lifecycle-and-plugins)

## Choose a route

Choose by the result you need. Each skill works independently.

| Your task | Plugin | Result |
|---|---|---|
| Is this idea worth building? | `product-discovery-suite` | Opportunity assessment, requirements, or interaction design. |
| How should this system change? | `architecture-suite` | System map, design decision, or migration plan. |
| Is this plan ready to implement? | `delivery-planning-suite` | Reviewed plan, ordered work, and test strategy. |
| Fix, upgrade, simplify, or speed up this code. | `implementation-suite` | Scoped change with behavior and benefit checks. |
| Set up lint, type or architecture checks that enforce project rules. | `implementation-suite` | Verified quality gates, with project compliance reported separately. |
| What could go wrong with this delivery or codebase? | `quality-assurance-suite` | Evidence-backed findings or scoped acceptance tests. |
| Get this change published or deployed. | `delivery-suite` | Authorized publication or deployment, verified at its destination. |
| Why did this fail, or did the feature help? | `operations-suite` | Incident diagnosis or product outcome assessment. |
| Can I trust the instructions in this skill? | `skill-maintenance-suite` | Skill boundaries, consistency, and distribution review. |
| Prepare Docker containers, configuration, access control or recovery. | `engineering-foundation-suite` | Native technical contracts and verified changes. |

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

For personal defaults shared by Claude Code and Codex, use the optional [user instructions template and connection guide](templates/user-instructions/README.md). Personalize and merge it into your existing configuration; plugin installation does not change global instructions.

## Lifecycle and plugins

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
| 41 | [Surgical Change Implementer](plugins/implementation-suite/skills/ln-41-surgical-change-implementer/SKILL.md) | Implements one scoped product feature or fix using existing contracts; not upgrades, performance tuning or establishing cross-cutting technical foundations. |
| 42 | [Dependency Upgrader](plugins/implementation-suite/skills/ln-42-dependency-upgrader/SKILL.md) | Upgrades dependencies in reversible batches with version-specific compatibility and regression checks. |
| 43 | [Code Modernizer](plugins/implementation-suite/skills/ln-43-code-modernizer/SKILL.md) | Modernizes a bounded capability to reduce demonstrated maintenance cost; not routine upgrades or performance tuning. |
| 44 | [Performance Optimizer](plugins/implementation-suite/skills/ln-44-performance-optimizer/SKILL.md) | Profiles and improves a measured performance bottleneck; retains only verified improvements. |
| 45 | [Benchmark Comparator](plugins/implementation-suite/skills/ln-45-benchmark-comparator/SKILL.md) | Compares tools or implementations through controlled benchmarks and independent correctness checks. |
| 46 | [Quality Gate Engineer](plugins/implementation-suite/skills/ln-46-quality-gate-engineer/SKILL.md) | Configures and verifies lint, type, architecture and other engineering checks; not product cleanup, policy invention or deployment redesign. |

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
| 63 | [Deployment Engineer](plugins/delivery-suite/skills/ln-63-deployment-engineer/SKILL.md) | Prepares delivery pipelines and remote infrastructure, then executes authorized rollouts; not standalone quality-gate setup or local container packaging. |
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

### Engineering Foundation Suite

Establish and verify project technical foundations using native stack mechanisms, explicit contracts and safe recovery.

| Index | Skill | Purpose |
|---:|---|---|
| 91 | [Engineering Baseline Builder](plugins/engineering-foundation-suite/skills/ln-91-engineering-baseline-builder/SKILL.md) | Creates project technical rules and recurring local procedures from the actual stack; edits guidance only, not architecture targets or application code. |
| 92 | [Container Engineer](plugins/engineering-foundation-suite/skills/ln-92-container-engineer/SKILL.md) | Builds, hardens or reviews container images and local runtime packaging with startup and shutdown evidence; not remote deployment or host administration. |
| 93 | [Configuration Engineer](plugins/engineering-foundation-suite/skills/ln-93-configuration-engineer/SKILL.md) | Establishes configuration ownership, validation, secret boundaries and environment isolation; not credential identity policy or live deployment. |
| 94 | [Authentication Engineer](plugins/engineering-foundation-suite/skills/ln-94-authentication-engineer/SKILL.md) | Implements or repairs identity verification and session or credential lifecycle; not operation permissions, resource access policy or a new identity provider by default. |
| 95 | [Resource Authorization Engineer](plugins/engineering-foundation-suite/skills/ln-95-resource-authorization-engineer/SKILL.md) | Implements permissions and tenant or owner scoped resource access while preserving approved grants; not authentication or role redesign. |
| 96 | [Error Handling Engineer](plugins/engineering-foundation-suite/skills/ln-96-error-handling-engineer/SKILL.md) | Implements safe error boundaries, cancellation and user recovery contracts; not telemetry pipelines or durable retry machinery. |
| 97 | [Observability Engineer](plugins/engineering-foundation-suite/skills/ln-97-observability-engineer/SKILL.md) | Implements structured diagnostics, correlation and justified metrics or traces; not incident investigation or a mandatory telemetry platform. |
| 98 | [Mutation Reliability Engineer](plugins/engineering-foundation-suite/skills/ln-98-mutation-reliability-engineer/SKILL.md) | Implements transactions, idempotency and interrupted-operation recovery; not schema migration or a mandatory background-job platform. |
| 99 | [Database Lifecycle Engineer](plugins/engineering-foundation-suite/skills/ln-99-database-lifecycle-engineer/SKILL.md) | Prepares and verifies schema migrations, database roles and isolated recovery or test resources; not query tuning or runtime mutation orchestration. |

## Update an installed plugin

For a Git-backed marketplace, refresh the catalog, then update your plugin:

```text
claude plugin marketplace update levnikolaevich-skills-marketplace
claude plugin update implementation-suite@levnikolaevich-skills-marketplace

codex plugin marketplace upgrade levnikolaevich-skills-marketplace
codex plugin add implementation-suite@levnikolaevich-skills-marketplace
```

For a local-directory marketplace, update its checkout first, then refresh the installed plugin; Codex marketplace upgrade supports Git sources only. Follow Claude's reload/restart instruction and start a new Codex session. Source edits alone do not refresh the installed cache or an existing session.

## License

[MIT](LICENSE)

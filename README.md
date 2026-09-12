# Claude-Codex Skills

31 standalone skills in eight lifecycle-ordered plugins for Claude Code and Codex.

The collection covers product discovery, architecture, planning, implementation, verification, delivery, and operations. Each skill has one bounded outcome, detailed evidence checks, a final self-check, and the same five-field report. Install only the capabilities you need.

The lifecycle is coordinated by the user or host agent. This repository supplies no deterministic workflow engine, mandatory skill chain, MCP server, tracker, or shared runtime. Equivalent user or repository evidence can replace any upstream artifact.

[Browse the catalog](https://levnikolaevich.github.io/claude-code-skills/).

## Lifecycle and plugins

```text
1 Product discovery → 2 Architecture → 3 Delivery planning
 → 4 Implementation → 5 Quality assurance → 6 Delivery → 7 Operations
 ↑ Product feedback / architecture changes / operational remediation ↵

8 Skill maintenance supports the collection itself.
```

Numbers indicate the main lifecycle position, not a requirement to run every skill. Audits, benchmarks, diagrams, separate reviews and test work are conditional on the task and missing evidence. Implementation includes its own required verification; a separate acceptance-test skill is optional.

### Product Discovery Suite

Evaluate opportunities, define product requirements, and design user interaction.

| Index | Skill | Purpose |
|---:|---|---|
| 11 | [Opportunity Evaluator](plugins/product-discovery-suite/skills/ln-11-opportunity-evaluator/SKILL.md) | Evaluates new product opportunities through demand, channels and economics before committing to build. |
| 12 | [Product Requirements Builder](plugins/product-discovery-suite/skills/ln-12-product-requirements-builder/SKILL.md) | Defines product requirements, business rules and acceptance criteria for a committed intent; edits product docs only. |
| 13 | [Interaction Design Builder](plugins/product-discovery-suite/skills/ln-13-interaction-design-builder/SKILL.md) | Designs user flows, interaction states and mockups for a defined product scope; does not implement UI code. |

### Architecture Suite

Establish architecture drivers, document current systems, and design decisions and migrations.

| Index | Skill | Purpose |
|---:|---|---|
| 21 | [System Design Baseline Builder](plugins/architecture-suite/skills/ln-21-system-design-baseline-builder/SKILL.md) | Defines measurable architecture drivers and constraints before system design; edits architecture docs only. |
| 22 | [Current Architecture Documenter](plugins/architecture-suite/skills/ln-22-current-architecture-documenter/SKILL.md) | Documents current architecture from implementation evidence; does not propose a target or audit fitness. |
| 23 | [System Design Proposal Builder](plugins/architecture-suite/skills/ln-23-system-design-proposal-builder/SKILL.md) | Designs target system boundaries, contracts and tradeoffs from requirements; does not plan tasks or implement. |
| 24 | [Architecture Decision Recorder](plugins/architecture-suite/skills/ln-24-architecture-decision-recorder/SKILL.md) | Records one architecture decision with alternatives, consequences and status; does not design the whole system. |
| 25 | [Architecture Diagram Builder](plugins/architecture-suite/skills/ln-25-architecture-diagram-builder/SKILL.md) | Creates evidence-backed current or target architecture diagrams; not UI design. |
| 26 | [Architecture Migration Planner](plugins/architecture-suite/skills/ln-26-architecture-migration-planner/SKILL.md) | Plans architecture migrations with compatibility, data safety, rollout and recovery; does not execute them. |

### Delivery Planning Suite

Build delivery plans, select risk-based verification, and review readiness before implementation.

| Index | Skill | Purpose |
|---:|---|---|
| 31 | [Delivery Plan Builder](plugins/delivery-planning-suite/skills/ln-31-delivery-plan-builder/SKILL.md) | Builds dependency-ordered delivery plans from requirements and repository evidence; read-only. |
| 32 | [Test Strategy Planner](plugins/delivery-planning-suite/skills/ln-32-test-strategy-planner/SKILL.md) | Plans risk-based test portfolios and acceptance evidence; does not write or execute tests. |
| 33 | [Plan Reviewer](plugins/delivery-planning-suite/skills/ln-33-plan-reviewer/SKILL.md) | Reviews a concrete implementation plan for missing decisions, feasibility and risk before execution; read-only. |

### Implementation Suite

Deliver scoped changes, dependency upgrades, modernization, and measured performance improvements.

| Index | Skill | Purpose |
|---:|---|---|
| 41 | [Surgical Change Implementer](plugins/implementation-suite/skills/ln-41-surgical-change-implementer/SKILL.md) | Implements one scoped feature or fix through the smallest complete solution; not upgrades or performance tuning. |
| 42 | [Dependency Upgrader](plugins/implementation-suite/skills/ln-42-dependency-upgrader/SKILL.md) | Upgrades dependencies in reversible batches with version-specific compatibility and regression checks. |
| 43 | [Code Modernizer](plugins/implementation-suite/skills/ln-43-code-modernizer/SKILL.md) | Modernizes a bounded capability to reduce demonstrated maintenance cost; not routine upgrades or performance tuning. |
| 44 | [Performance Optimizer](plugins/implementation-suite/skills/ln-44-performance-optimizer/SKILL.md) | Profiles and improves a measured performance bottleneck; retains only verified improvements. |
| 45 | [Benchmark Comparator](plugins/implementation-suite/skills/ln-45-benchmark-comparator/SKILL.md) | Compares tools or implementations through controlled benchmarks and independent correctness checks. |

### Quality Assurance Suite

Build acceptance tests and review deliveries, documentation, code, tests, architecture, and persistence.

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

Publish repositories and releases, prepare and execute deployments, and announce approved results.

| Index | Skill | Purpose |
|---:|---|---|
| 61 | [Repository Publisher](plugins/delivery-suite/skills/ln-61-repository-publisher/SKILL.md) | Commits, pushes and remotely verifies authorized repository changes; does not create releases. |
| 62 | [Release Publisher](plugins/delivery-suite/skills/ln-62-release-publisher/SKILL.md) | Prepares and publishes an explicitly requested tagged GitHub release; does not deploy applications. |
| 63 | [Deployment Engineer](plugins/delivery-suite/skills/ln-63-deployment-engineer/SKILL.md) | Prepares CI/CD and infrastructure, then executes authorized deployments with health and recovery checks. |
| 64 | [Community Announcer](plugins/delivery-suite/skills/ln-64-community-announcer/SKILL.md) | Drafts or publishes authorized, fact-checked GitHub Discussions announcements; does not create releases. |

### Operations Suite

Investigate operational deviations and evaluate observed product outcomes without changing live systems.

| Index | Skill | Purpose |
|---:|---|---|
| 71 | [Operations Investigator](plugins/operations-suite/skills/ln-71-operations-investigator/SKILL.md) | Diagnoses incidents from operational evidence and proposes recovery; does not change live systems. |
| 72 | [Product Outcome Evaluator](plugins/operations-suite/skills/ln-72-product-outcome-evaluator/SKILL.md) | Evaluates observed product outcomes against a prior hypothesis; does not run experiments or change user treatment. |

### Skill Maintenance Suite

Review standalone skills, instruction boundaries, evidence contracts, and distribution integrity.

| Index | Skill | Purpose |
|---:|---|---|
| 81 | [Skill Reviewer](plugins/skill-maintenance-suite/skills/ln-81-skill-reviewer/SKILL.md) | Reviews skill instructions, trigger boundaries and distribution contracts; not product code. |

## Choose a route

| Request | Typical work |
|---|---|
| Small fix | 41; 52 when separate review provides necessary evidence |
| Feature | 12 → applicable UX/architecture → 31–33 when a separate plan is needed → 41 → applicable 51–52 |
| New product | 11 → 12–13 → applicable architecture/planning → implementation/acceptance → authorized delivery → 72 |
| Architecture migration | 22–23 → 26 → 31–33 → implementation/acceptance → authorized deployment |
| Incident | 71 → bounded remediation through 41, 44 or 63 → verification of recovery |
| Dependency update | 42 → affected verification → requested publication/deployment |

Do not run a full audit for every change. Missing optional artifacts do not require their producing skills. Read-only skills return plans/findings without writing task records or applying repairs.

## Compatible results

Preserve requirement and decision identities across artifacts. Reuse the authoritative source rather than copying a second truth. Bind evidence to relevant revisions, dirty changes, configuration, environment and observation windows. A changed input invalidates affected conclusions, not all prior work.

For a long task, an authorized task artifact or response can carry intent, scope, source state, decisions, evidence, gaps and the next action. On continuation, reconcile it with current state. No mandatory state directory or runtime is required.

Readiness is not approval; checked code is not a published release; a published release is not a healthy deployment; healthy deployment is not proof of business impact. Continue already authorized work and prepare concrete artifacts before asking for any missing external authorization.

## Migration from the previous catalog

This is an approved index and plugin migration. Existing invocations must be updated by full skill name; bare numbers have been reassigned. The table below is historical, not a set of aliases. Old site URLs remain redirects to the relevant family; use this table for exact destinations when a former plugin split. No host-specific skill copies or compatibility wrappers are installed.

| Previous invocation | Current invocation |
|---|---|
| `product-discovery-suite:ln-51-opportunity-evaluator` | `product-discovery-suite:ln-11-opportunity-evaluator` |
| `architecture-suite:ln-71-system-design-baseline-builder` | `architecture-suite:ln-21-system-design-baseline-builder` |
| `architecture-suite:ln-72-current-architecture-documenter` | `architecture-suite:ln-22-current-architecture-documenter` |
| `architecture-suite:ln-73-system-design-proposal-builder` | `architecture-suite:ln-23-system-design-proposal-builder` |
| `architecture-suite:ln-74-architecture-decision-recorder` | `architecture-suite:ln-24-architecture-decision-recorder` |
| `architecture-suite:ln-75-architecture-diagram-builder` | `architecture-suite:ln-25-architecture-diagram-builder` |
| `architecture-suite:ln-76-architecture-migration-planner` | `architecture-suite:ln-26-architecture-migration-planner` |
| `testing-suite:ln-41-test-strategy-planner` | `delivery-planning-suite:ln-32-test-strategy-planner` |
| `review-suite:ln-11-plan-reviewer` | `delivery-planning-suite:ln-33-plan-reviewer` |
| `optimization-suite:ln-35-surgical-change-implementer` | `implementation-suite:ln-41-surgical-change-implementer` |
| `optimization-suite:ln-32-dependency-upgrader` | `implementation-suite:ln-42-dependency-upgrader` |
| `optimization-suite:ln-33-code-modernizer` | `implementation-suite:ln-43-code-modernizer` |
| `optimization-suite:ln-31-performance-optimizer` | `implementation-suite:ln-44-performance-optimizer` |
| `optimization-suite:ln-34-benchmark-comparator` | `implementation-suite:ln-45-benchmark-comparator` |
| `testing-suite:ln-42-acceptance-test-builder` | `quality-assurance-suite:ln-51-acceptance-test-builder` |
| `review-suite:ln-12-delivery-reviewer` | `quality-assurance-suite:ln-52-delivery-reviewer` |
| `codebase-audit-suite:ln-21-documentation-auditor` | `quality-assurance-suite:ln-53-documentation-auditor` |
| `codebase-audit-suite:ln-22-codebase-auditor` | `quality-assurance-suite:ln-54-codebase-auditor` |
| `codebase-audit-suite:ln-23-test-suite-auditor` | `quality-assurance-suite:ln-55-test-suite-auditor` |
| `codebase-audit-suite:ln-24-architecture-auditor` | `quality-assurance-suite:ln-56-architecture-auditor` |
| `codebase-audit-suite:ln-25-persistence-auditor` | `quality-assurance-suite:ln-57-persistence-auditor` |
| `maintainer-suite:ln-62-repository-publisher` | `delivery-suite:ln-61-repository-publisher` |
| `maintainer-suite:ln-63-release-publisher` | `delivery-suite:ln-62-release-publisher` |
| `maintainer-suite:ln-64-community-announcer` | `delivery-suite:ln-64-community-announcer` |
| `maintainer-suite:ln-61-skill-reviewer` | `skill-maintenance-suite:ln-81-skill-reviewer` |

Install the destination plugins before removing obsolete installations. Update saved prompts, commands and automation references yourself or within separately authorized scope. Previously installed caches are not changed by this repository edit. Start a new agent session after updating installed skills. The migration table is also recorded in [the migration ledger](docs/lifecycle-migration.json).

## Install

Claude Code:

```text
/plugin marketplace add levnikolaevich/claude-code-skills
/plugin install product-discovery-suite@levnikolaevich-skills-marketplace
/plugin install architecture-suite@levnikolaevich-skills-marketplace
/plugin install delivery-planning-suite@levnikolaevich-skills-marketplace
/plugin install implementation-suite@levnikolaevich-skills-marketplace
/plugin install quality-assurance-suite@levnikolaevich-skills-marketplace
/plugin install delivery-suite@levnikolaevich-skills-marketplace
/plugin install operations-suite@levnikolaevich-skills-marketplace
/plugin install skill-maintenance-suite@levnikolaevich-skills-marketplace
/reload-plugins
```

Codex:

```text
codex plugin marketplace add levnikolaevich/claude-code-skills
codex plugin add product-discovery-suite@levnikolaevich-skills-marketplace
codex plugin add architecture-suite@levnikolaevich-skills-marketplace
codex plugin add delivery-planning-suite@levnikolaevich-skills-marketplace
codex plugin add implementation-suite@levnikolaevich-skills-marketplace
codex plugin add quality-assurance-suite@levnikolaevich-skills-marketplace
codex plugin add delivery-suite@levnikolaevich-skills-marketplace
codex plugin add operations-suite@levnikolaevich-skills-marketplace
codex plugin add skill-maintenance-suite@levnikolaevich-skills-marketplace
```

Install commands use the current default branch. Downloaded release archives and previously installed caches can contain an older catalog; compare full skill names when updating. Invoke a skill by its full name, for example `/delivery-planning-suite:ln-33-plan-reviewer` in Claude Code or `$ln-33-plan-reviewer` in Codex. For local Claude Code development use `claude --plugin-dir ./plugins/delivery-planning-suite`.

## Token-efficient use

Install only relevant families and invoke the skill for the actual task. Discovery loads names and short descriptions; the selected entrypoint supplies its complete checklist. Conditional references load only when their trigger applies.

Preserve every domain obligation, self-check and report field. Reuse current evidence, invalidate only affected claims, and link canonical artifacts instead of copying them into each response. Shorter text is useful only if routing and correctness remain intact; fewer tokens alone do not prove better task performance. See [authoring and measurement guidance](docs/token-efficiency.md).

## Repository and authoring

Each plugin contains canonical `skills/<skill>/SKILL.md` entrypoints. Root `plugin.json` owns only the portable schema and stable name; `.codex-plugin/plugin.json` owns host metadata. Claude and Codex catalogs reference the same skill tree. Skill-local references load only for the applicable workflow branch.

[AGENTS.md](AGENTS.md) owns repository boundaries and release policy; [SKILL_TEMPLATE.md](SKILL_TEMPLATE.md) owns the detailed checklist, evidence states, self-check and five-field report. Skills stay in English with two-field frontmatter, descriptions up to 200 characters and entrypoints up to 200 lines. These are local conventions, not model restrictions.

[OpenAI's Astra guidance](https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra), checked on 2026-09-12, informs precise discovery, contextual reading, preservation of intent, and proportionate verification. The agreed detailed checklists, self-check and report remain intact. No model pin or specific provider is required.

## Validation

Run `pwsh -File scripts/validate-repository.ps1` and `pwsh -File scripts/test-repository-contracts.ps1`, plus installed per-skill/per-plugin validators and `claude plugin validate . --strict` as required by AGENTS.md. The disposable contract fixtures have no production access. Static checks prove structure and consistency; they do not prove agent performance. [Behavioral scenarios](docs/behavioral-validation.md) define separate observed-outcome checks.

Repository publication and Pages deployment do not create a tagged release or bump versions. Historical releases retain the catalog available at their tag.

Repository description, homepage and GitHub topics are maintained in [.github/repository-metadata.json](.github/repository-metadata.json). These are discovery metadata, not Git release tags. Update the GitHub About section from this file when lifecycle coverage changes.

## License

[MIT](LICENSE)

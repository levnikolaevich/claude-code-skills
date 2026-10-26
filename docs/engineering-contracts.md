# Engineering contracts and workflow ownership

This maintainer map explains the contracts owned by [AGENTS.md](../AGENTS.md), [SKILL_TEMPLATE.md](../SKILL_TEMPLATE.md) and the canonical skills linked in the [catalog](../README.md#lifecycle-and-plugins). It is not a runtime registry, a mandatory project artifact or a dependency of any skill. Update this projection when an owning boundary changes; the repository validator checks local references and standalone common blocks.

## Rule authority

| Kind | Owner | Consumer obligation |
|---|---|---|
| Personal defaults | Personalized global instructions | Respect task mode and project specialization; do not overwrite unique preferences from a template |
| Project intent and mandatory standards | Accepted requirements, standards and ADRs | Preserve source identities, mandatory constraints and explicit deviations |
| Common execution and report semantics | Skill template | Distribute checked standalone copies; never require loading the template at runtime |
| Workflow algorithm and mutation boundary | Each canonical skill | Choose by requested outcome; incidental domain work need not invoke another skill |
| Exact limits, settings and commands | Project executable configuration | Reference the owner rather than maintaining another inventory |
| Historical experience | Memory and history | Verify current state; history cannot supersede accepted policy |

The [template's execution contract](../SKILL_TEMPLATE.md#skillmd-template) owns requirement traceability, causal scope and evidence reuse. Each review skill owns its finding thresholds; this map only identifies the responsible workflow.

## Applying supplied engineering standards

General principles apply across appropriate workflows. Conditional obligations apply only to relevant technologies and risks. Project choices remain binding in that project without becoming defaults elsewhere. Conflicts require an explicit decision; tools cannot silently weaken policy.

| Source obligation | Classification and owner | Acceptance evidence |
|---|---|---|
| Plan, source checks, decisions and resumption | General: 31 and shared continuation contract. Project-specific: mandatory plan file, journal and push timing | Requirements survive handoff; changed sources invalidate only affected evidence |
| Research, root cause, facts from commands/history | General: shared evidence contract; 41 owns repair | Applicable version/source and observed outcome, not remembered numbers |
| Fast/slow check order, progress, priorities and delegation | General: dependency-aware verification and user intent. Project-specific: intervals, shared checkout and coordinator Git policy | No lost requests, conflicting mutations or unjustified repeated checks |
| Independent review after large changes | Conditional: 52 and accepted project review policy | Disclosed independent scope, findings and gaps |
| Target architecture and old-code removal | General: 41/43 remove superseded mechanisms. Project-specific: no compatibility or saved-data migration | Protected consumers/data remain valid or their change is authorized |
| SSOT, semantic constants, tokens, shared limits | General: one concept owner. Conditional: 23/93 and typed/generated cross-language contracts | No competing source; derived representations have parity evidence |
| Layers, pure domain, API ownership and OOP | General: explicit responsibilities. Project-specific: exact layer chain or single API module | 23 defines and 56 verifies accepted dependency/side-effect boundaries |
| Strict types, boundary schemas, interfaces, options and invariants | Conditional: 91 guidance, 41/93 implementation, 46 enforcement | Bad input and forbidden type patterns rejected through owning boundary |
| Safe error codes, request identity, feedback ADR | Conditional: 96 error contract, 97 diagnostic correlation, 12/24 product decisions | Safe response, retained cause, one feedback owner, no input leakage |
| Latest-wins, timestamps, cancellation, late results and quotas | Conditional: 41 operation behavior, 96 outcome presentation, 98 replay safety | Superseded results/errors discarded; bounded cleanup and ordering |
| Libraries, newest versions, exact pins, types and NOTICE | General: proven suitability. Project-specific: version/license/attribution policy; 42 and 92 | Compatible resolved inputs, approved licenses and reproducible packaging |
| Lint every technology, strict presets, warnings and exceptions | Conditional: 46 implements accepted policy; 91 documents it | Actual input coverage, configured rules and positive/negative command outcomes |
| Complexity, dead files/exports/dependencies/styles/translation keys | Conditional: 46 enforces declared rules, 54 assesses maintainability | Controls detect intended violations without rejecting legitimate cases |
| Import cycles, ownership, custom checks and logging placement | Conditional: 23/56 establish/assess boundaries, 46 automates them, 97 owns logging semantics | Resolved dependency paths and meaningful diagnostics; no parallel policy |
| Promises, real errors, blocking work, threads/processes and deadlines | Conditional: 41/96/98 implementation, 54/57 assessment, 46 detectable patterns | Handled rejection, resource ownership and bounded execution |
| Profile-first, bundled benchmarks, hot loops and idle costs | Conditional: 44/45 measurement, 41 product contract | Comparable runtime evidence; static patterns cannot prove performance |
| Optional loading, bounded downloads, reuse and compression | Conditional: 41/44 behavior, 92 packaging, 63 serving | Usable critical path and measured loading/network outcomes |
| Cache policies, keys, limits, invalidation and stored-data validation | Conditional: 23/93 policy ownership, 41 implementation, 44/57 assessment | Correct isolation, freshness, bounded resources and validated reads |
| Audio context, audible clock, event timestamps and calibration | Project/domain-specific: requirements/ADRs and 41 | Measured timing and device behavior; no universal audio policy |
| Structured logs, levels, forwarding, rotation and fallback | Conditional: 97 signals, 92/63 runtime delivery. Project-specific: JSONL/file sink choices | Real output, correlation, redaction, bounds and outage behavior |
| Input attacks, SSRF, origin checks, rates, headers and secrets | Conditional: 54 threat assessment, 94/95 identity/access, 93 limits, 41 affected paths | Reachable attack-specific checks; no generic security pass from tooling alone |
| Non-root containers and verified downloads | Conditional: 92 and accepted supply-chain policy | Actual runtime privileges and integrity evidence |
| Useful tests, E2E risks, regression-first and accessibility scans | General: 32/51/55. Project-specific: mandatory browser/screenshot coverage | Independent oracles and observed execution; engineering controls assessed separately |
| Random order, timezone, deterministic waits, retries and repetition | Conditional: 32/51/55 risk coverage. Project-specific: exact required matrix | Reproducible first failure, seed/environment and truthful execution status |
| Locales, plural parity, glossary, motion, touch targets and design tokens | Conditional: 12/13 specify, 41 implements, 51/52 verify. Project-specific: languages/dimensions | Complete journeys and approved accessibility/localization acceptance |
| Screenshots, overflow, state preservation and few-action journeys | Conditional: 13 design and 52 delivery review | Real target viewport/locale behavior; simulated artifacts labeled |
| README map, ADRs, story CSV, flow diagrams and checked references | General: one owner and same-change updates. Project-specific: exact format; 12/22/25/53 | Current requirements/code/test links without copying implementation |
| Branches, authorship, commits, push cadence and no force-push | Project-specific: 61/62 consume accepted delivery policy | Explicit publication authority and required passing gates |
| CI placement, staged hooks, parallel local checks and image caching | Project-specific: 46 check commands, 63 pipeline policy, 92 images | Each check really runs; pipeline authority and artifact identity preserved |
| Windows, portable launchers, EOL, tracked inputs and privileges | Conditional on supported environments: 46/92 and implementation checks | Commands run on required OS; exclusions/skips explicit; identity-sensitive bytes preserved |
| Piano gestures, MusicXML verification, branding and licensed visual assets | Project-only: product requirements and scoped implementation | Product-specific acceptance; do not copy device/brand defaults into general skills |

For strictness, preset selection and policy exceptions, use the [quality-gate design checklist](../plugins/implementation-suite/skills/ln-46-quality-gate-engineer/SKILL.md#2-design-the-smallest-enforceable-control). Compatibility and data transitions follow the accepted target-project decisions and the owning architecture or implementation skill.

## Outcome routing and domain treatment

All skills consume the common contract. This table maps current responsibilities; it is not an ordered lifecycle.

| Skills | Primary responsibility |
|---|---|
| 11 | Opportunity evidence, not engineering setup |
| 12, 13 | Product and interaction acceptance, including applicable mandatory standards |
| 21 | Mandatory constraints distinguished from assumptions/preferences |
| 22, 24, 25 | Current architecture, individual decisions and diagrams; consume original requirements |
| 23, 26 | Verifiable target boundaries and authorized compatibility/data transitions |
| 31, 33 | Complete work units and read-only plan review, including necessary refactoring and missing checks |
| 32 | Product-test strategy distinct from engineering-control evidence |
| 41 | Feature/fix including causal structural repair and all affected consumers |
| 42, 43 | Accepted dependency policy; modernization as its own requested outcome |
| 44, 45 | Measured optimization and controlled comparison; no static speed claims |
| 46 | Executable engineering checks and their acceptance/rejection behavior |
| 51, 55 | Product-test creation/audit; no product repair or rejection of useful engineering controls |
| 52, 54, 56 | Change, codebase and architecture reviews; explicit constraints and effective enforcement |
| 53 | Documentation ownership, freshness and valid references |
| 57 | Query, transaction, cache and resource correctness |
| 61, 62, 64 | Authorized publication, tagged release and announcement; consume valid evidence |
| 63 | Delivery topology, permissions, credentials, publication, rollout and health |
| 71, 72 | Read-only incident diagnosis and product-outcome assessment |
| 81 | Skill ownership, standalone contracts and discovery versus execution evidence |
| 91 | Guidance and missing-control identification; never tooling implementation |
| 92, 93 | Local packaging and application configuration, separate from check configuration |
| 94, 95, 96, 97, 98, 99 | Identity, grants, errors, diagnostics, reliable effects and database lifecycle; incidental work stays with its requested outcome |

### Quality gates versus delivery

| Request | Owner | Limit |
|---|---|---|
| Document accepted engineering rules and missing controls | 91 | Guidance only; no implementation readiness claim |
| Configure analyzers and wire commands into existing entrypoints | 46 | No pipeline topology, triggers, credentials, permissions, environments, publication or rollout changes |
| Implement a feature and maintain its affected checks | 41 | Necessary incidental tooling is allowed within scope; no mandatory handoff |
| Upgrade analysis dependencies as the primary outcome | 42 | Compatibility and regression evidence |
| Change delivery pipeline or remote rollout | 63 | Consume check commands rather than own duplicate rule semantics |
| Assess an existing change, codebase or architecture | 52/54/56 | Read-only findings, not repairs |

The [quality-gate boundaries](../plugins/implementation-suite/skills/ln-46-quality-gate-engineer/SKILL.md#boundaries) and [verdicts](../plugins/implementation-suite/skills/ln-46-quality-gate-engineer/SKILL.md#verdict) define setup versus project compliance, read-only assessment and authorized mutations.

## Validation coverage

The repository validator checks common-block parity and distribution; contract fixtures detect drift and broken paths. Per-skill and plugin checks cover their documented surfaces. None proves agent behavior.

Changes to common contracts invalidate prior evidence for every affected skill. Retain existing domain cases and use the [behavioral validation procedure](behavioral-validation.md) to select them by changed obligations. Structural repair, hidden lint coverage, standalone setup and natural-language routing have separate cases. Model execution remains explicitly authorized work; prepared cases are NOT RUN until observed results bind to their exact content.

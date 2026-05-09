# Codebase Audit Suite

> Managed audit coordinators for security, quality, architecture, tests, and performance

## Install

```bash
# Add the marketplace once
/plugin marketplace add levnikolaevich/claude-code-skills

# Install this plugin
/plugin install codebase-audit-suite@levnikolaevich-skills-marketplace
```

## What it does

Run comprehensive audits on any existing codebase. Five coordinator skills launch managed evaluation-worker runtimes, checkpoint child runs, collect JSON summaries first, and then assemble markdown evidence for documentation, security, build health, code principles, dependencies, dead code, observability, concurrency, lifecycle, test suites, architecture patterns, layer boundaries, API contracts, and persistence performance.

## Skills

### Documentation (5)

| Skill | Description |
|-------|-------------|
| ln-610-docs-auditor | Coordinate 4 documentation audit workers |
| ln-611-docs-structure-auditor | Check hierarchy, links, SSOT, freshness |
| ln-612-semantic-content-auditor | Audit content against SCOPE and goals |
| ln-613-code-comments-auditor | Check WHY-not-WHAT, density, docstrings |
| ln-614-docs-fact-checker | Verify claims (paths, versions, counts) against code |

### Codebase Health (10)

| Skill | Description |
|-------|-------------|
| ln-620-codebase-auditor | Coordinate 9 parallel audit workers |
| ln-621-security-boundary-auditor | Secrets, injection, XSS, validation, sensitive defaults |
| ln-622-build-delivery-gate-auditor | Build, lint, type, test, and CI gate failures |
| ln-623-duplication-overabstraction-auditor | DRY/KISS/YAGNI with evidence |
| ln-624-code-maintainability-hotspot-auditor | Complexity, long methods, signatures, constants |
| ln-625-dependency-reuse-auditor | Dependency health and generic utility/integration reuse |
| ln-626-dead-code-pruning-auditor | Unreachable, unused, obsolete, commented-out code |
| ln-627-diagnosability-auditor | Structured logs, metrics, traces, correlation IDs |
| ln-628-concurrency-correctness-auditor | Async races, thread safety, TOCTOU, deadlocks |
| ln-629-runtime-lifecycle-config-auditor | Bootstrap, shutdown, probes, fail-fast config validation |

### Test Suites (9)

| Skill | Description |
|-------|-------------|
| ln-630-test-auditor | Coordinate 8 test audit workers |
| ln-631-test-business-logic-auditor | Detect tests validating framework, not your code |
| ln-632-test-e2e-priority-auditor | Validate E2E coverage for critical paths |
| ln-633-test-value-auditor | Calculate test Usefulness Score (Impact x Probability) |
| ln-634-test-coverage-auditor | Identify missing tests for critical business logic |
| ln-635-test-isolation-auditor | Check isolation, determinism, anti-patterns |
| ln-636-manual-test-auditor | Audit manual test scripts for quality |
| ln-637-test-structure-auditor | Audit test file organization and naming |
| ln-638-test-oracle-effectiveness-auditor | Assertion strength and test oracles that prove real defects |

### Architecture (8)

| Skill | Description |
|-------|-------------|
| ln-640-pattern-evolution-auditor | Audit architectural patterns against best practices |
| ln-641-pattern-fitness-auditor | Analyze one implemented architectural pattern |
| ln-642-layer-ownership-boundary-auditor | Check layer, resource ownership, orchestration boundaries |
| ln-643-api-contract-auditor | Check layer leakage, missing DTOs, error contracts |
| ln-644-dependency-topology-auditor | Build dependency topology, detect cycles, coupling metrics |
| ln-645-architecture-modernization-auditor | Simplify obsolete custom architectural mechanisms |
| ln-646-project-structure-auditor | Modules, domains, layer layout, junk drawers |
| ln-647-configuration-boundary-auditor | Typed settings boundary and scattered config access |

### Persistence (5)

| Skill | Description |
|-------|-------------|
| ln-650-persistence-performance-auditor | Coordinate 4 persistence audit workers |
| ln-651-query-efficiency-auditor | N+1, over-fetching, missing bulk operations |
| ln-652-transaction-correctness-auditor | Transaction scope, rollback, long-held txns |
| ln-653-runtime-performance-auditor | Blocking IO, unnecessary allocations, sync sleep |
| ln-654-resource-lifecycle-auditor | Session scope, pool config, error path leaks |

## How it works

5 coordinators (`ln-610`, `ln-620`, `ln-630`, `ln-640`, `ln-650`) use skill-local `references/scripts/evaluation-runtime/cli.mjs` copies to launch audit workers. Managed child runs write worker summaries to `.hex-skills/runtime-artifacts/runs/{parent_run_id}/evaluation-worker/{worker}--{identifier}.json`, worker markdown reports to `.hex-skills/runtime-artifacts/runs/{parent_run_id}/audit-report/`, and coordinator summaries to `.hex-skills/runtime-artifacts/runs/{parent_run_id}/evaluation-coordinator/{identifier}.json`. Coordinators aggregate JSON summaries first, read markdown reports only for findings/evidence, write the public report under `docs/project/`, append `docs/project/.audit/results_log.md`, and then clean the run-scoped runtime artifacts.

## Quick start

```bash
ln-620-codebase-auditor  # Full codebase audit
ln-610-docs-auditor      # Documentation audit only
ln-630-test-auditor      # Test suite audit only
```

## Related

- [All plugins](../../README.md)
- [Architecture guide](../architecture/SKILL_ARCHITECTURE_GUIDE.md)

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

Run comprehensive audits on any existing codebase. Five coordinator skills launch managed audit-worker runtimes, checkpoint child runs, collect JSON summaries first, and then assemble markdown evidence for documentation, security, build health, code principles, dependencies, dead code, observability, concurrency, lifecycle, test suites, architecture patterns, layer boundaries, API contracts, and persistence performance.

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
| ln-621-security-auditor | Secrets, injection, XSS, insecure deps, validation |
| ln-622-build-auditor | Compiler errors, deprecations, type errors, build config |
| ln-623-code-principles-auditor | DRY (10 types), KISS/YAGNI, error handling, DI |
| ln-624-code-quality-auditor | Complexity, nesting, god classes, O(n^2), N+1 |
| ln-625-dependencies-auditor | Outdated, unused, reinvented wheels, CVE scan |
| ln-626-dead-code-auditor | Unreachable code, unused imports/vars/functions |
| ln-627-observability-auditor | Structured logging, health checks, metrics, tracing |
| ln-628-concurrency-auditor | Async races, thread safety, TOCTOU, deadlocks |
| ln-629-lifecycle-auditor | Bootstrap order, graceful shutdown, signal handling |

### Test Suites (8)

| Skill | Description |
|-------|-------------|
| ln-630-test-auditor | Coordinate 7 test audit workers |
| ln-631-test-business-logic-auditor | Detect tests validating framework, not your code |
| ln-632-test-e2e-priority-auditor | Validate E2E coverage for critical paths |
| ln-633-test-value-auditor | Calculate test Usefulness Score (Impact x Probability) |
| ln-634-test-coverage-auditor | Identify missing tests for critical business logic |
| ln-635-test-isolation-auditor | Check isolation, determinism, anti-patterns |
| ln-636-manual-test-auditor | Audit manual test scripts for quality |
| ln-637-test-structure-auditor | Audit test file organization and naming |

### Architecture (8)

| Skill | Description |
|-------|-------------|
| ln-640-pattern-evolution-auditor | Audit architectural patterns against best practices |
| ln-641-pattern-analyzer | Analyze single pattern, calculate 4 scores |
| ln-642-layer-boundary-auditor | Check layer violations, transaction boundaries |
| ln-643-api-contract-auditor | Check layer leakage, missing DTOs, error contracts |
| ln-644-dependency-graph-auditor | Build dep graph, detect cycles, coupling metrics |
| ln-645-open-source-replacer | Find OSS alternatives for custom modules |
| ln-646-project-structure-auditor | File hygiene, conventions, naming, organization |
| ln-647-env-config-auditor | Env var sync, defaults, naming, startup validation |

### Persistence (5)

| Skill | Description |
|-------|-------------|
| ln-650-persistence-performance-auditor | Coordinate 4 persistence audit workers |
| ln-651-query-efficiency-auditor | N+1, over-fetching, missing bulk operations |
| ln-652-transaction-correctness-auditor | Transaction scope, rollback, long-held txns |
| ln-653-runtime-performance-auditor | Blocking IO, unnecessary allocations, sync sleep |
| ln-654-resource-lifecycle-auditor | Session scope, pool config, error path leaks |

## How it works

5 coordinators (`ln-610`, `ln-620`, `ln-630`, `ln-640`, `ln-650`) each launch workers through `shared/scripts/audit-worker-runtime/cli.mjs`. Managed child runs write worker summaries to `.hex-skills/runtime-artifacts/runs/{parent_run_id}/audit-worker/{worker}--{identifier}.json`, worker markdown reports to `.hex-skills/runtime-artifacts/runs/{parent_run_id}/audit-report/`, and coordinator summaries to `.hex-skills/runtime-artifacts/runs/{parent_run_id}/audit-coordinator/`. Coordinators aggregate JSON summaries first, read markdown reports only for findings/evidence, write the public report under `docs/project/`, append `docs/project/.audit/results_log.md`, and then clean the run-scoped runtime artifacts.

## Quick start

```bash
ln-620-codebase-auditor  # Full codebase audit
ln-610-docs-auditor      # Documentation audit only
ln-630-test-auditor      # Test suite audit only
```

## Related

- [All plugins](../../README.md)
- [Architecture guide](../architecture/SKILL_ARCHITECTURE_GUIDE.md)

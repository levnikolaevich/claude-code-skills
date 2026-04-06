# Optimization Suite

> Multi-cycle performance profiling, dependency upgrades, and code modernization

## Install

```bash
# Add the marketplace once
/plugin marketplace add levnikolaevich/claude-code-skills

# Install this plugin
/plugin install optimization-suite@levnikolaevich-skills-marketplace
```

## What it does

Three optimization tracks: Performance (profile -> research -> validate -> execute with keep/discard loop), Dependencies (upgrade npm/NuGet/pip packages with breaking change handling), and Modernization (replace custom modules with OSS, optimize bundle size).

## Skills

| Skill | Description |
|-------|-------------|
| ln-810-performance-optimizer | Multi-cycle diagnostic pipeline coordinator |
| ln-811-performance-profiler | Runtime profiling with multi-metric measurement |
| ln-812-optimization-researcher | Competitive benchmarks and solution research |
| ln-813-optimization-plan-validator | Validate plan via Codex + Gemini review |
| ln-814-optimization-executor | Hypothesis testing with keep/discard loop |
| ln-820-dependency-optimization-coordinator | Coordinate upgrades across package managers |
| ln-821-npm-upgrader | Upgrade npm/yarn/pnpm dependencies |
| ln-822-nuget-upgrader | Upgrade .NET NuGet packages |
| ln-823-pip-upgrader | Upgrade Python pip/poetry/pipenv dependencies |
| ln-830-code-modernization-coordinator | Coordinate OSS replacement and bundle optimization |
| ln-831-oss-replacer | Replace custom modules with OSS packages |
| ln-832-bundle-optimizer | Reduce JS/TS bundle size |
| ln-840-benchmark-compare | A/B benchmark: built-in vs hex-line tool comparison |

## How it works

**Performance:** ln-811 (profile) -> ln-812 (research) -> ln-813 (validate) -> ln-814 (execute). Repeats until target metric is met. Each cycle measures before/after and keeps or discards changes.

**Dependencies:** ln-820 -> ln-821/822/823 (one worker per package manager). The coordinator assigns deterministic child runs, each worker emits a `dependency-worker` summary, and ln-820 records the final `dependency-coordinator` summary.

**Modernization:** ln-830 -> ln-831 (OSS replacement) + ln-832 (bundle optimization). The coordinator assigns deterministic child runs, workers emit `modernization-worker` summaries, and ln-830 records the final `modernization-coordinator` summary.

**Benchmark:** ln-840 runs the scenario suite, writes the comparison report, and emits a final `benchmark-worker` summary artifact with validity and scenario metrics.

## Quick start

```bash
ln-810-performance-optimizer                # Profile and optimize
ln-820-dependency-optimization-coordinator  # Upgrade all dependencies
ln-830-code-modernization-coordinator       # OSS replacement + bundle
```

## Related

- [All plugins](../../README.md)
- [Architecture guide](../architecture/SKILL_ARCHITECTURE_GUIDE.md)

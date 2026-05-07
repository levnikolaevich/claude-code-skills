<!-- SOURCE-OF-TRUTH: shared/references/ci_tool_detection.md. Edit ONLY here; run `node tools/marketplace/shared.mjs sync` -->

# CI Tool Detection & Execution Guide

<!-- SCOPE: Unified reference for detecting and running lint, typecheck, test, and build commands across stacks. Single Source of Truth — all skills reference this instead of inline detection logic. -->

## Discovery Hierarchy

Resolve commands in this order (stop at first match per category):

| Priority | Source | Example |
|----------|--------|---------|
| 1 (highest) | `docs/project/tech_stack.md` | Explicit lint/test/build commands |
| 2 | `docs/project/infrastructure.md` | Service endpoints, ports, base URLs |
| 3 | `docs/project/runbook.md` | Operational commands with flags |
| 4 | Config file detection (see Command Registry) | `.eslintrc*`, `pyproject.toml`, `Makefile` |
| 5 | `package.json` scripts | `scripts.lint`, `scripts.test`, `scripts.build` |
| 6 (fallback) | SKIP with info message | No tooling detected |

**Rule:** Priority 1-3 commands override auto-detection. If `tech_stack.md` says `ruff check --config custom.toml`, use that exact command.

## Command Registry

### Linters

| Stack | Config Detection | Run | JSON Output | Auto-Fix | Timeout |
|-------|-----------------|-----|-------------|----------|---------|
| JS/TS | `.eslintrc*`, `eslint.config.*`, `biome.json` | `npx eslint .` | `--format json` | `--fix` | 2min |
| Python | `pyproject.toml [tool.ruff]`, `.flake8`, `setup.cfg` | `ruff check .` | `--output-format json` | `--fix` | 2min |
| .NET | `.editorconfig`, `Directory.Build.props` | `dotnet format` | — | implicit | 2min |
| Go | `golangci-lint` in Makefile/CI | `golangci-lint run` | `--out-format json` | `--fix` | 2min |
| Styles | `.stylelintrc*` | `npx stylelint "**/*.css"` | `--formatter json` | `--fix` | 2min |

### Type Checkers

| Stack | Config Detection | Run | Timeout |
|-------|-----------------|-----|---------|
| TypeScript | `tsconfig.json` | `tsc --noEmit` | 5min |
| Python (mypy) | `mypy.ini`, `pyproject.toml [tool.mypy]` | `mypy .` | 5min |
| Python (pyright) | `pyrightconfig.json`, `pyproject.toml [tool.pyright]` | `pyright` | 5min |
| Go | built-in | `go vet ./...` | 5min |
| Rust | built-in | `cargo check` | 5min |

### Test Frameworks

| Stack | Config Detection | Run | JSON Output | Timeout |
|-------|-----------------|-----|-------------|---------|
| JS (Jest) | `jest.config.*`, `package.json jest` | `npx jest` | `--json` | 5min |
| JS (Vitest) | `vitest.config.*` | `npx vitest run` | `--reporter=json` | 5min |
| Python | `pytest.ini`, `pyproject.toml [tool.pytest]` | `pytest` | `--json-report` | 5min |
| Go | built-in | `go test ./...` | `-json` | 5min |
| .NET | `*.csproj` with test refs | `dotnet test` | `--logger trx` | 5min |
| Rust | built-in | `cargo test` | `--no-fail-fast` | 5min |

### Build

| Stack | Config Detection | Run | Timeout |
|-------|-----------------|-----|---------|
| JS/TS | `package.json scripts.build` | `npm run build` | 5min |
| Python | `setup.py`, `pyproject.toml [build-system]` | `python -m build` | 5min |
| Go | `main.go` / `cmd/` | `go build ./...` | 5min |
| .NET | `*.sln`, `*.csproj` | `dotnet build` | 5min |
| Rust | `Cargo.toml` | `cargo build` | 5min |
| Java | `pom.xml` | `mvn compile` | 5min |

### Benchmarks

| Stack | Config Detection | Run | Output | Timeout |
|-------|-----------------|-----|--------|---------|
| Go | `*_test.go` + `func Benchmark` | `go test -bench={name} -benchmem -count=5 -run=^$ {pkg}` | `-json` | 5min |
| Python | `pytest-benchmark` in deps | `pytest --benchmark-only --benchmark-json=bench.json` | JSON | 5min |
| Rust | `benches/` directory | `cargo bench -- {name}` | stdout | 5min |
| JS (Vitest) | `*.bench.ts` | `npx vitest bench` | `--reporter=json` | 5min |
| Java (JMH) | `@Benchmark` annotation | `mvn exec:java` | `-rf json` | 10min |
| .NET | `[Benchmark]` attribute | `dotnet run -c Release` | stdout | 10min |

## Execution Rules

1. **Exit code:** 0 = PASS, non-zero = FAIL. When piping through `tail`/`head`/`awk`, preserve exit code via `set -o pipefail` or `${PIPESTATUS[0]}` — truncation must never mask failure.
2. **Output capture:** on FAIL apply the normalization chain (normalize → dedupe → group → truncate) per `output_normalization.md`; raw `tail -N` is a last resort. Keep the compact result in-context; preserve the **full** stderr/stdout artifact at `.hex-skills/logs/error_recovery/` (Pattern 6, `TOKEN_EFFICIENCY_PATTERNS.md`).
3. **Compact output flags:** prefer framework-native compact modes before any piping — `pytest --tb=short -q`, `cargo test 2>&1 | tail -N` (with pipefail), `dotnet test --verbosity minimal`, `npm test --silent`, `go test -json`. For large directory listings use `ls | head -N`.
4. **JSON preferred:** use `--format json` / `--json` / `--reporter=json` where available — structured output is cheaper to parse and easier to normalize than free-form text.
5. **Auto-fix flow:** run with `--fix` → re-run without `--fix` → verify zero errors.
6. **No interactive prompts:** use CI-compatible flags (`--no-interaction`, `--ci`).

## Graceful Degradation

| Situation | Action |
|-----------|--------|
| No config found for category | SKIP with info: "No {category} tooling detected" |
| Command not installed | SKIP with warning: "{tool} not found in PATH" |
| Timeout exceeded | Mark FAIL with "timeout after {N}min" |
| tech_stack.md missing | Fall through to config file detection (Priority 3+) |

## Skill-Specific Behavior

Each skill adds its own logic ON TOP of this guide:

| Role | Additional Behavior |
|------|--------------------|
| Push workflow | Auto-fix enabled; 2 retry attempts; continue on persistent errors |
| Task reviewer | Run only when verdict=Done; FAIL overrides to To Rework |
| Quality coordinator | Delegates tests to regression checker; aggregates results |
| Tech debt cleaner | Revert ALL changes on any FAIL (`git checkout .`) |
| Regression checker | Tests only; prefer infrastructure.md + runbook.md commands over auto-detect |
| Build auditor | Full audit with severity scoring (CRITICAL/HIGH/MEDIUM/LOW) |
| Performance profiler | Read-only analysis; no tests/build needed; traces call paths |
| Optimization researcher | Read-only research; no tests/build needed; uses MCP research chain |
| Optimization executor | Tests + benchmark; multi-file changes; compound baselines; keep/discard loop |
| OSS replacer | Tests only; atomic per-module revert; delete old on keep |
| Bundle optimizer | Build only; metric = bundle size; JS/TS specific |

---
**Version:** 1.0.0
**Last Updated:** 2026-02-15

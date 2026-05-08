<!-- SOURCE-OF-TRUTH: shared/references/ci_tool_detection.md. Edit ONLY here; run `node tools/marketplace/shared.mjs sync` -->

# CI Tool Detection Contract

Small runtime contract for discovering lint, typecheck, test, build, and benchmark commands.

## Discovery Order

Stop at the first reliable command per category:

1. `docs/project/tech_stack.md`
2. `docs/project/infrastructure.md`
3. `docs/project/runbook.md`
4. tool config files
5. package/build manifests
6. skip with evidence

Explicit project docs override auto-detection.

## Detection Map

| Category | Common signals | Default command shape |
|---|---|---|
| lint | `eslint.config.*`, `.eslintrc*`, `biome.json`, `pyproject.toml`, `.flake8`, `.editorconfig` | `npm run lint`, `npx eslint .`, `ruff check .`, `dotnet format --verify-no-changes` |
| typecheck | `tsconfig.json`, `mypy.ini`, `pyrightconfig.json`, Go/Rust manifests | `tsc --noEmit`, `mypy .`, `pyright`, `go vet ./...`, `cargo check` |
| test | `jest.config.*`, `vitest.config.*`, `pytest.ini`, test project refs | `npm test`, `npx vitest run`, `pytest`, `go test ./...`, `dotnet test`, `cargo test` |
| build | `package.json`, `pyproject.toml`, `go.mod`, `*.sln`, `Cargo.toml`, `pom.xml` | `npm run build`, `python -m build`, `go build ./...`, `dotnet build`, `cargo build`, `mvn compile` |
| benchmark | `*_test.go`, `pytest-benchmark`, `benches/`, `*.bench.ts`, JMH/BenchmarkDotNet markers | framework benchmark command with JSON/text artifact |

## Execution Rules

- Preserve the real exit code; piping/truncation must not mask failure.
- Prefer compact or JSON output when the tool supports it.
- On failure, keep compact output in context and preserve full logs under `.hex-skills/logs/error_recovery/` when the skill writes artifacts.
- Use CI-compatible non-interactive flags.
- Auto-fix flow is `fix -> rerun without fix -> verify`.

## Graceful Degradation

| Situation | Result |
|---|---|
| no config found | skip category with `No {category} tooling detected` |
| command missing | skip with `{tool} not found in PATH` |
| timeout | fail category with timeout evidence |
| project docs missing | fall through to config detection |

## Evidence Shape

Return or record:

```json
{
  "category": "test",
  "command": "npm test",
  "source": "docs|config|manifest|fallback",
  "status": "pass|fail|skipped",
  "evidence": "short reason or log artifact path"
}
```

Long stack/provider recipes are skill-local or conditional; this contract is only the command detection and evidence SSOT.

**Version:** 1.0.0
**Last Updated:** 2026-02-15

<!-- SOURCE-OF-TRUTH: shared/references/ci_tool_detection.md. Edit ONLY here; run `node tools/marketplace/shared.mjs sync` -->

# CI Tool Detection Contract

Small runtime contract for discovering lint, typecheck, test, build, and benchmark commands.

## Discovery Order

Use the first reliable source per category:

1. `docs/project/tech_stack.md`
2. `docs/project/infrastructure.md`
3. `docs/project/runbook.md`
4. tool config files
5. package/build manifests
6. skip with evidence

Explicit project docs override auto-detection.

## Detection Map

| Category | Signals | Default shape |
|---|---|---|
| lint | eslint/biome/ruff/dotnet format configs | `npm run lint`, `npx eslint .`, `ruff check .`, `dotnet format --verify-no-changes` |
| typecheck | `tsconfig`, mypy/pyright, Go/Rust manifests | `tsc --noEmit`, `mypy .`, `pyright`, `go vet ./...`, `cargo check` |
| test | Jest/Vitest/Pytest, test project refs | `npm test`, `npx vitest run`, `pytest`, `go test ./...`, `dotnet test`, `cargo test` |
| build | package/build manifests, solutions, Maven, Cargo | `npm run build`, `python -m build`, `go build ./...`, `dotnet build`, `cargo build`, `mvn compile` |
| benchmark | benchmark files/framework markers | framework benchmark command with JSON/text artifact |

## Execution Rules

- Preserve real exit codes; piping/truncation must not mask failure.
- Prefer compact or JSON output when supported.
- Use CI-compatible non-interactive flags.
- Auto-fix flow is `fix -> rerun without fix -> verify`.
- On failure, keep compact context and preserve full logs under `.hex-skills/logs/error_recovery/` when the skill writes artifacts.

## Skip/Failure Evidence

| Situation | Result |
|---|---|
| no config found | skip with `No {category} tooling detected` |
| command missing | skip with `{tool} not found in PATH` |
| timeout | fail category with timeout evidence |
| project docs missing | continue to config detection |

Record `{category, command, source, status, evidence}` where `source` is `docs|config|manifest|fallback` and `status` is `pass|fail|skipped`.

Long provider recipes are skill-local or conditional; this file is only detection and evidence SSOT.

**Version:** 1.0.0
**Last Updated:** 2026-02-15

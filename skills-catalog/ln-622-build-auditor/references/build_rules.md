# Build Health Audit Rules

<!-- SCOPE: Build commands and error patterns ONLY. Contains per-stack commands, error regex, severity mapping. -->
<!-- DO NOT add here: Audit workflow → ln-622-build-auditor SKILL.md -->

Commands, error patterns, and recommendations for build health checks.

## 1. Compiler/Linter Errors

### Build Commands by Stack

| Stack | Build Command | Lint Command | Output Format |
|-------|---------------|--------------|---------------|
| Node.js/TypeScript | `npm run build` or `tsc --noEmit` | `npx eslint . --format json` | JSON (lint), stderr (tsc) |
| Python | `python -m compileall .` | `pylint **/*.py --output-format=json` | JSON |
| Go | `go build ./...` | `golangci-lint run --out-format json` | JSON |
| Rust | `cargo build` | `cargo clippy --message-format=json` | JSON |
| Java | `mvn compile` | `mvn checkstyle:check` | XML/text |
| .NET | `dotnet build` | `dotnet format --verify-no-changes` | Text |

### Error Parsing

**TypeScript (tsc):**
```
src/utils/helper.ts(45,10): error TS2322: Type 'string' is not assignable to type 'number'.
```
Pattern: `(.+)\((\d+),(\d+)\): error (TS\d+): (.+)`
→ Extract: file, line, column, code, message

**ESLint (JSON):**
```json
{
  "filePath": "src/api/routes.ts",
  "messages": [
    {
      "ruleId": "no-unused-vars",
      "severity": 2,
      "message": "'userId' is defined but never used",
      "line": 12,
      "column": 7
    }
  ]
}
```
→ severity: 2 = error, 1 = warning

### Severity Mapping

| Condition | Severity |
|-----------|----------|
| Build command exit code != 0 | CRITICAL |
| Linter error (severity=2) in production code | HIGH |
| Linter warning (severity=1) | MEDIUM |
| Stylistic issues (formatting) | LOW |

---

## 2. Unsupported API Warnings

### Detection Commands

| Stack | Command | Output |
|-------|---------|--------|
| Node.js | `npm outdated --json` | JSON with current/wanted/latest versions |
| Python | `pip list --outdated --format=json` | JSON with current/latest versions |
| Go | `go list -u -m all` | Text with available updates |
| Rust | `cargo outdated --format=json` | JSON with outdated crates |
| Java | `mvn versions:display-dependency-updates` | Text report |

### Grep Patterns for Code

| Pattern | Description |
|---------|-------------|
| `@obsolete` (Java/JS/TS) | Unsupported function annotation |
| `UnsupportedApiWarning` (Python) | Runtime deprecation warning |
| `#[obsolete]` (Rust) | Unsupported attribute |
| `obsolete` (C#) | Obsolete attribute |

### Severity by Version Gap

| Gap | Severity | Example |
|-----|----------|---------|
| Breaking change in next major | CRITICAL | Current: 2.5.0, Unsupported removed in: 3.0.0 |
| Unsupported >1 year ago | HIGH | Marked unsupported: 2022, Current: 2024 |
| Soft deprecation | MEDIUM | Still works, alternative suggested |
| No removal timeline | LOW | Unsupported but maintained |

---

## 3. Type Errors

### Type Checker Commands

| Stack | Tool | Command | Config |
|-------|------|---------|--------|
| TypeScript | tsc | `tsc --noEmit --strict` | `tsconfig.json`: `"strict": true` |
| Python | mypy | `mypy . --strict --show-error-codes` | `mypy.ini`: `strict = True` |
| Python | pyright | `pyright --warnings` | `pyrightconfig.json` |
| Go | go vet | `go vet ./...` | Built-in |
| Rust | cargo | `cargo check` | Built-in |

### Error Patterns

**TypeScript:**
```
error TS2345: Argument of type 'string' is not assignable to parameter of type 'number'.
error TS2339: Property 'name' does not exist on type 'User'.
error TS7006: Parameter 'req' implicitly has an 'any' type.
```

**mypy:**
```
error: Argument 1 to "process" has incompatible type "str"; expected "int"  [arg-type]
error: Function is missing a return type annotation  [no-untyped-def]
```

### Severity Rules

| Error Code | Severity | Example |
|------------|----------|---------|
| TS2322, TS2345 (type mismatch) | CRITICAL | Prevents compilation |
| TS7006 (implicit any) | HIGH | Runtime type error likely |
| TS2339 (missing property) | HIGH | Runtime error on access |
| TS2304 (cannot find name) | CRITICAL | Reference error |
| Missing type annotations | MEDIUM | Works but untyped |

---

## 4. Failed or Skipped Tests

### Test Commands by Framework

| Framework | Command | Output Format |
|-----------|---------|---------------|
| Jest | `npm test -- --json --outputFile=results.json` | JSON |
| Mocha | `mocha --reporter json > results.json` | JSON |
| Pytest | `pytest --json-report --json-report-file=results.json` | JSON |
| Go test | `go test ./... -json` | JSON (one result per line) |
| Cargo test | `cargo test --no-fail-fast -- --format=json` | JSON |

### JSON Result Parsing

**Jest:**
```json
{
  "numFailedTests": 2,
  "numPassedTests": 15,
  "numPendingTests": 3,
  "testResults": [
    {
      "name": "src/api.test.ts",
      "status": "failed",
      "message": "Expected 200, received 404",
      "assertionResults": [...]
    }
  ]
}
```

**Pytest:**
```json
{
  "summary": {
    "passed": 15,
    "failed": 2,
    "skipped": 3
  },
  "tests": [
    {
      "nodeid": "tests/test_api.py::test_login",
      "outcome": "failed",
      "call": {
        "longrepr": "AssertionError: assert 404 == 200"
      }
    }
  ]
}
```

### Severity Rules

| Condition | Severity |
|-----------|----------|
| Failed tests in production code | CRITICAL |
| Skipped tests in critical paths (auth, payment) | HIGH |
| Skipped tests in non-critical features | MEDIUM |
| Skipped with "TODO" comment | LOW |

### Skipped Test Detection

| Framework | Skip Syntax |
|-----------|-------------|
| Jest | `test.skip()`, `xit()`, `xdescribe()` |
| Mocha | `it.skip()`, `describe.skip()` |
| Pytest | `@pytest.mark.skip`, `@pytest.mark.xfail` |
| Go | `t.Skip()` |
| Rust | `#[ignore]` |

---

## 5. Build Configuration Issues

### Config Files by Stack

| Stack | Config Files | What to Check |
|-------|--------------|---------------|
| Node.js/TypeScript | `package.json`, `tsconfig.json`, `webpack.config.js` | Scripts, paths, compiler options |
| Python | `setup.py`, `pyproject.toml`, `requirements.txt` | Dependencies, build scripts |
| Go | `go.mod`, `go.sum`, `Makefile` | Module paths, versions |
| Rust | `Cargo.toml`, `Cargo.lock` | Dependencies, build settings |
| Java | `pom.xml`, `build.gradle` | Dependencies, plugins |

### Common Issues

| Issue | Detection | Severity |
|-------|-----------|----------|
| Missing build script | `package.json` has no "build" script | HIGH |
| Incorrect paths in tsconfig | `"outDir"` points to non-existent dir | HIGH |
| Missing dependencies | Import fails but not in package.json | CRITICAL |
| Conflicting dependencies | Same package with different versions | HIGH |
| No source maps | `tsconfig.json` has `"sourceMap": false` | MEDIUM |
| No minification | Webpack config missing `optimization` | MEDIUM |

### TypeScript Config Checks

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,          // ✅ MUST be true
    "sourceMap": true,       // ✅ SHOULD be true for debugging
    "declaration": true,     // ✅ SHOULD be true for libraries
    "outDir": "./dist",      // ✅ MUST exist
    "rootDir": "./src",      // ✅ MUST exist
    "esModuleInterop": true  // ✅ RECOMMENDED
  }
}
```

**Missing:**
- `"strict": false` → Severity: HIGH (no type safety)
- `"outDir"` points to deleted folder → Severity: CRITICAL (build fails)
- No `"sourceMap"` → Severity: MEDIUM (harder debugging)

---

## Effort Estimation

| Type | Time | Examples |
|------|------|----------|
| **S** | <1h | Fix typo, add missing type annotation, update config value |
| **M** | 1-4h | Fix test assertion, refactor type incompatibility, add build script |
| **L** | >4h | Migrate to new API, redesign type system, overhaul build pipeline |

---

## Tech Stack Specific Notes

### Node.js/TypeScript
- **Build:** `tsc` for types, `webpack`/`esbuild` for bundling
- **Lint:** ESLint with `@typescript-eslint` plugin
- **Test:** Jest with `ts-jest` or Vitest

### Python
- **Build:** `python -m build` for packages
- **Lint:** `pylint`, `flake8`, `ruff`
- **Type check:** `mypy` (gradual typing), `pyright` (strict)
- **Test:** `pytest`, `unittest`

### Go
- **Build:** `go build ./...`
- **Lint:** `golangci-lint` (aggregates multiple linters)
- **Test:** `go test ./... -cover`

### Rust
- **Build:** `cargo build --release`
- **Lint:** `cargo clippy` (strict mode with `-- -D warnings`)
- **Test:** `cargo test`

---

## Scoring Examples

| Violations | Calculation | Score |
|------------|-------------|-------|
| 0 violations | 10 - 0 | 10/10 |
| 1 critical (build fails) | 10 - (1*2.0) | 8/10 |
| 2 critical, 5 high | 10 - (2*2.0 + 5*1.0) | 10 - 9 = 1/10 |
| 10 high, 20 medium | 10 - (10*1.0 + 20*0.5) | 10 - 20 = 0/10 |

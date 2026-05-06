# Linter Configuration Guide

<!-- SCOPE: Configuration rationale, tool choices, troubleshooting. Contains WHY behind each setting. -->
<!-- DO NOT add here: Configuration workflow → ln-741-linter-configurator SKILL.md -->

Reference for ln-741-linter-configurator.

---

## Latest Versions Policy

This skill always installs the **latest available versions** of all tools at the time of use. No version pinning in install commands. This ensures projects start with the most current rules and security fixes.

---

## TypeScript: ESLint + Prettier + Unicorn

### Why This Combination?

- **ESLint** catches code quality issues (bugs, bad patterns, type safety)
- **Prettier** handles formatting (spacing, quotes, semicolons)
- **eslint-plugin-unicorn** enforces modern JavaScript/TypeScript patterns (134+ rules)
- **eslint-config-prettier** prevents conflicts between ESLint and Prettier

### Key Configuration Choices

| Setting | Value | Rationale |
|---------|-------|-----------|
| Config format | `eslint.config.ts` | Type-safe config, modern standard (ESLint 9.9+) |
| TypeScript preset | `recommendedTypeChecked` + `stylisticTypeChecked` | Official recommended start for typed projects |
| Parser config | `projectService` with `allowDefaultProject` | Modern approach (typescript-eslint v8+), replaces unsupported `project: true` |
| Code quality | `eslint-plugin-unicorn` | Active maintenance (Sindre Sorhus), 134+ rules for modern patterns |
| Prettier integration | `eslint-config-prettier/flat` | Correct import path for flat config format |

> **Note:** For teams highly proficient in TypeScript, replace `recommendedTypeChecked` with `strictTypeChecked` for maximum type safety.

### jiti Dependency

The `eslint.config.ts` format requires TypeScript transpilation:

| Node.js Version | Requirement |
|-----------------|-------------|
| < 22.10 | Install `jiti` as dev dependency |
| >= 22.10 | Native support (no extra deps) |

When in doubt, install jiti — it's a lightweight dev dependency.

### Test File Configuration

Tests are typically excluded from `tsconfig.json`, which breaks type-checked rules. The template uses the `disableTypeChecked` pattern:

```typescript
{
  files: ["**/*.test.ts", "tests/**/*.ts"],
  ...tseslint.configs.disableTypeChecked,
  rules: {
    // Relax strict rules for test code
    "@typescript-eslint/no-explicit-any": "off",
    "no-console": "off",
  },
}
```

### Common Customizations

**Disable a unicorn rule:**
```typescript
rules: {
  "unicorn/prevent-abbreviations": "off",
  "unicorn/no-null": "off",
}
```

**Use stricter TypeScript rules:**
```typescript
// Replace recommendedTypeChecked with:
...tseslint.configs.strictTypeChecked,
...tseslint.configs.stylisticTypeChecked,
```

### defineConfig vs tseslint.config

typescript-eslint v8.57+ introduces `defineConfig()` as the recommended API:

```typescript
// v8.57+
import { defineConfig } from "typescript-eslint";
export default defineConfig(/* ... */);

// v8.56 and earlier
import tseslint from "typescript-eslint";
export default tseslint.config(/* ... */);
```

Both are functionally identical. The template uses `tseslint.config()` for wider compatibility.

### Unicorn Config Name

Use `unicorn.configs.recommended` (not `unicorn.configs["flat/recommended"]` — the `flat/` prefix is unsupported).

### Optional Advanced Tools

| Tool | Purpose | When to Add |
|------|---------|-------------|
| dependency-cruiser | Architecture boundary enforcement | Projects with layer architecture |
| knip | Unused exports/dependencies | Any project >10 files |

---

## .NET: Roslyn Analyzers + dotnet format

### Why This Combination?

- **Roslyn Analyzers** provide compile-time code analysis
- **dotnet format** enforces .editorconfig rules
- **Directory.Build.props** applies settings to all projects

### Key Configuration Choices

| Setting | Value | Rationale |
|---------|-------|-----------|
| Nullable | enable | Catch null reference bugs |
| TreatWarningsAsErrors | true | Enforce quality in CI |
| AnalysisLevel | latest | Get newest analyzer rules |

### Common Customizations

**Suppress specific warning:**
```xml
<PropertyGroup>
  <NoWarn>CS1591</NoWarn> <!-- Missing XML comment -->
</PropertyGroup>
```

**Add additional analyzers:**
```xml
<ItemGroup>
  <PackageReference Include="StyleCop.Analyzers" Version="1.2.0-beta.556">
    <PrivateAssets>all</PrivateAssets>
  </PackageReference>
</ItemGroup>
```

### Optional: CSharpier

CSharpier is an opinionated formatter for C# (like Prettier for TypeScript). Growing adoption in 2025-2026.

```bash
dotnet tool install csharpier
dotnet csharpier .
```

Integrates with `.editorconfig` and supports format-on-save in VS Code/Rider.

---

## Python: Ruff + mypy

### Why This Combination?

- **Ruff** is a single tool that replaces Black, isort, flake8 + plugins, pyupgrade, and autoflake. ~1000x faster than traditional tools.
- **mypy** provides static type checking with `strict` mode. Ruff handles style/bugs, mypy handles type safety.

### Key Configuration Choices

| Setting | Value | Rationale |
|---------|-------|-----------|
| Config format | `ruff.toml` (standalone) or `pyproject.toml` | Both equivalent; pyproject.toml centralizes config |
| target-version | Match `requires-python` | Use correct Python idioms |
| line-length | 120 | Modern standard for wide monitors |
| select | 24 rule sets | Production-grade coverage |
| mccabe | max-complexity = 10 | McCabe standard threshold |

### Rule Set Rationale

| Rule | Category | What It Catches |
|------|----------|-----------------|
| E, F | Core | Syntax errors, undefined names, unused imports |
| UP | Modernization | Unsupported syntax that has newer alternatives |
| B | Bugs | Common bug patterns (mutable default args, etc.) |
| SIM | Simplification | Code that can be simplified |
| I | Imports | Import order and grouping |
| N | Naming | PEP 8 naming violations |
| ASYNC | Async | Blocking calls in async, missing await |
| S | Security | Hardcoded passwords, SQL injection, exec usage |
| C4, C90 | Complexity | Unnecessary comprehensions, cyclomatic complexity |
| DTZ | Datetime | Naive datetime usage (missing timezone) |
| T20 | Print | Print statements left in production code |
| RET | Return | Unnecessary return statements, missing returns |
| PERF | Performance | Performance anti-patterns |
| PT | Pytest | Pytest style issues |
| FURB | Refurb | Pythonic modernization opportunities |
| LOG, G | Logging | Logging best practices and string formatting |
| PIE | Misc | Miscellaneous lint rules |
| RUF | Ruff | Ruff-specific rules |
| A | Builtins | Shadowing built-in names (id, list, type) |
| TC | Type-checking | Imports that should be in TYPE_CHECKING block |
| EM | Error messages | Exception message formatting |

### mypy Integration

**Default: strict mode.** This enables all strict checks. Relax individual settings via overrides:

```toml
# For libraries without type stubs
[[mypy.overrides]]
module = ["some_library.*"]
ignore_missing_imports = true

# For tests (relaxed typing)
[[mypy.overrides]]
module = "tests.*"
disallow_untyped_defs = false
```

**Common plugins:**
- `sqlalchemy.ext.mypy.plugin` — SQLAlchemy model support
- `pydantic.mypy` — Pydantic model support

### Common Customizations

**Add more rule sets:**
```toml
select = [
    # ... existing ...
    "D",      # pydocstyle (requires 100% documentation — very noisy)
    "ANN",    # annotations (only if project is fully typed)
]
```

**Per-file ignores:**
```toml
[lint.per-file-ignores]
"tests/*" = ["S101"]  # Allow assert in tests
"__init__.py" = ["F401"]  # Allow unused imports
```

### Advanced Static Analysis Tools (Mandatory)

These tools are MANDATORY for Python projects and included in `scripts/lint.sh`.

| Tool | Purpose | Config Location | Run Command |
|------|---------|----------------|-------------|
| import-linter | Layer boundary enforcement | `pyproject.toml [tool.importlinter]` | `uv run lint-imports` |
| deptry | Unused/missing/transitive deps | `pyproject.toml [tool.deptry]` | `uv run deptry .` |
| vulture | Dead code detection | `pyproject.toml [tool.vulture]` | `uv run vulture src/ --min-confidence 80` |
| pip-audit | CVE vulnerability scanning | No config needed | `uv run pip-audit` |

---

## Lint Script (scripts/lint.sh)

Unified entry point for all linters. Features:

| Flag | Behavior |
|------|----------|
| (none) | Stop on first failure |
| `--all` | Run all checks, report all failures |
| `--fix` | Auto-fix, then check remaining |

The script uses colored output with `[N/TOTAL] check_name ... PASSED/FAILED` format and returns exit code 0/1 for CI integration.

---

## Troubleshooting

### ESLint projectService Errors

**Symptom:** `Cannot read file` or `File not found in project service`

**Solution:** Add the file to `allowDefaultProject`:
```typescript
projectService: {
  allowDefaultProject: ["eslint.config.ts", "vitest.config.ts"],
},
```

### ESLint jiti Errors

**Symptom:** `Cannot use import statement` when running ESLint with `.ts` config

**Solution:** Install jiti: `npm install -D jiti`

### ESLint/Prettier Conflicts

**Symptom:** ESLint auto-fix changes formatting that Prettier then changes back.

**Solution:** Ensure eslint-config-prettier is last in config:
```typescript
export default tseslint.config(
  // ... all other configs ...
  eslintConfigPrettier,  // MUST be last
);
```

### mypy: Missing Type Stubs

**Symptom:** `Library stubs not installed for "xxx"`

**Solution:** Add override for the module:
```toml
[[mypy.overrides]]
module = ["xxx.*"]
ignore_missing_imports = true
```

Or install stubs: `pip install types-xxx`

### mypy: Strict Mode Too Strict

**Symptom:** Hundreds of errors after enabling `strict = true`

**Solution:** Start with individual strict options, enable gradually:
```toml
strict = false
warn_return_any = true
warn_unused_configs = true
check_untyped_defs = true
```

### Ruff vs Black Formatting

**Symptom:** Different formatting between Ruff and existing Black config.

**Solution:** Ruff's formatter is >99.9% Black-compatible. Migrate:
1. Remove Black from dependencies
2. Use `ruff format` instead of `black`
3. Remove `.black.toml` / `pyproject.toml [tool.black]`

---

**Version:** 3.0.0
**Last Updated:** 2026-03-18

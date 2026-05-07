<!-- SOURCE-OF-TRUTH: shared/references/breaking_changes_patterns.md. Edit ONLY here; run `node tools/marketplace/shared.mjs sync` -->

# Breaking Changes Patterns

<!-- SCOPE: Breaking changes and migration patterns ONLY. Contains per-library upgrade tables (React, Next.js, Express, etc.). -->
<!-- DO NOT add here: Upgrade workflow → ln-820-dependency-optimization-coordinator SKILL.md -->

Common breaking changes and migration patterns for major package upgrades.

> **Note:** For detailed migration steps, always query Context7/Ref for the latest official guides.

---

## Node.js / npm

### React 18 → 19

| Change | Migration |
|--------|-----------|
| `ReactDOM.render()` removed | Use `createRoot().render()` |
| `React.FC<Props>` unsupported | Direct function with props type |
| `forwardRef` unsupported | Use `ref` as regular prop |
| JSX Transform required | Update tsconfig.json: `"jsx": "react-jsx"` |

### ESLint 8 → 9

| Change | Migration |
|--------|-----------|
| `.eslintrc.*` unsupported | Use `eslint.config.js` (flat config) |
| `extends` array removed | Direct imports of configs |
| `plugins` as strings | Use plugin objects |

### Vite 5 → 6

| Change | Migration |
|--------|-----------|
| `require()` in config | ESM imports only |
| CJS plugins | ESM plugins required |
| Node 16 support | Node 18+ required |
| Default port | Changed to 5173 |

### Tailwind CSS 3 → 4

| Change | Migration |
|--------|-----------|
| `tailwind.config.js` | CSS-based config or `.ts` |
| `@tailwind` directives | Use `@import "tailwindcss"` |
| JIT mode | Default (no config needed) |

### TypeScript 5.4 → 5.5+

| Change | Migration |
|--------|-----------|
| Stricter inference | May need explicit types |
| `satisfies` behavior | Review usage patterns |
| Import attributes | New syntax available |

---

## .NET / NuGet

### .NET 9 → 10

| Change | Migration |
|--------|-----------|
| Target framework | `<TargetFramework>net10.0</TargetFramework>` |
| Minimal APIs | Enhanced routing features |
| EF Core | New query optimizations |

### Microsoft.EntityFrameworkCore 8 → 9

| Change | Migration |
|--------|-----------|
| Query execution | Review LINQ for breaking changes |
| Migration format | May need regeneration |
| Complex types | New mapping behaviors |

### Serilog.AspNetCore 7 → 8

| Change | Migration |
|--------|-----------|
| Configuration | Update appsettings.json Serilog section |
| Bootstrap logger | New initialization pattern |

### Swashbuckle.AspNetCore 6 → 7

| Change | Migration |
|--------|-----------|
| Minimal API | Updated endpoint discovery |
| OpenAPI 3.1 | New schema features |

---

## Python / pip

### Pydantic 1 → 2

| Change | Migration |
|--------|-----------|
| Model syntax | Use `pydantic.v1` for compatibility |
| Validators | New decorator syntax |
| Config class | Use `model_config` dict |

### SQLAlchemy 1 → 2

| Change | Migration |
|--------|-----------|
| Query syntax | Use 2.0 style queries |
| Session API | New execute patterns |
| ORM mapping | Declarative base changes |

### FastAPI 0.99 → 0.100+

| Change | Migration |
|--------|-----------|
| Pydantic version | Requires Pydantic v2 |
| Response models | Updated validation |

---

## Upgrade Strategy

### Order of Operations

1. **Backup** lock files before starting
2. **Check** for known breaking changes in this file
3. **Query** Context7/Ref for official migration guide
4. **Upgrade** one major version at a time
5. **Run** tests after each upgrade
6. **Apply** migrations from official guides
7. **Verify** build passes
8. **Commit** or rollback

### Rollback Commands

| Manager | Command |
|---------|---------|
| npm | `git checkout package.json package-lock.json && npm ci` |
| dotnet | `git checkout *.csproj && dotnet restore` |
| pip | `git checkout requirements.txt && pip install -r requirements.txt` |
| poetry | `git checkout pyproject.toml poetry.lock && poetry install` |

---

**Version:** 1.1.0
**Last Updated:** 2026-01-10

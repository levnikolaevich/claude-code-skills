# Project Structure Rules

<!-- SCOPE: Framework-specific directory rules for structure auditing ONLY.
     Contains expected directories, naming conventions, forbidden placements per tech stack. -->
<!-- DO NOT add here: Audit workflow -> ln-646-project-structure-auditor/SKILL.md -->

## File Hygiene Rules

### Build Artifact Directories (always flag if tracked in git)

| Pattern | Stacks | Severity |
|---------|--------|----------|
| `dist/` | All JS/TS | HIGH |
| `build/` | All | HIGH |
| `bin/` | .NET, Go | HIGH |
| `obj/` | .NET | HIGH |
| `__pycache__/` | Python | HIGH |
| `.next/` | Next.js | HIGH |
| `.nuxt/` | Nuxt | HIGH |
| `target/` | Rust, Java | HIGH |
| `out/` | Go, Next.js | HIGH |
| `node_modules/` | All JS/TS | HIGH |
| `.venv/`, `venv/` | Python | HIGH |
| `coverage/` | All JS/TS | MEDIUM |
| `.pytest_cache/` | Python | MEDIUM |

### Temp/Junk File Patterns

| Pattern | Severity |
|---------|----------|
| `*.tmp`, `*.temp` | MEDIUM |
| `*.log` | MEDIUM |
| `*.bak`, `*.orig` | MEDIUM |
| `*.swp`, `*.swo`, `*~` | MEDIUM |
| `.DS_Store` | LOW |
| `Thumbs.db` | LOW |
| `desktop.ini` | LOW |
| `*.pid` | MEDIUM |
| `npm-debug.log*` | MEDIUM |

### Binary File Extensions (tracked in git = flag)

| Pattern | Severity |
|---------|----------|
| `*.zip`, `*.tar`, `*.gz`, `*.rar`, `*.7z` | MEDIUM |
| `*.exe`, `*.dll`, `*.so`, `*.dylib` | MEDIUM |
| `*.jar`, `*.war`, `*.ear` | MEDIUM |
| `*.sqlite`, `*.db` | MEDIUM |
| `*.woff`, `*.woff2`, `*.ttf`, `*.eot` | LOW (exception: fonts in assets/) |

---

## Ignore File Rules

### .gitignore Required Entries by Stack

| Stack | Required Entries |
|-------|-----------------|
| Node.js/TS | `node_modules/`, `dist/`, `.env`, `coverage/`, `*.log` |
| React | + `build/` |
| Next.js | + `.next/`, `out/` |
| Vue | + `.nuxt/` (Nuxt), `dist/` |
| Python | `__pycache__/`, `*.pyc`, `.venv/`, `.env`, `*.egg-info/`, `.pytest_cache/` |
| .NET | `bin/`, `obj/`, `*.user`, `.vs/`, `*.suo` |
| Go | `vendor/` (if unused), `*.exe`, `*.test` |
| Java | `target/`, `*.class`, `.settings/`, `.project` |
| Rust | `target/`, `Cargo.lock` (libraries only) |

### Secrets Protection (always required regardless of stack)

**Reference:** `../ln-733-env-configurator/references/gitignore_secrets.template`

Minimal required patterns:

| Pattern | Severity if Missing |
|---------|---------------------|
| `.env` | HIGH |
| `.env.local` | HIGH |
| `.env.*.local` | HIGH |
| `*.pem` | HIGH |
| `*.key` | HIGH |
| `secrets/` | MEDIUM |

### .dockerignore Baseline (if Dockerfile exists)

**Reference:** `../ln-731-docker-generator/references/dockerignore.template`

Required entries: `node_modules`, `.git`, `.env`, `*.log`, `dist`, `tests`, `docs`

---

## Framework Convention Rules

### React / Vite / CRA / Next.js

**Reference:** `../ln-720-structure-migrator/references/frontend_structure.md`

| Expected Directory | Purpose | Required? |
|--------------------|---------|-----------|
| `src/components/` | Reusable UI components | Required |
| `src/pages/` OR `app/` | Route pages | Required |
| `src/hooks/` | Custom hooks | Recommended |
| `src/contexts/` OR `src/store/` | State management | Recommended |
| `src/lib/` OR `src/utils/` | Utilities | Recommended |
| `src/types/` | TypeScript types | Recommended (TS only) |
| `public/` | Static assets | Required |

**Forbidden placements:**
- React components (`*.tsx` with JSX) outside `src/`
- API route handlers in `src/components/`

**Co-location rules:**
- Feature folder pattern: `src/pages/{Feature}/` contains `index.tsx`, `types.ts`, `hooks.ts`, `components/`
- Component co-location: component + test + styles together

### .NET / ASP.NET Core / Clean Architecture

**Reference:** `../ln-720-structure-migrator/references/clean_architecture_dotnet.md`

| Expected Directory | Purpose | Required? |
|--------------------|---------|-----------|
| `{Project}.Api/Controllers/` | HTTP endpoints | Required |
| `{Project}.Api/DTOs/` | Request/Response DTOs | Required |
| `{Project}.Domain/Entities/` | Business entities | Required |
| `{Project}.Services/` | Business logic | Required |
| `{Project}.Repositories/` | Data access | Required |
| `{Project}.Shared/` | Cross-cutting concerns | Recommended |

**Forbidden placements:**
- Domain entities in Api/ project
- Direct DB access from Controllers/

### Python / FastAPI / Django / Flask

| Expected Directory | Purpose | Required? |
|--------------------|---------|-----------|
| `src/` OR `{package}/` | Source root | Required |
| `tests/` | Test directory | Required |
| `src/api/` OR `src/routes/` | API endpoints | Recommended (FastAPI/Flask) |
| `src/models/` | Data models | Recommended |
| `src/services/` | Business logic | Recommended |
| `{app}/models.py` | Django models | Required (Django) |
| `{app}/views.py` | Django views | Required (Django) |

**Special:** `__init__.py` required in all packages (src layout)

### Go

| Expected Directory | Purpose | Required? |
|--------------------|---------|-----------|
| `cmd/` | Entry points (main packages) | Required (multi-binary) |
| `internal/` | Private packages | Required |
| `pkg/` | Public/reusable packages | Optional |
| `api/` | API definitions (proto, swagger) | Recommended |

**Forbidden placements:**
- Source files directly in repo root (except `main.go` for single-binary)
- Test files outside their package directory

### Node.js / Express / NestJS

| Expected Directory | Purpose | Required? |
|--------------------|---------|-----------|
| `src/routes/` OR `src/controllers/` | HTTP handlers | Required |
| `src/services/` | Business logic | Required |
| `src/models/` OR `src/entities/` | Data models | Recommended |
| `src/middleware/` | HTTP middleware | Recommended |
| `src/modules/` | NestJS modules | Required (NestJS) |

### Rust

| Expected Directory | Purpose | Required? |
|--------------------|---------|-----------|
| `src/` | Source code | Required |
| `src/bin/` | Binary targets | Recommended (multi-binary) |
| `tests/` | Integration tests | Recommended |
| `benches/` | Benchmarks | Optional |

### Generic Fallback (unknown framework)

| Expected Directory | Purpose | Required? |
|--------------------|---------|-----------|
| `src/` | Source code | Required |
| `tests/` OR `test/` | Tests | Required |
| `docs/` | Documentation | Recommended |
| `config/` | Configuration | Recommended (if >5 config files in root) |

---

## Naming Convention Rules

| Stack | File Case | Dir Case | Test Pattern | Component Case |
|-------|-----------|----------|--------------|----------------|
| React/Vue | PascalCase (`.tsx`/`.vue`), camelCase (`.ts`) | lowercase / kebab-case | `*.test.tsx`, `*.spec.tsx` | PascalCase |
| Angular | kebab-case (`*.component.ts`) | kebab-case | `*.spec.ts` | PascalCase |
| .NET | PascalCase | PascalCase | `*Tests.cs` | PascalCase |
| Python | snake_case | snake_case | `test_*.py`, `*_test.py` | PascalCase (classes) |
| Go | snake_case | lowercase (no underscores) | `*_test.go` | PascalCase (exported) |
| Node.js/TS | camelCase or kebab-case | kebab-case or camelCase | `*.test.ts`, `*.spec.ts` | N/A |
| Rust | snake_case | snake_case | `#[test]` in-file, `tests/` dir | PascalCase (structs) |
| Java | PascalCase | lowercase dot-separated | `*Test.java` | PascalCase |

### Allowed Root Files (not flagged as source-in-root)

| Stack | Allowed Root Source Files |
|-------|--------------------------|
| Node.js/TS | `index.ts`, `main.ts`, `app.ts`, `server.ts` |
| Python | `manage.py`, `wsgi.py`, `asgi.py`, `main.py`, `setup.py` |
| .NET | `Program.cs` |
| Go | `main.go` |
| Rust | `main.rs`, `lib.rs` (in `src/`) |

---

## Junk Drawer Thresholds

| Directory Name | Max Files Before Flagging | Severity |
|----------------|---------------------------|----------|
| `utils/` | 10 | MEDIUM |
| `helpers/` | 10 | MEDIUM |
| `common/` | 10 | MEDIUM |
| `misc/` | 0 (always flag) | HIGH |
| `shared/` | 15 | MEDIUM |
| `lib/` | 15 | MEDIUM |
| `tools/` | 10 | MEDIUM |

---

**Version:** 1.0.0
**Last Updated:** 2026-02-28

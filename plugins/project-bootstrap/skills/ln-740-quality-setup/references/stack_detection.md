# Stack Detection Rules

<!-- SCOPE: Technology stack detection rules ONLY. Contains file patterns, confidence levels for TypeScript/React/.NET. -->
<!-- DO NOT add here: Quality setup workflow → ln-740-quality-setup SKILL.md -->

Reference for ln-740-quality-setup Phase 1.

---

## Detection Priority

When multiple indicators found, detect ALL stacks. Project can be mixed (e.g., TypeScript frontend + .NET backend).

---

## TypeScript/React Detection

| Indicator | Confidence | Notes |
|-----------|------------|-------|
| `package.json` + `tsconfig.json` | High | Definite TypeScript |
| `package.json` with `react` dependency | High | React project |
| `*.tsx` files in `src/` | High | React components |
| `vite.config.ts` | Medium | Vite-based project |
| `next.config.js` | Medium | Next.js project |

**Glob Patterns:**
```
tsconfig.json
package.json
src/**/*.tsx
```

---

## .NET Detection

| Indicator | Confidence | Notes |
|-----------|------------|-------|
| `*.sln` file | High | Solution file |
| `*.csproj` file | High | Project file |
| `Program.cs` | Medium | Entry point |
| `appsettings.json` | Medium | .NET config |

**Glob Patterns:**
```
*.sln
**/*.csproj
**/Program.cs
```

---

## Python Detection

| Indicator | Confidence | Notes |
|-----------|------------|-------|
| `pyproject.toml` | High | Modern Python project |
| `requirements.txt` | Medium | Dependencies file |
| `setup.py` | Medium | Legacy packaging |
| `*.py` in root or `src/` | Medium | Python source |
| `uv.lock` | High | UV package manager |

**Glob Patterns:**
```
pyproject.toml
requirements.txt
**/*.py
uv.lock
```

---

## Mixed Stack Examples

| Structure | Detected Stacks |
|-----------|-----------------|
| `frontend/` + `backend/` | TypeScript + .NET or Python |
| Monorepo with `packages/` | Multiple TypeScript packages |
| `api/` (Python) + `web/` (React) | Python + TypeScript |

---

## Output Format

After detection, report to user:

```
Detected Technology Stack:
- TypeScript/React (frontend/)
- .NET 10 (backend/)
- Python 3.12 (scripts/)

Quality tools will be configured for all detected stacks.
```

---

**Version:** 1.0.0
**Last Updated:** 2026-01-10

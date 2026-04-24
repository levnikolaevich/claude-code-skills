# Claim Extraction Rules

<!-- SCOPE: Per-claim-type extraction patterns, verification methods, FP exclusion rules, normalization for cross-doc comparison. -->

## 1. File Path Claims

### Extraction Patterns

```bash
# Backtick paths (most common)
grep -oE '`[a-zA-Z_./-]+\.[a-z]{1,5}`' "$doc"

# Markdown link targets
grep -oE '\]\(([^)]+\.md)\)' "$doc"

# Paths in prose (src/, app/, lib/, config/, tests/, docs/)
grep -oE '(?:src|app|lib|config|tests|docs)/[a-zA-Z0-9_/.-]+' "$doc"
```

### Verification

```bash
ls -la "$PROJECT_ROOT/$path" 2>&1
# OR for glob patterns:
ls -d "$PROJECT_ROOT/$pattern" 2>/dev/null
```

### FP Exclusions

- Paths preceded by "e.g.", "for example", "such as"
- Paths inside `<!-- SCOPE: ... -->` describing other projects
- Paths with placeholders: `{name}`, `<project>`, `YOUR_*`
- Paths in `node_modules/` references (dependency internals)
- External URLs (http://, https://)

---

## 2. Version Claims

### Extraction Patterns

```bash
# Semver near package names: "Express 4.18", "Redis 7.x", "Node 20.x"
grep -oE '(\w[\w.-]+)\s+v?(\d+\.\d+[\d.x-]*)' "$doc"

# Docker image tags: "postgres:15", "redis:8-alpine"
grep -oE '(\w+):(\d+[\w.-]*)' "$doc"

# Version in tables: "| Package | Version |" rows
grep -oE '\|\s*\w+\s*\|\s*v?(\d+\.\d+[\d.x-]*)' "$doc"
```

### Verification by Source

| Claim Context | Verification Source |
|---------------|-------------------|
| Node.js package | `grep '"$pkg"' package.json` |
| Python package | `grep '$pkg' requirements.txt` or `pyproject.toml` |
| Go module | `grep '$mod' go.mod` |
| Docker image | `grep '$image:' docker-compose.yml` |
| Tool version | `.tool-versions`, `.nvmrc`, `Dockerfile` |

### FP Exclusions

- Version ranges in docs ("4.x") when code has specific "4.18.2" — not a mismatch
- Lockfile versions (package-lock.json) — compare against package.json instead
- CHANGELOG entries (historical versions)

### Normalization for Cross-Doc

Strip leading `v`, normalize `x` wildcards: `v4.18.x` → `4.18`.

---

## 3. Count/Statistic Claims

### Extraction Patterns

```bash
# "N entities" pattern
grep -oE '(\d+)\s+(modules?|formats?|endpoints?|services?|tables?|parsers?|files?|workers?|routes?|columns?|containers?|domains?|categories?|layers?)' "$doc"

# "N+" pattern (lower bounds)
grep -oE '(\d+)\+?\s+(types?|checks?|rules?|tests?)' "$doc"
```

### Verification

| Claimed Entity | How to Count |
|---------------|-------------|
| modules/domains | `ls -d src/*/` or `ls -d app/domain/*/` |
| endpoints/routes | `grep -c '@(Get\|Post\|Put\|Delete\|Patch)' src/` or count route definitions |
| tables | Count CREATE TABLE in migrations or models |
| parsers/formatters | Count class definitions matching pattern |
| services | `ls app/services/*/` or count service files |
| containers | `grep -c 'image:' docker-compose.yml` |

### FP Exclusions

- Approximate language ("about", "approximately", "~")
- "up to N" (upper bound, not exact)
- Claims in feature roadmaps/plans (not current state)

---

## 4. API Endpoint Claims

### Extraction Patterns

```bash
# HTTP method + path
grep -oE '(GET|POST|PUT|DELETE|PATCH)\s+/[\w/{}\-:.]+' "$doc"

# Table rows with endpoints
grep -oE '\|\s*(GET|POST|PUT|DELETE|PATCH)\s*\|\s*`?(/[\w/{}\-:.]+)`?' "$doc"
```

### Verification by Framework

| Framework | Grep Pattern |
|-----------|-------------|
| Express | `grep -rn 'router\.(get\|post\|put\|delete\|patch).*$path' src/routes/` |
| FastAPI | `grep -rn '@(app\|router)\.(get\|post\|put\|delete\|patch).*$path' app/` |
| Flask | `grep -rn '@.*route.*$path' app/` |
| NestJS | `grep -rn '@(Get\|Post\|Put\|Delete\|Patch).*$path' src/` |
| Django | `grep -rn "path.*$path" */urls.py` |

### FP Exclusions

- Unsupported endpoints marked as such
- Endpoints in "planned" or "future" sections
- External API references (third-party services)

---

## 5. Config Key / Env Var Claims

### Extraction Patterns

```bash
# UPPER_CASE keys in config context
grep -oE '[A-Z][A-Z_]{2,}' "$doc" | sort -u

# process.env.X or os.environ references
grep -oE '(?:process\.env\.|os\.environ\[)[A-Z_]+' "$doc"

# Key=Value patterns
grep -oE '[A-Z_]{3,}\s*=' "$doc"
```

### Verification

```bash
# Check if env var is actually used in code
grep -rn "$VAR" src/ app/ lib/ --include="*.py" --include="*.ts" --include="*.js"

# Check .env.example
grep "$VAR" .env.example .env.template
```

### FP Exclusions

- Generic names: `API_KEY`, `SECRET` when used as examples
- Variables in code blocks explaining external services
- OS-level vars: `PATH`, `HOME`, `USER`

---

## 6. CLI Command Claims

### Extraction Patterns

```bash
# Commands in backtick blocks
grep -oE '`(npm run \w+|python [\w.-]+|docker[\w -]+|make \w+|pip install[\w .-]+|cargo \w+)`' "$doc"

# Commands in code blocks (``` blocks)
# Parse code blocks, extract lines starting with $, >, or command names
```

### Verification

| Command Type | Check Method |
|-------------|-------------|
| `npm run X` | `grep '"X"' package.json` |
| `python X.py` | `ls X.py` |
| `docker-compose up` | `ls docker-compose.yml` |
| `make X` | `grep '^X:' Makefile` |
| `cargo X` | Check Cargo.toml |

### FP Exclusions

- Commands in installation instructions for external tools
- OS-specific commands when project targets different OS
- Commands in troubleshooting sections (may be diagnostic)

---

## 7. Function/Class Name Claims

### Extraction Patterns

```bash
# CamelCase references in backticks
grep -oE '`[A-Z][a-zA-Z0-9]+`' "$doc"

# snake_case function references in backticks
grep -oE '`[a-z][a-z_0-9]+\(\)`' "$doc"

# Class/function in prose context
grep -oE '(?:class|function|method|service|handler)\s+`?([A-Z][a-zA-Z0-9]+)`?' "$doc"
```

### Verification

```bash
# Search for definition
grep -rn "class $name\|def $name\|function $name\|const $name\|export.*$name" src/ app/ lib/
```

### FP Exclusions

- Generic names: `Error`, `Response`, `Request` (framework types)
- Names from external libraries (check if defined in project)
- Names in "alternative" or "comparison" sections (describing other tools)

---

## 8. Line Number Reference Claims

### Extraction Patterns

```bash
# file:line pattern
grep -oE '[\w/.-]+\.[a-z]+:\d+' "$doc"

# "line N" or "lines N-M" near file references
grep -oE '(?:line|lines?)\s+(\d+(?:-\d+)?)' "$doc"
```

### Verification

```bash
# Read file at specific line, check if context matches
sed -n "${line}p" "$PROJECT_ROOT/$file"

# For ranges: sed -n "${start},${end}p"
```

### Tolerance

- Exact match: content at line matches claim context
- Near match (within 5 lines): LOW finding instead of MEDIUM
- File exists but line exceeds file length: MEDIUM finding

---

## 9. Docker/Infrastructure Claims

### Extraction Patterns

```bash
# Docker image references
grep -oE '(\w+/)?(\w+):[\w.-]+' "$doc"

# Port mappings
grep -oE '(\d{4,5}):(\d{4,5})' "$doc"

# Service names in docker context
grep -oE 'services?:\s*(\w+)' "$doc"
```

### Verification

```bash
# Image tags
grep "$image" docker-compose.yml Dockerfile

# Port mappings
grep "$port" docker-compose.yml

# Service names
grep "^\s*$service:" docker-compose.yml
```

### FP Exclusions

- Example/template docker-compose files
- External service references (not in project's docker-compose)

---

## Cross-Document Normalization

For cross-document consistency checks, normalize claims before comparison:

| Claim Type | Normalization |
|------------|--------------|
| File paths | Resolve `./`, `../`, strip trailing `/` |
| Versions | Strip `v` prefix, replace `x` wildcards with `*`, drop build metadata |
| Counts | Extract integer only, ignore "approximately" |
| Endpoints | Lowercase, strip trailing `/`, normalize path params `{id}` = `:id` |
| Entity names | Case-sensitive (CamelCase preserved), strip backticks |

---
**Version:** 1.0.0
**Last Updated:** 2026-03-06

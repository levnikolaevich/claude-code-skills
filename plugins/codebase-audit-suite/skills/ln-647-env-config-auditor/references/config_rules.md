# Env Config Audit Rules

<!-- SCOPE: Environment variable detection patterns and severity rules ONLY.
     Contains: env usage regex by language, env file patterns, validation frameworks.
     DO NOT add here: Audit workflow → ln-647-env-config-auditor/SKILL.md -->

## Env Var Usage Patterns by Language

| Language | Pattern | Capture Group | Notes |
|----------|---------|---------------|-------|
| JavaScript/TypeScript | `process\.env\.(\w+)` | $1 | Direct access |
| JavaScript/TypeScript | `process\.env\[['"](\w+)['"]\]` | $1 | Bracket access |
| Python | `os\.getenv\(['"](\w+)['"]` | $1 | With optional default |
| Python | `os\.environ\[['"](\w+)['"]\]` | $1 | KeyError if missing |
| Python | `os\.environ\.get\(['"](\w+)['"]` | $1 | Safe access |
| Go | `os\.Getenv\(['"](\w+)['"]` | $1 | Returns empty string if missing |
| .NET | `Environment\.GetEnvironmentVariable\(['"](\w+)['"]` | $1 | |
| .NET | `Configuration\[['"](\w+)['"]\]` | $1 | IConfiguration access |
| Java | `System\.getenv\(['"](\w+)['"]` | $1 | |
| Ruby | `ENV\[['"](\w+)['"]\]` | $1 | Direct access |
| Ruby | `ENV\.fetch\(['"](\w+)['"]` | $1 | Raises if missing |
| Rust | `env::var\(['"](\w+)['"]` | $1 | std::env |

### Pydantic Settings (Layer 2)

Pydantic `BaseSettings` maps field names to env vars automatically:

```python
class Settings(BaseSettings):
    database_url: str       # → DATABASE_URL
    api_key: str            # → API_KEY
    model_config = SettingsConfigDict(env_prefix="APP_")  # → APP_DATABASE_URL
```

Detection: Grep `class\s+\w+\(.*BaseSettings\)` → read class body → extract field names → convert to SCREAMING_SNAKE_CASE → add `env_prefix` if present.

## Env File Patterns

| Pattern | Type | Contains Secrets? | Safe to Commit? |
|---------|------|-------------------|-----------------|
| `.env` | Local config | YES | NO |
| `.env.local` | Local overrides | YES | NO |
| `.env.*.local` | Per-env local | YES | NO |
| `.env.example` | Template/docs | NO (placeholders) | YES |
| `.env.template` | Template/docs | NO (placeholders) | YES |
| `.env.development` | Dev defaults | DEPENDS | DEPENDS (if no real secrets) |
| `.env.staging` | Staging config | YES | NO |
| `.env.production` | Prod config | YES | NO |
| `.env.test` | Test config | Usually NO | Usually YES |

## Docker/CI Env Patterns

| Source | Section/Directive | Detection Pattern |
|--------|-------------------|-------------------|
| `docker-compose.yml` | `environment:` | `^\s+environment:` then `\s+\w+=` or `\s+- \w+=` |
| `docker-compose.*.yml` | Override files | Same as above |
| `Dockerfile` | `ENV` directive | `^ENV\s+(\w+)` |
| `Dockerfile` | `ARG` directive | `^ARG\s+(\w+)` |
| `.github/workflows/*.yml` | `env:` section | `^\s+env:` then `\s+\w+:` |
| `.gitlab-ci.yml` | `variables:` | `^variables:` then `\s+\w+:` |

## Validation Frameworks

| Stack | Framework | Detection Pattern |
|-------|-----------|-------------------|
| Python | pydantic-settings | `from pydantic_settings import\|from pydantic import BaseSettings` |
| Python | environs | `from environs import Env` |
| Node.js | envalid | `require\(['"]envalid['"]\)\|from ['"]envalid['"]` |
| Node.js | zod (env) | `z\.object.*env\|createEnv` |
| Node.js | @t3-oss/env | `from ['"]@t3-oss/env` |
| .NET | IOptions | `services\.Configure<\|IOptions<` |
| Go | envconfig | `envconfig\.Process` |
| Go | viper | `viper\.AutomaticEnv\|viper\.BindEnv` |
| Java | Spring | `@Value\("\$\{` |
| Ruby | dotenv | `Dotenv\.load\|require ['"]dotenv['"]` |

## Framework-Managed Variables (Layer 2 Exclusions)

Exclude from C2.1 (Code→Example sync) — these are auto-set by frameworks:

| Framework | Auto-Managed Vars |
|-----------|-------------------|
| Node.js | `NODE_ENV`, `PORT` |
| Next.js | `NEXT_PUBLIC_*` prefix, `NEXT_RUNTIME`, `NEXT_PHASE` |
| Vite | `VITE_*` prefix, `MODE`, `BASE_URL`, `PROD`, `DEV` |
| Python/Django | `DJANGO_SETTINGS_MODULE` |
| Python/Flask | `FLASK_APP`, `FLASK_ENV`, `FLASK_DEBUG` |
| .NET | `ASPNETCORE_ENVIRONMENT`, `ASPNETCORE_URLS`, `DOTNET_ENVIRONMENT` |
| Go | `GOPATH`, `GOROOT`, `GOPROXY` |
| Ruby/Rails | `RAILS_ENV`, `RACK_ENV` |
| Java/Spring | `SPRING_PROFILES_ACTIVE` |
| Docker | `HOSTNAME`, `HOME`, `PATH` |

## Sensitive Var Name Patterns

Variables matching these patterns should never have hardcoded defaults (C4.2):

```
SECRET, PASSWORD, PASSWD, TOKEN, API_KEY, APIKEY,
PRIVATE_KEY, CREDENTIALS, AUTH_TOKEN, ACCESS_KEY,
CLIENT_SECRET, SIGNING_KEY, ENCRYPTION_KEY, JWT_SECRET,
DATABASE_URL (contains credentials), REDIS_URL (may contain password)
```

## Severity Mapping

| Check | Severity | Effort |
|-------|----------|--------|
| C1.1 No .env.example | MEDIUM | S |
| C1.2 .env committed | CRITICAL | S |
| C1.3 Missing env-specific files | LOW | S |
| C2.1 Code var missing from example | MEDIUM | S |
| C2.2 Dead var in example | MEDIUM | S |
| C2.3 Default desync | HIGH | M |
| C3.1 Naming inconsistency | LOW | S |
| C3.2 Redundant variables | LOW | M |
| C3.3 Missing comments | LOW | S |
| C4.1 No startup validation | MEDIUM | M |
| C4.2 Sensitive defaults | HIGH | S |

# Technology Justification Rules

<!-- SCOPE: Rules for when to create ADR/Guide/Manual ONLY. Contains justification matrix by category, skip criteria. -->
<!-- DO NOT add here: document creation → ln-120-reference-docs-creator SKILL.md, document templates → references/templates/ -->

**Purpose:** Defines when to create ADR/Guide/Manual for detected technologies. Prevents "for checkbox" documents - only creates when choice was nontrivial.

---

## Category Justification Matrix

| Category | ADR Justified If | Skip ADR If |
|----------|------------------|-------------|
| frontend | React/Vue/Angular/Svelte/Solid (2+ options in ecosystem) | jQuery only, vanilla JS, no framework |
| backend | Express/Fastify/NestJS/Koa/Hapi (2+ options in ecosystem) | Simple http server, serverless functions only |
| database | PostgreSQL/MySQL/MongoDB/SQLite (production choice) | SQLite for dev only, mock DB |
| auth | JWT/OAuth/Session/Passport (explicit choice) | No auth required, basic auth only |
| orm | Prisma/TypeORM/Sequelize/Drizzle (2+ options in ecosystem) | Raw SQL only, query builder only |
| cache | Redis/Memcached/KeyDB (external service) | In-memory only, no cache |
| queue | RabbitMQ/Redis Queue/Bull/BullMQ (explicit choice) | No async processing |
| storage | S3/GCS/Azure Blob/MinIO (cloud choice) | Local filesystem only |

---

## Document Creation Logic

### ADR Creation Criteria

**Create ADR if ALL conditions met:**
```
has_alternatives = category in ["frontend", "backend", "database", "auth", "orm", "cache", "queue", "storage"]
is_nontrivial = tech NOT in TRIVIAL_CHOICES[category]
has_ecosystem_options = len(ecosystem_alternatives) >= 2
```

**TRIVIAL_CHOICES (skip ADR):**
```json
{
  "frontend": ["jquery", "vanilla"],
  "backend": ["http", "net"],
  "database": ["sqlite", "lowdb", "json-server"],
  "auth": ["basic", "none"],
  "orm": ["knex", "sql"],
  "cache": ["memory", "lru-cache"],
  "queue": ["none"],
  "storage": ["fs", "local"]
}
```

### Guide Creation Criteria

**Create Guide if ANY condition met:**
```
has_custom_config = config_file_exists AND config_lines > 20
has_multiple_plugins = plugins_count >= 3
has_custom_patterns = uses_custom_hooks OR uses_middleware OR uses_decorators
has_integration_complexity = related_deps_count >= 3
```

**Config file patterns:**
- `{tech}.config.js` / `{tech}.config.ts`
- `.{tech}rc` / `.{tech}rc.json` / `.{tech}rc.js`
- `{tech}.json` (if >20 lines)

**Skip Guide if:**
- Default configuration only
- Zero or minimal customization
- Standard boilerplate setup

### Manual Creation Criteria

**Create Manual if ALL conditions met:**
```
is_complex_api = package has >10 exported methods/functions
has_version_specifics = major_version >= 2 OR has_breaking_changes
is_not_trivial = tech NOT in TRIVIAL_PACKAGES
```

**TRIVIAL_PACKAGES (skip Manual):**
```
["lodash", "uuid", "dotenv", "chalk", "debug", "ms", "dayjs", "date-fns"]
```

**Create Manual for:**
- ORMs (Prisma, TypeORM, Sequelize)
- Authentication libraries (Passport, NextAuth)
- State management (Redux, Zustand, MobX)
- UI frameworks with complex APIs (Material-UI, Chakra, Ant Design)
- Testing frameworks (Jest, Vitest, Playwright)

---

## Auto-Detection Sources

| Data Point | Source Files |
|------------|--------------|
| TECH_STACK | package.json dependencies, requirements.txt, go.mod |
| Config complexity | *.config.js, .eslintrc, tsconfig.json |
| Plugin count | Config files "plugins" arrays |
| Custom patterns | src/**/*.ts for decorators, hooks, middleware |
| API complexity | node_modules/{package}/index.d.ts exports |

---

## Examples

### Example 1: React 18 Project

**Detected:**
- frontend: "React 18"
- Has next.config.js (45 lines)
- Uses custom hooks (3 files)

**Result:**
| Document | Created | Reason |
|----------|---------|--------|
| ADR-001-frontend-framework.md | Yes | React has alternatives (Vue, Angular, Svelte) |
| guide-react-patterns.md | Yes | Custom hooks detected |
| manual-react-18.md | No | Standard usage, no version-specific complexity |

### Example 2: Express + SQLite Dev Project

**Detected:**
- backend: "Express 4.18"
- database: "SQLite"
- No config files

**Result:**
| Document | Created | Reason |
|----------|---------|--------|
| ADR-001-backend-framework.md | Yes | Express has alternatives (Fastify, Koa) |
| ADR-002-database.md | No | SQLite is trivial choice (dev-only) |
| guide-express-patterns.md | No | No custom middleware detected |

### Example 3: Full-Stack with Prisma

**Detected:**
- orm: "Prisma 5.0"
- Has prisma/schema.prisma (120 lines)
- Uses Prisma Client extensions

**Result:**
| Document | Created | Reason |
|----------|---------|--------|
| ADR-001-orm.md | Yes | Prisma has alternatives (TypeORM, Sequelize) |
| guide-prisma-patterns.md | Yes | Schema >20 lines, extensions used |
| manual-prisma-5.md | Yes | Complex API, version-specific migrations |

---

## Integration with SKILL.md Phase 2

**Step 2.2 uses this file:**
1. Load TECH_STACK from Context Store
2. For each category in TECH_STACK:
   - Check category against justification matrix
   - Apply TRIVIAL_CHOICES filter
   - Log decision: "ADR for {tech}: {CREATED|SKIPPED} - {reason}"
3. For created ADR technologies:
   - Check Guide criteria (config complexity)
   - Check Manual criteria (API complexity)
4. Return list of justified documents to create

---

**Version:** 1.0.0
**Last Updated:** 2025-12-19

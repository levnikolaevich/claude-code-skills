<!-- SOURCE-OF-TRUTH: plugins/agile-workflow/shared/references/domain_patterns.md. Edit ONLY here; run `node tools/marketplace/shared.mjs sync` -->

# Domain Patterns Registry

<!-- SCOPE: Domain pattern → doc type mapping for inline documentation creation. Contains trigger keywords, doc_type output. -->
<!-- DO NOT add here: Validation logic → ln-310-multi-agent-validator SKILL.md, documentation rules → references/documentation_creation.md -->

Mapping Story patterns to documentation types for inline documentation creation during ln-310 validation.

---

## Purpose

This registry defines WHEN to create documentation inline and WHAT type of document to create.

**Usage in ln-310 Phase 3:**
1. Load domain_patterns.md
2. Scan Story title + Technical Notes for trigger keywords
3. IF keywords match → Create doc inline per references/documentation_creation.md
4. Add created doc links to Story Technical Notes

---

## Pattern Registry

| Pattern | Doc Type | Topic | Trigger Keywords | Example Output |
|---------|----------|-------|------------------|----------------|
| **OAuth/OIDC** | Manual + ADR | [library] + "Auth Strategy" | auth, oauth, oidc, token, JWT, bearer | `docs/manuals/oauth2-v7.md` + `docs/adrs/NNN-auth.md` |
| **REST API** | Guide | RESTful API Patterns | endpoint, route, controller, REST, resource | `docs/guides/NN-rest-api-patterns.md` |
| **Rate Limiting** | Guide | API Rate Limiting | rate, throttle, quota, limit | `docs/guides/NN-rate-limiting.md` |
| **Error Handling** | Guide | Error Patterns (RFC 7807) | error, exception, status code, 4xx, 5xx | `docs/guides/NN-error-handling.md` |
| **Logging** | Guide | Structured Logging | log, trace, audit, winston, pino | `docs/guides/NN-logging.md` |
| **WebSocket** | Guide | WebSocket Patterns | websocket, real-time, streaming, SSE | `docs/guides/NN-websocket.md` |
| **Pagination** | Guide | Pagination Patterns | page, offset, cursor, pagination | `docs/guides/NN-pagination.md` |
| **Caching** | Manual | [library] (redis, memcached) | cache, redis, memcached, TTL | `docs/manuals/redis-N.md` |
| **Database** | Manual | [ORM/library] | database, ORM, prisma, sequelize | `docs/manuals/prisma-N.md` |
| **Validation** | Guide | Input Validation | validate, sanitize, schema, joi, zod | `docs/guides/NN-validation.md` |
| **File Upload** | Guide | File Upload & Storage | upload, multer, file, storage, s3 | `docs/guides/NN-file-upload.md` |
| **Email** | Manual | [library] (nodemailer, sendgrid) | email, mail, smtp, sendgrid | `docs/manuals/nodemailer-N.md` |

---

## Detection Logic

### 1. Keyword Matching
```
IF Story.title OR Story.context OR Story.technical_notes contains trigger_keyword:
  → Pattern detected
```

**Example:**
- Story title: "Implement OAuth 2.0 authentication"
- Keywords detected: "oauth", "authentication"
- Pattern matched: **OAuth/OIDC**
- Action: Create Manual + ADR

### 2. Multiple Patterns
```
IF multiple patterns detected:
  → Create ALL applicable docs
```

**Example:**
- Story: "Add rate limiting to REST API"
- Patterns: **REST API** + **Rate Limiting**
- Action: Create Guide for REST + Guide for Rate Limiting

### 3. Library Detection (for Manuals)
```
IF doc_type = Manual:
  → Extract library name from Technical Notes
  → Pass library name to manual template
```

**Example:**
- Story mentions: "Using oauth2-proxy v7.6.0"
- Action: Create `docs/manuals/oauth2-proxy-v7.md`

---

## Inline Creation Example (multi-pattern)

Story: "Add rate-limited REST API with Redis caching"
→ Keywords: `REST`, `API`, `rate`, `redis`, `caching`
→ Patterns: **REST API** + **Rate Limiting** + **Caching**

```
1. Glob docs/guides/*rest*.md → not found
2. Load references/templates/guide_template.md
3. Research "RESTful API Patterns" per research_methodology.md
4. Generate guide (NO CODE, tables first, 300-500 words)
5. Save → docs/guides/NN-rest-api-patterns.md

1. Glob docs/guides/*rate-limit*.md → not found
2. Load references/templates/guide_template.md
3. Research "API Rate Limiting Pattern" per research_methodology.md
4. Generate guide
5. Save → docs/guides/NN-api-rate-limiting.md

1. Glob docs/manuals/*redis*.md → not found
2. Load references/templates/manual_template.md
3. Research "Redis v7.2" via Context7
4. Generate manual
5. Save → docs/manuals/redis-v7.md
```

---

## Usage Guidelines

### When to Delegate

✅ **DO delegate when:**
- Pattern clearly detected (keywords match)
- Documentation does NOT already exist
- Story is in Backlog/Todo (not Done/Canceled)

❌ **DON'T delegate when:**
- Documentation already exists (just add reference)
- Story in Done/Canceled status
- Pattern ambiguous (use MCP Ref fallback instead)

### Fallback Strategy

**IF no pattern matched BUT technical aspect missing:**
- Query MCP Ref directly for standards
- Add inline references to Technical Notes
- Log in Linear comment: "No pattern matched - used MCP Ref fallback"

---

**Version:** 2.0.0
**Last Updated:** 2025-01-07

<!-- SOURCE-OF-TRUTH: shared/references/quality_validation.md. Edit ONLY here; run `node tools/marketplace/shared.mjs sync` -->

# Quality Validation (Criteria #14-#15)

<!-- SCOPE: Documentation and code quality criteria #14-#15 ONLY. Contains completeness checks, hardcoded values rules. -->
<!-- DO NOT add here: Other criteria → structural_validation.md, workflow_validation.md, penalty system → penalty_points.md -->

Detailed rules for documentation completeness and code quality (no hardcoded values).

---

## Criterion #14: Documentation Complete

**Check:** All relevant docs from Phase 3 research are referenced in Story

**Penalty:** HIGH (5 points)

**What it checks:**
- Guides/Manuals/ADRs created in Phase 3 are linked in Technical Notes
- Pattern-specific documentation exists and referenced
- Technical Notes contain links to relevant docs

**GOOD:**
```markdown
## Technical Notes

### Architecture Considerations
- **REST API:** Resource-based URLs (see [Guide-05: RESTful API Patterns](docs/guides/05-rest-api-patterns.md))
- **Rate Limiting:** 100 req/min per IP (see [Guide-06: API Rate Limiting](docs/guides/06-api-rate-limiting.md))

### Integration Points
- **OAuth 2.0:** oauth2-proxy v7.6.0 (see [Manual: oauth2-proxy v7](docs/manuals/oauth2-proxy-v7.md))
- **Architecture Decision:** See [ADR-003: Authentication Strategy](docs/adrs/003-auth-strategy.md)

### Related Documentation
| Document | Path |
|----------|------|
| oauth2-proxy Manual | docs/manuals/oauth2-proxy-v7.md |
| REST API Guide | docs/guides/05-rest-api-patterns.md |
| Auth Strategy ADR | docs/adrs/003-auth-strategy.md |
```

**BAD:**
```markdown
## Technical Notes

We'll add OAuth authentication and REST API endpoints.
(No references to guides/manuals/ADRs/research created in Phase 3)
```

**Auto-fix actions:**
1. Check if documentation exists from Phase 3 (created inline)
2. For EACH keyword in Technical Notes (auth, database, api, error, logging):
   - IF doc exists -> Add reference to Technical Notes
   - IF doc missing -> Create per documentation_creation.md or add MCP Ref reference
3. Add "Related Documentation" subsection with all doc links
4. Update Linear issue via `save_issue`
5. Add comment: "Documentation references added - [list of docs]"

**Pattern Examples:**
- **OAuth/Auth:** Manual (library v[version]) + ADR (Authentication Strategy)
- **REST API:** Guide (RESTful API Patterns)
- **Database:** Manual (ORM/library version)
- **Error Handling:** Guide (Error Response Patterns RFC 7807)

**Skip Fix When:**
- No relevant guides exist yet
- All docs already referenced in Technical Notes
- Story in Done/Canceled status

---

## Criterion #15: No Hardcoded Values (TODO Placeholders)

**Check:** No hardcoded credentials, API keys, or config values in Story

**Penalty:** MEDIUM (3 points)

**GOOD:**
```markdown
## Technical Notes

### Configuration
- Database URL: `_TODO: Add DATABASE_URL to .env_`
- OAuth Client ID: `_TODO: Register app, add OAUTH_CLIENT_ID to .env_`
- API Key: `_TODO: Generate key, add API_KEY to .env_`
```

**BAD:**
```markdown
## Technical Notes

### Configuration
- Database URL: `postgresql://localhost:5432/mydb`  <- Hardcoded
- OAuth Client ID: `abc123xyz`  <- Hardcoded
- API Key: `sk_test_4eC39HqLyjWDarjtT1zdp7dc`  <- Hardcoded
```

**Auto-fix actions:**
1. Grep Technical Notes for patterns: URLs, keys, credentials
   - Database URLs: `postgresql://`, `mysql://`, `mongodb://`
   - API keys: `sk_`, `pk_`, `Bearer`, `token=`
   - Credentials: `password=`, `secret=`
2. IF hardcoded value found -> Replace with `_TODO: Add [NAME] to .env_`
3. Add Security section if missing:
   ```markdown
   ### Security
   All sensitive values stored in environment variables (never committed to git)
   ```
4. Update Linear issue via `save_issue`
5. Add comment: "Hardcoded values replaced with .env placeholders"

**Skip Fix When:**
- Values are examples/placeholders (clearly marked as `example.com`, `<YOUR_KEY>`)
- Story in Done/Canceled status

---

## Execution Notes

**Sequential Dependency:**
- Criteria #14-#15 depend on #1-#13 being completed first
- Cannot add doc references (#14) until structure exists (#1)
- Cannot check hardcoded values (#15) until Technical Notes exist

**Research Integration:**
- Phase 3 creates documentation inline per references/documentation_creation.md
- Criteria #14-#15 read from Phase 3 docs
- All research completed BEFORE Phase 4 auto-fix begins

**Linear Updates:**
- Each criterion auto-fix updates Linear issue once
- Add single comment summarizing ALL fixes in this category

---

**Version:** 3.0.0
**Last Updated:** 2025-01-07

# Standards Validation (Criterion #5)

<!-- SCOPE: RFC/OWASP/REST/Security compliance criterion #5 ONLY. Contains standard types, compliance checks. -->
<!-- DO NOT add here: Library versions → solution_validation.md, other criteria → structural_validation.md -->

Detailed rules for RFC/OWASP/REST/Security compliance verification.

---

## Criterion #5: Standards Compliance

**Check:** Solution follows industry standards (RFC, OWASP, REST, Security)

**Penalty:** CRITICAL (10 points)

**CRITICAL:** This criterion checked BEFORE KISS/YAGNI (#11-#12). Standards override simplicity.

---

## Common Standards

| Standard | Applies When | Documentation |
|----------|--------------|---------------|
| RFC 6749 (OAuth 2.0) | Auth/tokens | Guide or Manual |
| RFC 7807 (Problem Details) | Error responses | Guide |
| RFC 7231 (HTTP Semantics) | API endpoints | Guide |
| OWASP Top 10 | All apps | Security guide |
| REST Principles | APIs | REST guide |
| OpenAPI 3.x | Public APIs | API guide |

---

## Examples

**GOOD (Compliant):**
```markdown
## Technical Notes

### Standards Compliance
- **OAuth 2.0 (RFC 6749):** Using authorization code flow with PKCE
- **Error Handling (RFC 7807):** Problem Details for HTTP APIs format
- **REST:** Resource-based URLs, proper HTTP methods (GET/POST/PUT/DELETE)
- **Security:** OWASP Top 10 compliance (Helmet.js, input validation, HTTPS)

### Architecture Considerations
OAuth 2.0 compliant authentication flow:
1. Client sends POST /token with { grant_type, username, password }
2. Server validates credentials
3. Returns { access_token, token_type, expires_in, refresh_token }
```

**BAD (Non-Compliant):**
```markdown
## Technical Notes

We'll create custom login endpoint `/do-login` that accepts username/password
and returns a session cookie.
(Violates OAuth RFC 6749 if API requires stateless auth)
```

---

## Auto-fix Actions

1. Read docs created in Phase 3 (guides/manuals/ADRs/research)
2. Query MCP Ref for additional standards:
   ```
   ref_search_documentation(query="[domain] RFC OWASP best practices {current_year}")
   ```
3. Extract standards/patterns (RFC numbers, OWASP rules, do/don't patterns)
4. Compare Story Technical Notes with standards
5. IF Story violates standard:
   - Rewrite Technical Notes with compliant approach
   - Add reference to guide/RFC (e.g., "See [Guide-05](docs/guides/05-rest-api-patterns.md)")
6. Add Standards Compliance subsection if missing
7. Update Linear issue via `save_issue`
8. Add comment: "Solution updated to comply with [Standards list]"

---

## Example Transformation

**Before:**
```markdown
## Technical Notes
We'll create custom login endpoint `/do-login` that accepts username/password
and returns a session cookie.
```

**After (Phase 3 findings from oauth2-proxy Manual + Auth ADR):**
```markdown
## Technical Notes

### Standards Compliance
- OAuth 2.0 (RFC 6749): Resource Owner Password Credentials Grant
- Token endpoint: POST /token with grant_type=password
- See [Manual: oauth2-proxy v7](docs/manuals/oauth2-proxy-v7.md) for implementation details
- Architecture decision: [ADR-003: Authentication Strategy](docs/adrs/003-auth-strategy.md)

### Architecture Considerations
OAuth 2.0 compliant authentication flow:
1. Client sends POST /token with { grant_type, username, password }
2. Server validates credentials
3. Returns { access_token, token_type, expires_in, refresh_token }
4. Client uses Bearer token for subsequent requests
```

---

## Standards Override KISS/YAGNI

**Decision Matrix:**

| Proposed Simplification | Standard Check | Decision |
|-------------------------|----------------|----------|
| "Skip refresh tokens" | RFC 6749 requires | REJECT - Keep refresh tokens |
| "Use GET for mutations" | REST violates | REJECT - Use POST/PUT/DELETE |
| "Skip CORS headers" | Security standard | REJECT - Keep CORS |
| "Return only 200/500" | RFC 7231 defines codes | REJECT - Use proper HTTP codes |
| "Custom auth for simplicity" | OAuth RFC 6749 | REJECT - Use OAuth |

**Decision Flow:**
```
Does solution violate Industry Standard (RFC, OWASP, REST)?
  -> YES: Keep complex solution, add standard justification
  -> NO: Continue to KISS/YAGNI check
```

---

## Skip Fix When

- Solution already references specific RFC/standard
- Story in Done/Canceled status
- Standard not applicable (e.g., OpenAPI for internal-only API)

---

## Execution Notes

**Sequential Dependency:**
- Criterion #5 depends on #1-#4 being completed first
- Cannot verify standards until Story structure is correct (#1-#2)
- Must be checked BEFORE KISS/YAGNI (#11-#12)

**Research Integration:**
- Phase 3 creates documentation inline
- Criterion #5 reads from Phase 3 docs, fallback to MCP Ref if needed
- All research completed BEFORE Phase 4 auto-fix begins

**Linear Updates:**
- Criterion auto-fix updates Linear issue once
- Add comment: "Standards compliance verified - [list of RFCs/standards]"

---

**Version:** 1.0.0
**Last Updated:** 2025-01-07

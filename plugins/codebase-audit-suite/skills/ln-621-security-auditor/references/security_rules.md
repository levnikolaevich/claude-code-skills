# Security Audit Rules

<!-- SCOPE: Security vulnerability detection patterns ONLY. Contains regex patterns, OWASP mappings, remediation steps. -->
<!-- DO NOT add here: Audit workflow → ln-621-security-auditor SKILL.md -->

Detailed detection patterns and recommendations for security vulnerabilities.

## 1. Hardcoded Secrets

### Detection Patterns

| Pattern Type | Regex / Search Term | File Types |
|--------------|---------------------|------------|
| API Keys | `API_KEY\s*=\s*['"][^'"]{20,}['"]` | .ts, .js, .py, .go, .java |
| Passwords | `password\s*=\s*['"][^'"]+['"]` | .ts, .js, .py, .go, .java |
| Tokens | `TOKEN\s*=\s*['"][^'"]{20,}['"]` | .ts, .js, .py, .go, .java |
| AWS Keys | `AKIA[0-9A-Z]{16}` | All |
| Private Keys | `-----BEGIN (RSA|EC|OPENSSH) PRIVATE KEY-----` | .pem, .key, .ts, .js |
| Database URLs | `postgres://.*:.*@.*` | .ts, .js, .py, .env |

### Exclusions (False Positives)

- `.env.example`, `.env.template` - example files
- `README.md`, `SETUP.md` - documentation
- `**/tests/**`, `**/__tests__/**`, `*.test.*`, `*.spec.*` - test files with mock data
- Comments explaining secrets (not actual secrets)

### Severity Rules

| Condition | Severity |
|-----------|----------|
| Production AWS key (starts with AKIA) | CRITICAL |
| Database password in non-test file | CRITICAL |
| API token >32 characters | CRITICAL |
| Password in test file | HIGH |
| Development credentials | HIGH |
| Mock/example credentials in docs | MEDIUM |

### Recommendations by Tech Stack

| Stack | Recommendation |
|-------|----------------|
| Node.js | Use `dotenv` package, load from `.env` file, add `.env` to `.gitignore` |
| Python | Use `python-dotenv`, load from `.env`, add to `.gitignore` |
| Go | Use `os.Getenv("VAR_NAME")`, configure via environment |
| Java | Use Spring `@Value("${var.name}")` or Properties files |
| .NET | Use `appsettings.json` + User Secrets, configure via environment |

---

## 2. SQL Injection Patterns

### Detection Patterns

| Language | Unsafe Pattern | Safe Pattern |
|----------|----------------|--------------|
| JavaScript | `db.query("SELECT * FROM users WHERE id=" + id)` | `db.query("SELECT * FROM users WHERE id=$1", [id])` |
| Python | `cursor.execute(f"SELECT * FROM users WHERE id={id}")` | `cursor.execute("SELECT * FROM users WHERE id=%s", (id,))` |
| PHP | `mysqli_query($conn, "SELECT * FROM users WHERE id=" . $id)` | `$stmt->prepare("SELECT * FROM users WHERE id=?")` |
| Java | `stmt.executeQuery("SELECT * FROM users WHERE id=" + id)` | `PreparedStatement.setInt(1, id)` |

### ORM Patterns (Generally Safe, but check)

| ORM | Unsafe | Safe |
|-----|--------|------|
| Prisma | `prisma.$queryRaw\`SELECT * FROM ${table}\`` | `prisma.$queryRaw\`SELECT * FROM User\`` |
| TypeORM | `repository.query("DELETE FROM " + table)` | `repository.createQueryBuilder().delete().execute()` |
| Sequelize | `sequelize.query("SELECT * FROM " + table)` | `User.findAll({ where: { id } })` |

### Severity Rules

| Condition | Severity |
|-----------|----------|
| User input directly concatenated | CRITICAL |
| Template literal with user variable | CRITICAL |
| String concatenation with any variable | HIGH |
| ORM raw query with concatenation | HIGH |
| Internal variable concatenation (no user input) | MEDIUM |

---

## 3. XSS Vulnerabilities

### Detection Patterns by Framework

| Framework | Unsafe | Safe |
|-----------|--------|------|
| React | `<div dangerouslySetInnerHTML={{__html: userInput}} />` | `<div>{userInput}</div>` |
| Vanilla JS | `element.innerHTML = userInput` | `element.textContent = userInput` |
| Vue | `<div v-html="userInput"></div>` | `<div>{{ userInput }}</div>` |
| Angular | `<div [innerHTML]="userInput"></div>` | `<div>{{ userInput }}</div>` |
| PHP | `<?= $userInput ?>` | `<?= htmlspecialchars($userInput) ?>` |

### Sanitization Libraries

| Language/Framework | Library | Example |
|--------------------|---------|---------|
| JavaScript | DOMPurify | `DOMPurify.sanitize(userInput)` |
| React | sanitize-html | `sanitizeHtml(userInput, { allowedTags: [...] })` |
| Python | bleach | `bleach.clean(user_input, tags=['p', 'b'])` |
| PHP | HTMLPurifier | `$purifier->purify($userInput)` |

### Severity Rules

| Condition | Severity |
|-----------|----------|
| User input → `innerHTML` without sanitization | CRITICAL |
| User input → `dangerouslySetInnerHTML` | CRITICAL |
| User input with partial escaping (insufficient) | HIGH |
| Internal data (potential XSS if compromised) | MEDIUM |
| Admin panel with trusted input | LOW |

---

## 4. Insecure Dependencies

### Audit Commands by Stack

| Stack | Command | Output Format |
|-------|---------|---------------|
| Node.js | `npm audit --json` | JSON with vulnerabilities |
| Python | `pip-audit --format json` | JSON with CVEs |
| Rust | `cargo audit --json` | JSON with advisories |
| .NET | `dotnet list package --vulnerable` | Table format |
| Go | `go list -json -m all \| nancy sleuth` | JSON with CVEs |

### Severity Mapping

| CVE CVSS Score | Severity |
|----------------|----------|
| 9.0-10.0 | CRITICAL |
| 7.0-8.9 | HIGH |
| 4.0-6.9 | MEDIUM |
| 0.1-3.9 | LOW |

### Recommendations

| Scenario | Action |
|----------|--------|
| Patch available | Update to patched version immediately |
| No patch, workaround exists | Apply workaround, add comment with CVE ID |
| No patch, actively exploited | Replace package with alternative |
| Unmaintained package | Find maintained alternative |
| Dev dependency only | Lower priority, update when possible |

---

## 5. Missing Input Validation

### Validation Points

| Boundary | What to Validate | Example |
|----------|------------------|---------|
| API endpoints | Request body, query params, headers | Email format, length limits, type checking |
| File uploads | File type, size, content | Only allow images, max 5MB, verify MIME type |
| Form inputs | Format, length, allowed characters | Phone numbers, credit cards, usernames |
| URL parameters | Type, range, format | Numeric IDs, UUIDs, enum values |

### Validation Libraries by Stack

| Stack | Library | Example |
|-------|---------|---------|
| Node.js/Express | joi, express-validator, zod | `Joi.object({ email: Joi.string().email() })` |
| Python/Flask | marshmallow, pydantic | `@validate(UserSchema)` |
| Go | go-playground/validator | `validate.Struct(user)` |
| Java/Spring | javax.validation | `@Valid @RequestBody UserDTO` |
| .NET | FluentValidation | `RuleFor(x => x.Email).EmailAddress()` |

### Common Validation Rules

| Field Type | Validation | Severity if Missing |
|------------|------------|---------------------|
| Email | Regex + DNS check | HIGH |
| Password | Length ≥8, complexity | CRITICAL |
| File upload | Type whitelist, size limit | CRITICAL |
| Numeric ID | Type check, range | MEDIUM |
| Enum value | Whitelist check | HIGH |
| Credit card | Luhn algorithm | CRITICAL |
| Phone number | Country-specific format | MEDIUM |

### CORS Configuration

| Setting | Secure | Insecure | Severity if Insecure |
|---------|--------|----------|----------------------|
| Origin | Specific domains | `*` (wildcard) | HIGH |
| Credentials | `false` or specific origin | `true` with `*` origin | CRITICAL |
| Methods | Only needed methods | All methods | MEDIUM |
| Headers | Only needed headers | `*` (all headers) | MEDIUM |

---

## Effort Estimation

| Type | Time | Description |
|------|------|-------------|
| **S** (Small) | <1 hour | Replace hardcoded value with env var, update dependency version, add simple validation |
| **M** (Medium) | 1-4 hours | Refactor query to parameterized, add validation middleware, sanitize XSS vectors |
| **L** (Large) | >4 hours | Major dependency migration, redesign authentication, comprehensive input validation |

---

## Tech Stack Specific Notes

### Node.js/TypeScript
- **ORM Security:** Prisma auto-sanitizes, but check raw queries
- **Template Engines:** EJS `<%=` escapes, `<%-` does not
- **Validation:** Prefer Zod for type-safe validation

### Python
- **Django:** Uses parameterized queries by default, but check `.raw()` and `.extra()`
- **Flask:** No built-in ORM, always validate input manually
- **FastAPI:** Pydantic validation built-in, but check custom validators

### Go
- **SQL:** Use `database/sql` with placeholders `?` or `$1`
- **Templates:** `html/template` auto-escapes, `text/template` does not
- **Validation:** Use `go-playground/validator`

### Java/Spring
- **Hibernate:** Parameterized by default, check native queries
- **Templates:** Thymeleaf escapes by default, check `th:utext`
- **Validation:** Use Bean Validation (`@Valid`, `@NotNull`, etc.)

---

## False Positive Reduction

**Always exclude:**
- Test files: `*.test.*`, `*.spec.*`, `__tests__/`, `tests/`
- Example configs: `.env.example`, `config.example.json`
- Documentation: `*.md`, `docs/`
- Generated code: `dist/`, `build/`, `target/`, `.next/`

**Context-aware checks:**
- If codebase has `.env.example`, don't flag secrets matching those placeholders
- If testing framework detected (Jest, Pytest), ignore mock credentials in tests
- If ORM detected, check ORM-specific unsafe patterns (not generic SQL concat)

---

## Scoring Examples

| Violations | Calculation | Score |
|------------|-------------|-------|
| 0 critical, 0 high, 0 medium, 0 low | 10 - 0 | 10/10 |
| 1 critical, 0 high, 0 medium, 0 low | 10 - (1*2.0) | 8/10 |
| 2 critical, 3 high, 5 medium, 2 low | 10 - (2*2.0 + 3*1.0 + 5*0.5 + 2*0.2) | 10 - 9.9 = 0.1 → 0/10 |
| 0 critical, 5 high, 10 medium, 5 low | 10 - (0 + 5*1.0 + 10*0.5 + 5*0.2) | 10 - 11 = 0/10 |

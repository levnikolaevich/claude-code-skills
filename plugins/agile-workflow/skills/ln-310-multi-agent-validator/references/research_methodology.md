<!-- SOURCE-OF-TRUTH: shared/references/research_methodology.md. Edit ONLY here; run `node tools/marketplace/shared.mjs sync` -->

# Research Methodology

<!-- SCOPE: Standardized research methodology for MCP Ref/Context7 research. Source credibility, domain standards, quality criteria. -->
<!-- DO NOT add here: documentation creation → documentation_creation.md, tool fallback chain → research_tool_fallback.md -->

Unified research methodology for all skills performing MCP Ref / Context7 research.

---

## Source Credibility Hierarchy

| Priority | Source Type | Example | When to Use |
|----------|-------------|---------|-------------|
| **1** | Official documentation | Python.org, FastAPI docs, RFC specifications | ALWAYS prefer official docs |
| **2** | Industry standards | RFC 6749 (OAuth), OpenAPI 3.0 spec, OWASP guidelines | For protocol/standard compliance |
| **3** | Vendor documentation | AWS docs, Redis docs, PostgreSQL docs | For specific vendor implementations |
| **4** | Community standards | PEP (Python), JSR (Java), WCAG (accessibility) | For language/platform best practices |
| **5** | Authoritative blogs | Real Python, DigitalOcean tutorials, vendor blogs | For complex integration examples |
| **6** | Stack Overflow | Accepted answers with high votes (500+) | LAST RESORT - verify info elsewhere |

**Red Flags (avoid):**
- Blog posts > 2 years old (outdated patterns)
- Personal blogs without credentials
- Medium posts without verification
- Reddit/forum posts (use for direction only)

---

## Standards Compliance by Domain

| Domain | Relevant Standards |
|--------|-------------------|
| **Authentication** | OAuth 2.0 (RFC 6749), OpenID Connect, JWT (RFC 7519) |
| **REST API** | OpenAPI 3.0, REST principles (RFC 7231), HATEOAS |
| **Security** | OWASP Top 10, NIST guidelines, CSP (Content Security Policy) |
| **Data formats** | JSON Schema, Protocol Buffers, Avro |
| **Protocols** | HTTP/2 (RFC 7540), WebSocket (RFC 6455), gRPC |
| **Accessibility** | WCAG 2.1, ARIA, Section 508 |

---

## Version Selection Guidelines

| Scenario | Preferred Version | Rationale |
|----------|-------------------|-----------|
| **Production projects** | Latest LTS (Long Term Support) | Stability + security updates |
| **New features** | Latest stable release | Modern APIs, avoid beta/RC |
| **Legacy projects** | Match existing version (upgrade path in separate Story) | Avoid breaking changes |
| **Experimental** | Latest (including RC) | ONLY if Epic explicitly requests bleeding edge |

**Version notation:** Use `"v3.12.1 (LTS)"` or `"v2.5.0 (stable)"`. Never `"latest"` or `"v3.x"`.

**Unsupported API check:** If library has unsupported methods, list in "Key constraints". If library is end-of-life, suggest alternatives.

---

## Key APIs Extraction

**Focus on 2-5 MOST RELEVANT methods for the Story domain.**

**Extraction rules:**
1. Include method signature (parameters, return type if critical)
2. Explain WHEN to use (not just WHAT it does)
3. Prioritize methods for Story domain (not all library methods)
4. If >5 methods, group by category (CRUD, validation, utilities)

---

## Constraints & Limitations

**MUST document:** async/sync support, storage backends, multi-process caveats, platform limitations, performance limitations.

**Format:**
```
**Key constraints:**
- [Limitation]: [Brief explanation] - [Workaround or solution]
```

---

## Research Methodology by Type

| Type | Focus | Primary Sources | Key Questions |
|------|-------|-----------------|---------------|
| **Technical** | Solution comparison | Docs, benchmarks, RFCs | "Which solution fits our use-case?" |
| **Market** | Industry landscape | Reports, blogs, articles | "What's the market size/trend?" |
| **Competitor** | How others solve it | Product pages, reviews, demos | "What features do competitors offer?" |
| **Requirements** | User needs | Feedback, support tickets, forums | "What do customers complain about?" |
| **Feasibility** | Can we build it? | PoC, prototypes, local tests | "Is it technically possible?" |
| **Feature Demand** | Feature viability | Competitor features + blogs/socials + user complaints | "Is this feature worth building?" |

---

## Research Summary Template

```markdown
## Library Research
**Primary libraries:**
| Library | Version | Purpose | Docs |
|---------|---------|---------|------|
| [name] | v[X.Y.Z] ([stable/LTS]) | [purpose] | [URL] |

**Key APIs:**
- `method(params)` - [when to use]

**Key constraints:**
- [Limitation] - [Workaround]

**Standards compliance:**
- [Standard/RFC]: [How to comply]

**Existing guides:**
- [path] - [description]
```

---

## Quality Checklist

Before returning Research Summary, verify:

- [ ] All libraries have specific versions (not "latest")
- [ ] Key APIs (2-5 methods) include when to use (not just what)
- [ ] Constraints list workarounds or solutions
- [ ] Standards compliance includes HOW to comply (not just standard name)
- [ ] Official docs URLs are valid (not broken links)
- [ ] Research Summary is <=500 words (concise, actionable)

---

## Time Management

**Time-box: 10-15 minutes maximum per Epic**

| Phase | Time |
|-------|------|
| Identify | 1-2 minutes |
| Context7 | 3-5 minutes (parallel calls) |
| MCP Ref | 3-5 minutes (parallel calls) |
| Guides | 1-2 minutes |
| Summary | 2-3 minutes |

**If time exceeds:** Reduce library count (focus on 2-3 primary), skip fallback WebSearch, use cached Ref results from previous Epics.

---

**Version:** 1.0.0
**Last Updated:** 2026-03-20

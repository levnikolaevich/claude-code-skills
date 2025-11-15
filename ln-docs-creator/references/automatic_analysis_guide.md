# Automatic Analysis Guide

Guide for automatic analysis of project materials and researching 2025 best practices.

---

## Section 1: Analyzing Project Materials

### When to Analyze
Ask user: *"Do you have project materials to analyze? (files, diagrams, docs, code)"*

### Files to Search (use Glob + Read)

**Package managers**: `package.json`, `requirements.txt`, `go.mod`, `pom.xml`, `Gemfile`
**Docker**: `Dockerfile`, `docker-compose.yml`, `docker-compose.test.yml`
**Config**: `tsconfig.json`, `*.env.example`, `.nvmrc`
**Docs**: `README.md`, architecture diagrams
**Code structure**: `src/`, `api/`, `services/`, `tests/`

### Information to Extract

From **package.json / requirements.txt / go.mod**:
- Runtime version (Node 18, Python 3.11, Go 1.21)
- Dependencies → frameworks, databases, auth, cache
- Pre-populate: Q9, Q12

From **Dockerfile**:
- Base image → runtime version
- Multi-stage structure → build optimization
- Pre-populate: Q9, Q12

From **docker-compose.yml**:
- Services → app + db + cache + queue
- Images → database/cache versions
- Volumes → hot-reload setup
- Pre-populate: Q9, Q11

From **docker-compose.test.yml**:
- Test services → db-test, cache-test (isolated)
- Volumes → ./src, ./tests (hot-reload)
- Tmpfs → in-memory test databases
- Command → test framework
- Pre-populate: Q12 (test setup)

### Output Format
```
✓ Analyzed project materials

**Detected**:
- Runtime: [runtime + version]
- Framework: [framework + version]
- Database: [database]
- Architecture: [hints from docker-compose]

**Pre-populated**: Q9, Q12 (partial)
```

---

## Section 2: Researching Best Practices 2025

### When to Research
During **Phase 2, Stage 2** for questions Q9, Q11-Q13.

Ask user first: *"Research best practices automatically? (Y/N)"*

### Research Tools

**MCP Ref** (`mcp__Ref__ref_search_documentation`):
- Query: `"[framework] latest version 2025"`
- Use for: Official docs, version numbers, features
- Then Read: `mcp__Ref__ref_read_url` for details

**WebSearch**:
- Query patterns:
  - `"[Tech A] vs [Tech B] 2025 comparison"`
  - `"best practices [technology] 2025"`
  - `"[pattern] architecture pros cons 2025"`
- Use for: Comparisons, best practices, trends

### Research Strategy by Question

**Q9: Technology Decisions**
1. Check analyzed versions vs 2025 latest
2. MCP Ref: latest stable versions
3. WebSearch: security vulnerabilities, release notes
4. Recommend upgrades if: EOL, security issues, LTS available

**Q11: Architectural Patterns**
1. Identify project type + scale from Stage 1
2. WebSearch: `"[project type] architecture patterns 2025"`
3. Consider scale:
   - Small (< 10K users) → Monolith
   - Medium (10K-100K) → Microservices
   - Large (100K+) → Microservices + Event-Driven

**Q12: Libraries and Frameworks**
1. Based on Q9 + Q11
2. MCP Ref: latest versions for each component
3. WebSearch: compatibility, comparisons
4. Check: ORM, testing framework, validation library
5. Verify compatibility matrix

**Q13: Integrations**
1. Identify needs from Q5 (IN SCOPE)
2. WebSearch comparisons:
   - Payments: `"Stripe vs PayPal 2025"`
   - Email: `"SendGrid vs AWS SES 2025"`
   - Auth: `"Auth0 vs Clerk 2025"`
   - Storage: `"AWS S3 vs Cloudinary 2025"`
3. Consider: pricing, DX, compliance, popularity

### Dockerfile Generation
Based on Q12 runtime + framework:
- Latest stable base image
- Multi-stage build (dev + prod)
- Security: non-root user, minimal image
- Generate docker-compose.yml with services from Q11

---

## Section 3: Transition to Interactive Mode

### When to Ask User

**Pause research when**:
1. **Multiple alternatives** (React vs Vue) → present both, ask preference
2. **Insufficient info** (no files found) → ask directly
3. **Unclear goals** (vague Q5) → ask clarifying questions
4. **Always interactive**: Q10, Q14-Q19 (org-specific)

### Alternative Presentation Template
```
"Researched [Category]:

**Option A**: [Tech A]
Pros: [key benefits]
Cons: [key drawbacks]

**Option B**: [Tech B]
Pros: [key benefits]
Cons: [key drawbacks]

Recommendation: [A/B] because [reason]

Which do you prefer? (A/B/Other)"
```

### Fallback to Full Interactive
If no materials OR user declines research → ask all Q9-Q19 interactively

---

## Section 4: Quality Guidelines

### Verification Checklist
- [ ] Version is 2025-current (< 1 year old)
- [ ] Stable release (not beta)
- [ ] No critical security vulnerabilities
- [ ] Compatible with other tech
- [ ] Active community (GitHub stars, updates)
- [ ] Official docs available

### Red Flags (Don't Recommend)
- Last updated > 2 years ago
- Unpatched security vulnerabilities
- Incompatible with stack
- Beta/experimental (unless requested)
- Obscure (<1000 GitHub stars)

### Rationale Format
```
Recommendation: [Technology]
Rationale:
1. [Technical reason]
2. [Ecosystem reason]
3. [Project fit reason]
4. [Industry adoption]
```

---

## Section 5: Execution Flow

### Phase 1.5: Material Analysis
```
User provides materials? (Y/N)
├─ Y: Glob + Read files → Extract info → Report findings
└─ N: Skip to Phase 2
```

### Phase 2, Stage 2: Research & Design
```
Stage 1 complete (Q1-Q8 answered)
  ↓
Research automatically? (Y/N)
├─ Y: Research Q9, Q11-Q13 → Present recommendations → User accepts/modifies
└─ N: Ask Q9-Q13 interactively
  ↓
Always ask Q10, Q14-Q19 interactively
```

---

**Version:** 1.0.0
**Last Updated:** 2025-10-29

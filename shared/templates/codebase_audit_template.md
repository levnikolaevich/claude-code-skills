<!-- SOURCE-OF-TRUTH: shared/templates/codebase_audit_template.md. Edit ONLY here; run `node tools/marketplace/shared.mjs sync` -->

# Codebase Audit Report Template

---

## Codebase Audit Report - [DATE]

### Executive Summary
[2-3 sentences on overall codebase health, major risks, and key strengths]

### Compliance Score

| Category | Score | Notes |
|----------|-------|-------|
| Security | X/10 | ... |
| Build Health | X/10 | ... |
| Architecture & Design | X/10 | ... |
| Code Quality | X/10 | ... |
| Dependencies & Reuse | X/10 | ... |
| Dead Code | X/10 | ... |
| Observability | X/10 | ... |
| Concurrency | X/10 | ... |
| Lifecycle | X/10 | ... |
| **Overall** | **X/10** | |

### Severity Summary

| Severity | Count |
|----------|-------|
| Critical | X |
| High | X |
| Medium | X |
| Low | X |

### Domain Health Summary (if domain_mode="domain-aware")

| Domain | Files | Arch Score | Quality Score | Issues |
|--------|-------|------------|---------------|--------|
| {domain} | N | X/10 | X/10 | N |
| **Total** | **N** | **X/10** | **X/10** | **N** |

### Cross-Domain Issues (if domain_mode="domain-aware" and pattern_signature matches found)

| Signature | Domains | Locations | Issue | Recommendation | Effort |
|-----------|---------|-----------|-------|----------------|--------|
| {sig} | d1, d2 | file:line, file:line | ... | ... | S/M/L |

### Strengths
- [What's done well in this codebase]
- [Good patterns and practices identified]

### Findings by Category

#### 1. Security (Global)

| Severity | Location | Issue | Principle Violated | Recommendation | Effort |
|----------|----------|-------|-------------------|----------------|--------|

#### 2. Build Health (Global)

| Severity | Location | Issue | Principle Violated | Recommendation | Effort |
|----------|----------|-------|-------------------|----------------|--------|

#### 3. Architecture & Design (Domain-Grouped)

##### Domain: {domain} ({path})

| Severity | Location | Issue | Principle Violated | Recommendation | Effort |
|----------|----------|-------|-------------------|----------------|--------|

#### 4. Code Quality (Domain-Grouped)

##### Domain: {domain} ({path})

| Severity | Location | Issue | Principle Violated | Recommendation | Effort |
|----------|----------|-------|-------------------|----------------|--------|

#### 5. Dependencies & Reuse (Global)

| Severity | Location | Issue | Principle Violated | Recommendation | Effort |
|----------|----------|-------|-------------------|----------------|--------|

#### 6. Dead Code (Global)

| Severity | Location | Issue | Principle Violated | Recommendation | Effort |
|----------|----------|-------|-------------------|----------------|--------|

#### 7. Observability (Global)

| Severity | Location | Issue | Principle Violated | Recommendation | Effort |
|----------|----------|-------|-------------------|----------------|--------|

#### 8. Concurrency (Global)

| Severity | Location | Issue | Principle Violated | Recommendation | Effort |
|----------|----------|-------|-------------------|----------------|--------|

#### 9. Lifecycle (Global)

| Severity | Location | Issue | Principle Violated | Recommendation | Effort |
|----------|----------|-------|-------------------|----------------|--------|

### Advisory Findings (Context-Validated)

Findings that triggered metric thresholds but were downgraded by context validation (see `references/context_validation.md`). Not included in penalty scoring. Listed for transparency.

| Location | Original Severity | Rule Applied | Evidence | Note |
|----------|-------------------|-------------|----------|------|

### Recommended Actions (Priority-Sorted)

| Priority | Category | Domain | Location | Issue | Recommendation | Effort |
|----------|----------|--------|----------|-------|----------------|--------|

### Priority Actions
1. Fix all Critical issues before next release
2. Address High issues within current sprint
3. Plan Medium issues for technical debt sprint
4. Track Low issues in backlog

### Sources Consulted
- [Framework] best practices: [URL from MCP Ref]
- [Library] documentation: [URL from Context7]

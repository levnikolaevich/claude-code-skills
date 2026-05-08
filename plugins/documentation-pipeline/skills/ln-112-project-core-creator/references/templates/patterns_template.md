# Patterns Catalog

Architectural patterns with 4-score evaluation.

> **SCOPE:** Pattern inventory with scores, ADR/Guide links. Updated by ln-640 Pattern Evolution Auditor.
> **Last Audit:** YYYY-MM-DD
<!-- DOC_KIND: reference -->
<!-- DOC_ROLE: canonical -->
<!-- READ_WHEN: Read when you need the current inventory of architectural patterns and their audit status. -->
<!-- SKIP_WHEN: Skip when you only need one specific ADR or implementation guide. -->
<!-- PRIMARY_SOURCES: docs/reference/adrs/, docs/reference/guides/, docs/project/architecture.md -->

## Quick Navigation

- [Architecture](../project/architecture.md)
- [ADRs](../reference/adrs/)
- [Guides](../reference/guides/)

## Agent Entry

| Signal | Value |
|--------|-------|
| Purpose | Tracks active architectural patterns, links to supporting docs, and records audit posture. |
| Read When | You need pattern inventory, trend, or audit status. |
| Skip When | You already know the exact ADR or guide to inspect. |
| Canonical | Yes |
| Next Docs | [Architecture](../project/architecture.md), [ADRs](../reference/adrs/), [Guides](../reference/guides/) |
| Primary Sources | `docs/reference/adrs/`, `docs/reference/guides/`, `docs/project/architecture.md` |

---

## Score Legend

| Score | Measures | Threshold |
|-------|----------|-----------|
| **Compliance** | Industry standards, naming, tech stack conventions, layer boundaries | 70% |
| **Completeness** | All components, error handling, observability, tests | 70% |
| **Quality** | Readability, maintainability, SOLID, no smells, no duplication | 70% |
| **Implementation** | Code exists, production use, monitored | 70% |

---

## Pattern Inventory

| # | Pattern | ADR | Guide | Compl | Complt | Qual | Impl | Avg | Notes | Story |
|---|---------|-----|-------|-------|--------|------|------|-----|-------|-------|
| 1 | *Example* | [ADR-NNN](link) | [G-NN](link) | —% | —% | —% | —% | **—%** | - | - |

**Column reference:**
- `ADR` — Architecture Decision Record (strategic decisions)
- `Guide` — Implementation guide (GoF, best practices)
- `Notes` — Inline context for scores (e.g., "90% Missing health check")

---

## Discovered Patterns (Adaptive)

Patterns found via Phase 1b heuristic discovery, not in baseline library.

| # | Pattern | Confidence | Evidence | Compl | Complt | Qual | Impl | Avg | Story |
|---|---------|------------|----------|-------|--------|------|------|-----|-------|
| 1 | *Example* | HIGH/MED/LOW | *src/handlers/, 5 files* | —% | —% | —% | —% | **—%** | - |

**Confidence levels:**
- `HIGH` — Naming + structural indicators match
- `MEDIUM` — Naming convention only
- `LOW` — Structural heuristic only

---

## Layer Boundary Status

Audit results from ln-642-layer-boundary-auditor.

| Metric | Value | Threshold | Status |
|--------|-------|-----------|--------|
| Layer Violations | X | 0 | -/- |
| HTTP Abstraction Coverage | XX% | 90% | -/- |
| Error Handling Centralized | Yes/No | Yes | -/- |

### Active Layer Violations

<!-- Populated by ln-642 -->

| # | File | Line | Violation | Allowed In | Story |
|---|------|------|-----------|------------|-------|
| 1 | *app/domain/X.py* | *45* | *HTTP Client in domain* | *infrastructure/http/* | [ID](link) |

---

## API Contract Status

Audit results from ln-643-api-contract-auditor.

| Check | Status | Details |
|-------|--------|---------|
| ORM Leakage to Schemas | -/- | - |
| Response Models | -/- | - |
| Service DTOs | -/- | - |
| Error Format | -/- | - |
| Entity Returns | -/- | - |
| Framework Leakage | -/- | - |

---

## Quick Wins (< 4h effort)

| Pattern | Issue | Recommendation | Effort | Impact |
|---------|-------|----------------|--------|--------|
| *Example* | Missing @decorator | Add @retry decorator to service methods | 1-2h | +5% completeness |

---

## Patterns Requiring Attention

### Score < 70% (Story Required)

| Pattern | Avg | Issue | Recommendation | Effort | Story |
|---------|-----|-------|----------------|--------|-------|
| *Example* | 58% | No DLQ, no schema versioning | Add Bull DLQ config; implement event schema v2 | L | [PROJ-XXX](link) |

### Score 70-80% (Improvement Planned)

| Pattern | Avg | Issue | Recommendation | Effort | Story |
|---------|-----|-------|----------------|--------|-------|
| *Example* | 75% | Missing health check | Add /health endpoint with dependency checks | M | [PROJ-XXX](link) |

### Layer Violations (Architectural Debt)

| File | Line | Violation | Recommendation | Story |
|------|------|-----------|----------------|-------|
| *app/domain/X.py* | *45* | *HTTP Client in domain* | *Move to infrastructure/http/, inject via DI* | [PROJ-XXX](link) |

---

## Pattern Recommendations

Suggested patterns based on Phase 1c project analysis (NOT scored, advisory only).

| Condition Found | Recommended Pattern | Rationale |
|-----------------|---------------------|-----------|
| *Example: External API calls without retry* | *Resilience* | *Prevent cascading failures* |

---

## Excluded Patterns

Patterns detected by keyword but excluded after applicability verification (Phase 1d).

| # | Pattern | Source | Keywords Found | Exclusion Reason | Last Seen |
|---|---------|--------|---------------|-----------------|-----------|
| 1 | *Example* | Baseline | *Queue (1 match)* | *Missing: Worker, DLQ, Retry* | *YYYY-MM-DD* |

**Exclusion reasons:**
- **Structural:** Fewer than 2 required structural components detected (baseline patterns)
- **Confidence:** LOW confidence with fewer than 3 evidence files (adaptive patterns)
- **Language idiom:** Standard language construct, stdlib feature, or framework built-in — not an architectural pattern (verified via MCP Ref)
- **Removed:** Previously cataloged but no longer detected after refactoring

---

## Summary

**Architecture Health Score:** XX% (Healthy|Warning|Critical)

Formula: `avg(N pattern scores + layer_score + api_contract_score) * 10`

**Trend:** +X% (reason)

| Status | Count | Patterns |
|--------|-------|----------|
| Healthy (90%+) | X | list |
| Warning (70-89%) | X | list |
| Critical (<70%) | X | list |

---

## Maintenance

**Updated by:** ln-640-pattern-evolution-auditor
**Layer audit by:** ln-642-layer-boundary-auditor
**API contract audit by:** ln-643-api-contract-auditor
**Last Updated:** {{DATE}}

**Update Triggers:**
- New pattern implemented
- Pattern refactored (run ln-640 audit)
- ADR/Guide created or updated
- Layer violation fixed

**Verification:**
- [ ] Pattern rows match the current codebase and reference docs
- [ ] ADR and Guide links resolve
- [ ] Audit fields reflect the latest review state

**Next Audit:** YYYY-MM-DD (30 days)

---

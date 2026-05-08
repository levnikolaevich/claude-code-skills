<!-- SOURCE-OF-TRUTH: plugins/agile-workflow/shared/references/risk_validation.md. Edit ONLY here; run `node tools/marketplace/shared.mjs sync` -->

# Risk Validation (Criterion #20)

<!-- SCOPE: Implementation risk analysis criterion #20 ONLY. Contains risk categories, Impact x Probability scoring, auto-fix rules. -->
<!-- DO NOT add here: Testing risks -> risk_based_testing_guide.md, dependencies -> dependency_validation.md, security standards -> standards_validation.md -->

Detailed rules for implementation risk analysis in Story/Tasks.

---

## Criterion #20: Risk Analysis

**Check:** Story/Tasks identify and mitigate implementation risks with Priority >= 9

**Penalty:** HIGH (5 points) per unmitigated risk with Priority >= 15; MEDIUM (3 points) for Priority 9-14

**Cap:** Max 15 points (3 violations maximum counted)

**Uses:** Impact x Probability matrix from `references/risk_based_testing_guide.md`

**Skip fix when:** Story has explicit Risk Assessment section, Story/Task in Done/Canceled, scope is trivial (1-2 Tasks, no external deps/DB/arch decisions), or all detected risks already mitigated in Technical Notes.

---

## Risk Categories

| Cat | Rule | Keywords | Auto-fix |
|-----|------|----------|----------|
| R1: Architecture | Non-trivial choices need rationale or ADR ref | architecture, pattern, CQRS, saga, event-driven, microservice, monolith, event sourcing, message queue | FLAG → create ADR per references/templates/adr_template.md |
| R2: Error Handling | External calls need timeout, retry, fallback, circuit breaker | error, exception, retry, fallback, timeout, circuit breaker, dead letter, compensation | TODO: Define error handling for [op] |
| R3: Scalability | Data ops need bounds (pagination, limits, batch). Unbounded = risk | scale, concurrent, batch, pagination, limit, all records, full scan, load all, fetch all, no limit | TODO: Define pagination/batch limits |
| R4: Data Integrity | Multi-step data ops need transactions with rollback | transaction, rollback, constraint, cascade, delete, drop, truncate, migrate, atomic, consistency | TODO: Wrap [op] in transaction with rollback |
| R5: Integration | External APIs need SLA, timeout, retry, mock, webhook idempotency | API, external, third-party, webhook, integration, service, provider, vendor, OAuth, SSO | TODO: Define timeout/retry/fallback + idempotency |
| R6: SPOF | Critical-path needs degradation or redundancy plan | single, central, only one, depends entirely, critical path, no alternative, sole provider | FLAG → degradation strategy |

---

### R4b: Destructive Operation Safety

> SSOT: `references/destructive_operation_safety.md`

**Check:** Tasks with destructive operations have "Destructive Operation Safety" section with all 5 required fields filled (backup, rollback, blast radius, env guard, preview/dry-run) + severity

**Keywords:** `DROP, TRUNCATE, DELETE (without WHERE), ALTER...DROP COLUMN, rm -rf, rmdir, unlink, terraform destroy, kubectl delete, docker volume rm, migrate, purge, wipe, --force, git push --force, git reset --hard`

**GOOD example** (all 5 fields concrete):
```markdown
### Destructive Operation Safety
**Operations:** DROP TABLE legacy_sessions; rm -rf /tmp/build-cache
**Severity:** HIGH
**Backup plan:** pg_dump legacy_sessions before DROP; verify row count matches
**Rollback plan:** pg_restore from dump; tested on staging 2024-01-15
**Blast radius:** legacy_sessions table (0 active users, read-only since 2023-06); /tmp/build-cache (ephemeral, recreated on build)
**Environment guard:** DROP gated by IS_MIGRATION_APPROVED=true env var; rm -rf only in CI cleanup stage
**Preview / dry-run:** SELECT COUNT(*) FROM legacy_sessions = 0 active rows; ls -la /tmp/build-cache shows only stale artifacts
```

**Scoring:** Impact 5, Probability 4 = Priority 20 (HIGH)
- All fields concrete (non-placeholder) → PASS (0 points)
- Any field is TODO/placeholder/empty → FLAGGED (5 points) + NO-GO (human must fill)
- Destructive keywords found but NO safety section → FLAGGED (5 points) + NO-GO (human review mandatory)

**Auto-fix:** Insert section skeleton from shared reference template. If ANY field remains TODO/placeholder/empty → criterion stays FLAGGED, story stays NO-GO. Not auto-fixable to PASS.

**Skip when:** No destructive keywords detected in Story or Tasks.

---

## Scoring Algorithm

```
FOR EACH risk category R1-R4, R4b, R5-R6:
  1. SCAN Story (Technical Notes, Dependencies) + Tasks (Implementation Plan, Technical Approach)
  2. DETECT risk indicators via keywords
  3. IF risk indicator found:
     a. CHECK if mitigation documented (retry, fallback, transaction, ADR ref, timeout, degradation)
     b. IF mitigated -> PASS (0 points)
     c. IF NOT mitigated:
        - Assign Impact (1-5) and Probability (1-5) per risk_based_testing_guide.md
        - Calculate Priority = Impact x Probability
        - IF Priority >= 15 -> HIGH (5 points)
        - IF Priority 9-14  -> MEDIUM (3 points)
        - IF Priority <= 8   -> SKIP (0 points)
  4. IF NO risk indicators for category -> PASS (0 points)

TOTAL = sum of all penalties (cap at 15 points)
```

**Default Impact x Probability by category:**

| Category | Impact | Probability | Priority | Notes |
|----------|--------|-------------|----------|-------|
| R1: Architectural Decisions | 4 | 3 | 12 (MEDIUM) | Raise to 5x4=20 if system-wide pattern |
| R2: Error Handling | 4 | 4 | 16 (HIGH) | External calls almost always need handling |
| R3: Scalability | 3 | 3 | 9 (MEDIUM) | Raise if user-facing or data-heavy |
| R4: Data Integrity | 5 | 4 | 20 (HIGH) | Data loss = highest business impact |
| R5: Integration | 4 | 4 | 16 (HIGH) | External systems are inherently unreliable |
| R6: SPOF | 5 | 2 | 10 (MEDIUM) | Low probability but catastrophic impact |

Override defaults when Story context indicates higher/lower risk (e.g., internal tool vs public API).

---

## Auto-fix vs Human Review

| Priority Range | Action | Rationale |
|----------------|--------|-----------|
| >= 20 | FLAG only (human review mandatory) | Too high-impact for automated TODO |
| 15-19 | Add TODO placeholder + FLAG | Actionable but needs human verification |
| 9-14 | Add TODO placeholder (silent) | Important but lower urgency |
| <= 8 | SKIP | Risk too low to warrant Story-level documentation |

**Auto-fixable:** R2 (error handling), R3 (limits), R4 (transactions), R5 (integration points)

**Human review only:** R1 (architectural decisions), R6 (SPOF at design level), any risk with Priority >= 20

---

**Version:** 1.0.0
**Last Updated:** 2026-02-11

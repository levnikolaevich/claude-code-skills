# Workflow Validation (Criteria #7-#13)

<!-- SCOPE: Workflow validation criteria #7-#13 ONLY. Contains test strategy, KISS/YAGNI, task order, Story size rules. -->
<!-- DO NOT add here: Structural validation → structural_validation.md, traceability → traceability_validation.md -->

Detailed rules for test strategy, documentation integration, Story size, test cleanup, YAGNI, KISS, and task order.

---

## Criterion #7: Test Strategy Section (Empty Placeholder)

**Check:** Test Strategy section exists but is EMPTY (testing planned separately).

**Penalty:** LOW (1 point)

**Rule:** Section `## Test Strategy` must exist with placeholder text only. Any actual test content (unit tests, test cases) is a violation.

**Auto-fix:** If missing — add empty section with placeholder. If contains content — clear, add placeholder. Update Linear issue.

**Rationale:** Test planner analyzes ALL implementation Tasks to create Risk-Based Test Plan. Premature test planning = incomplete coverage.

---

## Criterion #8: Documentation Integration (No Standalone Doc Tasks)

**Check:** No separate Tasks for documentation — docs integrated into implementation Tasks.

**Penalty:** MEDIUM (3 points)

**Rule:** Standalone doc Tasks (keywords: "Write docs", "Update README", "Document API") must be merged into related implementation Task's Definition of Done as a doc checkbox.

**Auto-fix:** Identify standalone doc Tasks, remove them, add doc requirement to related Task's DoD. Update Linear issue.

**Rationale:** Documentation should be created WITH implementation, not after.

---

## Criterion #9: Story Size (1-8 Tasks)

**Check:** Story has 1-8 implementation Tasks (3-5 optimal).

**Penalty:** MEDIUM (3 points)

**Task Count by Complexity:**

| Complexity | Task Count | Example |
|------------|------------|---------|
| Trivial | 1-2 | Add health check, config endpoint |
| Simple | 3-4 | Add single endpoint with validation |
| Medium | 5-6 | Integrate external service (OAuth, Stripe) |
| Complex | 7-8 | Implement multi-step workflow |

**Database Creation Principle (Incremental Schema Evolution):**
Each Story creates ONLY the tables it needs. Big-bang "Setup Database" Stories that create all tables violate incremental delivery and vertical slicing.

**Auto-fix:**
1. Count implementation Tasks (exclude final test Task). If >8 — consolidate related Tasks
2. Scan first Story in Epic for database setup indicators (keywords: "Setup Database", "Create all tables", "Database schema"). If found and creates >5 tables — flag violation, suggest moving table creation to Stories that first use them
3. Update Linear issue

---

## Criterion #10: Test Cleanup (No Premature Test Tasks)

**Check:** No separate test Tasks BEFORE final Task (testing handled separately).

**Penalty:** MEDIUM (3 points)

**Rule:** Test Tasks (keywords: "test", "spec", "e2e") are only allowed as the final Task. Mid-Story test Tasks must be removed — add testing note to related Task's DoD instead.

**Auto-fix:** Find test Tasks before final Task, remove them, add testing note to related Task's DoD. Update Linear issue.

---

## Criterion #11: YAGNI (You Aren't Gonna Need It)

**Check:** Story scope limited to current requirements (no speculative features).

**Penalty:** MEDIUM (3 points)

**CRITICAL:** YAGNI applies UNLESS Industry Standards (#5) require it. Standards override YAGNI.

**YAGNI Hierarchy:**
```
Level 1: Industry Standards (RFC, OWASP) -> CANNOT remove
Level 2: Security Standards -> CANNOT remove
Level 3: YAGNI -> Apply ONLY if no conflict with Level 1-2
```

**GOOD (Standards Override YAGNI):**
- OAuth includes refresh tokens (RFC 6749 requires, even if "not needed yet")
- Error handling includes all HTTP codes (RFC 7231 defines them)

**GOOD (YAGNI Applies):**
- Login does NOT include social auth if not required now
- API does NOT include GraphQL if REST sufficient

**BAD (Violates Standards):**
- "Skip refresh tokens for simplicity" (violates RFC 6749)

**Auto-fix:**
1. Identify speculative features (keywords: "future-proof", "might need", "prepare for")
2. If required by Standard — keep, add justification. If not — remove, add TODO comment
3. Update Linear issue

---

## Criterion #12: KISS (Keep It Simple, Stupid)

**Check:** Solution uses simplest approach that meets requirements.

**Penalty:** MEDIUM (3 points)

**CRITICAL:** KISS applies UNLESS Industry Standards (#5) require complexity. Standards override KISS.

**KISS Hierarchy:**
```
Level 1: Industry Standards -> CANNOT simplify
Level 2: Security Standards -> CANNOT simplify
Level 3: KISS -> Apply ONLY if no conflict with Level 1-2
```

**GOOD (Standards Override KISS):**
- OAuth 2.0 with all required parameters (RFC 6749 requires)
- Helmet.js with security headers (OWASP requires)

**GOOD (KISS Applies):**
- Monolith instead of microservices (for small apps)
- SQLite instead of PostgreSQL (for dev/small apps)

**BAD (Over-engineered):**
- "Microservices for 3-endpoint API" (no scale requirement)
- "Kubernetes for single server" (Docker Compose sufficient)

**Auto-fix:**
1. Identify over-engineered solutions (keywords: "microservice", "kubernetes", "distributed")
2. If justified by Standard — keep, add justification. If not — simplify, suggest alternative
3. Update Linear issue

---

## Criterion #13: Foundation-First Task Order

**Check:** Tasks ordered bottom-up (Database -> Service -> API -> UI).

**Penalty:** MEDIUM (3 points)

**Correct Layer Order:** Database/schema -> Repository/data access -> Service/business logic -> API/routes -> Middleware -> UI/Frontend -> Tests (final).

**Task Independence Check:** Can Task N be completed using only Tasks 1..N-1? Forward dependencies (Task 2 requires Task 3 output) are violations. Detailed forward dependency detection handled by Criterion #19 in [dependency_validation.md](dependency_validation.md); this criterion focuses on LAYER ordering.

**Auto-fix:**
1. Identify layer for each Task (keywords: "schema", "repository", "service", "route")
2. If out of order — reorder Tasks
3. Parse Task descriptions for dependency keywords ("requires", "depends on", "needs"). If forward dependency found — flag as MEDIUM violation, suggest reordering
4. Update Linear issue

---

## Auto-Fix Hierarchy (CRITICAL)

**Check order:** Industry Standards (#5) first -> Security Standards second -> KISS/YAGNI (#11-#12) last.

**Decision:** If solution violates Industry Standard or compromises security — keep complex solution, add justification. Otherwise — apply KISS/YAGNI simplification.

| Proposed Simplification | Standard Check | Decision |
|-------------------------|----------------|----------|
| "Skip refresh tokens" | RFC 6749 requires | REJECT |
| "Use GET for mutations" | REST violates | REJECT |
| "Remove Redis caching" | No standard | ACCEPT |
| "Remove microservices" | No standard | ACCEPT |

---

**Version:** 3.0.0
**Last Updated:** 2025-01-07

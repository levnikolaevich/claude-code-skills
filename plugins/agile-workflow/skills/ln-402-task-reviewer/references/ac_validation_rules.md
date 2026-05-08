# AC Validation Rules

Standard criteria for validating Acceptance Criteria quality.

## 4 Core Criteria

### 1. Completeness (3 scenario types)

| Type | Required | Example |
|------|----------|---------|
| **Happy Path** | 1-2 AC | "Given valid credentials, When login, Then receive token" |
| **Error Handling** | 1-2 AC | "Given invalid password, When login, Then 401 error" |
| **Edge Cases** | 1 AC | "Given locked account, When login, Then 403 error" |

**Verdict:** ❌ FAIL if only happy path, no error handling

### 2. Specificity (measurable outcomes)

| ✅ Good | ❌ Bad |
|---------|--------|
| "Then return 200 OK" | "Then succeed" |
| "Then respond < 200ms" | "Then be fast" |
| "Then error 'Invalid email format'" | "Then show error" |

**Required elements:**
- HTTP status codes (200, 201, 400, 401, 403, 404, 500)
- Timing constraints where relevant
- Exact error messages for error scenarios

### 3. Dependencies (no forward references)

**Rule:** Task N can only depend on Tasks 1..N-1, never N+1 or later.

| ✅ Good | ❌ Bad |
|---------|--------|
| Task 3 uses result from Task 2 | Task 2 calls service from Task 4 |
| Task 1 creates table, Task 2 uses it | Task 1 references Task 3's API |

**Foundation-First order:** Database → Repository → Service → API

### 4. Database Scope (incremental schema)

**Rule:** Each Story creates ONLY tables it needs (not all upfront).

| ✅ Good | ❌ Bad |
|---------|--------|
| "User registration" → Creates Users table | "Setup database" → Creates all 50 tables |
| "Product search" → Creates Products table | "Database schema" → Big-bang creation |

## HTTP Status Code Reference

| Code | Meaning | When to Use |
|------|---------|-------------|
| 200 | OK | Successful GET/PUT |
| 201 | Created | Successful POST |
| 400 | Bad Request | Invalid input format |
| 401 | Unauthorized | Missing/invalid auth |
| 403 | Forbidden | Valid auth, no permission |
| 404 | Not Found | Resource doesn't exist |
| 500 | Internal Error | Server failure |

## Quick AC Checklist

```
□ Has happy path AC (1-2)
□ Has error handling AC (1-2)
□ Has edge case AC (1)
□ All AC have HTTP codes
□ Timing specified where needed
□ No forward dependencies
□ Database scope matches Story
```

---

## INVEST Validation (Story-Level)

Story quality validation using INVEST criteria.

### INVEST Criteria Table

| Criterion | Check | ✅ PASS | ❌ FAIL |
|-----------|-------|---------|---------|
| **Independent** | Can develop/deploy without blocking others | Story N uses only N-1 outputs | Story N requires Story N+2 output |
| **Negotiable** | AC focus on WHAT, not HOW | "User gets valid token" | "Use authlib 1.3.0, store in Redis" |
| **Valuable** | Clear business value in "So that" | "So that I maintain session" | "So that token_refresh table exists" |
| **Estimable** | Can estimate 6-20h | Clear scope, known patterns | "Implement authentication" (vague) |
| **Small** | Fits 1-2 sprints (3-5 AC) | 4 AC, 12h estimate, 18 tests | 8 AC, 40h estimate |
| **Testable** | AC have measurable outcomes | "Then receive token <200ms" | "Should be fast" |

### Forward Dependency Detection (Independent)

**Algorithm:**
```
FOR EACH Story N in Epic:
  FOR EACH dependency in Story N:
    IF dependency.story_number > N:
      FAIL("Forward dependency: Story {N} requires Story {dependency}")
```

**Examples:**

| Scenario | Verdict |
|----------|---------|
| US002 "Login" depends on US001 "Registration" | ✅ PASS (N=2, dep=1) |
| US003 "Refresh token" depends on US005 "Token revocation" | ❌ FAIL (N=3, dep=5) |

### Size Validation (Small)

| Metric | Min | Max | Under-decomposed | Over-decomposed |
|--------|-----|-----|------------------|-----------------|
| **AC count** | 3 | 5 | >5 → split Story | <3 → merge Stories |
| **Hours** | 6h | 20h | >20h → split Story | <6h → merge Stories |
| **Tests** | 10 | 28 | >28 → split Story | <10 → merge Stories |

### INVEST Validation Workflow

```
1. Check Independent → Forward dependencies?
2. Check Negotiable → AC describes HOW instead of WHAT?
3. Check Valuable → Missing "So that" business value?
4. Check Estimable → Vague scope, unknown patterns?
5. Check Small → Outside 3-5 AC / 6-20h range?
6. Check Testable → Non-measurable outcomes?

IF ANY criterion FAIL → Story needs revision
IF ALL criteria PASS → Story ready for Task decomposition
```

## 5. Verification Methods (Goal-Driven Execution)

Each task AC must include a verification method — defines HOW executor checks that AC is satisfied after implementation.

| Method | When to Use | Format |
|--------|-------------|--------|
| **test** | Existing or planned test covers AC | `verify: test (test_name or test file)` |
| **command** | CLI command can validate outcome | `verify: command (exact command + expected output)` |
| **inspect** | Manual file/output inspection | `verify: inspect (what to check + expected content)` |

**Examples:**
- AC "POST /users returns 201" → `verify: command (curl -s -o /dev/null -w "%{http_code}" -X POST localhost:3000/users -d '{"email":"test@test.com"}' → 201)`
- AC "Users table has email column" → `verify: inspect (migration file contains email column definition)`
- AC "Invalid email returns 400" → `verify: test (test_user_validation.py::test_invalid_email)`

**Quick Checklist:**
```
□ Every task AC has verify: method
□ Verify methods are executable (not vague)
□ At least 1 AC uses test or command (not all inspect)
```

## Usage

```markdown
## Reference Files
- **AC validation:** `references/ac_validation_rules.md`
```

---
**Version:** 1.1.0
**Last Updated:** 2026-02-05

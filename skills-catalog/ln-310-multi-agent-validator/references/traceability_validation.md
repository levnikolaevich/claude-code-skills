# Traceability & Verification (Criteria #16-#17, #17b-#17c, #22)

<!-- SCOPE: Story-Task alignment (#16), AC coverage (#17), AC invocability (#17b), scenario completeness (#17c), and AC verify methods (#22). -->
<!-- DO NOT add here: Structural validation -> structural_validation.md, quality -> quality_validation.md -->

Detailed rules for Story-Task alignment, AC-Task coverage, AC invocability, scenario completeness, and AC verification methods.

---

## Criterion #16: Story-Task Alignment

**Check:** Each Task implements part of Story statement (no orphan Tasks)

**Penalty:** MEDIUM (3 points)

**Rule:** Every Task must contribute to the Story goal. Tasks unrelated to Story statement are orphans. Skip when Story has no Tasks, or Story is Done/Canceled.

**Auto-fix actions:**
1. Extract Story Statement keywords (user, OAuth, log in, protected resources)
2. For EACH Task, check if title/description relates to Story keywords
3. IF Task misaligned: add TODO `_TODO: Verify this Task belongs to Story scope_` + warn user
4. IF multiple misaligned Tasks -> suggest splitting Story
5. Update Linear issue, add comment: "Story-Task alignment verified - [N] aligned, [M] warnings"

---

## Criterion #17: AC-Task Coverage

**Check:** Each Acceptance Criterion (AC) has at least one implementing Task

**Penalty:** MEDIUM (3 points)

**Rule:** Every AC must map to at least one Task. No ACs left without implementation. Skip when Story has no Tasks, or Story is Done/Canceled, or all ACs already have coverage notes.

### AC-Task Mapping Algorithm

1. Parse all Acceptance Criteria from Story
2. For EACH AC, find implementing Task(s) by keyword matching
3. Build coverage matrix:
   ```markdown
   ## AC-Task Coverage Matrix
   | AC | Task | Status |
   |----|------|--------|
   | 1 | T1 | Covered |
   | 2 | T2 | Covered |
   | 3 | - | MISSING |
   ```
4. **Coverage Quality Check** — for each AC->Task mapping, extract AC requirements:
   - **HTTP codes** (200, 201, 400, 401, 403, 404, 500)
   - **Error messages** ("Invalid token", "User not found", "Access denied")
   - **Performance criteria** (<200ms, <1s, 1000 req/sec)
   - **Timing constraints** (token expires in 1h, session timeout 30min)
5. **Scoring:**
   - **STRONG:** Task mentions all AC requirements (HTTP code + message + timing)
   - **WEAK:** Task exists but missing specific requirements
   - **MISSING:** No Task for AC
6. **Auto-fix:**
   - MISSING AC: add TODO to Story `_TODO: Add Task for AC #[N]: "[AC text]"_`
   - WEAK coverage: add TODO to Task `_TODO: Ensure AC requirement: [specific requirement]_`
7. Update coverage matrix with quality indicators:
   ```markdown
   | AC | Task | Status |
   |----|------|--------|
   | 1: Valid credentials -> 200 | T1 | STRONG (mentions 200, success flow) |
   | 2: Invalid token -> 401 | T2 | WEAK (mentions validation, no 401/message) |
   | 3: Timeout <200ms | - | MISSING |
   ```
8. Update Linear issue, add comment: "AC coverage - [N]/[M] ACs ([K] STRONG, [L] WEAK, [P] MISSING)"

---

## Criterion #17b: AC Invocability

**Check:** Every AC where an actor (user, bot, scheduler, handler, pipeline) must invoke or consume a mechanism has a covering Task whose Implementation Plan names a concrete mechanism

**Penalty:** HIGH (5 points per AC)

**Rule:** For each AC that describes an actor invoking or consuming a mechanism, at least one covering Task must have an Implementation Plan that names a concrete mechanism (MCP tool, API endpoint, CLI command, UI component, chat handler, config file, system prompt section, cron handler). Infrastructure-only tasks (queue, registry, store) do NOT satisfy ACs that require something to *use* that infrastructure. Vague mechanism references ("via X or Y", "direct function access") = violation. Skip when Story has no Tasks, or Story is Done/Canceled.

### Invocability Check Algorithm

1. Parse all Acceptance Criteria from Story
2. For EACH AC, determine if an actor must invoke or consume a mechanism:
   - Look for action verbs: "invokes", "calls", "triggers", "sends", "receives", "configures", "uses", "consumes", "publishes", "subscribes"
   - Look for actor keywords: "user", "bot", "scheduler", "handler", "pipeline", "admin", "system", "agent", "service"
3. For EACH invocable AC, find covering Task(s) and inspect their Implementation Plan:
   - **CONCRETE:** Implementation Plan names a specific mechanism type (e.g., "MCP tool `ref_search_documentation`", "POST /api/tasks endpoint", "CLI command `npm run validate`", "`TaskDialog` UI component", "cron handler in `scheduler.ts`")
   - **INFRASTRUCTURE-ONLY:** Task only creates infrastructure (queue, registry, store, schema, table) without a consuming layer — does NOT satisfy the AC
   - **VAGUE:** Mechanism described ambiguously ("via X or Y", "direct function access", "through the system") — violation
4. Build invocability matrix:
   ```markdown
   ## AC Invocability Matrix
   | AC | Actor | Mechanism Required | Covering Task | Mechanism Named | Status |
   |----|-------|--------------------|---------------|-----------------|--------|
   | 1 | user | login endpoint | T1 | POST /auth/login | CONCRETE |
   | 2 | scheduler | cleanup trigger | T3 | cron handler cleanup.ts | CONCRETE |
   | 3 | bot | notification send | T2 | (queue only) | INFRASTRUCTURE-ONLY |
   | 4 | user | config update | - | - | MISSING |
   ```
5. **Auto-fix:**
   - INFRASTRUCTURE-ONLY: identify missing consuming mechanism, add to existing task's Implementation Plan with explicit "Invocation Mechanism" section, or flag that a new task is needed
   - MISSING: add TODO to Story `_TODO: AC #[N] requires a task with concrete mechanism for: "[AC text]"_`
   - VAGUE: replace vague reference with specific mechanism in task's Implementation Plan
6. Update Linear issue, add comment: "AC Invocability — [N]/[M] invocable ACs ([K] CONCRETE, [L] violations)"

---

## Criterion #17c: Scenario Completeness

**Check:** For each invocable AC, covering task(s) must collectively address all 5 scenario segments

**Penalty:** HIGH (5 points per AC)

**Rule:** For each AC where an actor must invoke or consume a mechanism (as identified by #17b), the covering task(s) must collectively address all 5 segments: (1) Actor trigger — what initiates the scenario; (2) Entry point — the named mechanism from #17b; (3) Discovery — how the actor's system finds/loads the mechanism at runtime; (4) Usage context — what the actor's system needs to correctly invoke the mechanism; (5) Observable outcome — the verifiable result. Missing segment = violation. Skip when Story has no Tasks, or Story is Done/Canceled, or AC is not invocable per #17b.

### Scenario Completeness Check Algorithm

1. Use the invocability matrix from #17b (only ACs with CONCRETE status)
2. For EACH invocable AC with a concrete mechanism, check all 5 segments across covering task(s):
   - **(1) Actor trigger:** What initiates the scenario? (e.g., "user clicks Submit", "cron fires at midnight", "webhook receives POST", "pipeline stage completes")
   - **(2) Entry point:** The named mechanism from #17b (e.g., "POST /api/tasks", "MCP tool `ref_search_documentation`", "CLI `npm run validate`")
   - **(3) Discovery:** How does the actor's system find/load the mechanism at runtime? (e.g., "registered in MCP manifest", "route registered in Express app", "command registered in package.json scripts", "component imported in App.tsx")
   - **(4) Usage context:** What does the actor's system need to correctly invoke the mechanism? (e.g., "auth token in header", "config loaded from .env", "schema validated before send", "permissions checked")
   - **(5) Observable outcome:** The verifiable result (e.g., "returns 200 with created entity", "log entry written", "status transitions to Done", "notification sent to channel")
3. Build scenario completeness matrix:
   ```markdown
   ## Scenario Completeness Matrix
   | AC | Mechanism | Trigger | Entry | Discovery | Context | Outcome | Missing |
   |----|-----------|---------|-------|-----------|---------|---------|---------|
   | 1 | POST /auth/login | user clicks Login | YES | YES | YES | YES | - |
   | 2 | cron cleanup.ts | midnight schedule | YES | NO | YES | YES | Discovery |
   | 3 | MCP tool search | agent invokes | YES | YES | NO | YES | Context |
   ```
4. **Scoring:**
   - **COMPLETE:** All 5 segments present across covering task(s)
   - **INCOMPLETE:** 1+ segments missing — violation (5 points per AC)
5. **Auto-fix:**
   - For each missing segment, either:
     (a) Add the missing segment to an existing covering task's Implementation Plan under a "Scenario Integration" section
     (b) Flag that a new section is needed if no existing task can logically own the segment
   - Template for Scenario Integration section:

     ```markdown
     ### Scenario Integration
     - **Actor trigger:** [what initiates]
     - **Entry point:** [mechanism name]
     - **Discovery:** [how found/loaded at runtime]
     - **Usage context:** [prerequisites for correct invocation]
     - **Observable outcome:** [verifiable result]
     ```

6. Update Linear issue, add comment: "Scenario Completeness — [N]/[M] invocable ACs ([K] COMPLETE, [L] INCOMPLETE with [P] missing segments)"

---

## Criterion #22: AC Verify Methods

**Check:** Every Task AC has a `verify:` method; at least 1 non-inspect method per Task

**Penalty:** MEDIUM (3 points)

**Rule:** Each Task AC must specify how to verify it. Three method types:

| Type | When to use | Examples |
|------|------------|---------|
| `test` | Business logic, data transforms | Unit test, integration test |
| `command` | HTTP endpoints, CLI operations | `curl`, `npm run`, DB query |
| `inspect` | Config, docs, code structure | Code review, log check |

At least 1 AC per Task must use `test` or `command` (not all `inspect`). Skip when Task is Done/Canceled.

**Mapping heuristic:**
- HTTP endpoints, API routes → `command`
- DB operations, file I/O → `inspect`
- Business logic, calculations, transforms → `test`

**Auto-fix actions:**
1. For EACH Task, scan ACs for missing `verify:` line
2. Generate `verify:` method per mapping heuristic above
3. IF all ACs are `inspect` → convert the most testable one to `test` or `command`
4. Update Linear issue + add comment

---

**Version:** 2.0.0
**Last Updated:** 2026-02-03

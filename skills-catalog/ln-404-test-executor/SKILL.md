---
name: ln-404-test-executor
description: "Executes test tasks (label 'tests') through Todo to To Review with risk-based limits. Use for test task execution. Not for implementation tasks."
allowed-tools: Read, Grep, Glob, Bash, mcp__hex-line__outline, mcp__hex-line__read_file, mcp__hex-line__edit_file, mcp__hex-line__write_file, mcp__hex-line__verify, mcp__hex-line__changes, mcp__hex-line__inspect_path
license: MIT
---

> **Paths:** File paths (`shared/`, `references/`, `../ln-*`) are relative to skills repo root. If not found at CWD, locate this SKILL.md directory and go up one level for repo root. If `shared/` is missing, fetch files via WebFetch from `https://raw.githubusercontent.com/levnikolaevich/claude-code-skills/master/skills/{path}`.

# Test Task Executor

**Type:** L3 Worker

Runs a single Story final test task (label "tests") through implementation/execution to To Review.

## Purpose & Scope
- Handle only tasks labeled "tests"; other tasks go to ln-401.
- Follow the 11-section test task plan (E2E/Integration/Unit, infra/docs/cleanup).
- Enforce risk-based constraints: Priority ≥15 scenarios covered; each test passes Usefulness Criteria; no framework/DB/library/performance tests.
- Update Linear/kanban for this task only: Todo -> In Progress -> To Review.

**Hex-line acceleration (if available):** Use `outline(path)` before reading test targets. Use `inspect_path(path="tests/")` to understand test structure; it is minimal by default, so only deepen when the first pass is insufficient.
Use `read_file()` and `edit_file()` as the primary path for test/code/config files. Keep `read_file()` in discovery mode for normal inspection; use `read_file(edit_ready=true, verbosity="full")` before edits that need revision/checksum protocol. Use `verify()` and `changes()` before handoff. Built-in Read/Edit are fallback only when hex-line is unavailable.

## Inputs

| Input | Required | Source | Description |
|-------|----------|--------|-------------|
| `taskId` | Yes | args, parent Story, kanban, user | Test task to execute |

**Resolution:** Task Resolution Chain.
**Status filter:** Todo (label: tests)

## Task Storage Mode

**MANDATORY READ:** Load `shared/references/environment_state_contract.md`, `shared/references/storage_mode_detection.md`, and `shared/references/input_resolution_pattern.md`

Extract: `task_provider` = Task Management → Provider (`linear` | `file`).

| Aspect | Linear Mode | File Mode |
|--------|-------------|-----------|
| **Load task** | `get_issue(task_id)` | `Read("docs/tasks/epics/.../tasks/T{NNN}-*.md")` |
| **Load Story** | `get_issue(parent_id)` | `Read("docs/tasks/epics/.../story.md")` |
| **Update status** | `save_issue(id, state)` | `Edit` the `**Status:**` line in file |
| **Test results** | `create_comment({issueId, body})` | `Write` comment to `.../comments/{ISO-timestamp}.md` |

**File Mode transitions:** Todo → In Progress → To Review

**MANDATORY READ:** Load `shared/references/mcp_tool_preferences.md` — ALWAYS use hex-line MCP for code files when available. No fallback to standard Read/Edit unless hex-line is down.

## Workflow (concise)
1) **Resolve taskId:** Run Task Resolution Chain per guide (status filter: [Todo, label: tests]).
2) **Load task:** Fetch full test task description (Linear: get_issue; File: Read task file); read linked guides/manuals/ADRs/research; review parent Story and manual test results if provided.
2b) **Goal gate:** **MANDATORY READ:** `shared/references/goal_articulation_gate.md` — State REAL GOAL of these tests (which business behavior must be verified, not "write tests"). NOT THE GOAL: testing infrastructure or framework behavior instead of business logic. HIDDEN CONSTRAINT: which existing tests might break from implementation changes.
3) **Read environment docs:** **Read `docs/project/infrastructure.md`** — get server IPs, ports, service endpoints. **Read `docs/project/runbook.md`** — understand test environment setup, Docker commands, test execution prerequisites. Use exact commands from runbook.
4) **Validate plan:** Check Priority ≥15 coverage and Usefulness Criteria; ensure focus on business flows (no infra-only tests).
5) **Start work:** Set task In Progress (Linear: update_issue; File: Edit status line); move in kanban.
6) **Implement & run:** **MANDATORY READ:** `shared/references/code_efficiency_criterion.md` — Author/update tests per plan; reuse existing fixtures/helpers; run tests; fix failing existing tests; update infra/doc sections as required. Before handoff, verify 3 efficiency self-checks (especially: reuse fixtures instead of duplicating setup).
7) **Complete:** Ensure counts/priority still within limits; set task To Review; move in kanban; add comment summarizing coverage, commands run, and any deviations.

## Critical Rules
- Single-task only; no bulk updates.
- Do not mark Done; the reviewer approves. Task must end in To Review.
- Keep language (EN/RU) consistent with task.
- No framework/library/DB/performance/load tests; focus on business logic correctness (not infrastructure throughput).
- Respect limits and priority; if violated, stop and return with findings.
- **Do NOT commit.** Leave all changes uncommitted — the reviewer reviews and commits.

## Runtime Summary Artifact

**MANDATORY READ:** Load `shared/references/coordinator_summary_contract.md`, `shared/references/worker_runtime_contract.md`, `shared/references/task_worker_runtime_contract.md`

Shared contract:
- emit `summary_kind=task-status`
- standalone mode omits `runId` and `summaryArtifactPath`
- managed mode passes both `runId` and exact `summaryArtifactPath` before the worker writes its validated summary

## Definition of Done
- [ ] Task identified as test task and set to In Progress; kanban updated
- [ ] Plan validated (priority/limits) and guides read
- [ ] Tests implemented/updated and executed; existing failures fixed
- [ ] Docs/infra updates applied per task plan
- [ ] Task set to To Review; kanban moved; summary comment added with commands and coverage
- [ ] Runtime summary artifact written to the shared task-status location.

## Test Failure Analysis Protocol

**CRITICAL:** When a **newly written test** fails, STOP and analyze BEFORE changing anything (failing new tests often indicate implementation bugs, not test issues — fixing blindly masks root cause).

**Step 1: Verify Test Correctness**
- Does test match AC requirements exactly? (Given/When/Then from Story)
- Is expected value correct per business logic?
- If uncertain: Query `ref_search_documentation(query="[domain] expected behavior")`

**Step 2: Decision**
| Test matches AC? | Action |
|------------------|--------|
| YES | **BUG IN CODE** → Fix implementation, not test |
| NO | Test is wrong → Fix test assertion |
| UNCERTAIN | **MANDATORY:** Query MCP Ref + ask user before changing |

**Step 3: Document in Linear comment**
"Test [name] failed. Analysis: [test correct / test wrong]. Action: [fixed code / fixed test]. Reason: [justification]"

**RED FLAGS (require user confirmation):**
- ⚠️ Changing assertion to match actual output ("make test green")
- ⚠️ Removing test case that "doesn't work"
- ⚠️ Weakening expectations (e.g., `toContain` instead of `toEqual`)

**GREEN LIGHTS (safe to proceed):**
- ✅ Fixing typo in test setup/mock data
- ✅ Fixing code to match AC requirements
- ✅ Adding missing test setup step

## Test Writing Principles

### 1. Strict Assertions - Fail on Any Mismatch

**Use exact match assertions by default:**

| Strict (PREFER) | Loose (AVOID unless justified) |
|-----------------|--------------------------------|
| Exact equality check | Partial/substring match |
| Exact length check | "Has any length" check |
| Full object comparison | Partial object match |
| Exact type check | Truthy/falsy check |

**WARN-level assertions FORBIDDEN** - test either PASS or FAIL, no warnings.

### 2. Expected-Based Testing for Deterministic Output

**For deterministic responses (API, transformations):**
- Use **snapshot/golden file testing** for complex deterministic output
- Compare actual output vs expected reference file
- Normalize dynamic data before comparison (timestamps → fixed, UUIDs → placeholder)

### 3. Golden Rule

> "If you know the expected value, assert the exact value."

**Forbidden:** Using loose assertions to "make test pass" when exact value is known.

## Reference Files
- **Environment state:** `shared/references/environment_state_contract.md`
- **Storage mode operations:** `shared/references/storage_mode_detection.md`
- Kanban format: `docs/tasks/kanban_board.md`
- **MANDATORY READ:** `shared/references/research_tool_fallback.md`

---
**Version:** 3.2.0
**Last Updated:** 2026-01-15

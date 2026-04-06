---
name: ln-523-auto-test-planner
description: "Plans automated tests (E2E/Integration/Unit) using Risk-Based Testing after manual testing. Use when Story needs a test task with prioritized scenarios."
license: MIT
---

> **Paths:** File paths (`shared/`, `references/`, `../ln-*`) are relative to skills repo root. If not found at CWD, locate this SKILL.md directory and go up one level for repo root. If `shared/` is missing, fetch files via WebFetch from `https://raw.githubusercontent.com/levnikolaevich/claude-code-skills/master/skills/{path}`.

# Automated Test Planner

**Type:** L3 Worker

Creates Story test task with comprehensive automated test coverage (E2E/Integration/Unit) based on Risk-Based Testing methodology and REAL manual testing results.

## Inputs

| Input | Required | Source | Description |
|-------|----------|--------|-------------|
| `storyId` | Yes | args, git branch, kanban, user | Story to process |

**Resolution:** Story Resolution Chain.
**Status filter:** To Review

## Purpose & Scope
- **Create** comprehensive test task for Story automation
- **Calculate** risk-based priorities (Impact x Probability)
- **Generate** 11-section test plan from manual test results
- **Delegate** to ln-301-task-creator (CREATE) or ln-302-task-replanner (REPLAN)
- **NOT** for: manual testing, research, or orchestration

## When to Use

- Use when implementation work is done and automated test coverage must be planned
- All implementation Tasks in Story status = Done
- ln-521 research: uses if available, generates minimal inline research if missing
- ln-522 manual testing: uses if available, marks as 'skipped by policy' if missing

**Automation:** Supports `autoApprove: true` in managed runs to skip manual confirmation.

## Workflow

### Phase 0: Tools Config

**MANDATORY READ:** Load `shared/references/environment_state_contract.md`, `shared/references/storage_mode_detection.md`, and `shared/references/input_resolution_pattern.md`

Extract: `task_provider` = Task Management → Provider (`linear` | `file`).

### Phase 1: Discovery (Automated)

1. **Resolve storyId:** Run Story Resolution Chain per guide (status filter: [To Review]).
2. Auto-discover Team ID from `docs/tasks/kanban_board.md` (see CLAUDE.md "Configuration Auto-Discovery")

### Phase 2: Story + Tasks Analysis (NO Dialog)

**Step 0: Study Project Test Files**
1. Scan for test-related files:
   - tests/README.md (commands, setup, environment)
   - Test configs (jest.config.js, vitest.config.ts, pytest.ini)
   - Existing test structure (tests/, __tests__/ directories)
   - Coverage config (.coveragerc, coverage.json)
2. Extract: test commands, framework, patterns, coverage thresholds
3. Ensures test planning aligns with project practices

**Step 1: Load Research and Manual Test Results**
1. Fetch Story (must have label "user-story"):
   - IF `task_provider` = `linear`: `get_issue(storyId)` — extract Story.id (UUID, NOT short ID)
   - IF `task_provider` = `file`: `Read story.md` — extract Story metadata
2. Load research comment (from ln-521): "## Test Research: {Feature}"
   - IF `task_provider` = `linear`: `list_comments(issueId=storyId)` → find matching comment
   - IF `task_provider` = `file`: `Glob("docs/tasks/epics/*/stories/*/comments/*.md")` → find matching comment
   - IF research comment not found: generate 3-5 bullet points of key test areas based on Story AC and task descriptions (inline, no external research).
3. Load manual test results comment (from ln-522): "## Manual Testing Results"
   - Same approach as research comment above
   - IF manual test results not found: skip manual test coverage analysis. Note in output: 'Manual testing: skipped by policy (simplified mode).'
4. Parse sections: AC results (PASS/FAIL), Edge Cases, Error Handling, Integration flows
5. Map to test design: PASSED AC -> E2E, Edge cases -> Unit, Errors -> Error handling, Flows -> Integration

**Step 2: Analyze Story + Tasks**
1. Parse Story: Goal, Test Strategy, Technical Notes
2. Fetch all child Tasks (status = Done):
   - IF `task_provider` = `linear`: `list_issues(parentId=Story.id, state="Done")`
   - IF `task_provider` = `file`: `Glob("docs/tasks/epics/*/stories/*/tasks/*.md")` → filter by `**Status:** Done`
3. Analyze each Task:
   - Components implemented
   - Business logic added
   - Integration points created
   - Conditional branches (if/else/switch)
4. Identify what needs testing

### Phase 3: Parsing Strategy for Manual Test Results

**Process:** Locate Linear comment with "Manual Testing Results" header -> Verify Format Version 1.0 -> Extract structured sections (Acceptance Criteria, Test Results by AC, Edge Cases, Error Handling, Integration Testing) using regex -> Validate (at least 1 PASSED AC, AC count matches Story, completeness check) -> Map parsed data to test design structure

**Error Handling:** Missing comment -> use fallback (inline research or skip per Phase 2 logic), Missing format version -> WARNING (try legacy parsing), Required section missing -> use fallback, No PASSED AC -> ERROR (fix implementation)

### Phase 4: Risk-Based Test Planning (Automated)

**MANDATORY READ:** Load `shared/references/risk_based_testing_guide.md` for complete methodology.

**E2E-First Approach:** Prioritize by business risk (Priority = Impact x Probability), not coverage metrics.

**Workflow:**

**Step 1: Risk Assessment**

Calculate Priority for each scenario from manual testing:

```
Priority = Business Impact (1-5) x Probability (1-5)
```

**Decision Criteria:**
- Priority ≥15 -> **MUST test**
- Priority 9-14 -> **SHOULD test** if not covered
- Priority <=8 -> **SKIP** (manual testing sufficient)

**Step 2: E2E Test Selection (2-5):** Baseline 2 (positive + negative) ALWAYS + 0-3 additional (Priority ≥15 only)

**Step 3: Unit Test Selection (0-15):** DEFAULT 0. Add ONLY for complex business logic (Priority ≥15): financial, security, algorithms

**Step 4: Integration Test Selection:** DEFAULT 0. Add ONLY if E2E gaps AND Priority ≥15: rollback, concurrency, external API errors

**Step 5: Validation:** Each test passes Usefulness Criteria (Priority ≥15, Confidence ROI, Behavioral, Predictive, Specific, Non-Duplicative)

### Phase 5: Test Task Generation (Automated)

Generates complete test task per `test_task_template.md` (11 sections):

**Sections 1-7:** Context, Risk Matrix, E2E/Integration/Unit Tests (with Priority scores + justifications), Coverage, DoD

**Section 8:** Existing Tests to Fix (analysis of affected tests from implementation tasks)

**Section 9:** Infrastructure Changes (packages, Docker, configs - based on test dependencies)

**Section 10:** Documentation Updates (README, CHANGELOG, tests/README, config docs)

**Section 11:** Legacy Code Cleanup (deprecated patterns, backward compat, dead code)

Shows preview for review.

### Phase 6: Confirmation & Delegation

**Step 1:** Preview generated test plan (always displayed for transparency)

**Step 2:** Confirmation logic:
- **autoApprove: true** -> proceed automatically
- **Manual run** -> prompt user to type "confirm"

**Step 3:** Check for existing test task

- IF `task_provider` = `linear`: `list_issues(parentId=Story.id, label="tests")`
- IF `task_provider` = `file`: `Glob("docs/tasks/epics/*/stories/*/tasks/*.md")` → filter by `**Labels:**` containing `tests`

**Decision:**
- **Count = 0** -> **CREATE MODE** (Step 4a)
- **Count >= 1** -> **REPLAN MODE** (Step 4b)

**Step 4a: CREATE MODE** (if Count = 0)

Managed delegation sequence:
1. Compute `childRunId = {parent_run_id}--ln-301--{storyId}`
2. Compute `childSummaryArtifactPath = .hex-skills/runtime-artifacts/runs/{parent_run_id}/task-plan/ln-301--{storyId}.json`
3. Materialize child manifest at `.hex-skills/test-planning/ln-301--{storyId}_manifest.json`
4. Start `task-plan-worker-runtime` with both transport inputs
5. Checkpoint `child_run` metadata in `PHASE_6_DELEGATE_TASK_PLAN`
6. Invoke `ln-301-task-creator` with `--run-id` and `--summary-artifact-path`
7. Read only the resulting child `task-plan` artifact

**Pass to worker:**
- taskType, teamId, storyData (Story.id, title, AC, Technical Notes, Context)
- researchFindings (from ln-521 comment)
- manualTestResults (from ln-522 comment)
- testPlan (e2eTests, integrationTests, unitTests, riskPriorityMatrix)
- infrastructureChanges, documentationUpdates, legacyCleanup

**Worker returns:** Task URL + `task-plan` artifact

**Step 4b: REPLAN MODE** (if Count >= 1)

Managed delegation sequence:
1. Compute `childRunId = {parent_run_id}--ln-302--{storyId}`
2. Compute `childSummaryArtifactPath = .hex-skills/runtime-artifacts/runs/{parent_run_id}/task-plan/ln-302--{storyId}.json`
3. Materialize child manifest at `.hex-skills/test-planning/ln-302--{storyId}_manifest.json`
4. Start `task-plan-worker-runtime` with both transport inputs
5. Checkpoint `child_run` metadata in `PHASE_6_DELEGATE_TASK_PLAN`
6. Invoke `ln-302-task-replanner` with `--run-id` and `--summary-artifact-path`
7. Read only the resulting child `task-plan` artifact

**Pass to worker:**
- Same data as CREATE MODE + existingTaskIds

**Worker returns:** Operations summary + child `task-plan` artifact

**Step 5:** Return structured summary to caller

---

## Runtime Summary Artifact

**MANDATORY READ:** Load `shared/references/test_planning_summary_contract.md`, `shared/references/test_planning_worker_runtime_contract.md`, `shared/references/task_plan_worker_runtime_contract.md`

Runtime profile:
- family: `test-planning-worker`
- worker: `ln-523`
- summary kind: `test-planning-worker`
- payload fields used by coordinators: `worker`, `status`, `warnings`, `test_task_id`, `test_task_url`, `coverage_summary`, `planned_scenarios`

Invocation rules:
- standalone: omit `runId` and `summaryArtifactPath`
- managed: pass both `runId` and exact `summaryArtifactPath`
- always write the validated summary before terminal outcome

Delegated child worker rules:
- when delegating to `ln-301` or `ln-302`, `ln-523` becomes the parent runtime
- start `task-plan-worker-runtime` before delegation
- checkpoint `child_run` metadata before the child Skill call
- consume only the child `task-plan` artifact, never child prose

## Definition of Done

**Research and Manual Results Loaded:**
- [ ] Research comment "## Test Research: {Feature}" found (from ln-521)
- [ ] Manual test results "## Manual Testing Results" found (from ln-522)
- [ ] At least 1 AC marked as PASSED

**Risk-Based Test Plan Generated:**
- [ ] Risk Priority Matrix calculated for all scenarios
- [ ] E2E tests: Baseline positive + negative, additional only if Priority ≥15
- [ ] Integration tests: ONLY if E2E doesn't cover AND Priority ≥15
- [ ] Unit tests: ONLY complex business logic with Priority ≥15
- [ ] Each test passes all 6 Usefulness Criteria
- [ ] No framework/library testing: Each test validates OUR business logic only

**Test Task Description Complete (11 sections):**
- [ ] All 11 sections populated per template
- [ ] Risk Priority Matrix included
- [ ] Each test beyond baseline 2 justified

**Worker Delegation Executed:**
- [ ] CREATE MODE: Delegated to ln-301-task-creator through `task-plan-worker-runtime`
- [ ] REPLAN MODE: Delegated to ln-302-task-replanner through `task-plan-worker-runtime`
- [ ] Child run metadata checkpointed before delegation
- [ ] Child `task-plan` artifact consumed before final summary
- [ ] Linear Issue URL returned

**Output:**
- **CREATE MODE:** Linear Issue URL + confirmation
- **REPLAN MODE:** Operations summary + URLs

## Reference Files

- **Environment state:** `shared/references/environment_state_contract.md`
- **Storage mode operations:** `shared/references/storage_mode_detection.md`
- **Risk-based testing methodology:** `shared/references/risk_based_testing_guide.md`
- **Auto-discovery patterns:** `shared/references/auto_discovery_pattern.md`
- **Test task template:** `shared/templates/test_task_template.md` (workers ln-301/ln-302 load via Template Loading)
- **Testing examples:** `references/risk_based_testing_examples.md`
- **MANDATORY READ:** `shared/references/research_tool_fallback.md`

## Critical Rules

- **Manual results preferred:** Use ln-522 manual testing results when available. When missing (simplified mode), generate minimal inline research and mark manual testing as skipped
- **E2E-first, not unit-first:** Baseline is always 2 E2E (positive + negative); unit/integration added only for Priority >= 15
- **No framework testing:** Every test must validate OUR business logic; never test library/framework behavior
- **Usefulness enforcement:** Every test beyond baseline must pass all 6 Usefulness Criteria (see risk_based_testing_guide.md)
- **Delegate, don't create:** Task creation goes through ln-301/ln-302 workers; this skill generates the plan only
- **Managed child runs only:** Parent-child delegation to ln-301/ln-302 must use `task-plan-worker-runtime`, deterministic child `runId`, exact child `summaryArtifactPath`, and artifact-only consumption

## Best Practices

**Minimum Viable Testing:** Start with baseline E2E (positive + negative). Each additional test must pass all 6 Usefulness Criteria.

**Risk-Based Testing:** Prioritize by Business Impact x Probability. E2E-first from ACTUAL manual testing results. Priority ≥15 scenarios covered by tests.

**Expected-Based Testing:** For deterministic tests, compare actual vs expected using `diff`. **MANDATORY READ:** Load `../ln-522-manual-tester/SKILL.md` — section "Test Design Principles".

---

**Version:** 1.0.0
**Last Updated:** 2026-01-15

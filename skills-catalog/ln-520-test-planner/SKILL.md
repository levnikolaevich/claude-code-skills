---
name: ln-520-test-planner
description: "Orchestrates test planning pipeline: research, manual testing, automated test planning. Use when Story needs comprehensive test coverage planning."
license: MIT
---

> **Paths:** File paths (`shared/`, `references/`, `../ln-*`) are relative to skills repo root. If not found at CWD, locate this SKILL.md directory and go up one level for repo root. If `shared/` is missing, fetch files via WebFetch from `https://raw.githubusercontent.com/levnikolaevich/claude-code-skills/master/skills/{path}`.

# Test Planning Orchestrator

**Type:** L2 Coordinator
**Category:** 5XX Quality

Runtime-backed test-planning coordinator. The runtime owns skip/reuse gates, worker summary tracking, and deterministic resume.

## Inputs

| Input | Required | Source | Description |
|-------|----------|--------|-------------|
| `storyId` | Yes | args, git branch, kanban, user | Story to process |
| `--simplified` | No | args | Skip research (ln-521) and manual testing (ln-522). Run only auto-test planning (ln-523). Used in fast-track mode. |

**Resolution:** Story Resolution Chain.
**Status filter:** To Review

## Purpose & Scope
- **Orchestrate** test planning: research → manual testing → automated test planning
- **Delegate** to workers: ln-521-test-researcher, ln-522-manual-tester, ln-523-auto-test-planner
- **No direct work** — only coordination and delegation via Skill tool

## Runtime Contract

**MANDATORY READ:** Load `shared/references/coordinator_runtime_contract.md`, `shared/references/test_planning_runtime_contract.md`, `shared/references/test_planning_summary_contract.md`, `shared/references/test_planning_worker_runtime_contract.md`, `shared/references/task_plan_worker_runtime_contract.md`

Runtime family: `test-planning-runtime`

Identifier:
- Story ID

Phases:
1. `PHASE_0_CONFIG`
2. `PHASE_1_DISCOVERY`
3. `PHASE_2_RESEARCH`
4. `PHASE_3_MANUAL_TESTING`
5. `PHASE_4_AUTO_TEST_PLANNING`
6. `PHASE_5_FINALIZE`
7. `PHASE_6_SELF_CHECK`

Worker summary contract:
- `ln-521`, `ln-522`, `ln-523` receive deterministic child `runId` plus exact `summaryArtifactPath`
- checkpoint child runtime metadata before waiting for the artifact
- each worker writes a `test-planning-worker` summary envelope before terminal outcome
- ln-520 consumes worker summaries, not free-text worker prose

## When to Use

This skill should be used when:
- Story passed implementation and regression work and needs full test planning
- All implementation tasks in Story are Done
- Need complete test planning (research + manual + auto)

**Prerequisites:**
- All implementation Tasks in Story status = Done
- Regression tests passed (ln-513)
- Code quality checked (ln-511)

## Pipeline Overview

```
ln-520-test-planner (Orchestrator)
    │
    ├─→ ln-521-test-researcher
    │     └─→ Posts "## Test Research: {Feature}" comment
    │
    ├─→ ln-522-manual-tester
    │     └─→ Creates tests/manual/ scripts + "## Manual Testing Results" comment
    │
    └─→ ln-523-auto-test-planner
          └─→ Creates test task in Linear via ln-301/ln-302
```

## Workflow

### Phase 0: Resolve Inputs

**MANDATORY READ:** Load `shared/references/input_resolution_pattern.md`

1. **Resolve storyId:** Run Story Resolution Chain per guide (status filter: [To Review]).

### Phase 1: Discovery

1) Auto-discover Team ID from `docs/tasks/kanban_board.md`
2) Validate Story ID

### Phase 2: Research Delegation

> **Simplified mode gate:**
> - IF `--simplified` flag AND research comment already exists on Story: Skip Phase 2 (research). Proceed to Phase 4.
> - IF `--simplified` flag AND no research comment: Skip Phase 2. Proceed to Phase 4 (ln-523 will generate minimal inline research).

1) **Check if research exists:**
   - Search Linear comments for "## Test Research:" header
   - If found → skip to Phase 3

2) **If no research:**
   - Compute deterministic child run inputs for `ln-521`
   - Start `test-planning-worker-runtime` and checkpoint `child_run` before delegation
   - **Invoke `ln-521-test-researcher` via managed worker run**
   - Pass: Story ID
   - Wait for completion
   - Read only the resulting `test-planning-worker` artifact
   - Verify research comment created

### Phase 3: Manual Testing Delegation

> **Simplified mode gate:**
> - IF `--simplified` flag: Skip Phase 3 (manual testing). Proceed to Phase 4.

1) **Check if manual testing done:**
   - Search Linear comments for "## Manual Testing Results" header
   - If found with all AC passed → skip to Phase 4

2) **If manual testing needed:**
   - Compute deterministic child run inputs for `ln-522`
   - Start `test-planning-worker-runtime` and checkpoint `child_run` before delegation
   - **Invoke `ln-522-manual-tester` via managed worker run**
   - Pass: Story ID
   - Wait for completion
   - Read only the resulting `test-planning-worker` artifact
   - Verify results comment created

3) **If any AC failed:**
   - Stop pipeline
   - Report to ln-500: "Manual testing failed, Story needs fixes"

### Phase 4: Auto Test Planning Delegation

1) **Invoke auto test planner:**
   - Compute deterministic child run inputs for `ln-523`
   - Start `test-planning-worker-runtime` and checkpoint `child_run` before delegation
   - **Invoke `ln-523-auto-test-planner` via managed worker run**
   - Pass: Story ID
   - Wait for completion
   - Read only the resulting `test-planning-worker` artifact

2) **Verify results:**
   - Test task created in Linear (or updated if existed)
   - Return task URL to ln-500

### Phase 5: Report to Caller

1) Return summary to ln-500:
   - Research: completed / skipped (existed)
   - Manual testing: passed / failed
   - Test task: created / updated + URL

### Runtime Summary Artifact

**MANDATORY READ:** Load `shared/references/coordinator_summary_contract.md`

Write `.hex-skills/runtime-artifacts/runs/{run_id}/story-tests/{story_id}.json` before finishing.

## Worker Invocation (MANDATORY)

> **CRITICAL:** All delegations use Agent tool with `subagent_type: "general-purpose"` for context isolation, but every managed worker run must be prepared through `test-planning-worker-runtime` first.

| Phase | Worker | Purpose |
|-------|--------|---------|
| 2 | ln-521-test-researcher | Runtime-backed managed Agent call; artifact is the only completion signal |
| 3 | ln-522-manual-tester | Runtime-backed managed Agent call; artifact is the only completion signal |
| 4 | ln-523-auto-test-planner | Runtime-backed managed Agent call; artifact is the only completion signal |

**Prompt template:**
```text
Agent(description: "[Phase N] test planning via ln-52X",
     prompt: "Execute test planning worker.

Step 1: Start worker runtime:
  node shared/scripts/test-planning-worker-runtime/cli.mjs start --skill {worker} --story {storyId} --manifest-file .hex-skills/test-planning/{worker}--{storyId}_manifest.json --run-id {childRunId} --summary-artifact-path .hex-skills/runtime-artifacts/runs/{parent_run_id}/test-planning-worker/{worker}--{storyId}.json

Step 2: Checkpoint child metadata:
  node shared/scripts/test-planning-runtime/cli.mjs checkpoint --story {storyId} --phase PHASE_N --payload '{\"child_run\":{\"worker\":\"{worker}\",\"run_id\":\"{childRunId}\",\"summary_artifact_path\":\".hex-skills/runtime-artifacts/runs/{parent_run_id}/test-planning-worker/{worker}--{storyId}.json\"}}'

Step 3: Invoke worker:
  Skill(skill: \"ln-52X-{worker}\", args: \"{storyId} --run-id {childRunId} --summary-artifact-path .hex-skills/runtime-artifacts/runs/{parent_run_id}/test-planning-worker/{worker}--{storyId}.json\")

CONTEXT:
Story: {storyId}",
     subagent_type: "general-purpose")
```

**Anti-Patterns:**
- ❌ Direct Agent invocation without child runtime start + `child_run` checkpoint
- ❌ Running web searches directly (delegate to ln-521)
- ❌ Creating bash test scripts directly (delegate to ln-522)
- ❌ Creating test tasks directly (delegate to ln-523)
- ❌ Skipping any phase without justification

## TodoWrite format (mandatory)

```
- Resolve Story and prerequisites (pending)
- Check or reuse research state (pending)
- Start ln-521 child runtime, checkpoint metadata, or skip deterministically (pending)
- Check or reuse manual testing state (pending)
- Start ln-522 child runtime, checkpoint metadata, or skip deterministically (pending)
- Start ln-523 child runtime, checkpoint metadata, and verify test-task result (pending)
- Write story-tests summary artifact (pending)
- Report final planning outcome (pending)
```

## Critical Rules

- **No direct work:** Orchestrator only delegates, never executes tasks itself
- **Sequential execution:** 521 → 522 → 523 (each depends on previous)
- **Fail-fast:** If manual testing fails, stop pipeline and report
- **Skip detection:** Check for existing comments before invoking workers
- **Single responsibility:** Each worker does one thing well
- Every managed worker run must start through `test-planning-worker-runtime` before the Agent wrapper invokes the worker.

## Definition of Done

- [ ] Story ID validated
- [ ] Research phase: ln-521 invoked OR existing comment found
- [ ] Manual testing phase: ln-522 invoked OR existing results found
- [ ] Auto test planning phase: ln-523 invoked
- [ ] Child test-planning runtimes started and checkpointed before every managed worker invoke
- [ ] Test task created/updated in Linear
- [ ] Summary prepared with phase results and test task URL
- [ ] Story-test summary artifact written to the shared location

**Output:** Summary with phase results + test task URL

## Phase 6: Meta-Analysis

**MANDATORY READ:** Load `shared/references/meta_analysis_protocol.md`

Skill type: `planning-coordinator`. Run after all phases complete. Output to chat using the `planning-coordinator` format.

## Reference Files

- Workers: `../ln-521-test-researcher/SKILL.md`, `../ln-522-manual-tester/SKILL.md`, `../ln-523-auto-test-planner/SKILL.md`
- Risk-based testing: `shared/references/risk_based_testing_guide.md`

---

**Version:** 4.0.0
**Last Updated:** 2026-01-15

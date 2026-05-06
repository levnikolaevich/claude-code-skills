# Phase 6: Meta-Analysis Implementation

Pipeline-specific implementation of `references/meta_analysis_protocol.md` (execution-orchestrator type).

Runs after Phase 5 completes. Appends `## Meta-Analysis` section to the pipeline report and updates the cross-run quality trend tracker.

## 1. Stage & Skill Effectiveness Audit

```
skill_map = {0: "ln-300", 1: "ln-310", 2: "ln-400", 3: "ln-500"}

FOR stage IN 0..3:
  stage_status = "OK"
  IF infra_issues has entry for this stage: stage_status = "Infra issue"
  IF stage not completed (no timestamp): stage_status = "Not reached"

  skill_status = "OK" IF:
    stage 0 -> plan_score >= 3
    stage 1 -> verdict == "GO"
    stage 2 -> state.phase != "PAUSED"
    stage 3 -> verdict IN ("PASS", "CONCERNS", "WAIVED")
  ELSE "degraded" or "failed/not reached"

  skill_result = {
    0: "Plan {score}/4, {N} tasks",
    1: "{GO/NO-GO}, Readiness {score}/10",
    2: "{files} files, +{add}/-{del}",
    3: "{verdict}, Score {score}/100, {rework} rework"
  }[stage]
```

## 2. Problems & Recovery Actions

```
recovery_map = {
  "assert_fail":  "Review ASSERT guards in phase4_flow.md",
  "skill_error":  "Check Skill() invocation and checkpoint recovery",
  "infra_issue":  "Review pipeline settings and environment"
}
```

## 3. Improvement Candidates (Focus Areas)

Per protocol S4: tied to specific weaknesses of THIS run, not generic.

```
candidates = []
IF any infra_issue:
  candidates += "Infrastructure issue -> review pipeline configuration"
IF quality_cycles > 1:
  candidates += "{quality_cycles} rework cycles -> improve test spec coverage in ln-520"
IF stage_durations.get(2, 0) > 10800:  # 3h
  candidates += "Stage 2 > 3h -> consider task decomposition for complex stories"
```

## 4. Trend Tracking

Read + append to `docs/tasks/reports/quality-trend.md` (create with header if missing):

```
Header: | Date | Story | Score | Rework | Infra Issues |
Row:    | {date} | {story_id} | {score}/100 | {quality_cycles} | {len(infra_issues)} |
```

Per protocol §4: IF previous row exists, note trend direction (improving/stable/declining).

## 5. Assumption Audit

Per protocol §5: compare actual outcome vs pre-execution expectations.
- Did the pipeline stages deliver what planning predicted?
- What surprised (unexpected rework, infra issues)?
- What would be done differently next time?

## 6. Report Output

Append to `docs/tasks/reports/pipeline-{date}.md`:

Output per `references/meta_analysis_protocol.md` format.
Pipeline-specific data to include: stage table from §1, recovery map from §2, trend from §4, assumptions from §5.

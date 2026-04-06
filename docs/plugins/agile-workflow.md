# Agile Workflow

> End-to-end delivery pipeline from scope decomposition to quality gates

## Install

```bash
# Add the marketplace once
/plugin marketplace add levnikolaevich/claude-code-skills

# Install this plugin
/plugin install agile-workflow@levnikolaevich-skills-marketplace
```

## What it does

Automates the full Agile delivery cycle. Coordinators advance only from machine-readable artifacts, while task-plan, execution, quality, and test-planning workers keep their own runtime state and stay standalone-capable. Integrates with Linear or works standalone with markdown files.

## Skills

| Skill | Description |
|-------|-------------|
| ln-200-scope-decomposer | Decompose scope into Epics, Stories, RICE |
| ln-201-opportunity-discoverer | Traffic-First KILL funnel for idea validation |
| ln-210-epic-coordinator | CREATE or REPLAN 3-7 Epics from scope |
| ln-220-story-coordinator | Runtime-backed Story planning coordinator |
| ln-221-story-creator | Create Story documents, validate INVEST |
| ln-222-story-replanner | Replan Stories when requirements change |
| ln-230-story-prioritizer | RICE prioritization with market research |
| ln-300-task-coordinator | Artifact-first task planning coordinator (1-8 tasks) |
| ln-301-task-creator | Stateful task-plan worker for task creation |
| ln-302-task-replanner | Stateful task-plan worker for replanning |
| ln-310-multi-agent-validator | Parallel review via Codex + Gemini agents |
| ln-400-story-executor | Artifact-first execution coordinator |
| ln-401-task-executor | Stateful implementation worker |
| ln-402-task-reviewer | Stateful review worker and final task outcome |
| ln-403-task-rework | Stateful rework worker |
| ln-404-test-executor | Stateful test execution worker |
| ln-500-story-quality-gate | 4-level gate (PASS/CONCERNS/FAIL/WAIVED) |
| ln-510-quality-coordinator | Artifact-first quality coordinator |
| ln-511-code-quality-checker | Stateful quality worker |
| ln-512-tech-debt-cleaner | Stateful autofix worker |
| ln-513-regression-checker | Stateful regression worker |
| ln-514-test-log-analyzer | Stateful log-analysis worker |
| ln-520-test-planner | Artifact-first test-planning coordinator |
| ln-521-test-researcher | Stateful research worker |
| ln-522-manual-tester | Stateful manual-testing worker |
| ln-523-auto-test-planner | Stateful automated test-planning worker |
| ln-1000-pipeline-orchestrator | Autonomous pipeline orchestrator over coordinator artifacts |

## How it works

```
ln-200 (scope) -> ln-300 (tasks) -> ln-310 (validate)
    -> ln-400 (execute: ln-401/402/403/404)
    -> ln-500 (quality gate)
```

`ln-220`, `ln-300`, `ln-400`, `ln-510`, and `ln-520` keep coordinator runtime state and checkpoint child worker runs for resume. `ln-221/222`, `ln-301/302`, `ln-401..404`, `ln-511..514`, and `ln-521..523` remain standalone-capable workers with their own run-scoped state and summaries. `ln-1000` advances only from coordinator stage artifacts, while multi-agent validation (`ln-310`) still runs Codex and Gemini in parallel before execution begins.

## Quick start

```bash
ln-200-scope-decomposer      # Scope -> Epics -> Stories
ln-400-story-executor         # Execute Story to Done
ln-1000-pipeline-orchestrator # Autonomous pipeline
```

## Related

- [All plugins](../../README.md)
- [Architecture guide](../architecture/SKILL_ARCHITECTURE_GUIDE.md)

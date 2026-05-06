# Task: Story to Implementation Tasks

You are decomposing a Story into implementation tasks (1-8 tasks, 3-5h each).

## Context
{context}

## Story
{story_description}

## Acceptance Criteria
{acceptance_criteria}

## Goal Articulation
Before decomposing, state in one sentence: What is the REAL deliverable this Story produces for the end user? (Not "implement tasks" — the actual user-facing outcome.) State your REAL GOAL at the start of your output before analysis.

## Instructions
1. Build IDEAL task plan with Foundation-First order (DB -> Repository -> Service -> API -> Frontend)
2. Each task must be independently completable using only preceding tasks
3. NO test tasks (created later by test planner)
4. NO documentation-only tasks (fold into implementation DoD)
5. If task REPLACES existing code → include deletion of old implementation in task scope (no backward-compat shims, no aliases). See `references/clean_code_checklist.md`.
6. Validate: Task N must NOT depend on Task N+1 or later

## Output Format (JSON)
```json
{
  "task_count": 4,
  "tasks": [
    {
      "number": 1,
      "title": "Create database schema for users",
      "goal": "Define and migrate user table with all required fields",
      "layer": "database",
      "estimate_hours": 3,
      "depends_on": []
    }
  ],
  "foundation_first_order": "DB -> Service -> API -> Frontend",
  "independence_check": "All tasks pass forward-dependency check"
}
```

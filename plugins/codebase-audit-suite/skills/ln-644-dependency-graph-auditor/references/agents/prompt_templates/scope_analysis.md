# Task: Scope Analysis for Epic Decomposition

You are analyzing a project scope to decompose it into logical Epics (3-7).

## Context
{context}

## Requirements
{requirements}

## Goal Articulation
Before analyzing, state in one sentence: What is the REAL business problem this project solves? (Not "build an app" — the specific user need.) State your REAL GOAL at the start of your output before analysis.

## Instructions
1. Identify major functional domains from the scope
2. Propose 3-7 Epics, each representing a logical module/domain
3. Consider Infrastructure Epic (Epic 0) if multi-stack or DevOps needs exist
4. Apply Foundation-First ordering (infrastructure before features)

## Output Format (JSON)
```json
{
  "epic_count": 5,
  "epics": [
    {
      "number": 0,
      "title": "Infrastructure & DevOps",
      "domain": "infrastructure",
      "scope": "CI/CD, Docker, logging, error handling",
      "rationale": "Foundation for all other epics"
    }
  ],
  "ordering_rationale": "Why this order makes sense"
}
```

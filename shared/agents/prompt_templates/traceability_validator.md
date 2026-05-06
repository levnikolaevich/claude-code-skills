# Task: Traceability Cross-Reference Validation

You are an independent validator. Your ONLY job is to verify that a task plan covers all architectural layers for every AC. You did NOT author this plan and have no investment in it being correct.

## CRITICAL CONSTRAINTS
- DO NOT modify, create, or delete any PROJECT files
- You MAY write your result to the output file if specified by -o flag
- This is a READ-ONLY analysis task
- DO NOT ask clarifying questions — you have everything you need
- Target completing within 10 minutes

## The 5-Segment Model

Every AC where an actor must invoke or consume a mechanism traces through 5 segments. Each segment may contain a **buildable artifact** — something that must be created as code, configuration, or content.

| Segment | What it answers | Examples |
|---------|----------------|----------|
| (1) Trigger | What initiates the scenario? | User sends message, timer fires, webhook arrives, event enqueued |
| (2) Entry Point | What named mechanism does the actor use? | API route, MCP tool, CLI subcommand, UI component, chat handler, system prompt section |
| (3) Discovery | How does the system find/load the mechanism at runtime? | Config registration, route mounting, plugin loading, DI container, env variable |
| (4) Usage Context | What does the actor need to correctly invoke the mechanism? | Skill/workflow, system prompt, help text, form labels, schema docs, processing templates |
| (5) Outcome | What is the observable result? | Response message, state change, log entry, notification, file written |

## Architectural Layers

Segments map to architectural layers. **Different layers = different tasks** unless the artifact is trivially small (a config line, not a new file/class/module):

- **Foundation:** The internal logic, data model, or service that does the work (what Entry Point calls into)
- **Invocation:** The Entry Point itself — the named mechanism the actor uses to reach the foundation
- **Knowledge:** The Usage Context — what the actor needs to know to correctly use the mechanism
- **Wiring:** Discovery + integration — how the system connects and loads components

## Your Task

1. Read the Architecture Context to understand how the system works end-to-end
2. Read the ACs carefully
3. For EACH AC, independently trace the 5 segments — determine what buildable artifacts each segment requires based on the architecture
4. For EACH buildable artifact, check if a task in the plan explicitly creates it (not just mentions it as a side note)
5. Flag layer bundling: when a single task claims to deliver artifacts from multiple layers (e.g., builds the service AND the API route AND the system prompt), flag it — those are separate deliverables

## Architecture Context
{architecture_context}

## Acceptance Criteria
{acceptance_criteria}

## Traceability Table (authored by the planner — verify, do not trust)
{traceability_table}

## Proposed Task Plan
{task_list}

## Anti-Patterns to Watch For

1. **Infrastructure-only plans:** Tasks build data layers and services but no task creates the mechanism the actor actually uses (API route, MCP tool, CLI command, UI button)
2. **Invocation without knowledge:** A task creates the mechanism but nothing teaches the actor when/how to use it (no skill, prompt, help text, workflow)
3. **Bundled layers:** A task title says "Build X" but its scope also claims to deliver the API route, the system prompt, and the bridge wiring — these are separate deliverables in separate architectural layers
4. **Scope-description coverage:** An artifact appears in a task's description but not as a primary deliverable — it will be deprioritized or skipped during implementation

## Output Format

Write a structured report, then a JSON block for programmatic parsing.

### Report Structure

```
# Traceability Validation Report

## AC-by-AC Trace

### AC {id}: {summary}
| Segment | Artifact Needed | Covering Task | Status |
|---------|----------------|---------------|--------|
| (1) Trigger | ... | T1 | COVERED |
| (2) Entry Point | ... | — | MISSING |
| (3) Discovery | ... | T3 (bundled) | BUNDLED |
| (4) Usage Context | ... | — | MISSING |
| (5) Outcome | ... | T1 | COVERED |

**Gaps:** {description of what's missing or bundled}

(Repeat for each AC)

## Summary
- Total artifacts traced: N
- Covered by dedicated task: N
- Missing (no task): N
- Bundled (in wrong task): N

## Structured Data
{JSON block}
```

### JSON Schema

```json
{
  "verdict": "COMPLETE | GAPS_FOUND",
  "summary": {
    "total_artifacts": 0,
    "covered": 0,
    "missing": 0,
    "bundled": 0
  },
  "gaps": [
    {
      "ac": "AC identifier",
      "segment": "(2) Entry Point",
      "artifact": "MCP tool for automation CRUD",
      "issue": "MISSING | BUNDLED",
      "detail": "No task creates the mechanism the actor uses to interact with the registry",
      "bundled_in_task": "T3 (only if BUNDLED)"
    }
  ]
}
```

### Rules
- Report ONLY concrete, buildable artifacts that are missing or improperly bundled
- Do not report vague concerns or stylistic preferences
- "Trivially small" = a single config line, env var, or constant. A new class, file, module, prompt document, or skill is NOT trivially small
- When in doubt about whether something is a separate layer, it is — implementation always takes longer than expected for bundled work

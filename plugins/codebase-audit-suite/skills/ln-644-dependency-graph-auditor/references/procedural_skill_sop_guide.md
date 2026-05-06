# Procedural Skill SOP/TWI Guide

**Version:** 1.0.0
**Last Updated:** 2026-04-25

> **Paths:** All paths are relative to the skills repository root.

## Purpose

Use this guide when writing procedural, orchestrating, or mutating skills: skills that tell an agent how to change files, move work through a state machine, invoke workers, update external systems, or recover from failures.

The goal is reliable execution, not longer prose.

## Procedural Step Model

Write risky workflow steps with this shape:

| Field | Requirement |
|-------|-------------|
| Action | One concrete action the agent can execute now |
| Key point | The non-obvious constraint that prevents the common mistake |
| Why | Why the key point matters; prevents quiet improvisation |
| Evidence | Observable artifact, status, diff, checkpoint, or command output |
| Exception | What to do when the step cannot be completed |
| Automation/guard | Script, runtime guard, checklist, or validator that can catch failure |

Use the full shape at high-risk points. Low-risk linear steps can stay compact.

## Point-of-Use Checklists

Critical checks must be placed where the risk occurs.

Do this:
- Put worker artifact validation immediately after worker invocation.
- Put retry/loop checks immediately before another retry.
- Put permission/tool/auth preflight before external agent launch.
- Put status-transition assertions next to the transition.

Do not rely on a final Definition of Done to catch missed critical checks. Final DoD verifies completion; point-of-use checklists prevent bad execution.

## TWI Rule

For risky steps, include:

```text
Action: {do this}
Key point: {critical detail}
Why: {consequence if skipped}
Evidence: {what proves it happened}
Exception: {pause/retry/ask path}
Automation/guard: {script/check/runtime field}
```

## Wording Rules

Avoid vague modal words in executable workflow steps:
- `typically`
- `periodically`
- `regularly`
- `as needed`
- `when appropriate`

Replace them with exact triggers:
- `after every worker run`
- `before retrying the same task`
- `when artifact_path is missing`
- `if the same error signature repeats 3 times`

## Compound Step Rule

One step should contain one action. Split steps that say:
- do A and then B
- inspect A, update B, and report C
- run X; if it fails, run Y; otherwise update Z

Decision branches are allowed, but each branch needs its own action and evidence.

## Runtime Compatibility

If a skill depends on tooling, include a first self-check that proves the runtime can execute it:
- command exists
- auth exists when required
- expected config file exists
- required MCP/tool namespace is available
- output path is writable

When a self-check fails, pause with a concrete operator action instead of treating it as a domain failure.

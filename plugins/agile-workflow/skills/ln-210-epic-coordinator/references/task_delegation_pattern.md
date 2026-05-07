# Agent Tool Delegation Pattern

Standard pattern for coordinators delegating work through the Agent tool with context isolation.

## Prompt Template

```javascript
Agent(
  description: "[Action] [item] via [skill-name]",
  prompt: "Execute worker.

Step 1: Invoke worker:
  Skill(skill: \"[skill-name]\")

CONTEXT:
[contextStore as JSON]",
  subagent_type: "general-purpose"
)
```

## Context Isolation Rules

1. **Pass the minimum usable context** - prefer IDs or a compact contextStore, not the coordinator's full reasoning trace.
2. **Fresh eyes review** - worker analyzes the task without coordinator bias.
3. **Use Agent when isolation matters** - audits, focused reviews, and parallel workers benefit most.
4. **Validate outputs explicitly** - coordinator never assumes worker success without checking the returned summary or written artifacts.

## Output Contract

Choose one output mode per workflow and document it in the coordinator:

- **Compact return** - worker returns a short result directly in the Agent response.
- **File-based return** - worker writes a file and returns a compact summary with the file path and key metrics.

For file-based audit workflows, use:
- `references/audit_worker_core_contract.md`
- `references/templates/audit_worker_report_template.md`

## Anti-Patterns

| DON'T | DO |
|------|----|
| Direct Skill tool without Agent wrapper | Use Agent wrapping Skill tool invocation |
| Manual "Read skill from SKILL.md" in prompt | Use Skill tool for framework-managed loading |
| Pass full coordinator reasoning trace | Pass IDs or a compact contextStore |
| Assume the worker succeeded | Validate returned summary or written artifact |
| Mix output modes inside one workflow | Pick one output contract per workflow |
| Let workers make routing decisions | Keep workflow control in the coordinator |

## Parallelism Strategy

**When to parallelize:**
- Independent workers with no data dependencies
- Different audit categories
- Multiple domains or files with no overlap

**When to serialize:**
- Workers depend on previous results
- Same resource is being modified
- Order matters for correctness

## Error Handling

```text
IF worker returns error:
  1. Log the error details
  2. Continue with other workers when safe
  3. Include partial results in final output
  4. Mark failed checks as skipped/error with reason
```

---
**Version:** 2.0.0
**Last Updated:** 2026-02-15

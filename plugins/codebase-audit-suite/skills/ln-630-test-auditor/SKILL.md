---
name: ln-630-test-auditor
description: "Use when auditing the test surface through the evaluation platform with mandatory research, coordinated test audit workers, and structured summaries."
license: MIT
---

> **Paths:** File paths (`references/`, `../ln-*`) are relative to this skill directory.

**Type:** L2 Coordinator
**Category:** 6XX Audit

# Test Auditor

## Mandatory Read

**MANDATORY READ:** Load `references/evaluation_coordinator_runtime_contract.md`, `references/evaluation_summary_contract.md`, `references/evaluation_research_contract.md`
**MANDATORY READ:** Load `references/risk_based_testing_guide.md`, `references/research_tool_fallback.md`

## Purpose

- audit business-logic focus, E2E priority, value, coverage, isolation, manual tests, and structure
- coordinate `ln-631` through `ln-637`
- require current testing best-practice research

## Runtime Contract

Runtime family:
- `evaluation-runtime`

Identifier:
- `test-audit`

Phase order:
1. `PHASE_0_CONFIG`
2. `PHASE_1_DISCOVERY`
3. `PHASE_2_RESEARCH`
4. `PHASE_3_DELEGATE`
5. `PHASE_4_AGGREGATE`
6. `PHASE_5_REPORT`
7. `PHASE_6_SELF_CHECK`

## Worker Set

- `ln-631-test-business-logic-auditor`
- `ln-632-test-e2e-priority-auditor`
- `ln-633-test-value-auditor`
- `ln-634-test-coverage-auditor`
- `ln-635-test-isolation-auditor`
- `ln-636-manual-test-auditor`
- `ln-637-test-structure-auditor`

## Worker Invocation (MANDATORY)

**Host Skill Invocation:** `Skill(skill: "...", args: "...")` is mandatory delegation.
- Claude: call the Skill tool exactly as shown.
- Codex: if no Skill tool exists, locate the named skill in available skills, read its `SKILL.md`, treat `args` as `$ARGUMENTS`, execute that skill workflow, then return here with its result/artifact.
- Do not inline worker logic or mark the worker complete without executing the target skill.

Use the Skill tool for delegated workers. Do not inline worker logic inside the coordinator.

TodoWrite format (mandatory):
- `Resolve audit scope and build manifest`
- `Load test infrastructure and coverage`
- `Run best-practice research`
- `Delegate to domain audit workers`
- `Aggregate worker findings`
- `Generate audit report`
- `Verify cleanup and self-check`

Representative invocations:

```text
Skill(skill: "ln-631-test-business-logic-auditor", args: "{scope}")
Skill(skill: "ln-632-test-e2e-priority-auditor", args: "{scope}")
Skill(skill: "ln-633-test-value-auditor", args: "{scope}")
Skill(skill: "ln-634-test-coverage-auditor", args: "{scope}")
Skill(skill: "ln-635-test-isolation-auditor", args: "{scope}")
Skill(skill: "ln-636-manual-test-auditor", args: "{scope}")
Skill(skill: "ln-637-test-structure-auditor", args: "{scope}")
```

## Workflow

1. Start `evaluation-runtime`.
2. Discover automated and manual test surfaces.
3. Perform mandatory research.
4. Delegate audit workers.
5. Aggregate findings into one risk-based test audit.
6. Write final report and `evaluation-coordinator` summary.

## Definition of Done

- [ ] Evaluation runtime started
- [ ] Test surfaces discovered
- [ ] Mandatory research completed
- [ ] All planned worker summaries recorded
- [ ] Aggregate report written
- [ ] `evaluation-coordinator` summary written
- [ ] Runtime completed

## Meta-Analysis

**MANDATORY READ:** Load `references/meta_analysis_protocol.md`

After the coordinator run, analyze the session per protocol section 7 and include the protocol-formatted output with the final test audit result.

## References

- Workers: `../ln-631-test-business-logic-auditor/SKILL.md`, `../ln-632-test-e2e-priority-auditor/SKILL.md`, `../ln-633-test-value-auditor/SKILL.md`, `../ln-634-test-coverage-auditor/SKILL.md`, `../ln-635-test-isolation-auditor/SKILL.md`, `../ln-636-manual-test-auditor/SKILL.md`, `../ln-637-test-structure-auditor/SKILL.md`

---
**Version:** 4.0.0
**Last Updated:** 2025-12-23

---
name: ln-640-pattern-evolution-auditor
description: "Use when auditing architectural patterns through the evaluation platform with mandatory best-practice research, coordinated pattern workers, and structured summaries."
license: MIT
---

> **Paths:** File paths (`references/`, `../ln-*`) are relative to this skill directory.

**Type:** L2 Coordinator
**Category:** 6XX Audit

# Pattern Evolution Auditor

## Mandatory Read

**MANDATORY READ:** Load `references/evaluation_coordinator_runtime_contract.md`, `references/evaluation_summary_contract.md`, `references/evaluation_research_contract.md`
**MANDATORY READ:** Load `references/research_tool_fallback.md`

## Purpose

- audit implemented architectural patterns against current best practices
- coordinate `ln-641` through `ln-647`
- require research before pattern scoring

## Runtime Contract

Runtime family:
- `evaluation-runtime`

Identifier:
- `pattern-audit`

Phase order:
1. `PHASE_0_CONFIG`
2. `PHASE_1_DISCOVERY`
3. `PHASE_2_RESEARCH`
4. `PHASE_3_BOUNDARY_AUDITS`
5. `PHASE_4_PATTERN_ANALYSIS`
6. `PHASE_5_AGGREGATE`
7. `PHASE_6_REPORT`
8. `PHASE_7_SELF_CHECK`

## Worker Set

- `ln-641-pattern-analyzer`
- `ln-642-layer-boundary-auditor`
- `ln-643-api-contract-auditor`
- `ln-644-dependency-graph-auditor`
- `ln-645-open-source-replacer`
- `ln-646-project-structure-auditor`
- `ln-647-env-config-auditor`

## Worker Invocation (MANDATORY)

**Host Skill Invocation:** `Skill(skill: "...", args: "...")` is mandatory delegation.
- Claude: call the Skill tool exactly as shown.
- Codex: if no Skill tool exists, locate the named skill in available skills, read its `SKILL.md`, treat `args` as `$ARGUMENTS`, execute that skill workflow, then return here with its result/artifact.
- Do not inline worker logic or mark the worker complete without executing the target skill.

Use the Skill tool for delegated workers. Do not inline worker logic inside the coordinator.

TodoWrite format (mandatory):
- `Resolve audit scope and build manifest`
- `Load architecture patterns and layers`
- `Run best-practice research`
- `Run boundary and contract audits`
- `Analyze pattern compliance and gaps`
- `Aggregate worker findings`
- `Generate audit report`
- `Verify cleanup and self-check`

Representative invocations:

```text
Skill(skill: "ln-641-pattern-analyzer", args: "{scope}")
Skill(skill: "ln-642-layer-boundary-auditor", args: "{scope}")
Skill(skill: "ln-643-api-contract-auditor", args: "{scope}")
Skill(skill: "ln-644-dependency-graph-auditor", args: "{scope}")
Skill(skill: "ln-645-open-source-replacer", args: "{scope}")
Skill(skill: "ln-646-project-structure-auditor", args: "{scope}")
Skill(skill: "ln-647-env-config-auditor", args: "{scope}")
```

## Workflow

1. Start `evaluation-runtime`.
2. Discover candidate patterns and applicability.
3. Run mandatory research first:
   - official docs or standards
   - MCP Ref
   - Context7 when library/framework patterns are involved
   - current web best-practice research
4. Run boundary audits before pattern scoring.
5. Run pattern analysis only after boundary results and research exist.
6. Aggregate scores and produce the final pattern report.

## Definition of Done

- [ ] Evaluation runtime started
- [ ] Pattern applicability resolved
- [ ] Best-practice research completed
- [ ] Boundary audit summaries recorded
- [ ] Pattern analysis summaries recorded
- [ ] Final report written
- [ ] `evaluation-coordinator` summary written
- [ ] Runtime completed

## Meta-Analysis

Optional reference: load `references/meta_analysis_protocol.md` only when the user asks for post-run meta-analysis or protocol-formatted run reflection.

When requested after the coordinator run, analyze the session per protocol section 7 and include the protocol-formatted output with the final pattern audit result.

## References

- Workers: `../ln-641-pattern-analyzer/SKILL.md`, `../ln-642-layer-boundary-auditor/SKILL.md`, `../ln-643-api-contract-auditor/SKILL.md`, `../ln-644-dependency-graph-auditor/SKILL.md`, `../ln-645-open-source-replacer/SKILL.md`, `../ln-646-project-structure-auditor/SKILL.md`, `../ln-647-env-config-auditor/SKILL.md`
- Shared pattern refs: `references/layer_rules.md`; pattern and scoring manuals are local to `../ln-641-pattern-analyzer/references/`

---
**Version:** 2.0.0
**Last Updated:** 2026-02-08

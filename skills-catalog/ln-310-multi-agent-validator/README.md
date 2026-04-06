# ln-310 Multi-Agent Validator — Architecture Reference

Quick-reference for understanding how the validator works at runtime. For implementation details, see SKILL.md and reference files.

## Modes

| | mode=story | mode=plan_review | mode=context |
|---|-----------|-----------|-------------|
| **Input** | Story ID (Backlog) | Plan file (auto-detect) | Conversation + git diff |
| **Phases** | 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 | 0 → 1 → 2 → 3 → 5 → 6 → 8 | 0 → 1 → 2 → 3 → 5 → 6 → 8 |
| **Phase 3 work** | 30-criteria audit + display | MCP Ref research | MCP Ref research |
| **Agents** | Codex + Gemini (background) | Codex + Gemini (background) | Codex + Gemini (background) |
| **Output** | GO/NO-GO, Story → Todo | Advisory corrections | Advisory corrections |
| **Prompt template** | `modes/story.md` | `modes/plan_review.md` | `modes/context.md` |

## Phase Flow

### mode=story

```
Phase 0         Phase 1          Phase 2                Phase 3
┌──────────┐   ┌─────────────┐  ┌──────────────────┐   ┌──────────────┐
│ Load     │   │ Resolve     │  │ Health Check     │   │ Research &   │
│ tools_   │──→│ Story +     │─→│ Build prompt     │──→│ Audit        │
│ config   │   │ Task meta   │  │ Launch agents ◄──┼───┼── PARALLEL   │
└──────────┘   └─────────────┘  └──────────────────┘   │ Display pts  │
                                  │ agents in background│ + Fix Plan   │
                                  ▼                     └──────┬───────┘
Phase 4          Phase 5                    Phase 6            Phase 7            │Phase 8
┌──────────────┐ ┌────────────────────────┐ ┌──────────────┐ ┌──────────────┐ ┌─────────────┐
│ Auto-Fix     │ │ Wait for agents        │ │ Iterative    │ │ Story → Todo │ │ Self-Check  │
│ 11 groups    │→│ Parse + Merge + Dedup  │→│ Refinement   │→│ Kanban update│→│ All [ ] must│
│ 30 criteria  │ │ REJECT if disagree     │ │ Codex loop   │ │ Summary post │ │ be [x]      │
└──────────────┘ └────────────────────────┘ └──────────────┘ └──────────────┘ └─────────────┘
```

### mode=plan_review / mode=context

```
Phase 0         Phase 1          Phase 2                Phase 3            Phase 5
┌──────────┐   ┌─────────────┐  ┌──────────────────┐   ┌──────────────┐  ┌────────────────┐
│ Load     │   │ Resolve     │  │ Health Check     │   │ MCP Ref      │  │ Wait agents    │
│ tools_   │──→│ input +     │─→│ Build prompt     │──→│ Research     │─→│ Merge + Verify │
│ config   │   │ metadata    │  │ Launch agents ◄──┼───┼── PARALLEL   │  │ Apply accepted │
└──────────┘   └─────────────┘  └──────────────────┘   │ Compare &    │  └───────┬────────┘
                                                        │ Correct      │          │
                                                        └──────────────┘    Phase 6
                                                                        ┌──────────────┐
                                                                        │ Iterative    │
                                                                        │ Refinement   │
                                                                        └──────┬───────┘
                                                                               │
                                                                         Phase 8
                                                                        ┌──────────────┐
                                                                        │ Self-Check   │
                                                                        │ Advisory out │
                                                                        └──────────────┘
```

## Parallel Architecture

The key design: agents run in background while Claude works foreground. No idle waiting.

```
Timeline ─────────────────────────────────────────────────────────────────────→

Phase 2                           Phases 3-4 (foreground)           Phase 5
┌────────────────────┐  ┌───────────────────────────────────┐  ┌─────────────┐
│ agent_runner.mjs   │  │                                   │  │ Process-as- │
│ --health-check     │  │  mode=story:                      │  │ arrive:     │
│                    │  │    Research + 30 criteria audit    │  │             │
│ Build prompt from  │  │    Display penalty points         │  │ 1st agent → │
│ review_base.md +   │  │    Auto-fix 11 groups             │  │  verify     │
│ modes/{mode}.md    │  │                                   │  │             │
│                    │  │  mode=plan_review/context:                │  │ 2nd agent → │
│ Launch:            │  │    MCP Ref research (3-5 topics)  │  │  merge      │
│  ├─ Codex CLI ─────┼──┼──── runs in background ──────────┼──┼→ parse      │
│  └─ Gemini CLI ────┼──┼──── runs in background ──────────┼──┼→ parse      │
└────────────────────┘  └───────────────────────────────────┘  │             │
                                                                │ Dedup vs   │
                                                                │ own + hist │
                                                                │             │
                                                                │ AGREE →    │
                                                                │   apply    │
                                                                │ REJECT →   │
                                                                │   skip     │
                                                                └─────────────┘
```

## Agent Review Lifecycle

```
Claude                           Codex CLI                    Gemini CLI
  │                                 │                             │
  ├─ agent_runner.mjs ─────────────→│ LAUNCHED                    │
  ├─ agent_runner.mjs ─────────────→│                             │ LAUNCHED
  │                                 │                             │
  │  ◄── foreground work ──►        │ reviewing...                │ reviewing...
  │                                 │                             │
  │         (process-as-arrive)     │                             │
  │◄────────────────────────────────┤ DONE: suggestions[]         │
  ├─ verify + evaluate              │                             │
  │                                 │                             │
  │◄────────────────────────────────┼─────────────────────────────┤ DONE
  ├─ merge + dedup                  │                             │
  │                                 │                             │
  ├─ AGREE → apply fix              │                             │
  ├─ REJECT → skip                  │                             │
  │                                 │                             │
  ├─ Iterative Refinement loop:     │                             │
  │   ├─ Send artifact to Codex ───→│ review                      │
  │   ├─ Parse suggestions ◄────────┤ suggestions[]               │
  │   ├─ AGREE/REJECT each          │                             │
  │   └─ Repeat until APPROVED      │                             │
  │                                 │                             │
  ├─ Save review_history.md         │                             │
  └─ Display summary                │                             │
```

## 30 Criteria at a Glance

| # | Criterion | Severity | Group |
|---|-----------|----------|-------|
| 1 | Story Structure | LOW (1) | Structural |
| 2 | Tasks Structure | LOW (1) | Structural |
| 3 | Story Statement | LOW (1) | Structural |
| 4 | Acceptance Criteria | MEDIUM (3) | Structural |
| 5 | Standards Compliance | CRITICAL (10) | Standards |
| 6 | Library & Version | HIGH (5) | Solution |
| 7 | Test Strategy | LOW (1) | Workflow |
| 8 | Documentation Integration | MEDIUM (3) | Workflow |
| 9 | Story Size | MEDIUM (3) | Workflow |
| 10 | Test Task Cleanup | MEDIUM (3) | Workflow |
| 11 | YAGNI | MEDIUM (3) | Workflow |
| 12 | KISS | MEDIUM (3) | Workflow |
| 13 | Task Order | MEDIUM (3) | Workflow |
| 14 | Documentation Complete | HIGH (5) | Quality |
| 15 | Code Quality Basics | MEDIUM (3) | Quality |
| 16 | Story-Task Alignment | MEDIUM (3) | Traceability |
| 17 | AC-Task Coverage | MEDIUM (3) | Traceability |
| 17b | AC Invocability | HIGH (5)* | Traceability |
| 17c | Scenario Completeness | HIGH (5)* | Traceability |
| 18 | Story Dependencies | CRITICAL (10) | Dependencies |
| 19 | Task Dependencies | MEDIUM (3) | Dependencies |
| 20 | Risk Analysis | HIGH (5)* | Risk |
| 21 | Alternative Solutions | MEDIUM (3) | Solution |
| 22 | AC Verify Methods | MEDIUM (3) | Verification |
| 23 | Architecture Considerations | MEDIUM (3) | AI-Readiness |
| 24 | Assumption Registry | MEDIUM (3) | Structural |
| 25 | AC Cross-Story Overlap | MEDIUM (3) / CRITICAL (10) | Cross-Reference |
| 26 | Task Cross-Story Duplication | LOW (1) | Cross-Reference |
| 27 | Pre-mortem Analysis | MEDIUM (3) | Pre-mortem |
| 28 | Library Feature Utilization | MEDIUM (3) | Solution |

*#20 capped at 15 points (3 risks max). #25 max 1 CRITICAL = 10. #17b and #17c are HIGH per AC, uncapped. Maximum total: 123+ points.

## Penalty Points Scoring

```
Severity:  CRITICAL = 10    HIGH = 5    MEDIUM = 3    LOW = 1

Readiness Score = 10 - (Penalty / 5)

GO:     Penalty After = 0  AND  no FLAGGED items
NO-GO:  Penalty After > 0  OR   any FLAGGED items

AC Coverage: 100% = pass    80-99% = -3 penalty    <80% = -5, NO-GO
```

## File Map

| File | Purpose | Read in |
|------|---------|---------|
| `SKILL.md` | Full workflow spec (phases 0-9) | Entry point |
| **Validation criteria** | | |
| `references/phase2_research_audit.md` | 30 criteria + auto-fix actions table | Phase 3 |
| `references/penalty_points.md` | Calculation rules, caps, report format | Phase 3 |
| **Validation checklists** | | |
| `references/structural_validation.md` | #1-4: template, statement, AC | Phase 4 group 1 |
| `references/standards_validation.md` | #5: RFC/OWASP compliance | Phase 4 group 2 |
| `references/solution_validation.md` | #6, #21, #28: libraries, alternatives, feature utilization | Phase 4 group 3 |
| `references/workflow_validation.md` | #7-13: test, docs, size, YAGNI, KISS | Phase 4 group 4 |
| `references/quality_validation.md` | #14-15: documentation, hardcoded values | Phase 4 group 5 |
| `references/dependency_validation.md` | #18-19: forward deps, DAG, parallel | Phase 4 group 6 |
| `references/cross_reference_validation.md` | #25-26: AC overlap, task duplication | Phase 4 group 7 |
| `references/risk_validation.md` | #20: impact x probability matrix | Phase 4 group 8 |
| `references/premortem_validation.md` | #27: Tiger/Paper Tiger/Elephant | Phase 4 group 9 |
| `references/traceability_validation.md` | #16-17, #17b-17c, #22: alignment, coverage, invocability, scenario completeness, verify | Phase 4 groups 10-11 |
| **Research** | | |
| `references/context_review_pipeline.md` | MCP Ref research pipeline | Phase 3 |
| `references/domain_patterns.md` | Pattern registry for domain extraction | Phase 3 |
| `references/mcp_ref_findings_template.md` | Output template for MCP findings | Phase 3 |
| **Shared** | | |
| `shared/references/agent_review_workflow.md` | Agent launch, merge, refinement protocol | Phase 2, 5, 6 |
| `shared/references/agent_delegation_pattern.md` | Inline agent review architecture | Phase 2 |
| `shared/references/agent_review_memory.md` | Review history dedup | Phase 5 |
| `shared/agents/prompt_templates/review_base.md` | Base prompt for all agent modes | Phase 2 |
| `shared/agents/prompt_templates/modes/*.md` | Mode-specific prompt parts | Phase 2 |
| `shared/references/research_tool_fallback.md` | MCP Ref → Context7 → WebSearch chain | Phase 3 |

---
**Version:** 2.0.0
**Last Updated:** 2026-03-22

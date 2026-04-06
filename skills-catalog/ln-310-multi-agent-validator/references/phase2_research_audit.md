# Phase 3: Research & Audit

**Always execute — no exceptions.** Steps 1-5 are mode=story only. Steps 3-4 and criteria #5, #6, #21, #28 apply to ALL modes (story, plan_review, context).

> **Note:** Domain Extraction and Inline Documentation Creation have moved to Phase 4 (Documentation). This file covers Research & Audit only.

## Step 1: Research via MCP (ALL MODES)

**MANDATORY READ:** Load `shared/references/research_methodology.md`

- Query MCP Ref for industry standards: `ref_search_documentation(query="[topic] RFC OWASP best practices {current_year}")`
- Query Context7 for library versions: `resolve-library-id` + `query-docs`
- Extract: standards (RFC numbers, OWASP rules), library versions, patterns
- **mode=plan_review/context:** pipeline entry via `references/context_review_pipeline.md` (Applicability Check → Stack Detection → this step)

## Step 2: Anti-Hallucination Verification (ALL MODES)

**MANDATORY READ:** Load `shared/references/epistemic_protocol.md`

- Scan artifact (Story/Tasks, plan, or reviewed documents) for factual claims across ALL trigger categories (per epistemic protocol Section B):
  - Version numbers, API signatures, deprecation claims
  - Standards/RFC references, security severity levels
  - Market/competitor data, performance characteristics
- For each claim, check evidence from Step 1 research results:
  - Has MCP Ref/Context7/WebSearch evidence → mark `VERIFIED`
  - No tool evidence but claim is plausible → mark `FROM TRAINING` + add to fix list
  - Contradicts tool evidence → mark `FLAGGED` (CRITICAL)
- Note: Step 2 VERIFIES claims against existing research. It does NOT run new searches — new tool queries happen in auto-fix (#6 for story, Compare & Correct for plan/context).
- Status: VERIFIED (all sourced) | FLAGGED (list unverified with trigger category)

## Step 3: Pre-mortem Analysis

**MANDATORY READ:** Load `references/premortem_validation.md`

- Execute for Stories with complexity >= Medium (3+ tasks, external deps, or unfamiliar tech)
- Skip for trivial Stories (1-2 tasks, no external deps, known tech)
- Tigers (evidence-based risks) → feed Risk criterion #20 (add to risk table BEFORE penalty calc)
- Elephants (unstated assumptions) → feed Assumptions criterion #24 (add with [pre-mortem] tag, Confidence=LOW)
- Paper Tigers (fears without evidence) → document and dismiss
- Include pre-mortem table in Phase 3 audit report

## Step 4: Cross-Reference Analysis

**MANDATORY READ:** Load `references/cross_reference_validation.md`

- Skip if Epic has only 1 Story or all siblings Done/Canceled
- Load sibling Stories via `list_issues(project=Epic.id)`
- Check AC overlap (#25): structured traceability first (AC IDs, Affected Components, file paths), keyword fallback advisory-only
- Check task duplication (#26): structured match (Affected Components, file paths) primary
- Include cross-reference findings in Phase 3 audit report

## Step 5: Penalty Points Calculation

- Evaluate all 30 criteria against Story/Tasks (see Auto-Fix Actions Reference below)
- Assign penalty points per violation (CRITICAL=10, HIGH=5, MEDIUM=3, LOW=1)
- Calculate total penalty points
- Build fix plan for each violation

# Auto-Fix Actions Reference

Detailed criteria table for Phase 4 auto-fix execution and Phase 3 penalty calculation.

## Structural (#1-#4, #24)

| # | Criterion | What it checks | Penalty | Auto-fix actions |
|---|-----------|----------------|---------|------------------|
| 1 | Story Structure | 9 sections per template | LOW (1) | Add/reorder sections with TODO placeholders; update Linear |
| 2 | Tasks Structure | Each Task has 7 sections | LOW (1) | Load each Task; add/reorder sections; update Linear |
| 3 | Story Statement | As a/I want/So that clarity | LOW (1) | Rewrite using persona/capability/value; update Linear |
| 4 | Acceptance Criteria | Given/When/Then, 3-5 items | MEDIUM (3) | Normalize to G/W/T; add edge cases; update Linear |
| 24 | Assumption Registry | Assumptions section with >=1 typed entry; each has Category, Confidence, Invalidation Impact; LOW confidence entries have validation plan in Tasks; Inherited Assumptions in child Tasks match parent Story registry (ID exists + text matches) | MEDIUM (3) | Scan Technical Notes for implicit assumptions (keywords: "assumes", "expects", "requires", "available"); populate table; verify assumption sync in Tasks |

## Standards (#5) — ALL MODES

| # | Criterion | What it checks | Penalty (story) | Auto-fix: story | Auto-fix: plan/context |
|---|-----------|----------------|-----------------|-----------------|------------------------|
| 5 | Standards Compliance | Each technical decision references specific RFC/OWASP/REST standard by number | CRITICAL (10) | Query MCP Ref; update Technical Notes with compliant approach | Query MCP Ref; add inline `"(per {RFC}: ...)"` to artifact |

## Solution (#6, #21, #28) — ALL MODES

| # | Criterion | What it checks | Penalty (story) | Auto-fix: story | Auto-fix: plan/context |
|---|-----------|----------------|-----------------|-----------------|------------------------|
| 6 | Library & Version | Libraries are latest stable | HIGH (5) | Query Context7; update to recommended versions | Query Context7; correct version in artifact + deprecation note |
| 21 | Alternative Solutions | Chosen approach optimal vs modern alternatives; cross-ref ln-645 audit if `docs/project/.audit/ln-640/*/645-open-source-replacer*.md` available (glob across dates, take latest) | MEDIUM (3) | Search MCP Ref + web; add "Alternative Considered" note to Technical Notes. If ln-645 + HIGH-confidence → advisory note | Search MCP Ref; add "Alternative Considered" note to artifact if better option found |
| 28 | Library Feature Utilization | Custom code duplicates features of declared dependencies | MEDIUM (3) | Read manifest + Context7 (max 3); add advisory to Task Technical Approach | Read manifest + Context7; add advisory "built-in {feature} available" to artifact |

> **Mode differences:** In mode=story, violations accumulate penalty points (Phase 3 Step 7) and are fixed in Phase 4. In mode=plan_review/context, no penalty points — corrections are applied directly per `references/context_review_pipeline.md` Compare & Correct Safety Rules (max 5 corrections).

## Workflow (#7-#13)

| # | Criterion | What it checks | Penalty | Auto-fix actions |
|---|-----------|----------------|---------|------------------|
| 7 | Test Strategy | Section exists but empty | LOW (1) | Ensure section present; leave empty (testing handled separately) |
| 8 | Documentation Integration | No standalone doc tasks | MEDIUM (3) | Remove doc-only tasks; fold into implementation DoD |
| 9 | Story Size | 1-8 tasks (3-5 optimal); 3-5h each | MEDIUM (3) | If >8, add TODO; flag task size issues |
| 10 | Test Task Cleanup | No premature test tasks | MEDIUM (3) | Remove test tasks before final; testing appears later |
| 11 | YAGNI | Each Task maps to ≥1 Story AC; no tasks without AC justification | MEDIUM (3) | Move speculative items to Out of Scope unless standards require |
| 12 | KISS | No task requires >3 new abstractions; if >3 → split or simplify | MEDIUM (3) | Simplify unless standards require complexity |
| 13 | Task Order | DB→Service→API→UI | MEDIUM (3) | Reorder Tasks foundation-first |

## Quality (#14-#15)

| # | Criterion | What it checks | Penalty | Auto-fix actions |
|---|-----------|----------------|---------|------------------|
| 14 | Documentation Complete | Pattern docs exist + referenced | HIGH (5) | Create inline per documentation_creation.md; add all doc links to Technical Notes |
| 15 | Code Quality Basics | No hardcoded values | MEDIUM (3) | Add TODOs for constants/config/env |

## Traceability (#16-#17, #17b-#17c)

| # | Criterion | What it checks | Penalty | Auto-fix actions |
|---|-----------|----------------|---------|------------------|
| 16 | Story-Task Alignment | Each Task title contains keyword from Story AC; grep verification | MEDIUM (3) | Add TODO to misaligned Tasks; warn user |
| 17 | AC-Task Coverage | Coverage matrix: each AC row has ≥1 Task; no empty rows | MEDIUM (3) | Add TODO for uncovered ACs; suggest missing Tasks |
| 17b | AC Invocability | Every AC where an actor must invoke/consume a mechanism has a covering Task whose Implementation Plan names a concrete mechanism (MCP tool, API endpoint, CLI command, UI component, chat handler, config file, system prompt section, cron handler). Infrastructure-only tasks do NOT satisfy ACs requiring something to *use* that infrastructure. Vague mechanism = violation | HIGH (5) per AC | For each violating AC — identify missing mechanism, either (a) add to existing task's Implementation Plan with explicit section, or (b) flag that a new task is needed for the consuming layer. Update Linear |
| 17c | Scenario Completeness | For each AC where an actor must invoke/consume a mechanism, covering task(s) must collectively address all 5 segments: (1) Actor trigger, (2) Entry point (named mechanism from #17b), (3) Discovery (how actor's system finds/loads mechanism at runtime), (4) Usage context (what actor's system needs to correctly invoke mechanism), (5) Observable outcome. Missing segment = violation | HIGH (5) per AC | For each violating AC — identify missing segment(s), either (a) add to existing task's Implementation Plan, or (b) flag that covering task needs a "Scenario Integration" section. Update Linear |

## Dependencies (#18-#19)

| # | Criterion | What it checks | Penalty | Auto-fix actions |
|---|-----------|----------------|---------|------------------|
| 18 | Story Dependencies | No forward Story dependencies | CRITICAL (10) | Flag forward dependencies; suggest reorder |
| 19 | Task Dependencies | No forward Task dependencies | MEDIUM (3) | Flag forward dependencies; reorder Tasks |

## Cross-Reference (#25-#26)

| # | Criterion | What it checks | Penalty | Auto-fix actions |
|---|-----------|----------------|---------|------------------|
| 25 | AC Cross-Story Overlap | Story AC doesn't overlap/conflict with active sibling Stories in same Epic | MEDIUM (3) / CRITICAL (10), max 1 CRITICAL | Structured traceability first (AC IDs, Affected Components, file paths); keyword overlap as advisory fallback; conflict (same Given/When + different Then) → CRITICAL |
| 26 | Task Cross-Story Duplication | Tasks don't duplicate sibling Stories' tasks | LOW (1), max 3 | Structured match (Affected Components, file paths) primary; title keyword overlap advisory; human decides |

## Risk (#20)

| # | Criterion | What it checks | Penalty | Auto-fix actions |
|---|-----------|----------------|---------|------------------|
| 20 | Risk Analysis | Unmitigated implementation risks (architecture, errors, scalability, data integrity, integration, SPOF) | HIGH (5) per risk, max 15 | Score via Impact x Probability matrix; add TODO sections for Priority 15-19; FLAG for human review at Priority >= 20; skip at Priority <= 8 |

## Verification Methods (#22)

| # | Criterion | What it checks | Penalty | Auto-fix actions |
|---|-----------|----------------|---------|------------------|
| 22 | AC Verify Methods | Every task AC has `verify:` method (test/command/inspect); at least 1 non-inspect per task | MEDIUM (3) | Generate `verify:` methods based on AC content: HTTP endpoints → command, DB operations → inspect, business logic → test; update Linear |

## AI-Readiness (#23)

| # | Criterion | What it checks | Penalty | Auto-fix actions |
|---|-----------|----------------|---------|------------------|
| 23 | Architecture Considerations Complete | Story has: layers affected, side-effect boundary, orchestration depth | MEDIUM (3) | Add Architecture Considerations section from story_template.md with placeholder fields; update Linear |

## Pre-mortem (#27)

| # | Criterion | What it checks | Penalty | Auto-fix actions |
|---|-----------|----------------|---------|------------------|
| 27 | Pre-mortem Analysis | Pre-mortem with Tiger/Paper Tiger/Elephant classification (complex Stories) | MEDIUM (3) | Execute algorithm from premortem_validation.md; Tigers → risk #20; Elephants → Assumptions #24 [pre-mortem] |

**Maximum Penalty:** 123+ points (sum of all 30 criteria; #17b and #17c are HIGH per AC, uncapped; #20 capped at 15; #25 max 1 CRITICAL = 10)

---
**Version:** 1.0.0
**Last Updated:** 2026-02-14

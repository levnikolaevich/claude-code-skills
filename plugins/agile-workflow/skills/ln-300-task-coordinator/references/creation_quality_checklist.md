# Creation Quality Checklist

Prevention checklist for content creators. Maps to story validation criteria — following these rules prevents penalty points at validation stage.

For full validation rules and auto-fix logic, see story validator `references/` (10 validation files).

## Vocabulary

**Actor:** The entity that makes the decision or performs the action described in an AC.

Rules:
- The actor is the entity that executes, not the entity that launches, schedules, or dispatches.
- If the AC describes a delegated action (spawned process, background worker, agent session), the actor is the delegate — not the delegator.
- Scenario segments (3) Discovery and (4) Usage Context must be answered from the actor's perspective: what does the actor discover, what context does the actor have at the point of execution.

## Story Creation Checklist

For Story creation workflow.

| # | Criterion | Penalty | Rule |
|---|-----------|---------|------|
| 1 | Story Structure | 1 | 9 sections per template (in order): Story, Context, Acceptance Criteria, Implementation Tasks, Test Strategy, Technical Notes, Definition of Done, Dependencies, Assumptions |
| 3 | Story Statement | 1 | Format: "As a {persona}, I want {capability}, so that {value}" — all 3 parts required |
| 4 | AC Quality | 3 | 3-5 Given/When/Then scenarios: happy path + error + edge case. Include HTTP codes, timing, exact messages |
| 5 | Standards Compliance | 10 | Every technical decision references specific RFC/OWASP/REST standard by number in Technical Notes. Use standards research results |
| 6 | Library & Version | 5 | Latest stable versions in Technical Notes. Query Context7/MCP Ref to verify |
| 9 | Story Size | 3 | 1-8 tasks (3-5 optimal), 3-5 AC (**HARD LIMIT: >5 ACs = MUST split**), 6-20 hours total, tests justified by Priority ≥15. If outside range — split or merge |
| 11 | YAGNI | 3 | Each AC = real user need from Epic Scope In. No speculative features. No research-driven ACs (research → Technical Notes only). Every Task maps to >= 1 AC |
| 12 | KISS | 3 | Simplest approach. No task requires >3 new abstractions. If >3 — split or simplify |
| 14 | Documentation Complete | 5 | Pattern docs (from best practices research) referenced in Technical Notes. No orphan patterns |
| 16 | Story-Task Alignment | 3 | Each Task title contains keyword from Story AC (grep-verifiable) |
| 17 | AC-Task Coverage | 3 | Coverage matrix: every AC covered by >= 1 Task. No empty rows |
| 17b | AC Invocability | 5 | Every AC where an actor invokes a mechanism must map to a task creating a concrete, named mechanism. Infrastructure-only tasks (queue, registry, store) do NOT satisfy ACs requiring something to *use* that infrastructure. One named mechanism per actor — no vague "via X or Y" |
| 17c | Scenario Completeness | 5 | Each AC traces 5 segments: (1) Trigger, (2) Entry Point, (3) Discovery, (4) Usage Context, (5) Outcome. All 5 must be addressed across covering tasks. Traceability table with these columns required in the plan. See ln-300 Phase 2 for segment definitions |
| 17d | Layer Separation | 5 | Segments map to layers: Foundation, Invocation, Knowledge, Wiring. Buildable artifacts in different layers = separate tasks. A foundation task must not also deliver the invocation mechanism or the actor's knowledge of how to use it, unless the artifact is trivially small (config line, not a new file/module) |
| 18 | Story Dependencies | 10 | No forward dependencies on Stories not yet created. Only reference earlier Stories |
| 24 | Assumption Registry | 3 | Assumptions section with >=1 typed entry per relevant category (FEASIBILITY/DEPENDENCY/DATA/SCOPE). Each entry has Confidence and Invalidation Impact |
| 28 | AC Purity | 3 | Every AC describes observable user behavior (Given user does X, Then user sees Y). System internals (lookup priority, cache layers, endpoint URLs, architecture) belong in Technical Notes, not ACs |
| 29 | Scope Minimalism | 3 | Simplest design that delivers Epic Goal. No benchmark-driven inflation ("industry does X" is not a reason to add AC). Standards Research → Technical Notes only |
| 30 | Feature Bundling | 3 | Story title has no conjunctions joining distinct capabilities ("and", "&", "+"). Each distinct user capability = separate Story |

**Total exposure:** 77 penalty points if all violated.

## Task Creation Checklist

For Task creation workflow.

| # | Criterion | Penalty | Rule |
|---|-----------|---------|------|
| 2 | Tasks Structure | 1 | 7 sections per template (in order): Context, Implementation Plan, Technical Approach, Acceptance Criteria, Affected Components, Existing Code Impact, Definition of Done |
| 8 | Documentation Integration | 3 | No standalone doc-only tasks. Doc updates fold into implementation task DoD |
| 13 | Task Order | 3 | Foundation-First: DB -> Service -> API -> UI. Each layer builds on previous |
| 15 | Code Quality Basics | 3 | No hardcoded values in Technical Approach. Use config/env/constants |
| 19 | Task Dependencies | 3 | Task N uses only Tasks 1..N-1. No forward references to N+1, N+2 |
| 22 | AC Verify Methods | 3 | Every task AC has `verify:` method (test/command/inspect). At least 1 non-inspect method per task |
| 19b | Parallel Groups | 3 | Tasks in same group have no mutual deps; all deps point to earlier groups; numbers sequential. Skip if no groups assigned |

**Total exposure:** 19 penalty points.

## Validation-Only Criteria

These 7 criteria are handled during story validation, NOT by creators:

| # | Criterion | Why validation-only |
|---|-----------|---------------------|
| 7 | Test Strategy | Section is placeholder at creation; filled by test planning later |
| 10 | Test Task Cleanup | Cleanup action during validation; no premature test tasks expected |
| 20 | Risk Analysis | Validator scans Story/Tasks for unmitigated risks (R1-R6) via keyword detection in Technical Notes and Implementation Plan |
| 21 | Alternative Solutions | Validator searches MCP Ref + web for modern alternatives; adds "Alternative Considered" note if better option exists |
| 25 | AC Cross-Story Overlap | Validator loads sibling Stories; checks structured traceability (AC IDs, Affected Components, file paths) for overlap and conflicts |
| 26 | Task Cross-Story Duplication | Validator compares task Affected Components and file paths across sibling Stories |
| 27 | Pre-mortem Analysis | Validator runs pre-mortem for complex Stories; Tigers → Risk #20, Elephants → Assumptions #24 |

---
**Version:** 1.0.0
**Last Updated:** 2026-02-08

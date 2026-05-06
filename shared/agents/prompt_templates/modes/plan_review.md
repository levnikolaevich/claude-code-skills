## header
# Task: Review Implementation Plan

You are reviewing an implementation plan against the actual codebase, feasibility constraints, and best practices. This is an independent review — challenge assumptions.

## constraints
- You HAVE internet access — use it for web research
- Do NOT use task management tools (Linear, Jira, etc.)

## body
## Plan
{plan_ref}

## Codebase Context
{codebase_context}

## Review Goal
{review_goal}

{focus_hint}

Given these goals, articulate in your report's Goal section what specific feasibility risk YOU will prioritize and why — this is your refinement of the caller's goals, not a replacement. Focus your analysis on the areas most relevant to your primary focus while still covering the review goal.

## Instructions
1. Read the plan file specified in the Plan section above — it contains the exact path to the materialized file
2. Examine the actual codebase to verify plan assumptions (file paths, APIs, patterns)
3. Search the web for best practices relevant to the technical decisions
4. Focus on analysis — avoid modifying project files unless a fix is trivial and obvious.

## Internal Reuse Check
Before evaluating external alternatives, search the codebase for:
- Utilities, helpers, or shared modules that already solve what the plan proposes to build
- Patterns established elsewhere in the project that the plan should follow
- Existing abstractions (base classes, middleware, hooks) the plan could extend rather than duplicate
If found, report under area `duplication` with file paths and function/class names.

## Refined Plan Output
After analysis, produce a **complete refined version** of the original plan with all corrections applied inline. This is the primary deliverable.

Rules:
- Include the FULL plan text, not just diffs
- Mark each change with inline comment: `<!-- AGENT: {reason} -->`
- If verdict = PLAN_ACCEPTABLE, include original plan unchanged
- Preserve original markdown structure
- Do NOT add steps or scope beyond your findings — only correct existing content
- Add `"refined_plan_included": true` to your JSON in Structured Data section

## Focus Areas
{focus_areas}

Default areas (when no focus filter applied):
- **feasibility** — Are proposed changes realistic given the codebase? Do referenced files/APIs exist?
- **completeness** — Missing steps? Unhandled edge cases? Dependencies not accounted for?
- **implementation_order** — Is the sequence correct? Foundation before consumers?
- **scope_creep** — Does the plan stay within the original request? Unnecessary additions?
- **risk** — What could break? Side effects on existing code? Rollback difficulty?
- **architecture** — Does the plan fit existing project architecture? Correct layers, established patterns, module boundaries respected?
- **duplication** — Does the plan reinvent solutions already existing in the codebase? Utilities, shared modules, base classes that should be reused instead?
- **factual_accuracy** — Are technical claims correct? Library capabilities, API contracts, platform limitations verified against docs?

## alt_title
Approaches

## alt_extra
- Use area `implementation_order` for sequencing alternatives, `feasibility` for approach alternatives
- **Check internal codebase first** before suggesting external alternatives — reusing existing project code preferred over new dependencies
- Only suggest if genuinely confident alternative is better

## schema
verdict: PLAN_ACCEPTABLE | SUGGESTIONS
areas: feasibility | completeness | implementation_order | scope_creep | risk | architecture | duplication | factual_accuracy
suggestion_desc: Specific change to the plan
reason_desc: Why this improves plan quality
verdict_question: is the plan acceptable or are there suggestions?

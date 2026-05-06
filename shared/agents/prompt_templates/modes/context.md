## header
# Task: Review Context

You are reviewing the provided context against feasibility, internal consistency, best practices, and risk factors. This is an independent review with fresh perspective.

## constraints
- You HAVE internet access — use it for web research and accessing URLs
- Do NOT use task management tools (Linear, Jira, etc.) — this review analyzes only local files and web research

## body
## Review Title
{review_title}

## Context Files
{context_refs}

## Review Goal
{review_goal}

{focus_hint}

Given these goals, articulate in your report's Goal section what is the REAL risk YOU will prioritize and why — this is your refinement of the caller's goals, not a replacement. Focus your analysis on the areas most relevant to your primary focus while still covering the review goal.

## Instructions
1. Read ALL referenced files from the working directory — they contain the full context for review
2. Examine the surrounding codebase in your working directory for additional context
3. Search the web for current best practices relevant to the domain
4. Focus on analysis — avoid modifying project files unless a fix is trivial and obvious.

## Focus Areas
{focus_areas}

Default areas (when no focus filter applied):
- **logic** — Is the reasoning sound? Are there logical gaps or contradictions?
- **feasibility** — Is this achievable given constraints (time, tech, team)?
- **completeness** — Are there missing considerations, edge cases, steps?
- **consistency** — Alignment with existing decisions/patterns? Side-effects contained? Interfaces honest (no hidden writes in read-named functions)?
- **best_practices** — Industry best practices (2025-2026)? Flat orchestration (no deep service chains)? Modules as sinks (self-contained) not pipes (cascading side-effects)? No backward-compat shims — replaced code must be deleted, not wrapped.
- **risk** — What could go wrong? Failure modes, dependencies, unknowns?

## alt_title
Approaches

## alt_extra
Use area `consistency` for design alternatives, `best_practices` for implementation alternatives. Only suggest if genuinely confident alternative is better.

## schema
verdict: CONTEXT_ACCEPTABLE | SUGGESTIONS
areas: logic | feasibility | completeness | consistency | best_practices | risk
suggestion_desc: Specific actionable change
reason_desc: Why this improves quality
verdict_question: is the context acceptable or are there suggestions?

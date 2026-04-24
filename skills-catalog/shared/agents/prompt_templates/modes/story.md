## header
# Task: Review Story and Tasks

You are reviewing a validated Story and its implementation Tasks against the actual codebase and industry best practices. This is an independent review with fresh context.

## constraints
- You HAVE internet access — use it for Linear and web research

## body
## Story
{story_ref}

## Tasks
{task_refs}

## Review Goal
{review_goal}

{focus_hint}

Given these goals, articulate in your report's Goal section what specific risk YOU will prioritize and why — this is your refinement of the caller's goals, not a replacement. Focus your analysis on the areas most relevant to your primary focus while still covering the review goal.

## Research Focus Areas
When reviewing technical decisions, validate against:
- Industry standards (RFC, OWASP, OpenAPI) — Story references specific standard numbers?
- Library versions — pinned and current (LTS preferred)?
- Architecture patterns — matches domain-standard patterns?
- Source quality: official docs > vendor docs > community. Avoid blog posts > 2 years old.

## Instructions
1. Access the Story and Tasks using the references above (Linear URLs or local file paths)
2. If you cannot access Linear — use local alternatives: check `docs/tasks/` directory, `git log`, `git diff`, README.md. Produce your review based on available information. Note what you could not access in your output.
3. Examine the actual codebase in your working directory
4. Search the web for current best practices relevant to the technical domains
5. Compare Story/Tasks against:
   - Current code structure and patterns
   - Industry best practices (2025-2026)
   - Technical feasibility of proposed implementation
6. Focus on analysis — avoid modifying project files unless a fix is trivial and obvious.

## Internal Reuse Check
Before evaluating external alternatives, search the codebase for:
- Utilities, helpers, or shared modules that already solve what the Tasks propose to build
- Patterns established elsewhere in the project that Tasks should follow
- Existing abstractions (base classes, middleware, hooks) Tasks could extend rather than duplicate
If found, report under area `duplication` with file paths and function/class names.

## Focus Areas
- Are Tasks achievable given the current codebase?
- Do Tasks reference correct files/modules/patterns from the code?
- Are alternative approaches considered? (see Alternative Solutions section below)
- Missing considerations (security, performance, edge cases)?
- **Library utilization:** Do Tasks plan to build something the project's existing dependencies already provide? Check manifest files (package.json, requirements.txt, etc.) against Task Implementation Plans.
- **Clean code:** Do Tasks include cleanup of replaced code? No backward-compat shims, no legacy wrappers left behind. See `shared/references/clean_code_checklist.md` Replacement Rule.

## Risk Analysis
Evaluate implementation risks that could cause production incidents:
- **Breaking changes:** API contracts, DB schema, client compatibility
- **Data loss:** Destructive operations without safeguards (soft-delete, backups)
- **Failure modes:** What happens when dependencies fail (timeout, unavailable, corrupt response)
- **Rollback difficulty:** Can deployment be reverted safely? Irreversible migrations?
- **Dependency risks:** Single points of failure, version pinning, unsupported libraries
- **Production edge cases:** Concurrency, race conditions, resource exhaustion, unexpected input

## alt_title
Solutions

## alt_extra
Use area `architecture` for design alternatives, `best_practices` for implementation alternatives. Only suggest if genuinely confident alternative is better.

## schema
verdict: STORY_ACCEPTABLE | SUGGESTIONS
areas: security | performance | architecture | feasibility | best_practices | risk_analysis
suggestion_desc: Specific change to Story or Tasks
reason_desc: Why this improves execution quality
verdict_question: is the story acceptable or are there suggestions?

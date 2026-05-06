# Structural Review Dimensions (D1-D11)

<!-- DO NOT add here: Workflow phases -> ln-162-skill-reviewer SKILL.md -->
<!-- Contract source: references/skill_contract.md -->

Check ALL dimensions across ALL skills in scope. Phase 2 failures are pre-verified -- include directly.

## D1: Flow Integrity
- Every `ln-NNN` reference in workflow/worker tables points to existing `ln-NNN-*/SKILL.md`
- No circular delegation loops (A -> B -> A)
- Every worker invocation targets a real skill with compatible responsibility boundaries
- No dead-end flows (delegation to worker with no output/return path)
- Peer coordinators (L2 siblings under same L1) do not reference each other
- Peer workers (L3 siblings under same L2) do not reference each other

## D2: Cross-Reference Consistency
- `MANDATORY READ` paths exist on disk (Glob each path)
- `Reference Files` section paths exist on disk
- L3 workers stay caller-agnostic: no `Coordinator`, `Parent`, or required caller declaration
- Skill invocation names (`skill: "ln-NNN-*"`) match actual directory names
- No passive file references (`See`, `Per`, `Follows` pointing to files) -- must be `**MANDATORY READ:** Load`
- Multiple `**MANDATORY READ:**` in same section -> group into ONE block at section start
- `> **Paths:**` note present after frontmatter if SKILL.md contains any file references

## D2b: Execution Proximity

Imperative actions in workflow steps (Launch, Run, Execute, Call) that depend on specific tool syntax (CLI flags, API signatures, file format patterns) MUST include an **inline command template** at the point of use — not only in a MANDATORY READ reference.

**Rationale:** Agents may skip MANDATORY READ and "guess" the syntax. Inline template prevents this while MANDATORY READ provides full documentation.

**Check:** For each workflow step containing an imperative action + reference to a shared tool:
- Step mentions `agent_runner`, `Skill(`, `Bash`, or external CLI → inline code block with exact command MUST be within 5 lines
- Step says "per {reference}" for execution syntax → inline template or example required

**Severity:** WARN (not FAIL) — advisory, but high-impact for correctness.

## D3: Duplication
- Same instructions/rules not repeated across multiple skills
- Shared logic lives in `references/`, skill-specific in SKILL.md (SRP)
- No copy-pasted blocks that should be a MANDATORY READ to a shared file

## D4: Contradiction Detection
- Thresholds (confidence, impact, scores) consistent across related skills
- Status transitions consistent (who sets which status)
- Rules about same concept do not conflict between caller and callee
- Verdict names and categories match across prompt templates, workflows, SKILL.md files
- MCP primary/fallback ordering is consistent with `references/mcp_applicability_matrix.md`

## D5: Context Economy
- No large inline blocks that could be conditional MANDATORY READs
- Metadata in table format where possible
- No verbose explanations where table/list suffices
- No filler words: "simply", "quickly", "easily", "on top of that", "in many cases"
- No AI vocabulary: "Additionally", "Furthermore", "Moreover", "testament", "landscape", "showcasing", "leverage", "utilize", "foster", "streamline", "delve", "tapestry", "multifaceted", "serves as", "functions as", "stands as". Use: "also", "shows", "use", "help", "explore", "is", "has"
- Passive voice where active is clearer ("File should be loaded" -> "Load file")
- Sentences over 25 words -- flag for splitting
- Verbose phrases not applied from `references/concise_terms.md` ("in order to" -> "to", "make sure that" -> "ensure")
- Every content block must enable a specific agent action or decision -- remove if agent behavior unchanged without it
- Tables must add information beyond adjacent text -- no restating
- 1:1 mapping tables (each row = one input -> one output, no conditions) -> convert to inline list
- Tables echoing template section names/structure -> reference template, don't duplicate
- **Tiebreaker re-read:** re-read the WHOLE skill end-to-end (not just changed sections). If same instruction can be expressed in fewer words without losing agent actionability -- compress. Apply `code_efficiency_criterion` tiebreaker to skill text: among equivalent formulations, choose shorter
- **Post-fix holistic pass:** after Phase 5 fixes, re-scan entire SKILL.md for cross-section redundancies introduced by fixes -- merge duplicate rules, combine overlapping tables, deduplicate restated instructions. Category: SIMPLIFY

## D6: Stale Artifacts
- No references to removed/renamed skills or files
- No outdated caller names (skill renamed but old name in callers)
- No instructions about features that no longer exist
- No placeholder/TODO markers left from previous edits

## D7: Structural Compliance
- YAML frontmatter has `name` and `description` fields
- If `description` contains `:`, wrapped in double quotes
- `**Version:** X.Y.Z` and `**Last Updated:** YYYY-MM-DD` present at end of file
- No `**Changes:**` section exists
- Files in `references/` are actually referenced from SKILL.md (no orphan reference files)
- `## Definition of Done` section present (all skills -- L1, L2, L3) with items as checkboxes (`- [ ]`)
- `## Meta-Analysis` phase present with `MANDATORY READ` to `references/meta_analysis_protocol.md` (L1 orchestrators and L2 coordinators only)
- Publishing skills (contain `gh api graphql.*mutation` or `gh issue comment`) must have: a Fact-Check phase AND `MANDATORY READ` to `references/humanizer_checklist.md`
- Skills that edit code/config/scripts must load `references/mcp_tool_preferences.md` and make `hex-line` primary
- Skills that depend on semantic code reasoning must load `references/mcp_tool_preferences.md` plus `references/mcp_integration_patterns.md` and make `hex-graph` primary
- Skills in non-code or non-semantic families must not cargo-cult `hex-graph` or `hex-line` requirements without a real workflow need
- Wrong MCP namespaces (`mcp__hex_graph__...`) are FAIL, not WARN

## D8: Architecture Conformance
- SKILL.md <= 800 lines total
- Frontmatter `description` <= 200 chars
- Phase/step numbering sequential (1, 2, 3, 4 -- no gaps). Exception: 4a/4b for CREATE/REPLAN
- Orchestrators (L1/L2) delegate work, not execute directly -- no detailed implementation logic
- Workers (L3) execute, not decide workflow -- no routing/priority logic
- Workers (L3) do not declare `Coordinator`, `Parent`, or peer-skill coupling in their public contract text
- L2->L2 cross-category delegation follows forward-flow (0XX->1XX->...->6XX), except 0XX shared services
- Coupling reduction in `shared/` files -- shared references describe patterns, NOT consumers. Forbidden in any form: `Used by`, `Skills using this:`, `For ln-NNN`, `via ln-NNN` suffixes, skill names in role descriptions, skill IDs in code examples. Use generic role names (`task executor`, `review worker`). Consumers reference shared via MANDATORY READ; reverse direction is never needed


## D8b: Worker Invocation Enforcement (L1/L2 only)

L1 orchestrators and L2 coordinators that delegate to workers MUST have all three:

| Required Element | Pattern to Grep | Where |
|-----------------|----------------|-------|
| Explicit invocation code | `Skill(skill:` or `Agent(description:.*Skill(skill:` | Per-worker in workflow section |
| Worker Invocation section | `## Worker Invocation (MANDATORY)` | Dedicated section |
| TodoWrite tracking | `TodoWrite format (mandatory):` | Near Worker Invocation section |

**Detection:** Skill is L1/L2 if `Type:` line contains `L1` or `L2`, or SKILL.md has a Worker Invocation table referencing other `ln-NNN` skills.

**Check:** For each L1/L2 skill with worker references:
1. Count distinct `ln-NNN` skills in worker/delegation tables
2. Count `Skill(skill: "ln-NNN` code blocks in workflow
3. If worker count > invocation count → FAIL: workers described but not explicitly invoked
4. If no `Worker Invocation (MANDATORY)` section → FAIL
5. If no `TodoWrite format (mandatory)` → WARN

**Why:** Without explicit `Skill()` code blocks, agents "forget" to invoke workers and execute their logic inline. This is a recurring failure pattern in coordinators.

## D9: Pattern Compliance (conditional -- `ln-6*` audit skills only)
- References `references/two_layer_detection.md` via MANDATORY READ
- Scoring formula consistent: `penalty = (C*2.0) + (H*1.0) + (M*0.5) + (L*0.2)`
- Report structure follows `references/templates/audit_worker_report_template.md`

## D10: Cross-Skill Behavioral Contracts

When a primary skill changes its behavioral contract (fast-track matrix, dispatch pattern, input/output format), verify ALL skills it delegates to or receives delegation from have compatible contracts.

- **Dispatch consistency:** If skill A's Worker Invocation table says "invoke ln-B via Skill tool" -- verify ln-B is actually designed for inline invocation (not Agent-only). Read Worker Invocation tables in both skills
- **Fast-track cascade:** If skill A has a fast-track matrix that skips/modifies sub-skill behavior -- verify each sub-skill's SKILL.md supports that modified behavior. Example: if ln-500 says "ln-520 RUN simplified" -- verify ln-520 has a `--simplified` input
- **Input contract compatibility:** If skill A delegates to B with specific args -- verify B's Inputs table accepts those args. If B has prerequisites -- verify A's state satisfies them when calling B
- **Status transition ownership:** If multiple skills can set the same kanban status -- verify exactly ONE is the designated writer (no conflicts, no gaps)

## D11: Resource Lifecycle Integrity

For skills that manage shared resources (worktrees, branches, `.hex-skills/pipeline/` state, `.hex-skills/agent-review/` files):

- **Creator-User-Cleaner chain:** Trace who creates, who uses, who cleans up each resource. Verify no gaps (resource created but never cleaned) or conflicts (cleanup while still in use)
- **Inline vs Isolated execution:** If a skill may run both as Skill (inline) and as Agent (isolated), verify resource operations work in both modes. Example: `git worktree remove` fails if CWD is inside the worktree
- **Checkpoint contract:** If a skill writes checkpoints -- verify the recovery consumer reads the same fields. If fields are added/removed -- verify both sides match

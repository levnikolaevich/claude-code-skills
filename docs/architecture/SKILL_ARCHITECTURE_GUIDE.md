# Skill Architecture Guide

**Maintainer reference for designing and refactoring skills in this repository**

<!-- SCOPE: Maintainer-only reference for skill architecture, hierarchy, delegation, token efficiency, and red flags. Not a runtime dependency for skills. -->

`SKILL.md` files and `ln-162` must not depend on `docs/` meta files at runtime.

Enforceable rules live in:
- `skills-catalog/shared/references/skill_contract.md`
- root `AGENTS.md`
- skill-local `references/` files where needed

Use this guide for:
- design rationale
- split vs combine decisions
- delegation heuristics
- token-efficiency heuristics
- anti-pattern detection

---

## How to Use This Guide

Read in this order when working on skills:
1. `skills-catalog/shared/references/skill_contract.md`
2. root `AGENTS.md`
3. this guide for design decisions and tradeoffs

Rule of thumb:
- if a rule must be machine-enforced, put it in `shared/references/`
- if a rule explains why the contract exists, keep it here

---

## Current Repo Model

### Core Principles

| Principle | Meaning |
|-----------|---------|
| **Map-first** | Keep entrypoints small and routing-oriented |
| **Progressive disclosure** | Load details only when the next decision needs them |
| **Single source of truth** | Put enforceable rules in shared refs, not scattered prose |
| **Top-down ownership** | Coordinators know workers; workers do not encode ownership hierarchy back upward |
| **Token efficiency** | Remove duplicated prose and keep only action-relevant detail |

### Skill Layers

| Layer | Role | Default Behavior |
|------|------|------------------|
| **L0** | Sequential repo-level workflow | Chains major capabilities |
| **L1** | Top orchestrator | Owns major workflow routing |
| **L2** | Domain coordinator | Owns one domain and delegates focused work |
| **L3** | Worker | Executes one focused responsibility |

Use the lowest layer that can solve the problem cleanly.

---

## Orchestrator and Worker Design

### Responsibility Split

| Component | Should Do | Should Not Do |
|-----------|-----------|---------------|
| **L1/L2 orchestrator** | discover context, route work, delegate, own retries and loops | execute detailed domain work inline |
| **L3 worker** | load the needed detail, execute a focused task, return results | own global routing, define parent hierarchy, orchestrate peers |

### Worker Independence

Workers should remain standalone-invocable.

That means:
- no `**Coordinator:**`
- no `**Parent:**`
- no peer-worker dependency wording in the public contract
- no reverse ownership documentation requirement

The old pattern "document the relationship in both SKILL.md files" is no longer correct for worker boundaries.

### L2 -> L2 Delegation

Default:
- prefer `L2 -> L3`
- keep `L2 -> L2` rare

Allow `L2 -> L2` only when all are true:
- the domains are genuinely different
- the flow stays acyclic
- the downstream coordinator owns a later or separate concern
- the handoff improves clarity more than it increases coupling

Defaults for execution:
- sequential is the safe default
- parallel is acceptable only for independent branches with no shared mutable state and no ordering dependency

---

## Skill vs Agent Delegation

### Tool Selection

| Use | When |
|-----|------|
| **Skill** | shared context matters and the worker should see current thread state |
| **Agent** | isolation matters more than shared context, or the task is heavy, long-running, or easier to review as a separate result |

Short version:
- **Skill for coordination**
- **Agent for isolation**

### Execution Guidance

| Pattern | Good Fit | Risk |
|---------|----------|------|
| **Direct Skill()** | shared planning, shared repo context, deterministic worker calls | worker logic may bloat caller if boundaries are unclear |
| **Agent(... Skill())** | isolated implementation, large reviews, heavy scans, long loops | overhead if used for trivial work |

---

## Splitting Heuristics

These are repo heuristics, not universal laws.

### Healthy Targets

| Signal | Healthy Default |
|--------|-----------------|
| `SKILL.md` size | under 800 lines |
| Description length | under 200 characters |
| Major workflow phases | usually 3-4 |
| Shared refs | only when they reduce real duplication |

### Split a Skill When

- the skill has more than one real responsibility
- the caller needs to route between substantially different behaviors
- one section is reusable by multiple orchestrators
- the file keeps growing because of unrelated branches
- the workflow mixes routing logic with domain execution

### Keep One Skill When

- the behavior serves one clear job
- the workflow is linear and compact
- splitting would create wrappers with little real separation
- the same context and tools are needed throughout

---

## Writing Guidance for `SKILL.md`

### What Good Skill Writing Looks Like

| Pattern | Why It Helps |
|---------|--------------|
| table-oriented metadata | cheaper to scan than long prose |
| imperative workflow steps | easier for agents to execute |
| short direct sentences | lowers context cost and ambiguity |
| `MANDATORY READ` only for execution-critical files | keeps context minimal and intentional |
| detail in `references/` | prevents giant monolithic skills |

### Writing Defaults

- use active voice
- prefer short paragraphs and compact tables
- remove filler words
- avoid repeating the same rule in multiple sections
- keep local examples only when they prevent a real mistake

Use `skills-catalog/shared/concise_terms.md` for wording cleanup.

### What Not to Do

- do not turn the skill into a large essay
- do not restate shared rules already enforced elsewhere
- do not leave passive "see file" references where execution depends on the file
- do not copy template structure tables into every skill when a shared ref can own them

---

## Red Flags

| Red Flag | Why It Matters | Preferred Fix |
|----------|----------------|---------------|
| `SKILL.md` keeps growing beyond 800 lines | likely more than one responsibility | split or move detail to refs |
| worker defines parent or coordinator | reverse coupling | remove ownership wording |
| caller describes workers but never invokes them explicitly | agents tend to inline logic | add `Skill()` blocks and Worker Invocation section |
| same threshold or rule repeated in many skills | drift risk | move to shared ref |
| giant inline instructions that are rarely needed | context waste | move to conditional shared ref |
| stale platform/runtime references | agent confusion | update or delete immediately |
| giant root map or giant skill manual | crowds out task context | keep map-first and route outward |

---

## Review Checklist

### Skill Contract Check

- [ ] Structure matches `shared/references/skill_contract.md`
- [ ] Paths and `MANDATORY READ` usage are correct
- [ ] Delegation is explicit where required
- [ ] Worker independence is preserved
- [ ] No stale or unsupported runtime assumptions remain

### Design Check

- [ ] The skill has one clear job
- [ ] The chosen layer is appropriate
- [ ] `Skill` vs `Agent` choice is justified
- [ ] Shared refs reduce duplication instead of adding indirection
- [ ] File size and workflow shape still fit the responsibility

### Writing Check

- [ ] The skill is easy to scan
- [ ] Tables replace verbose prose where useful
- [ ] Sentences are short and direct
- [ ] Repeated instructions have been merged or removed

---

## Migration Notes

After changing structure, paths, or repo conventions, verify:
- `ln-162-skill-reviewer`
- `skills-catalog/shared/references/skill_contract.md`
- `.claude/commands/review-skills.md`
- any repo-level docs that route maintainers to the changed contract

Typical migration risks:
- stale hardcoded paths
- duplicated contract rules between docs and shared refs
- checks still assuming old hierarchy or old directory layout

---

## External Alignment

This guide is intentionally aligned with current agent-engineering practice:
- short routing entrypoints instead of giant manuals
- progressive disclosure
- specialized workers with clean contracts
- enforceable shared rules rather than prose-only guidance
- OODA-inspired evaluation patterns: evidence classification (`evidence_basis`), research freshness, merge priority rules, feedback loops between quality gate and executor
- separate specialized systems (audit vs evaluation) bridged by shared envelope fields rather than monolithic unification (per DORA, AWS Well-Architected, SARIF patterns)

Useful official references:
- Anthropic memory and context management
- Anthropic subagents guidance
- OpenAI guidance to give the agent a map, not a giant manual

This file stays at the design-rationale layer. Runtime truth belongs in shared refs.

---

**Version:** 2.0.0
**Last Updated:** 2026-03-26

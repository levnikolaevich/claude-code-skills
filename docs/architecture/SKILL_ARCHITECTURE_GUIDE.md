# Skill Architecture Guide

**Maintainer reference for designing and refactoring skills in this repository**

<!-- SCOPE: Maintainer-only reference for skill architecture, hierarchy, delegation, token efficiency, and red flags. Not a runtime dependency for skills. -->

`SKILL.md` files and `ln-162` must not depend on `docs/` meta files at runtime.

Enforceable rules live in:
- `shared/references/skill_contract.md`
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
1. `shared/references/skill_contract.md`
2. root `AGENTS.md`
3. this guide for design decisions and tradeoffs

Rule of thumb:
- if a rule must be machine-enforced, put it in `shared/references/`
- if a rule explains why the contract exists, keep it here

---

## Current Repo Model

### Plugin-First Layout

The repository is built around installable plugin bundles. There is no separate flat skill source tree.

| Path | Purpose | Edit Policy |
|------|---------|-------------|
| `plugins/<plugin>/skills/<skill>/SKILL.md` | Real skill entrypoint used by Claude and Codex | Edit here |
| `plugins/<plugin>/skills/<skill>/references/` | Skill-local supporting files and generated shared copies | Edit only single-skill files here |
| `plugins/<plugin>/skills/<skill>/references/scripts/` | Skill-local executable helpers and CLIs | Edit here when only one skill needs it |
| `plugins/<plugin>/skills/<skill>/references/templates/` | Skill-local templates, service units, timers, and stubs | Edit here when only one skill needs it |
| `plugins/<plugin>/skills/<skill>/references/agents/` | Skill-local agent prompts, runners, and schemas | Edit here when only one skill needs it |
| `shared/` | Canonical source for files reused by 2+ skills | Edit here, map in `tools/marketplace/shared-registry.json`, then sync |
| `tools/marketplace/` | Marketplace validation and shared registry distribution tooling | Edit only when marketplace structure changes |

Claude Code reads the root `.claude-plugin/marketplace.json` marketplace catalog. Codex reads `.agents/plugins/marketplace.json` and each `.codex-plugin/plugin.json`. Both point at the same `plugins/<plugin>` bundles.

Do not add `plugins/<plugin>/.claude-plugin/marketplace.json`. A plugin root may contain `.claude-plugin/plugin.json` later if Claude-specific plugin metadata becomes necessary, but nested marketplaces are not part of the repository model.

Codex structure rules are enforced by `tools/marketplace/validate.mjs`:
- `.agents/plugins/marketplace.json` and `.claude-plugin/marketplace.json` must use the same marketplace id and plugin names.
- each Codex marketplace entry uses `source.source: "local"` and `source.path: "./plugins/<plugin>"`.
- each Codex marketplace entry declares `policy.installation`, `policy.authentication`, and `category`.
- each plugin root has `.codex-plugin/plugin.json` with `name` matching the plugin folder and `skills: "./skills/"`.
- the directories under `plugins/<plugin>/skills/` must match the root Claude marketplace skill list exactly.

### Development Workflow

Use this order when changing skills or shared resources:

1. Edit the target skill under `plugins/<plugin>/skills/<skill>/`.
2. If the change is reusable by 2+ skills, move the reusable source to root `shared/`.
3. Add or update its exact targets in `tools/marketplace/shared-registry.json`. Skills must reference only their own `references/...` files at runtime.
4. Run `node tools/marketplace/shared.mjs sync` after any root `shared/` or registry change. This refreshes every registry-listed skill-local `references/` copy.
5. Run validation before considering the change done:

```bash
node tools/marketplace/shared.mjs validate
node tools/marketplace/validate.mjs
claude plugin validate .
```

Do not hand-edit registry-generated copies under skill `references/`; edit root `shared/` and run sync. If a generated copy differs, fix root `shared/` and run the sync command. `node tools/marketplace/validate.mjs` fails on shared registry drift, missing plugin manifests, removed-path references, and invalid plugin-local skill paths.

### Shared Resource Rules

| Case | Put It Here | Reason |
|------|-------------|--------|
| Used by one skill only | `plugins/<plugin>/skills/<skill>/references/` | Keeps plugin bundle local and avoids broad coupling |
| Used by several skills in one plugin | root `shared/` plus registry targets | Same consistency rule regardless of plugin boundary |
| Used by multiple plugins | root `shared/` | One source of truth with hash-validated skill-local copies |
| Needed at runtime by installed plugins | root `shared/`, registry target, then sync into skill-local `references/` | Marketplace installs plugin bundles, so snapshots must contain the same files |
| Temporary run state or generated artifacts | `.hex-skills/`, `.agent-review/`, `.cache/`, `dist/`, `node_modules/` | Ignored local artifacts; do not commit |

When adding a new shared file, prefer small, named references over large manuals. A shared file should remove real duplication or define an enforceable contract. If it only explains rationale for maintainers, keep it in `docs/`.

Inside a skill, supporting files are organized by runtime type:
- flat `references/*.md`, `*.json`, `*.toml` for docs, contracts, schemas, and small config examples.
- `references/scripts/` for executable helpers and CLIs (`.mjs`, `.js`, `.sh`, `.ps1`, `.py`).
- `references/templates/` for templates, service files, timers, and generated-file stubs.
- `references/agents/` for agent prompts, runners, and schemas.
- `references/fixtures/` for test/example inputs and outputs.
- `references/assets/` for non-text assets.

### Core Principles

| Principle | Meaning |
|-----------|---------|
| **Map-first** | Keep entrypoints small and routing-oriented |
| **Progressive disclosure** | Load details only when the next decision needs them |
| **Single source of truth** | Put enforceable rules in shared refs, not scattered prose |
| **Top-down ownership** | Coordinators know workers; workers do not encode ownership hierarchy back upward |
| **Token efficiency** | Remove duplicated prose and keep only action-relevant detail |
| **Loop-aware retries** | Keep lifecycle status separate from `loop_health`; repeated attempts need new evidence |
| **SOP/TWI execution** | Procedural steps carry action, key point, why, evidence, exception, and guard at point of use |

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

`Skill(skill: "...", args: "...")` is the canonical delegation notation across hosts. Claude executes it through the native Skill tool. Codex has no equivalent tool call, so delegator skills must include the host bridge: locate the named skill in the available skill list, read its `SKILL.md`, pass `args` as `$ARGUMENTS`, execute the workflow, then return to the caller with the result or artifact.

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
| point-of-use risk checklists | prevents skipped critical steps when progressive disclosure hides later sections |
| step -> key point -> why | makes risky instructions harder to bypass or reinterpret |
| short direct sentences | lowers context cost and ambiguity |
| `MANDATORY READ` only for execution-critical files | keeps context minimal and intentional |
| detail in `references/` | prevents giant monolithic skills |

### Writing Defaults

- use active voice
- prefer short paragraphs and compact tables
- remove filler words
- avoid repeating the same rule in multiple sections
- keep local examples only when they prevent a real mistake

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
| caller describes workers but never invokes them explicitly | agents tend to inline logic | add `Skill()` blocks, host bridge, and Worker Invocation section |
| same threshold or rule repeated in many skills | drift risk | move to shared ref |
| retries are driven only by lifecycle status | retry storms and same-error loops | use `shared/references/loop_health_contract.md` |
| final DoD carries all safety checks | agents may miss point-of-use risks | colocate SOP/TWI checklist at the risky step |
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
- [ ] Retry loops use `loop_health` evidence instead of lifecycle status alone
- [ ] File size and workflow shape still fit the responsibility

### Writing Check

- [ ] The skill is easy to scan
- [ ] Tables replace verbose prose where useful
- [ ] Sentences are short and direct
- [ ] Repeated instructions have been merged or removed
- [ ] Procedural risky steps include point-of-use action/key point/why/evidence/exception/guard

---

## Migration Notes

After changing structure, paths, or repo conventions, verify:
- `ln-162-skill-reviewer`
- `shared/references/skill_contract.md`
- `.claude/commands/review-skills.md`
- `tools/marketplace/validate.mjs`
- `tools/marketplace/shared.mjs`
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

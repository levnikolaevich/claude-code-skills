# Skill Contract

<!-- SCOPE: Canonical shared contract for SKILL.md files in this repository. Contains enforceable structure, delegation, and coupling rules. -->

This file is the runtime source of truth for `SKILL.md` requirements.

Use it for:
- creating new skills
- reviewing or refactoring existing skills
- enforcing rules in `ln-162-skill-reviewer`

Do not rely on `docs/` meta files for runtime enforcement. Those files are maintainer references only.

---

## Goal

Every `SKILL.md` must be:
- executable by an agent without guessing
- small enough to stay context-efficient
- explicit about delegation and boundaries
- free of reverse coupling and stale instructions

---

## Required Structure

Every `SKILL.md` must include:
- YAML frontmatter with `name` and `description`
- `> **Paths:**` note after frontmatter if the file references local paths
- `**Type:**` line as the canonical role marker for review and delegation logic
- `## Definition of Done` with `- [ ]` checkboxes
- `**Version:** X.Y.Z` and `**Last Updated:** YYYY-MM-DD` at the end

Forbidden:
- `**Changes:**` sections
- passive local file references such as `See`, `Per`, `Follows` instead of `**MANDATORY READ:** Load`

`**Type:**` rules:
- reviewers and coordinators use it to classify the skill as L1/L2/L3 and orchestrator/coordinator/worker
- a missing `**Type:**` is a structural contract violation, not a style nit
- reviewers may infer likely role only to improve diagnostics; inference does not replace the required field

Description rules:
- keep under 200 characters
- say WHAT the skill does and WHEN to use it
- if `description:` contains `:`, wrap it in double quotes

---

## Path and Reference Rules

Path resolution:
- relative paths in `SKILL.md` are relative to the skills repo root
- not relative to the target project

Reference rules:
- file references that matter for execution must use `**MANDATORY READ:** Load ...`
- do not rely on `@path` imports as the execution contract for `SKILL.md`; use explicit `**MANDATORY READ:** Load ...` for any file the agent must read before acting
- group multiple `MANDATORY READ` targets into one block at the section start
- move reusable logic to `shared/references/`
- keep skill-specific logic in the local `SKILL.md` or local `references/`

---

## Delegation Rules

### L1 / L2 skills

If a skill delegates to workers, it must include all three:
- explicit invocation code using `Skill(skill:` or `Agent(... Skill(skill: ...))`
- `## Worker Invocation (MANDATORY)`
- `TodoWrite format (mandatory):`

Defaults:
- prefer `Skill` when shared context matters
- prefer `Agent` when isolation matters more than shared context
- prefer L2 -> L3 delegation over L2 -> L2 delegation
- L2 -> L2 is allowed only when domains are distinct, the graph stays acyclic, and the flow is justified
- sequential orchestration is the default; parallel branches are allowed only when they are independent and do not share mutable state or ordering requirements

### L3 workers

Workers must stay standalone-invocable.

Forbidden in worker contract text:
- `**Coordinator:**`
- `**Parent:**`
- required caller declarations
- peer-worker cross-references as part of the public contract

Workers may mention external skills only when describing accepted inputs or interoperable formats, not ownership hierarchy.

---

## Context Economy

Hard limits:
- `SKILL.md` <= 800 lines
- frontmatter `description` <= 200 characters

Required behavior:
- route heavy detail into `references/`
- keep workflow steps sequential and explicit
- use tables for compact metadata
- remove filler and duplicated prose
- prefer active voice

Heuristics, not hard law:
- 3-4 major workflow steps is usually a healthy ceiling
- if one skill keeps accumulating unrelated branches, split it

---

## Compliance Notes

Additional enforced rules:
- no hardcoded aggregate counts outside allowed locations
- no stale references to removed skills or files
- no deprecated platform APIs in active skills
- no contradictions between caller and callee contracts
- MCP usage must match `shared/references/mcp_applicability_matrix.md`
- skills that edit code/config/scripts must make `hex-line` primary and name built-in tools as fallback only
- skills that depend on semantic code reasoning must make `hex-graph` primary and name grep/read as fallback only
- skills without code-file or semantic-code decisions must not cargo-cult `hex-graph` requirements

Special cases:
- L1/L2 skills need Meta-Analysis with `shared/references/meta_analysis_protocol.md`
- publishing skills need their extra review requirements
- domain-specific families may add stricter shared contracts on top of this base contract

---

## Relationship to Maintainer Docs

`docs/architecture/SKILL_ARCHITECTURE_GUIDE.md` is a developer reference:
- rationale
- design heuristics
- anti-patterns
- examples

It is not the enforceable runtime contract for skills.

---

**Version:** 1.0.0
**Last Updated:** 2026-03-26

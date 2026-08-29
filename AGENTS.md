# Repository Instructions

This repository distributes standalone skills for Claude Code and Codex through a collection of small plugins.

## Structure

```text
plugins/<plugin>/
├── plugin.json
├── .codex-plugin/plugin.json
└── skills/<skill>/SKILL.md
```

Root `plugin.json` is the minimal portable Agent Plugins v1 manifest. `.codex-plugin/plugin.json` is the current OpenAI host adapter for richer metadata and component pointers. Claude Code discovers the shared `skills/` directories through `.claude-plugin/marketplace.json`; Codex uses `.agents/plugins/marketplace.json` and the host adapter. Do not add host-specific copies of a skill.

Keep portable manifests limited to the canonical Agent Plugins schema identifier and stable plugin `name`; optional version, description, and publisher metadata remain in the host adapter to avoid duplicated mutable metadata. Both names and the plugin directory must match. Add portable optional fields only when a concrete cross-client requirement justifies a new canonical owner and matching parity validation.

## Skill rules

- Edit the canonical skill only at `plugins/<plugin>/skills/<skill>/SKILL.md`.
- Keep each skill standalone. It must not require another skill, MCP server, task tracker, separately installed coordinator or worker, or shared runtime. A skill may require host-native independent contexts when that is intrinsic to its outcome and it defines an explicit `BLOCKED` result.
- Keep YAML frontmatter to `name` and `description`. The folder name and `name` must match.
- Put the trigger boundary in `description`: what the skill does, when to use it, and important near-negative cases.
- Begin each skill body, before tool routing, with `**Goal:**` defining its intended outcome and boundary and `**Execution contract:**` telling the agent how to apply the skill.
- In that execution contract, treat the ordered checkbox workflow as the skill's Definition of Done. Do not add a duplicate DoD section.
- Track every checkbox as `PENDING`, then resolve it to `PROVEN` with concrete evidence, `CLEARED` with evidence that its conditional trigger is absent, or `UNPROVEN`; only `PROVEN` and `CLEARED` count as complete, and no `PENDING` may remain at return.
- Require the execution contract to account for all checkboxes with `Checklist: X/Y complete` and an `Incomplete` list containing each skipped item's reason, outcome impact, and exact next action; apply the skill's own verdict, decision, and approval rules to incomplete items.
- Preserve evidence rules, tool-selection guidance, safety gates, verdict mapping, output contract, and residual-risk reporting when simplifying.
- Add `references/`, `scripts/`, or `assets/` only after a concrete execution defect shows that the instruction-only skill is insufficient.
- Treat each `SKILL.md` as the canonical operational document for its workflow: keep rules at the narrowest relevant section, remove filler and duplicated guidance, and avoid volatile values or copied implementation detail unless execution requires them and the authoritative source or update trigger is explicit.
- Prefer capability descriptions over vendor-specific tools. Every required capability needs a credible fallback or an explicit `BLOCKED` outcome.
- Keep skills in English and target 100–200 lines. Remove repetition before splitting a skill.
- Review and audit skills are read-only. Optimization skills may mutate only the user-approved scope and must retain or discard changes using measured evidence.
- Test planning and product discovery skills are read-only. Acceptance-test building may mutate only the approved test and test-documentation scope and must not repair product code.
- Architecture artifact skills may mutate only explicitly approved architecture documents and must not edit product code or tests, execute migrations, or change external systems.
- Skill review is read-only. Repository, release, and announcement publication may mutate only explicitly approved local and external scope and must preserve their approval gates.

## Index system

The first digit identifies the plugin; the second identifies the skill inside it:

- `1x` — review suite
- `2x` — codebase audit suite
- `3x` — optimization suite
- `4x` — testing suite
- `5x` — product discovery suite
- `6x` — maintainer suite
- `7x` — architecture suite

Allocate the next unused index inside the relevant plugin. A new plugin receives the next unused leading digit.

Each plugin can contain at most nine indexed skills. A tenth capability starts a new plugin unless an explicit index migration is approved.

## Validation

Before finishing a change:

1. Run `pwsh -File scripts/validate-repository.ps1`; it is the executable owner for repository structure, manifest and catalog parity, skill contracts, metadata limits, README and site coverage, local site links, and known retired paths.
2. Run the installed `skill-creator` `quick_validate.py` for every skill directory.
3. Run the installed `plugin-creator` `validate_plugin.py` for every plugin directory.
4. Run `claude plugin validate . --strict` for the Claude marketplace. This validates the catalog, not Claude skill frontmatter in manifest-less plugin directories; the per-skill validator and repository validator cover that known boundary.
5. Search for stale references to removed skills, MCP packages, shared registries, drafts, and orchestration harnesses that are not already encoded as known retired paths in the repository validator.

If an installed validator is unavailable, perform the equivalent checks manually: frontmatter contains only `name` and `description`; folder and frontmatter names match; descriptions are at most 200 characters; skills stay within the 100–200 line target; portable and host manifests parse and satisfy their contracts; both catalogs match; and no stale coupling remains.

## Release rules

- Explicit plugin SemVer lives only in `.codex-plugin/plugin.json`; the minimal portable manifest intentionally omits its optional `version` to preserve one mutable version owner. Claude marketplace entries also omit `version`, so Claude Code identifies ordinary updates by their source commit SHA.
- Change a version only when the user explicitly requests a release; ordinary repository edits do not bump versions.
- Record a release with a matching Git tag and GitHub Release. Document user-facing migration in `README.md`; a repository `CHANGELOG.md` is not required.

Do not update or add explicit versions unless the user requests a release.

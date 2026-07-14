# Repository Instructions

This repository distributes standalone skills for Claude Code and Codex through six small plugins.

## Structure

```text
plugins/<plugin>/
├── .codex-plugin/plugin.json
└── skills/<skill>/SKILL.md
```

Claude Code discovers the standard `skills/` directories through `.claude-plugin/marketplace.json`. Codex uses `.agents/plugins/marketplace.json` and each `.codex-plugin/plugin.json`. Do not add host-specific copies of a skill.

## Skill rules

- Edit the canonical skill only at `plugins/<plugin>/skills/<skill>/SKILL.md`.
- Keep each skill standalone. It must not require another skill, an MCP server, a task tracker, or repository-wide shared instructions.
- Keep YAML frontmatter to `name` and `description`. The folder name and `name` must match.
- Put the trigger boundary in `description`: what the skill does, when to use it, and important near-negative cases.
- Treat the ordered checkbox workflow as the skill's Definition of Done. Do not add a duplicate DoD section.
- Require every output contract to account for all checkboxes with `Checklist: X/Y complete` and an `Incomplete` list containing each skipped item's reason, outcome impact, and exact next action; apply the skill's own verdict, decision, and approval rules to incomplete items.
- Preserve evidence rules, tool-selection guidance, safety gates, verdict mapping, output contract, and residual-risk reporting when simplifying.
- Add `references/`, `scripts/`, or `assets/` only after a concrete execution defect shows that the instruction-only skill is insufficient.
- Prefer capability descriptions over vendor-specific tools. Every required capability needs a credible fallback or an explicit `BLOCKED` outcome.
- Keep skills in English and target 100–200 lines. Remove repetition before splitting a skill.
- Review and audit skills are read-only. Optimization skills may mutate only the user-approved scope and must retain or discard changes using measured evidence.
- Test planning and product discovery skills are read-only. Acceptance-test building may mutate only the approved test and test-documentation scope and must not repair product code.
- Skill review is read-only. Repository, release, and announcement publication may mutate only explicitly approved local and external scope and must preserve their approval gates.

## Index system

The first digit identifies the plugin; the second identifies the skill inside it:

- `1x` — review suite
- `2x` — codebase audit suite
- `3x` — optimization suite
- `4x` — testing suite
- `5x` — product discovery suite
- `6x` — maintainer suite

Allocate the next unused index inside the relevant plugin. A new plugin receives the next unused leading digit.

Each plugin can contain at most nine indexed skills. A tenth capability starts a new plugin unless an explicit index migration is approved.

## Validation

Before finishing a change:

1. Run the installed `skill-creator` `quick_validate.py` for every skill directory.
2. Run the installed `plugin-creator` `validate_plugin.py` for every plugin directory.
3. Run `claude plugin validate . --strict` for the Claude marketplace.
4. Confirm both marketplace catalogs contain the same plugin names in the same order, every manifest path exists, and each plugin description matches its Claude marketplace entry.
5. Search for stale references to removed skills, MCP packages, shared registries, drafts, and orchestration harnesses.

If an installed validator is unavailable, perform the equivalent checks manually: frontmatter contains only `name` and `description`; folder and frontmatter names match; descriptions are at most 200 characters; skills stay within the 100–200 line target; manifests parse and point to existing paths; both catalogs match; and no stale coupling remains.

## Release rules

- Plugin versions live only in `.codex-plugin/plugin.json` and follow SemVer.
- Change a version only when the user explicitly requests a release; ordinary repository edits do not bump versions.
- Record a release with a matching Git tag and GitHub Release. Document user-facing migration in `README.md`; a repository `CHANGELOG.md` is not required.

Do not update or add explicit versions unless the user requests a release.

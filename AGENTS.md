# Repository Instructions

This repository distributes standalone skills for Claude Code and Codex through a collection of small plugins.

## Structure

```text
plugins/<plugin>/
├── plugin.json
├── .codex-plugin/plugin.json
├── skills/<skill>/SKILL.md
└── evals/<case>/          # maintainer behavioral evals; never loaded by skills
```

Root `plugin.json` is the minimal portable Agent Plugins v1 manifest. `.codex-plugin/plugin.json` is the current OpenAI host adapter for richer metadata and component pointers. Claude Code discovers the shared `skills/` directories through `.claude-plugin/marketplace.json`; Codex uses `.agents/plugins/marketplace.json` and the host adapter. Do not add host-specific copies of a skill.

Keep portable manifests limited to the canonical Agent Plugins schema identifier and stable plugin `name`; optional version, description, and publisher metadata remain in the host adapter to avoid duplicated mutable metadata. Both names and the plugin directory must match. Add portable optional fields only when a concrete cross-client requirement justifies a new canonical owner and matching parity validation.

## Skill rules

- Edit the canonical skill only at `plugins/<plugin>/skills/<skill>/SKILL.md`.
- Give every skill at least one behavioral eval case in `plugins/<plugin>/evals/<case>/`, in the `claude plugin eval` format, the default location the official evals documentation recommends. An explicit case prompt starts with `Use the <skill> skill.` and its `graders/skill-fired.md` names the same skill. Additional `discovery` cases use natural wording without a skill identifier and do not replace explicit coverage; `negative` discovery forbids activation and does not require a skill report verdict. Fixtures are offline and must tempt the boundary they grade; graders prove observable outcomes (files, tool calls, the exact verdict token) rather than self-reported success. Skills never reference eval assets.
- Keep each skill standalone. It must not require another skill, MCP server, task tracker, separately installed coordinator or worker, or shared runtime. A skill may require host-native independent contexts when that is intrinsic to its outcome and it defines an explicit `BLOCKED` result.
- Skill plugins ship instructions only: no mods, `hooks/` directories, or `hooks.json` files. Executable Claude Code tooling for maintainers lives only in the repository mod `.claude/skills/ln-maintainer/`; it is never distributed, never required by a skill, and never orchestrates agents (no agent spawning, prompt submission, model calls, or tool registration). CI validation and contract tests stay authoritative when the mod is off.
- Follow [SKILL_TEMPLATE.md](SKILL_TEMPLATE.md), the canonical owner of skill format, detailed checklist accounting, self-check, and common report blocks. Preserve individually verifiable obligations and skill-specific verdicts; validate standalone copies against the template.
- Preserve evidence rules, tool-selection guidance, safety gates, verdict mapping, output contract, and residual-risk reporting when simplifying.
- Keep common purpose, constraints, and routing in `SKILL.md`. Move substantial conditional detail into skill-local `references/` when it saves irrelevant reading; link each reference with its trigger and keep each rule in one owner. Add scripts or assets only for a concrete reliability or output need; do not create placeholders or a shared runtime.
- Treat each `SKILL.md` as the canonical operational document for its workflow: keep rules at the narrowest relevant section, remove filler and duplicated guidance, and avoid volatile values or copied implementation detail unless execution requires them and the authoritative source or update trigger is explicit.
- Prefer capability descriptions over vendor-specific tools. Every required capability needs a credible fallback or an explicit `BLOCKED` outcome.
- Apply the template's language and size limits without padding. Inspect word volume and repeated rules; remove repetition before splitting conditional detail.
- Preserve user intent and already-granted authorization within each skill's mutation boundary. Prepare a concrete result before required external approval; do not ask again for unchanged authorization. Run proportionate checks and repeat them only for new changes, failures, or unresolved evidence.
- Review and audit skills are read-only. Implementation skills may mutate only the user-approved scope and must retain or discard changes using measured evidence.
- Delivery/test planning, opportunity evaluation, operations investigation, and product outcome evaluation are read-only. Product requirements and interaction design may change only approved product/design artifacts. Acceptance-test building may mutate only the approved test and test-documentation scope and must not repair product code.
- Architecture artifact skills may mutate only explicitly approved architecture documents and must not edit product code or tests, execute migrations, or change external systems.
- Skill review is read-only. Repository, release, and announcement publication may mutate only explicitly approved local and external scope and must preserve their approval gates.

- Deployment engineering may modify only approved delivery files and explicitly authorized target environments; preparation, publication, deployment, and operational health are distinct outcomes.
- Model-specific guidance may improve triggers, intent handling and contextual routing; preserve detailed domain checklists, self-checks, evidence thresholds and the approved five-field report.
- Preserve requirement and decision identities across artifacts. Bind reused evidence to relevant revisions, dirty changes, configuration, environment, and observation windows; invalidate only affected conclusions. Continuation records belong in the response or an already-authorized artifact, not a mandatory state directory.
- Keep artifact readiness, verified behavior, external-action authority, publication, deployment health, and product impact distinct. Lifecycle order does not require running every skill; equivalent user or repository evidence is valid input.

## Public documentation and metadata

- Write `README.md` for users choosing and using skills: lead with their problem and the supported outcome, then task selection, installation, and the catalog. Keep authoring rules, validation commands, maintenance reminders, and internal approval history here or in the linked maintainer documents.
- Describe benefits supported by the workflows. Do not promise measured savings, comparative superiority, or guaranteed correctness without matching behavioral evidence.
- Do not hard-code changing inventory counts or statistics in README, repository descriptions, or plugin metadata, whether as digits or words. Derive any needed counts at execution time; identifiers, versions, and explicit contract limits are not inventory claims.
- Treat README and host catalogs as projections of the canonical sources below; update required copies together and validate parity. Do not introduce another metadata registry or host-specific skill body.
- [.github/repository-metadata.json](.github/repository-metadata.json) owns the GitHub About description, homepage, and topics. During authorized publication, sync the GitHub About fields and verify them remotely; editing the local file alone does not update GitHub.
- GitHub Pages publishes only a redirect generated from the canonical homepage by `.github/workflows/pages.yml`; keep project content on the external site.
- Describe only the current supported catalog. Do not retain previous-name mappings, obsolete skill URLs, migration archives, or redirects for removed plugins. Validate references against current canonical files rather than a historical registry.
- Use [docs/token-efficiency.md](docs/token-efficiency.md) for authoring and measurement guidance and [docs/behavioral-validation.md](docs/behavioral-validation.md) for observed-outcome checks. Model-guidance provenance belongs in [SKILL_TEMPLATE.md](SKILL_TEMPLATE.md). Local Claude development can load a plugin with `claude --plugin-dir ./plugins/<plugin>`. The repository mod `.claude/skills/ln-maintainer/` loads as `ln-maintainer@skills-dir` after workspace trust: it runs the repository validator after edits to contract-owning files and tells the model when it fails, shows each `ln-*` skill's Result verdict with its revision, and `/ln-evals` lists eval freshness. It is Claude Code-only convenience; set `pluginConfigs["ln-maintainer@skills-dir"].options.pwshPath` in user settings when `pwsh` is not on `PATH`, and disable it with `"ln-maintainer@skills-dir": false` in `.claude/settings.local.json`.

## Canonical ownership

| Information | Canonical owner | Derived or checked copies |
|---|---|---|
| Skill behavior, title, description | The skill's `SKILL.md` | README skill entries |
| Skill format, common execution/report blocks and reusable checks | `SKILL_TEMPLATE.md` | Standalone skill blocks checked by the repository validator |
| Plugin identity and membership | Canonical plugin/skill directories and the index rules below | Both catalogs and plugin manifests |
| Plugin display metadata and version | `.codex-plugin/plugin.json`; `description` owns its long form | `interface.longDescription`, Claude catalog and README |
| Repository description, homepage and topics | `.github/repository-metadata.json` | README project link, plugin homepages, applicable marketplace metadata and remote GitHub About |
| Repository maintenance and publication rules | `AGENTS.md` | `CLAUDE.md` imports it |

Within a skill, keep each rule at its narrowest operational owner. Required standalone copies are distribution copies, not independent authorities; references own conditional procedures and entrypoints specify when to load them.

## Index system

The first digit identifies the plugin; the second identifies the skill inside it:

- `1x` — product discovery suite
- `2x` — architecture suite
- `3x` — delivery planning suite
- `4x` — implementation suite
- `5x` — quality assurance suite
- `6x` — delivery suite
- `7x` — operations suite
- `8x` — skill maintenance suite
- `9x` — engineering foundation suite

Allocate the next unused index inside the relevant plugin. A new plugin receives the next unused leading digit.

Each plugin can contain at most nine indexed skills. A tenth capability starts a new plugin unless an explicit index migration is approved.

## Validation

Before finishing a change:

Keep checks tied to concrete failures: invalid distribution, contract drift, incomplete catalogs, or broken references. Do not test helper logic created only inside a test, duplicate the same guarantee, or enforce historical text and cosmetic markers.

1. Run `pwsh -File scripts/validate-repository.ps1`; it is the executable owner for repository structure, manifest and catalog parity, skill contracts, metadata limits, README coverage, and current local references.
2. Run the installed `skill-creator` `quick_validate.py` for affected skill directories and the installed `plugin-creator` `validate_plugin.py` for affected plugin directories. Run both across all directories when a common contract, shared validator, or distribution-wide change affects their guarantees.
3. Run `claude plugin validate . --strict` when the Claude marketplace or its distribution contract is affected. This validates the catalog, not Claude skill frontmatter in manifest-less plugin directories; the per-skill validator and repository validator cover that known boundary.
4. Search affected sources for unresolved references, MCP coupling, shared registries, drafts, and orchestration harnesses outside the supported standalone skill structure; expand to the repository for cross-cutting changes. The global repository validator still checks structure, catalogs, contracts, and references for every change. The maintainer mod is not a harness; its allowed API calls are checked in CI.
5. Run `pwsh -File scripts/test-repository-contracts.ps1` when its tests, the repository validator, or a tested contract changes. Run `pwsh -File scripts/test-codex-eval-runner.ps1` when its tests, the eval runner, or its tested evidence contract changes. When the maintainer mod changes, run `claude plugin validate .claude/skills/ln-maintainer --strict` and `claude plugin test .claude/skills/ln-maintainer`. Disposable fixtures verify rejection and evidence mapping, not agent performance.
6. Preserve all mandatory CI checks. Reuse passing local checks only with evidence matching the relevant revisions, dirty files, configuration, and environment; rerun affected checks after changes, failures, or unresolved evidence. A common contract, shared validator, or distribution-wide change requires the full applicable validator set.
7. When skill behavior or eval cases change, identify affected cases as [docs/behavioral-validation.md](docs/behavioral-validation.md) describes. Execute model evals only when explicitly requested, locally or through the manually triggered `Behavioral evals` workflow, never on every push; an unexecuted case is NOT RUN, not PASS.

If an installed validator is unavailable, manually check the template's format, naming, size, checklist, self-check and report contracts; verify manifest parsing/contracts, catalog and metadata parity, local references, and standalone boundaries.

## Release rules

- Explicit plugin SemVer lives only in `.codex-plugin/plugin.json`; the minimal portable manifest intentionally omits its optional `version` to preserve one mutable version owner. Claude marketplace entries also omit `version`, so Claude Code identifies ordinary updates by their source commit SHA.
- Change a version only when the user explicitly requests a release; ordinary repository edits do not bump versions.
- Record a release with a matching Git tag and GitHub Release; a repository `CHANGELOG.md` is not required.
- Repository publication does not create a tagged release or bump versions. Installation follows the default branch.

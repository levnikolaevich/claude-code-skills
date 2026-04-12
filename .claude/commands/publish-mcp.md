---
description: "Publish a hex MCP server to npm with checks, version sync, tags, and verification"
allowed-tools: Bash, Glob, AskUserQuestion, mcp__hex-line__read_file, mcp__hex-line__edit_file, mcp__hex-line__grep_search, mcp__hex-line__write_file, mcp__hex-line__changes, mcp__hex-graph__index_project, mcp__hex-graph__find_symbols, mcp__hex-graph__find_references, mcp__hex-graph__analyze_changes
---

# Publish MCP Server

Publishes one of the bundled MCP servers to npm. Tag push triggers GitHub Actions → `npm publish --provenance`.

## Source

| Field | Value |
|-------|-------|
| Source | Repo-maintained MCP publish command |
| Review Contract | `skills-catalog/ln-162-skill-reviewer/references/command_review_criteria.md` |
| Publish Guidance | `docs/best-practice/MCP_TOOL_DESIGN_GUIDE.md` |

**IMPORTANT:** Set `PROJECT_ROOT` to the absolute path of the repo root at the start. Use `$PROJECT_ROOT` in all `cd` and path references to avoid CWD-related failures.

## Package Registry

| Package | Directory | Tag Pattern | CI Workflow |
|---------|-----------|-------------|-------------|
| @levnikolaevich/hex-line-mcp | `mcp/hex-line-mcp/` | `hex-line-v*` | publish-hex-line.yml |
| @levnikolaevich/hex-ssh-mcp | `mcp/hex-ssh-mcp/` | `hex-ssh-v*` | publish-hex-ssh.yml |
| @levnikolaevich/hex-graph-mcp | `mcp/hex-graph-mcp/` | `hex-graph-v*` | publish-hex-graph.yml |

**Shared dependency:** `mcp/hex-common/` (private, `file:` linked) — changes there affect ALL 3 packages.

## Workflow

### 1. Scan all packages for unpublished changes

For each of the 3 packages above, run in parallel:

```bash
# Last tag for this package
git tag -l "${TAG_PREFIX}*" --sort=-v:refname | head -1

# Commits since last tag touching this package
git log ${LAST_TAG}..HEAD --oneline -- mcp/${PKG}/

# Unstaged changes (not yet committed)
git diff --stat -- mcp/${PKG}/

# Local version
node --input-type=module -e "import{readFileSync}from'fs';console.log(JSON.parse(readFileSync('$PROJECT_ROOT/mcp/${PKG}/package.json','utf8')).version)"

# npm registry version
npm view @levnikolaevich/${PKG} version 2>/dev/null || echo "not published"
```

Also check shared dependency:
```bash
git diff --stat -- mcp/hex-common/
git log ${LAST_TAG}..HEAD --oneline -- mcp/hex-common/
```

A package **needs release** if it has commits since tag OR unstaged changes. If only `mcp/hex-common/` changed, ALL packages that import from it need release.

Display summary table:

```
| Package       | Local  | npm    | Commits | Unstaged | Status         |
|---------------|--------|--------|---------|----------|----------------|
| hex-line-mcp  | 1.1.1  | 1.1.1  | 2       | 6 files  | needs release  |
| hex-graph-mcp | 0.2.1  | 0.2.1  | 0       | 3 files  | needs release  |
| hex-ssh-mcp   | 1.1.1  | 1.1.1  | 0       | 0        | up to date     |
```

If no packages need release → report "All packages up to date" and stop.

### 2. Choose package

AskUserQuestion: "Which MCP server to publish?" — list only packages that need release (commits > 0 OR unstaged changes). If only one needs release, suggest it as default. Allow "all" if multiple need release.

Set variables:
- `PKG` = selected package name (e.g. `hex-line-mcp`)
- `PKG_DIR` = `mcp/${PKG}/`
- `TAG_PREFIX` = `hex-line-v` | `hex-ssh-v` | `hex-graph-v`
- `PKG_NAME` = `@levnikolaevich/${PKG}`
- `LAST_TAG` = most recent tag for this package

### 3. Show changes since last release

```bash
git log ${LAST_TAG}..HEAD --oneline -- mcp/${PKG}/ mcp/hex-common/
git diff --stat ${LAST_TAG}..HEAD -- mcp/${PKG}/ mcp/hex-common/
```

Display the output to the user.

### 4. Suggest bump type

Analyze the diff, commit messages, AND public API changes:

**Semantic analysis via hex-graph** (run `index_project` once at start):

```
mcp__hex-graph__analyze_changes(path: "mcp/${PKG}", base_ref: "${LAST_TAG}")
```

Also discover exported symbols for before/after comparison:

```
mcp__hex-line__grep_search(pattern: "export", path: "mcp/${PKG}/server.mjs")
```

| Signal | Bump | How to detect |
|--------|------|---------------|
| Removed/renamed public exports | **major** | `find_symbols` on `${LAST_TAG}:server.mjs` vs current — missing symbols |
| Changed tool parameter signatures | **major** | `analyze_changes` shows modified tool input schemas |
| New tool registrations or exports | **minor** | `find_symbols` finds symbols absent from last tag |
| Internal-only changes, `fix:` commits | **patch** | `analyze_changes` shows no public API diff |

Fall back to commit message heuristics (`BREAKING CHANGE`, `feat:`, `fix:`) when graph evidence is inconclusive.

AskUserQuestion with the recommendation marked "(Recommended)":
- **patch** (X.Y.Z → X.Y.Z+1): bug fixes, tweaks
- **minor** (X.Y.Z → X.Y+1.0): new features, new tools
- **major** (X.Y.Z → X+1.0.0): breaking changes
### 5. Pre-publish checks

```bash
cd $PROJECT_ROOT/mcp/hex-common && npm test && cd $PROJECT_ROOT/mcp/${PKG} && npm run check && npm run lint && npm test
```

**Gate:** hex-common tests + package check/lint/test must all pass. If any fails — fix before proceeding.

**hex-graph blast radius check** (when `hex-common/` changed):

```
mcp__hex-graph__find_references(symbol: "{changed_export}", path: "mcp/")
```

For each changed export in `hex-common/`, verify all consuming servers handle the new signature. Report any import that references a removed or renamed export.

**README tool count check** — `grep_search` for tool registrations (hex-graph cannot index method calls like `server.tool()`):

```
mcp__hex-line__grep_search(pattern: "server\\.tool\\(", path: "mcp/${PKG}/server.mjs")
```

Count matches and compare against `N MCP Tools` in README.md. If mismatch — update README before proceeding.

**MANDATORY READ:** Load `docs/best-practice/MCP_OUTPUT_CONTRACT_GUIDE.md`

**Output contract + vocabulary gates**

- Public outputs MUST keep canonical field ordering where applicable: `status` -> `reason` -> identity/query fields -> `next_action` / `next_actions` -> `summary` -> recovery helpers -> details.
- Public `reason` values MUST be stable `snake_case`, not prose sentences.
- Public `next_action` / `next_actions` MUST use canonical labels, not English advice sentences.
- Do not introduce a new `status`, `reason`, or `next_action` label if an existing one already covers the same decision.
- `hex-graph` success payloads MUST keep top-level `status: "OK"`; error payloads MUST keep the compact error envelope: `status`, `code`, `summary`, `next_action`, `recovery`.
- `hex-line` text contracts MUST stay canonical and compact: prefer `summary` / `snippet` / `retry_edit` / `retry_edits` / `suggested_read_call` / `retry_plan` over long prose guidance blocks.

**Docs and server-description sync gates**

- `README.md`, package site/page content if touched, and `server.mjs` tool descriptions must agree on:
  - tool count
  - primary use cases
  - current output contract fields
  - status/reason/next_action vocabulary
- `server.mjs` descriptions must describe **when to use** the tool and mention current recovery contract where relevant.
- If a release changes public output wording or recovery fields, update README examples in the same release.

**hex-line-specific release gates**

- Hook behavior, `output-style.md`, README, and `hook.mjs` must agree on:
  - whether built-in `Read` / `Edit` / `Write` / `Grep` are redirected or merely advised
  - what Bash commands are redirected
  - PostToolUse truncation thresholds and head/tail counts
  - SessionStart bootstrap behavior
- `edit_file` conflict output must still expose the current compact recovery contract:
  - `status`
  - `reason`
  - `next_action`
  - `summary`
  - `snippet`
  - recovery helpers such as `retry_edit`, `retry_edits`, `suggested_read_call`, `retry_plan`, `retry_checksum`, `recovery_ranges`
- `verify` and `changes` must preserve canonical `status` / `reason` / `next_action` outputs; do not publish if they drift back to narrative/prose-first responses.
- `edit_file`, `verify`, `changes`, and `bulk_replace` must expose the same canonical line-report status in `structuredContent.status`; do not accept wrapper-level `OK` when the report says `CONFLICT`, `STALE`, `CHANGED`, `NO_CHANGES`, or `AUTO_REBASED`.
- `mcp/hex-line-mcp/test/smoke.mjs` must include structured status assertions for `NO_CHANGES`, `CHANGED`, `STALE`, `AUTO_REBASED`, and `CONFLICT`.

**hex-graph-specific release gates**

- Use-case wrappers and server-level overrides must keep the same action vocabulary; no mixed sentence-style `next_actions`.
- `compact` / default outputs should prune empty sections instead of shipping null-heavy payloads.
- Query success results must preserve the top-level pattern: `status`, `query`, `summary`, `reason`, `result`, optional `quality`, optional `warnings`, optional `next_actions`.

**Suggested spot checks before publish**

Run targeted searches via `hex-line` for edit-ready output if fixes needed:

```
mcp__hex-line__grep_search(pattern: "next_action|next_actions|status: |reason: ", path: "mcp/${PKG}/")
mcp__hex-line__grep_search(pattern: "retry_edit|retry_edits|suggested_read_call|retry_plan|summary: |snippet: ", path: "mcp/${PKG}/")
```

Also run the contract checker:
```bash
node mcp/check-output-contracts.mjs
```

For `hex-line-mcp`, also inspect:

```bash
rg -n "HOOK_OUTPUT_POLICY|LINE_THRESHOLD|HEAD_LINES|TAIL_LINES|SessionStart|PreToolUse|PostToolUse" $PROJECT_ROOT/mcp/hex-line-mcp/hook.mjs $PROJECT_ROOT/mcp/hex-line-mcp/lib/hook-policy.mjs $PROJECT_ROOT/mcp/hex-line-mcp/README.md $PROJECT_ROOT/mcp/hex-line-mcp/output-style.md
```

If these checks reveal drift, fix it before version bumping.

### 6. Bump version

```bash
cd $PROJECT_ROOT/mcp/${PKG} && npm version ${BUMP_TYPE} --no-git-tag-version
node --input-type=module -e "import{readFileSync}from'fs';console.log(JSON.parse(readFileSync('$PROJECT_ROOT/mcp/${PKG}/package.json','utf8')).version)"
```

### 7. Build bundle (inlines hex-common + injects version)

```bash
cd $PROJECT_ROOT/mcp/${PKG} && npm run build
```

Version is injected at build time via esbuild `define: { __HEX_VERSION__ }`. No manual sync in server.mjs needed.

Verify version in bundle:
```
mcp__hex-line__grep_search(pattern: "${NEW_VERSION}", path: "mcp/${PKG}/dist/server.mjs", literal: true, limit: 1)
```
### 8. Sync version in server.json (MCP Registry metadata)

Update both `version` and `packages[0].version` in `mcp/${PKG}/server.json`:
```bash
jq --arg v "${NEW_VERSION}" '.version = $v | .packages[0].version = $v' $PROJECT_ROOT/mcp/${PKG}/server.json > /tmp/server.tmp && mv /tmp/server.tmp $PROJECT_ROOT/mcp/${PKG}/server.json
```

Verify:
```bash
jq '.version, .packages[0].version' $PROJECT_ROOT/mcp/${PKG}/server.json
```

### 9. Commit + tag + push

**CRITICAL:** Commit ALL repo changes (`git add -A`), not just the package directory. Other pending changes (skills, commands, docs) ride along with the release commit. Never scope `git add` to a subdirectory.

```bash
git add -A
git commit -m "release: ${PKG_NAME} v${NEW_VERSION}"
git tag ${TAG_PREFIX}${NEW_VERSION}
git push origin master --tags
```

### 10. Verify publish

Wait ~30s, then:
```bash
gh run list --limit 1
npm view ${PKG_NAME} version
```

### 11. Report

Display: package name, old → new version, npm URL (`https://www.npmjs.com/package/${PKG_NAME}`), GitHub Actions run status.

---

### 12. Meta-Analysis

**MANDATORY READ:** Load `shared/references/meta_analysis_protocol.md`

Analyze this session per protocol §7. Output per protocol format.

---
**Last Updated:** 2026-04-12

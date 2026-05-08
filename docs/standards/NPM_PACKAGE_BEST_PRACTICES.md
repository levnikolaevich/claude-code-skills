# npm Package Best Practices

<!-- SCOPE: npm package formatting, SEO, and discovery guidelines. Covers package.json fields, README structure for npm rendering, badge strategy, keyword optimization. -->
<!-- DO NOT add here: GitHub README general guidelines → GITHUB_README_BEST_PRACTICES.md, documentation standards → DOCUMENTATION_STANDARDS.md -->

Best practices for publishing npm packages with optimal discoverability, based on npm search algorithm analysis and top MCP server patterns (2024-2026).

## Table of Contents

- [npm Search Ranking](#npm-search-ranking)
- [package.json Fields](#packagejson-fields)
- [Description Strategy](#description-strategy)
- [Keywords Optimization](#keywords-optimization)
- [README Structure for npm](#readme-structure-for-npm)
- [Badge Strategy](#badge-strategy)
- [Cross-Linking](#cross-linking)
- [npm Rendering Quirks](#npm-rendering-quirks)
- [Anti-Patterns](#anti-patterns)
- [Quality Checklist](#quality-checklist)

---

## npm Search Ranking

npm calculates a composite search score from three components:

| Component | Weight | What Drives It |
|-----------|--------|----------------|
| **Quality** | 30% | Tests, docs, README length, `bugs`/`repository`/`homepage` fields, TypeScript types |
| **Maintenance** | 35% | Publish frequency, commit activity, open issues responsiveness |
| **Popularity** | 35% | Weekly downloads, dependents count, GitHub stars |

**Branding score** (subset of Quality):

```
branding = 0.4 × has_homepage + 0.6 × badge_count_normalized
```

More badges in README = higher branding score. Diminishing returns after 5-6 badges.

---

## package.json Fields

### Required for npm Quality Score

| Field | Impact | Example |
|-------|--------|---------|
| `name` | Primary search index | `@scope/package-name` |
| `description` | Search + npm page subtitle | 1-2 sentences, see [Description Strategy](#description-strategy) |
| `version` | Semver, search freshness | `1.2.0` |
| `license` | Quality score, trust | `MIT` |
| `repository` | Quality score, GitHub link | `{"type":"git","url":"https://github.com/...","directory":"mcp/pkg/"}` |
| `homepage` | 40% of branding score | GitHub tree URL or docs site |
| `bugs` | Quality score | `{"url":"https://github.com/.../issues"}` |
| `author` | Trust signal | `"Name <url>"` |
| `keywords` | Search discovery | Array of 8-12 strings, see [Keywords](#keywords-optimization) |
| `engines` | Node version badge, compatibility | `{"node":">=18.0.0"}` |

### Recommended for Distribution

| Field | Purpose | Example |
|-------|---------|---------|
| `bin` | CLI entry point | `{"cmd-name":"server.mjs"}` |
| `files` | Whitelist published files (reduces package size) | `["server.mjs","lib/","README.md"]` |
| `main` | Entry point for `require()` | `"server.mjs"` |
| `type` | Module system | `"module"` for ESM |

### Monorepo Packages

For packages in subdirectories of a monorepo:

```json
{
  "repository": {
    "type": "git",
    "url": "https://github.com/org/monorepo",
    "directory": "packages/my-pkg"
  },
  "homepage": "https://github.com/org/monorepo/tree/master/packages/my-pkg"
}
```

---

## Description Strategy

The `description` field appears in npm search results and on the package page. It is the single most important text for human discovery.

| Rule | Bad | Good |
|------|-----|------|
| Start with what it does | `"A great tool for..."` | `"Hash-verified file editing MCP server."` |
| Include key differentiator | `"MCP server"` | `"MCP server with hash verification + token efficiency hooks."` |
| List tool count if applicable | — | `"9 tools: inspect_path, read, edit, grep, outline..."` |
| No marketing language | `"The best MCP server"` | `"Token-efficient SSH MCP server."` |
| 1-2 sentences max | 3+ sentences | Concise but complete |

---

## Keywords Optimization

npm search uses keywords for discovery. Optimal count: **8-12 keywords**.

### Keyword Layers

| Layer | Purpose | Examples |
|-------|---------|---------|
| **Protocol** | MCP ecosystem discovery | `mcp`, `model-context-protocol` |
| **Platform** | Agent compatibility | `claude`, `ai`, `llm`, `coding-agent` |
| **Domain** | Feature-specific search | `file-edit`, `ssh`, `tree-sitter`, `knowledge-graph` |
| **Brand** | Package family | `hex-line`, `hex-ssh`, `hex-graph`, `hex-research` |

### Rules

- No duplicates of words already in `name` or `description` (npm deduplicates automatically)
- Lowercase only (npm normalizes)
- Hyphenated compounds count as one keyword: `hash-verified`
- Avoid generic terms with high competition: `tool`, `server`, `utility`
- Include both long and short forms: `mcp` + `model-context-protocol`

### Family Packages

Share a common keyword set across related packages:

```
Shared: mcp, model-context-protocol, claude, ai, llm, coding-agent
Unique: [domain-specific terms per package]
```

---

## README Structure for npm

npm renders README.md directly on the package page. Structure affects both readability and SEO.

### Section Order

| # | Section | Purpose | Priority |
|---|---------|---------|----------|
| 1 | **Title** | Package name as H1 | REQUIRED |
| 2 | **One-liner** | What it does in one sentence | REQUIRED |
| 3 | **Badges** | Version, downloads, license, node | REQUIRED |
| 4 | **Expanded description** | 2-3 sentences with value proposition | REQUIRED |
| 5 | **Features** | Tools/capabilities table | REQUIRED |
| 6 | **Install** | Copy-paste commands (npm + claude mcp add) | REQUIRED |
| 7 | **Tools Reference** | Parameter tables per tool | RECOMMENDED |
| 8 | **Architecture** | Directory tree, key modules | OPTIONAL |
| 9 | **Benchmark** | Token savings, performance data | OPTIONAL |
| 10 | **FAQ** | Common questions in `<details>` | OPTIONAL |
| 11 | **Related packages** | Cross-links to family | RECOMMENDED |
| 12 | **License** | MIT or applicable | REQUIRED |

### Optimal Length

| Package Type | Target | Maximum |
|-------------|--------|---------|
| Simple MCP server (3-5 tools) | 150-200 lines | 300 |
| Full MCP server (6-14 tools) | 200-350 lines | 450 |
| MCP server + hooks | 250-400 lines | 500 |

---

## Badge Strategy

Badges increase branding score (60% weight in branding formula). Use shields.io dynamic badges.

### Required Badges (in order)

| Badge | URL Pattern | Purpose |
|-------|-------------|---------|
| **npm version** | `img.shields.io/npm/v/PKG` | Current version, links to npm |
| **Downloads** | `img.shields.io/npm/dm/PKG` | Social proof, popularity signal |
| **License** | `img.shields.io/npm/l/PKG` | Trust, dynamic from package.json |
| **Node version** | `img.shields.io/node/v/PKG` | Compatibility, from `engines` field |

### Optional Badges

| Badge | When to Add |
|-------|-------------|
| CI status | Public GitHub Actions workflow exists |
| TypeScript | Package ships `.d.ts` types |
| Bundle size | Frontend-facing packages |

### Template

```markdown
[![npm](https://img.shields.io/npm/v/@scope/pkg)](https://www.npmjs.com/package/@scope/pkg)
[![downloads](https://img.shields.io/npm/dm/@scope/pkg)](https://www.npmjs.com/package/@scope/pkg)
[![license](https://img.shields.io/npm/l/@scope/pkg)](./LICENSE)
![node](https://img.shields.io/node/v/@scope/pkg)
```

Use dynamic `npm/l` badge instead of static `badge/license-MIT-green` — it auto-updates from package.json.

---

## Cross-Linking

### Related Packages Table

For package families, add a "Family" section before License in every package README:

```markdown
## Package Family

| Package | Purpose | npm |
|---------|---------|-----|
| [pkg-a](npm-url) | Description | [![npm](badge-url)](npm-url) |
| [pkg-b](npm-url) | Description | [![npm](badge-url)](npm-url) |
```

Benefits:
- npm renders inline badge images — shows version at a glance
- Each package cross-links to siblings — improves discoverability
- Users discovering one package find the whole family

---

## npm Rendering Quirks

| Feature | Support | Notes |
|---------|---------|-------|
| Markdown tables | Yes | Rendered correctly |
| `<details>`/`<summary>` | Yes | Collapsible sections work |
| Mermaid diagrams | No | Use code blocks or images instead |
| HTML `<img>` tags | Yes | For badges, logos |
| Relative links | Partial | `./LICENSE` works, deep paths may not |
| Emoji | Yes | But renders differently than GitHub |
| Syntax highlighting | Yes | Standard fenced code blocks |
| Anchor links | Yes | Auto-generated from headings |

---

## Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| Missing `bugs` field | Reduces npm quality score | Add `bugs.url` pointing to GitHub issues |
| Missing `author` | No trust signal | Add author name + URL |
| Static license badge | Won't update if license changes | Use `img.shields.io/npm/l/PKG` |
| Keyword stuffing | npm may penalize | 8-12 relevant terms, no repeats |
| No `files` whitelist | Publishes everything (tests, configs) | Whitelist with `files` array |
| Description > 2 sentences | Truncated in search results | Keep to 1-2 sentences |
| No `engines` field | No node version badge, no compatibility signal | Add `engines.node` |
| Missing `homepage` | Loses 40% of branding score | Set to GitHub tree URL |
| No cross-links | Sibling packages undiscoverable | Add Family table in README |
| `README.md` not in `files` | npm page shows no README | Include `README.md` in `files` array |
| Marketing language in description | Looks unprofessional | State facts: what it does, how many tools |

---

## Quality Checklist

### package.json

- [ ] `name` — scoped, lowercase, hyphenated
- [ ] `description` — 1-2 sentences, starts with what it does
- [ ] `keywords` — 8-12 relevant terms, includes ecosystem + domain
- [ ] `repository` — points to correct repo + `directory` for monorepos
- [ ] `homepage` — set (contributes 40% to branding)
- [ ] `bugs` — points to issues page
- [ ] `author` — name + URL
- [ ] `license` — explicit, matches LICENSE file
- [ ] `engines` — minimum Node.js version
- [ ] `files` — whitelist (no tests, configs, or dev files published)
- [ ] `bin` — set for CLI packages

### README.md

- [ ] H1 title matches package name
- [ ] One-liner description after title
- [ ] 4+ badges (version, downloads, license, node)
- [ ] Dynamic badges (shields.io/npm/) not static
- [ ] Install section with copy-paste commands
- [ ] All tool parameters documented in tables
- [ ] Family/related packages section with cross-links
- [ ] FAQ uses `<details>` for collapsible answers
- [ ] License section at the end
- [ ] Total length < 450 lines

### Before Publishing

- [ ] `npm pack --dry-run` — verify only intended files included
- [ ] README renders correctly on npm (publish, then check)
- [ ] All badge URLs resolve (check shields.io)
- [ ] No secrets or credentials in published files

---

**Version:** 1.0.0
**Last Updated:** 2026-03-21

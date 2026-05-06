# Documentation Audit Checklist

<!-- SCOPE: Documentation audit check rules ONLY. Contains per-category checks, fundamental principle (fix content not rules). -->
<!-- DO NOT add here: Size limits → size_limits.md, audit workflow → ln-611-docs-structure-auditor SKILL.md -->

Detailed checks per category.

## ⚠️ Fundamental Principle

**Fix content, not rules.** When files violate limits/standards:
- ✅ Reduce file size (split, compress, extract)
- ✅ Fix formatting issues
- ✅ Remove duplication
- ❌ NEVER change limits in *_standards.md
- ❌ NEVER relax rules to make violations pass

This is non-negotiable. Changing rules instead of fixing content is forbidden.

## 1. Hierarchy & Links

### Must Pass
- [ ] CLAUDE.md exists at project root
- [ ] CLAUDE.md links to all primary docs (README, docs/*)
- [ ] All docs in docs/ reachable from CLAUDE.md (max 2 hops)
- [ ] No broken internal links (404)
- [ ] No orphaned .md files (unreachable from CLAUDE.md)

### Should Pass
- [ ] Consistent link format (relative paths)
- [ ] Links use descriptive text (not "click here")
- [ ] Bidirectional links for related docs
- [ ] TOC in files >100 lines

### Scoring
- 10/10: All checks pass
- -1 per broken link
- -2 per orphaned file
- -3 if CLAUDE.md missing or doesn't link to docs/

---

## 2. Single Source of Truth (SSOT)

### Must Pass
- [ ] No identical paragraphs across files
- [ ] No copy-pasted sections
- [ ] Shared concepts defined in one place with links elsewhere
- [ ] Clear ownership: each concept has one authoritative source

### Should Pass
- [ ] Cross-references use links, not inline copies
- [ ] Definitions not repeated (link to glossary/source)
- [ ] Version numbers in one place only
- [ ] Config examples not duplicated

### Detection Patterns
- Same paragraph in multiple files
- Similar tables with same data
- Repeated code examples
- Same list items in different docs

### Scoring
- 10/10: No duplication
- -1 per minor duplication (<50 words)
- -2 per major duplication (>50 words)
- -3 per full section copy

---

## 3. Proactive Compression

**Goal:** Minimum viable size - smallest document that fully conveys information.
Size limits are upper bounds, NOT targets. A 100-line file instead of 300 = success!

### Must Pass
- [ ] **All files checked for compression** (even under-limit ones!)
- [ ] No filler words (simply, easily, basically, actually, really, very)
- [ ] No obvious statements ("This section describes...")
- [ ] No over-explanations (one concept = one sentence max)
- [ ] Comparisons converted to tables
- [ ] Enumerations converted to lists
- [ ] Active voice used (not passive)

### Compression Targets

| Content Type | Before | After | Technique |
|--------------|--------|-------|-----------|
| Comparison prose | "X is better than Y because..." | Table: X vs Y | prose→table |
| Long explanation | 5 sentences | 1-2 sentences | remove filler |
| Obvious statement | "This function does X" | (delete) | remove obvious |
| Repeated info | same info in 3 places | 1 place + links | SSOT |
| Verbose phrase | "in order to" | "to" | compress |

### Meaningless Content Patterns (DELETE)
- "This section describes/explains..."
- "As mentioned above/below..."
- "It is important to note that..."
- "Please note that..."
- "In this document, we will..."
- "The purpose of this is to..."

### Detection Patterns
- Verbose phrases (in order to → to, at this point → now)
- Long paragraphs (>3 sentences)
- Over-explained obvious concepts
- Prose comparisons: "X is better than Y", "compared to"
- Prose enumerations: "First..., Second...", "Additionally..."

### Scoring
- 10/10: Maximum compression achieved; no further reduction possible
- 8-9/10: Minor compression opportunities remain
- 6-7/10: Moderate compression possible (verbose sections, some prose→tables)
- 4-5/10: Significant compression needed (filler words, over-explanations)
- 1-3/10: Bloated content (major redundancy, meaningless sections)

**Note:** Being under size limit does NOT automatically mean 10/10.
A 150-line file with compression opportunities = 6/10.

---

## 4. Requirements Compliance

### Must Pass
- [ ] CLAUDE.md has: Repository section, Key Concepts, Important Details
- [ ] README.md has: About, Features, Installation, Usage
- [ ] SKILL.md has: YAML frontmatter (name, description), workflow, critical notes
- [ ] All docs end with single blank line (POSIX)
- [ ] **No code blocks in docs** - text descriptions only; code lives in codebase

### Should Pass
- [ ] Consistent heading hierarchy (h1 → h2 → h3)
- [ ] Tables properly formatted
- [ ] Callouts/admonitions for warnings

### No Code Policy

Documents describe algorithms and concepts in text, NOT code:
- ✅ "Function validates input, checks permissions, then processes request"
- ✅ "Loop iterates through items, filtering by status"
- ❌ `def process(item): ...` (code block)
- ❌ `for item in items: if item.status == 'active': ...`

**Exceptions:**
- CLI commands for installation/usage in README.md
- Config file snippets (YAML/JSON) when documenting configuration
- Shell commands for Quick Audit section

**Detection:** Search for triple backticks (```) with language tags (python, js, ts, etc.)

### Document-Specific Checks

| Document | Required Sections |
|----------|-------------------|
| CLAUDE.md | Repository, Key Concepts, Important Details |
| README.md | About, Features, Installation, Usage, License |
| SKILL.md | Frontmatter, Purpose, Workflow, Critical Notes, Version |
| Guide | Purpose, Steps, Examples, Troubleshooting |
| ADR | Context, Decision, Consequences |

### Scoring
- 10/10: All required sections present, no code blocks
- -1 per missing optional section
- -2 per missing required section
- -2 per code block in doc (except allowed exceptions)
- -3 per malformed document structure

---

## 5. Freshness Indicators

Detect staleness signals in documentation. Deep fact-checking (paths, versions, endpoints, configs) handled by dedicated worker.

### Must Pass
- [ ] No inline dates older than 6 months (except CHANGELOG, version history)
- [ ] No references to known unsupported tools/APIs (e.g., "Python 2", "jQuery 1.x", EOL frameworks)
- [ ] No TODO/FIXME markers in published documentation
- [ ] No placeholder text left in place ("Lorem ipsum", "TBD", "Coming soon", "XXX")

### Should Pass
- [ ] Last Updated date within 3 months (if present in document)
- [ ] No references to tools/frameworks removed from package manifests
- [ ] Maintenance section present in audit/operational docs

### Detection Patterns
- Dates in format YYYY-MM-DD or Month YYYY older than 6 months
- Known unsupported tech: Python 2, Node 14/16, Angular.js, jQuery 1.x, Webpack 4
- TODO/FIXME/XXX markers in non-task documentation
- "TBD", "Coming soon", "placeholder", "Lorem ipsum"

### Scoring
- 10/10: No staleness signals detected
- -1 per stale date or unsupported reference
- -2 per TODO/FIXME in published docs
- -1 per missing Maintenance section in operational docs

---

## 6. Legacy Cleanup

### Must Pass
- [ ] No "History" or "Changelog" sections in docs (use CHANGELOG.md)
- [ ] No "was previously", "used to be" language
- [ ] No commented-out documentation
- [ ] No unsupported feature documentation without removal date

### Should Pass
- [ ] No TODO comments in docs older than 30 days
- [ ] No references to removed features
- [ ] No migration guides for completed migrations
- [ ] No "temporary" notes that are permanent

### Detection Patterns
- "In version X.Y, we changed..."
- "Previously, this was..."
- "TODO: update this section"
- "Legacy: kept for backward compatibility"
- Dates more than 6 months old in inline notes

### Scoring
- 10/10: Current state only
- -1 per legacy note
- -2 per unsupported section kept
- -3 per major outdated documentation

---

## Quick Audit Commands

```bash
# === STRUCTURE & LINKS ===

# Find orphaned files (files not linked from any other)
grep -rL "filename.md" docs/

# Find broken links
grep -roh '\[.*\](.*\.md)' docs/ | grep -v http

# === COMPRESSION ===

# Find verbose phrases
grep -rni "in order to\|at this point\|has the ability" docs/

# Find code blocks (should be minimal in docs)
grep -rn '```python\|```js\|```ts\|```java\|```go\|```rust' docs/

# Check file sizes
wc -l docs/**/*.md | sort -n

# === LEGACY ===

# Find TODO comments
grep -rn "TODO\|FIXME\|XXX" docs/
```

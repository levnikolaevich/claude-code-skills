---
name: x-guide-creator
description: Creates minimal project guides (6 sections, 300-500 words) documenting reusable patterns. AUTO-RESEARCH via MCP Ref/Context7. Use when new pattern discovered. Returns guide path for linking.
---

# Guide Creator Skill

Create minimal project guides (6 sections, 300-500 words) documenting reusable patterns and best practices.

## When to Use This Skill

This skill should be used when:
- A new pattern is discovered during task implementation
- Pattern is reusable across multiple tasks/stories
- Pattern is not yet documented in `docs/guides/`
- Document architectural decision or best practice
- Task verification identifies missing guide

## How It Works

### Phase 1: Research & Discovery (Automated)

**Objective**: Automatically research pattern best practices and gather sources.

**Input:** Pattern name/description (e.g., "HTTP Client Connection Pooling")

**Steps:**

1. **Search library documentation via MCP Ref:**
   - Query: "[pattern name] best practices [language/framework]"
   - Example: "HTTP client connection pooling Python FastAPI"
   - Extract: Official recommendations, configuration, lifecycle management
   - Collect: Library versions, official docs URLs

2. **Search Context7 for framework patterns:**
   - Query: "[pattern name] [framework]"
   - Example: "connection pooling FastAPI httpx"
   - Extract: Framework-specific implementations, recommended libraries
   - Collect: Code structure patterns, anti-patterns

3. **Analyze findings:**
   - Identify core principle (industry standard)
   - Identify 2-3 do/don't patterns
   - Compile sources with dates/versions

**Output:**
- Principle statement with citations
- 2-3 do/don't patterns
- Sources list with versions/dates (2-3 sources)

**Tools:** MCP Ref (`ref_search_documentation`), Context7 (`mcp__context7__*`)

**Note:** WebSearch removed - MCP Ref + Context7 sufficient for quality guides

---

### Phase 2: Pattern Analysis

**Input:** Research data from Phase 1

**Steps:**
1. Identify pattern category (architecture, testing, API design, etc.)
2. **Use researched principle** as industry best practice baseline
3. Define how pattern applies to project context
4. **Use researched do/don't patterns** for guide content

### Phase 3: Guide Generation

**Generate guide with 6 required sections:**

1. **SCOPE tags** - Document boundaries (HTML comments after title)
2. **Principle** - Industry best practice with version/date citation (1-2 sentences)
3. **Our Implementation** - How pattern applies to project context (1 paragraph, NO alternatives/rationale)
4. **Patterns** - Table format with 3 columns (Do ✅ | Don't ❌ | When)
5. **Sources** - 2-3 references with dates/versions
6. **Related + Last Updated** - Navigation (ADRs + Guides) + date

**Validation:**
- SCOPE tags present (first 3-5 lines after title)
- All sources dated (2025 or version specified)
- Principle cites official docs
- NO code snippets (structural descriptions only)
- NO ADR concepts ("Alternatives rejected", "Decision rationale")
- Table format for Patterns (3 columns)
- Target length: 300-500 words

Shows preview for review.

### Phase 4: Confirmation & Storage

1. User reviews generated guide
2. Type "confirm" to proceed
3. Save to `docs/guides/[NN]-[pattern-name].md`
4. Return file path for linking

## Example Usage

**Request:**
```
"Create guide for External Client Pattern (HTTP client connection pooling)"
```

**Execution:**
1. **Research** - MCP Ref (httpx docs), Context7 (FastAPI patterns), WebSearch (2025 best practices)
2. **Analysis** - Pattern: HTTP client lifecycle, Principle: Connection pooling, Alternatives: httpx vs requests vs aiohttp
3. **Generation** - Complete guide with researched sources, alternatives, anti-patterns
4. **Storage** - `docs/guides/12-external-client-pattern.md` → Return path for linking

## Reference Files

- **guide_template.md:** Standard guide structure

## Best Practices

1. **Cite sources:** All principles reference official docs with versions
2. **Date everything:** Use current year (2025) or library versions
3. **No code snippets:** Describe structure, not actual code
4. **Be specific:** Link to project files, show concrete decisions
5. **Cover alternatives:** Explain why other approaches rejected
6. **Keep focused:** One pattern per guide
7. **Research thoroughly:** Use MCP Ref + Context7 + WebSearch to find current (2025) best practices
8. **Verify versions:** Always check latest stable versions via MCP Ref
9. **Multiple sources:** Cite at least 3 sources (official docs + community + industry standards)

---

## Definition of Done

Before completing work, verify ALL checkpoints:

**✅ Research Completed (Phase 0):**
- [ ] MCP Ref search executed: "[pattern name] best practices [language/framework]"
  - Official library documentation found
  - Configuration recommendations extracted
  - Library versions identified
- [ ] Context7 search executed: "[pattern name] [framework]"
  - Framework-specific implementations found
  - Recommended libraries identified
  - Code structure patterns extracted
- [ ] Research findings analyzed:
  - Core principle identified (industry standard)
  - 2-3 do/don't patterns identified
  - Sources compiled with dates/versions (2-3 sources)

**✅ Pattern Analysis Complete (Phase 1):**
- [ ] Pattern category identified (architecture, testing, API design, etc.)
- [ ] Researched principle used as baseline (not user assumption)
- [ ] Pattern applied to project context
- [ ] Researched do/don't patterns used for guide content

**✅ Guide Generated (Phase 2):**
- [ ] All 6 sections present:
  - SCOPE tags (HTML comments in first 3-5 lines after title)
  - Principle (industry best practice with version/date citation, 1-2 sentences)
  - Our Implementation (1 paragraph, NO alternatives/rationale)
  - Patterns (table: Do ✅ | Don't ❌ | When)
  - Sources (2-3 references with dates/versions)
  - Related + Last Updated (navigation + date)
- [ ] No placeholders remaining (no {{PLACEHOLDER}} or [FILL])
- [ ] Guide preview generated for user review

**✅ Quality Verification:**
- [ ] SCOPE tags present (HTML comments defining document boundaries)
- [ ] All sources dated (2025 or library version specified)
- [ ] Principle cites official docs (not generic statements)
- [ ] NO code snippets (structural descriptions only)
- [ ] NO ADR concepts in guide ("Alternatives rejected", "Decision rationale" removed)
- [ ] 2-3 sources cited (official docs + framework/community refs)
- [ ] Latest stable versions verified via MCP Ref
- [ ] Table format for Patterns (3 columns: Do ✅ | Don't ❌ | When)
- [ ] Target length: 300-500 words

**✅ User Confirmation:**
- [ ] Guide preview displayed to user
- [ ] User reviewed generated guide
- [ ] User typed "confirm" to proceed with creation
- [ ] User approval received before saving file

**✅ Guide Saved:**
- [ ] File created in `docs/guides/` directory
- [ ] Filename format: `[NN]-[pattern-name].md` (sequential number + kebab-case name)
- [ ] Sequential number determined (find highest existing number + 1)
- [ ] File written successfully

**✅ Path Returned:**
- [ ] Guide file path returned to caller: `docs/guides/NN-pattern-name.md`
- [ ] Path format correct for linking in Linear or other documents
- [ ] Success message displayed: "✓ Guide created: docs/guides/NN-pattern-name.md"

**Output:** Guide file path `docs/guides/NN-pattern-name.md` for linking by caller tools (e.g., x-story-verifier)

---

**Version:** 4.0.0 (Minimal Format)
**Last Updated:** 2025-01-31

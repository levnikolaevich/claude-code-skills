# Documentation Size Limits

<!-- SCOPE: Documentation size limits and compression targets ONLY. Contains per-file line limits, MVS philosophy. -->
<!-- DO NOT add here: Audit checks → audit_checklist.md, audit workflow → ln-611-docs-structure-auditor SKILL.md -->

Token-efficient documentation targets.

## Philosophy

Size limits are **upper bounds**, not targets. The goal is **maximum compression** while preserving accuracy and usefulness.

| Approach | Wrong ❌ | Right ✅ |
|----------|---------|---------|
| File is 200/300 lines | "Under limit, OK" | "Can we compress to 150?" |
| File is 100 lines | "Way under, skip" | "Can we compress to 80?" |
| File is 350 lines | "Over limit, reduce to 300" | "Reduce as much as possible" |

**Target: Minimum Viable Size (MVS)** — the smallest document that fully conveys the information.

---

## File Size Limits (Upper Bounds)

| Document | Max Lines | Max Words | Rationale |
|----------|-----------|-----------|-----------|
| CLAUDE.md | 100 | 800 | Claude Code performance; fits in context |
| README.md | 500 | 4000 | GitHub rendering; scannable |
| SKILL.md | 150 | 1200 | Skill trigger efficiency |
| Guide/Manual | 300 | 2500 | Single-topic focus |
| ADR | 100 | 800 | Decision record; concise |
| API docs | 200 | 1600 | Per endpoint group |

## Section Limits

| Section Type | Max Lines | Notes |
|--------------|-----------|-------|
| Introduction | 10 | 2-3 sentences max |
| Table of Contents | 20 | Auto-generated preferred |
| Code example | 30 | Focused; one concept |
| Table | 25 | Prefer over prose |

## Compression Targets

| Metric | Target | How to Achieve |
|--------|--------|----------------|
| Token reduction | -30 to -40% | Use concise terms dictionary |
| Sentence length | Max 25 words | Split long sentences |
| Paragraph length | 3-5 sentences | One idea per paragraph |
| Heading depth | Max h3 | Rarely h4 |

## Verbose → Concise Phrases

| Avoid | Use | Savings |
|-------|-----|---------|
| in order to | to | -67% |
| at this point in time | now | -80% |
| has the ability to | can | -73% |
| for the purpose of | to/for | -75% |
| due to the fact that | because | -75% |
| with regard to | about | -67% |
| it is important to note | (remove) | -100% |

## Structured Representation (Prose → Table/List)

**Principle:** Tables and lists are 3-5x faster to scan than prose text.

| Prose Pattern | Convert To | When |
|---------------|------------|------|
| Comparisons (X vs Y, X is better than Y) | Table | Always |
| Enumerations (First..., Second..., Additionally...) | Numbered list | >2 items |
| Object attributes (has X, contains Y, supports Z) | Table or bullet list | >3 attributes |
| Step-by-step instructions | Numbered list | Always |
| Parameters/options | Table | >2 parameters |
| Before/After examples | Two-column table | Always |

### Detection Patterns (convert prose to structured)

```regex
# Comparisons
(compared to|versus|vs\.?|better than|worse than|unlike|similar to)

# Enumerations in prose
(first(ly)?|second(ly)?|third(ly)?|additionally|furthermore|moreover|also,)

# Attribute listings
(has|have|contains?|includes?|supports?|provides?).*(and|,).*(and|,)
```

---

## Scannability Checks

**Principle:** F-pattern reading — users scan left side first, then horizontally.

| Check | Rule | Why |
|-------|------|-----|
| Lead with important | Keyword at heading start | F-pattern: left side scanned first |
| List size | 2-8 items per list | <2 not a list, >8 overwhelming |
| Table cells | Max 2 sentences | More → use different format |
| Paragraph size | Max 5 sentences | Split longer paragraphs |
| Heading depth | Max h3, rarely h4 | Deep nesting = poor structure |

### Anti-Patterns

| Pattern | Problem | Fix |
|---------|---------|-----|
| "Introduction to X" | Buries keyword | "X Overview" |
| 10+ item lists | Overwhelming | Split into groups |
| 3+ sentences in table cell | Unreadable | Move to prose or split rows |
| Wall of text | Not scannable | Add headings, lists, tables |

---

## Red Flags

- File exceeds limits by >20%
- Multiple h4/h5 headings
- Paragraphs >7 sentences
- Code blocks >50 lines
- Tables >30 rows
- Prose where table would work better

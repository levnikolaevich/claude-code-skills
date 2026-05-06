# Announcement Styles & Writing Quality

<!-- SCOPE: Multiple announcement formats for variety + writing quality principles. Used by ln-912 to avoid repetitive announcements. -->
<!-- DO NOT add here: GitHub markdown syntax → discussion_formatting.md; strategy/triggers → community_strategy_template.md -->

## Style Selection Matrix

Pick a primary style based on announcement type. Mix with a secondary for variety.

| Announcement Type | Primary Style | Good Secondary |
|-------------------|--------------|----------------|
| :sparkles: New Features | **Walkthrough** or **Feature Spotlight** | Problem → Solution |
| :building_construction: Architecture | **Before → After** or **Behind the Scenes** | Walkthrough |
| :warning: Breaking Change | **Before → After** | Problem → Solution |
| :people_holding_hands: Community | **Community-Driven** | Behind the Scenes |
| :rocket: Release / Digest | **Batch Digest** | Feature Spotlight for top item |

**Variety rule:** Check last 3 announcements. If all used the same style, pick a different one.

---

## Style Templates

### 1. Problem → Solution

**Hook:** Lead with the pain point users experienced.

```
{emoji} {Title — names the solution}

{Problem statement — 1-2 sentences describing what was painful/broken/slow}

{Solution — what we built to fix it, how it works}

### Impact
{Before/after metrics or user-visible change}

### How to Use
{Command or quick start}
```

**When:** Bug fixes, features born from complaints, performance improvements.
**Tone:** Empathetic → Decisive. "We heard you. Here's the fix."

### 2. Before → After

**Hook:** Show the contrast between old and new.

```
{emoji} {Title — emphasizes the transformation}

{1 sentence: what changed at high level}

| Before | After |
|--------|-------|
| {old behavior} | {new behavior} |
| {old limitation} | {new capability} |

### What This Means
{2-3 bullets on user impact}

### Migration
{Steps if needed, or "no action required"}
```

**When:** Redesigns, architecture changes, breaking changes with migration.
**Tone:** Factual, comparative. Let the table speak.

### 3. Walkthrough / Demo

**Hook:** Lead with a concrete example showing input → output.

```
{emoji} {Title — describes the capability}

{1-2 sentence summary}

### Example

{Scenario description}
{Input → Processing steps → Output}
{Concrete numbers/results}

### How It Works
{Brief architecture or flow — table or diagram}

### Get Started
{Command}
```

**When:** New tools, complex features that need demonstration.
**Tone:** Practical, hands-on. "Here's what it looks like in action."

### 4. Feature Spotlight

**Hook:** Deep dive into one feature. Explain why it matters.

```
{emoji} {Title — names the feature}

{What it is + why it exists — 2-3 sentences}

> [!TIP]
> {Key insight or "aha moment" about this feature}

### Key Capabilities
- **{Cap 1}** — {description}
- **{Cap 2}** — {description}
- **{Cap 3}** — {description}

<details>
<summary>Technical details</summary>
{Architecture, configuration, edge cases}
</details>

### Get Started
{Command}
```

**When:** Single important capability worth explaining in depth.
**Tone:** Enthusiastic but focused. Deep, not wide.

### 5. Batch Digest

**Hook:** Grouped summary of multiple changes.

```
{emoji} {Title — "{Month} {Year}: what shipped" or "Release vX.Y"}

{1 sentence overview — count of changes, themes}

### :sparkles: Added
- **{Feature}** — {1-line impact}
- **{Feature}** — {1-line impact}

### :wrench: Changed
- **{Change}** — {1-line impact}

### :bug: Fixed
- **{Fix}** — {1-line description}

<details>
<summary>Full list ({N} changes)</summary>
{Complete changelog entries}
</details>

### What's Next
{1-2 sentences}
```

**When:** Monthly digests, version releases, feature batches.
**Tone:** Scannable, comprehensive. Categories over narrative.

### 6. Behind the Scenes

**Hook:** Tell the story of why and how something was built.

```
{emoji} {Title — hints at the journey}

{What we shipped — 1 sentence}

### Why We Built This
{Problem + context that motivated the work — 2-3 sentences}

### What We Tried
{Approaches explored, including dead ends — brief}

### What We Landed On
{Final solution + key design decisions}

### Lessons Learned
{1-2 takeaways}
```

**When:** Architecture decisions, significant R&D, experimental features.
**Tone:** Transparent, reflective. Builds trust through honesty.

### 7. Community-Driven

**Hook:** Reference the original request or discussion.

```
{emoji} {Title — "You asked, we built"}

{Reference to original request — link to issue/discussion}

### What You Asked For
{Original problem in community's own words}

### What We Built
{Solution — how it addresses the request}

### Credit
{Thank the person/people who raised it}
```

**When:** Features from community requests, voted ideas, discussion-born features.
**Tone:** Grateful, collaborative. "Built with you, for you."

---

## Mixing Styles

Combine a **hook** from one style with the **body** from another:

| Hook From | Body From | Result |
|-----------|-----------|--------|
| Problem → Solution | Walkthrough | "Here's what was painful" → concrete demo |
| Community-Driven | Feature Spotlight | "You asked for X" → deep dive on the solution |
| Behind the Scenes | Before → After | "Here's why we rethought this" → comparison table |
| Problem → Solution | Batch Digest | "These pain points are gone" → categorized fix list |

---

## Writing Quality Principles

### Core Rules

| Principle | Description |
|-----------|-------------|
| **Show, don't tell** | Concrete examples, input/output, scenarios — not abstract descriptions |
| **Link, don't duplicate** | Link to CHANGELOG, docs, SKILL.md — don't copy content into announcement |
| **[What] + [Why] + [Impact]** | Every hook answers: what changed, why it matters, what users should do |
| **Scannable structure** | Bullets, tables, bold labels — not prose paragraphs |
| **One idea per post** | Focused announcements outperform kitchen-sink posts |

### Anti-Patterns

| Anti-Pattern | Fix |
|-------------|-----|
| Wall of text (no structure) | Add headers, bullets, tables |
| No code/examples | Add at least one concrete scenario |
| Jargon without context | Explain internal terms or replace with user-facing language |
| Excessive length (> 300 lines) | Move details into `<details>` or link to docs |
| "We're excited to announce..." | Cut filler. Lead with the change, not emotions |
| Feature list without impact | Each bullet: **what** — *so what* |
| Marketing-only title (no keywords) | Include feature/product name so users find it via search |

### Title Patterns

Titles must be **searchable AND engaging**. Include the feature/product name as a keyword.

| Bad (hook-only) | Good (searchable + engaging) |
|-----------------|------------------------------|
| Tell it what's slow — it finds out why | New: Performance Optimizer — profile and fix bottlenecks automatically |
| Your logs are hiding bugs | New: Test Log Analyzer — find hidden bugs in application logs |
| One command to rule them all | Pipeline Orchestrator — autonomous multi-agent development lifecycle |
| Stop guessing, start measuring | Codebase Audit Suite — parallel security, quality, and architecture checks |

### Quality Checklist

Before publishing, verify:

- [ ] Title: imperative, < 80 chars, no version numbers (put in body)
- [ ] Title: includes searchable product/feature name (not just a marketing hook)
- [ ] Hook answers "what changed and why should I care?" in 1-2 sentences
- [ ] At least one concrete example, scenario, or comparison
- [ ] No duplicated content from CHANGELOG (link instead)
- [ ] All file paths and commands verified against repo
- [ ] Ends with engagement question (breaks "silent users" pattern)
- [ ] Different style from last 3 announcements

---

**Version:** 1.0.0
**Last Updated:** 2026-03-14

# RICE Scoring Guide

<!-- SCOPE: RICE scoring formula and scale definitions ONLY. Contains Reach, Impact, Confidence, Effort guidelines. -->
<!-- DO NOT add here: Prioritization logic → ln-230-story-prioritizer SKILL.md, competition analysis → competition_index.md -->

Reference for calculating RICE scores in ln-230-story-prioritizer.

## Formula

```
RICE Score = (Reach x Impact x Confidence) / Effort
```

---

## Reach (1-10)

**Definition:** Number of users affected per quarter.

| Score | Users/Quarter | Story Indicators |
|-------|---------------|------------------|
| 1 | <100 | Admin-only feature, single user |
| 2 | 100-500 | Power user feature, niche use case |
| 3 | 500-1,000 | Department-level feature |
| 4 | 1,000-2,000 | Team-wide feature |
| 5 | 2,000-5,000 | Organization-wide feature |
| 6 | 5,000-7,500 | Multi-department feature |
| 7 | 7,500-10,000 | Cross-organization feature |
| 8 | 10,000-25,000 | Multi-org feature |
| 9 | 25,000-50,000 | Platform feature |
| 10 | >50,000 | Core platform capability |

**How to estimate:**
- Check Epic scope (all users? subset?)
- Review Customer Profile personas
- Consider Story AC (who benefits?)

---

## Impact (0.25-3.0)

**Definition:** Business value delivered if Story is completed.

| Score | Level | Indicators | Examples |
|-------|-------|------------|----------|
| 0.25 | Minimal | Nice-to-have, no metrics impact | UI polish, minor text change |
| 0.5 | Low | Quality of life, minor efficiency | Keyboard shortcuts, sorting |
| 1.0 | Medium | Measurable efficiency gain | Auto-save, batch operations |
| 2.0 | High | Revenue driver, retention impact | New revenue stream, churn reduction |
| 3.0 | Massive | Strategic differentiator, market entry | New market, competitive moat |

**How to estimate:**
- Review Story "So that [value]" clause
- Check market research (TAM/SAM impact)
- Consider competitive positioning

---

## Confidence (0.5-1.0)

**Definition:** Quality of data supporting estimates.

| Score | Level | Data Quality | Source Examples |
|-------|-------|--------------|-----------------|
| 0.5 | Low | Gut feeling, no research | Team opinion only |
| 0.6 | Medium-Low | Blog posts, forums | Medium articles, Reddit |
| 0.7 | Medium | News articles, case studies | TechCrunch, company blogs |
| 0.8 | Medium-High | Industry reports | Gartner, Forrester previews |
| 0.9 | High | Primary research | Customer interviews, surveys |
| 1.0 | Very High | Hard data | Pilot results, A/B tests |

**How to estimate:**
- Count sources found in research
- Check source recency (last 2 years = higher)
- Validate with multiple sources

---

## Source Quality Tiers

Map sources to confidence scores for consistent RICE calculation.

### Tier Classification

| Tier | Confidence | Source Examples |
|------|------------|-----------------|
| **Tier 1** (Primary) | 0.9-1.0 | Gartner, Forrester, IDC, Statista, McKinsey, BCG, SEC filings, Annual Reports, Pilot results |
| **Tier 2** (Secondary) | 0.7-0.8 | TechCrunch, VentureBeat, G2, Capterra, TrustRadius, Official company blogs, Industry news |
| **Tier 3** (Tertiary) | 0.5-0.6 | Medium, Dev.to, Reddit, HackerNews, Twitter/X, Personal blogs, Forum discussions |

### Source Validation Rules

| Rule | Impact |
|------|--------|
| **Multiple sources required** | Confidence > 0.8 requires 2+ sources agreeing |
| **Recency bonus** | Sources ≤ 2 years old → +0.1 to confidence |
| **Cross-validation** | 2+ Tier 2 sources agree → treat as Tier 1 |
| **Single source penalty** | Only 1 source → max 0.7 confidence |
| **Conflicting sources** | Sources disagree → use lower confidence |

### Quick Confidence Calculator

| Sources Found | Tier Mix | Final Confidence |
|---------------|----------|------------------|
| 1 Tier 1 | Primary only | 0.9 |
| 2+ Tier 1 | Multiple primary | 1.0 |
| 1 Tier 2 | Secondary only | 0.7 |
| 2+ Tier 2 | Multiple secondary | 0.8 |
| 1 Tier 3 | Tertiary only | 0.5 |
| Mixed Tier 1 + Tier 2 | Validated | 0.9 |
| No sources | Gut feeling | 0.5 |

---

## Effort (1-10)

**Definition:** Person-months to implement Story.

| Score | Time | Story Indicators |
|-------|------|------------------|
| 1 | <1 week | 3 AC, simple CRUD, no dependencies |
| 2 | 1-2 weeks | 3-4 AC, straightforward logic |
| 3 | 2-3 weeks | 4 AC, single integration |
| 4 | 3-4 weeks | 4-5 AC, multiple integrations |
| 5 | 1-1.5 months | 5 AC, complex business logic |
| 6 | 1.5-2 months | 5 AC, external API dependencies |
| 7 | 2-2.5 months | 5 AC, new infrastructure component |
| 8 | 2.5-3 months | 5 AC, security/compliance requirements |
| 9 | 3-4 months | 5 AC, architectural changes |
| 10 | 4+ months | 5 AC, platform-level changes |

**How to estimate:**
- Count AC in Story (3-5 typical)
- Review Technical Notes complexity
- Check dependencies in Story

---

## Priority Mapping

| Priority | RICE Threshold | Competition Override | Action |
|----------|----------------|---------------------|--------|
| **P0 (Critical)** | >= 30 | OR Competition = 1 | Implement ASAP, this sprint |
| **P1 (High)** | >= 15 | OR Competition <= 2 | Next sprint, high priority backlog |
| **P2 (Medium)** | >= 5 | - | Backlog, schedule when capacity |
| **P3 (Low)** | < 5 | Competition = 5 forces P3 | Defer or cut, low value |

---

## Examples

### Example 1: High Value Feature

**Story:** "As API user, I want translation memory, so that I save 70-90% GPU costs"

| Factor | Value | Rationale |
|--------|-------|-----------|
| Reach | 8 | All API users benefit (~15,000/quarter) |
| Impact | 3.0 | Massive cost reduction, competitive differentiator |
| Confidence | 0.9 | Industry reports confirm (M&M Research) |
| Effort | 5 | Redis integration, 1.5 months |

**RICE = (8 x 3.0 x 0.9) / 5 = 4.32** → P2?

Wait, Competition = 3 (few competitors have it) → Boost to P0

### Example 2: Low Value Feature

**Story:** "As admin, I want dark mode, so that I reduce eye strain"

| Factor | Value | Rationale |
|--------|-------|-----------|
| Reach | 2 | Admin users only (~200/quarter) |
| Impact | 0.25 | Nice-to-have, no business impact |
| Confidence | 0.8 | Common request in feedback |
| Effort | 2 | CSS changes, 1 week |

**RICE = (2 x 0.25 x 0.8) / 2 = 0.2** → P3 (defer)

---

## Common Mistakes

| Mistake | Problem | Solution |
|---------|---------|----------|
| Overestimating Reach | Counts all users, not affected users | Focus on users who will USE the feature |
| Underestimating Effort | Ignores testing, deployment, docs | Include full Story scope (AC + Technical Notes) |
| High Confidence without data | "Everyone knows this" | Require sources or reduce to 0.5 |
| Ignoring Competition | Red Ocean features get same score | Apply Competition Override (Blue Ocean = P0/P1) |

---

**Version:** 1.0.0

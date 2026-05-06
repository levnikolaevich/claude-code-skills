# Filter Criteria & KILL Thresholds

KILL funnel criteria for ln-201-opportunity-discoverer.

---

## KILL Funnel Overview

```
Idea → [Traffic] → [Demand] → [Competition] → [Revenue] → [Interest] → [MVP] → SURVIVOR
           ↓           ↓            ↓             ↓            ↓          ↓
         KILL        KILL         KILL          KILL         KILL       KILL
```

**Rule:** Fail ANY filter = KILL immediately. Don't analyze further.

---

## Filter 1: Traffic Channel

**Question:** Where do people actively look for this solution?

### Valid Channels

| Channel | Identification Signal | Best For |
|---------|----------------------|----------|
| **Search/SEO** | "[problem] solution" has search volume | Tools, info products |
| **YouTube** | "[problem] tutorial" searches exist | Education, how-to |
| **Marketplaces** | Category exists on ProductHunt/AppStore | Apps, plugins |
| **Communities** | Active subreddit/forum with problem discussions | Niche products |
| **Paid Ads** | Competitors actively running ads | Proven demand |
| **Outbound B2B** | Clear ICP list, reachable via LinkedIn/email | Enterprise, high-ticket |

### Research Queries

```
WebSearch: "[idea] how do people find"
WebSearch: "[idea] customer acquisition channels"
WebSearch: "[problem] where people ask for help"
```

### KILL Criteria

| Condition | Verdict |
|-----------|---------|
| Clear channel identified | PASS |
| Channel exists but weak signal | PASS (note risk) |
| No identifiable channel | **KILL** |
| Only "word of mouth" possible | **KILL** |

---

## Filter 2: Existing Demand

**Question:** Are people already searching for this solution?

### Demand Signals

| Signal | Source | Weight |
|--------|--------|--------|
| Monthly search volume | Keywords Everywhere, Ahrefs | High |
| Google Trends direction | trends.google.com | Medium |
| Forum/Reddit activity | Direct search | Medium |
| Competitor traffic | SimilarWeb | High |
| "How to [problem]" searches | Google autocomplete | Medium |

### Research Queries

```
WebSearch: "[idea] search volume monthly"
WebSearch: "[idea] Google Trends {current_year}"
WebSearch: "how to [problem] reddit"
WebSearch: "[competitor] monthly traffic"
```

### Scoring Scale

| Volume/month | Score | Verdict |
|--------------|-------|---------|
| >100K | 5 | Strong demand |
| 10K-100K | 4 | Good demand |
| 1K-10K | 3 | Viable niche |
| 100-1K | 2 | Weak demand |
| <100 | 1 | **KILL** |

### KILL Criteria

| Condition | Verdict |
|-----------|---------|
| >1K/month search volume | PASS |
| Growing trend + active forums | PASS (even if volume unclear) |
| <1K/month, no forum activity | **KILL** |
| Declining trend >50% YoY | **KILL** |

---

## Filter 3: Competition (Blue/Red Ocean)

**Question:** Can we realistically enter this market?

### Research Queries

```
WebSearch: "[idea] competitors {current_year}"
WebSearch: "[idea] alternatives comparison"
WebSearch: "[idea] vs"
WebSearch: "best [idea] tools"
```

### Competitor Counting Rules

**Include as competitor if:**
- Offers similar core feature
- Has public pricing or freemium
- Updated in last 12 months
- Targets same customer segment

**Exclude:**
- Unsupported/abandoned products
- Enterprise-only (no public pricing)
- Different market segment
- Open source without commercial offering

### Classification Scale

| Competitors | Index | Ocean | Interpretation |
|-------------|-------|-------|----------------|
| 0 | 1 | Blue | Unproven market (validate demand!) |
| 1-2 | 2 | Emerging | Best entry window |
| 3-5 | 3 | Growing | Differentiation required |
| 6-10 | 4 | Mature | Hard, need strong angle |
| >10 | 5 | Red | **KILL** — commoditized |

### KILL Criteria

| Condition | Verdict |
|-----------|---------|
| Index 1-4 | PASS |
| Index 5 (>10 competitors) | **KILL** |
| Index 1 + no demand signal | PASS but flag risk |

### Score Inversion for Ranking

For survivor scoring, invert competition:
```
Competition Score = 6 - Index
```
- Index 1 (Blue) → Score 5
- Index 5 (Red) → Score 1 (but already KILL)

---

## Filter 4: Revenue Potential

**Question:** Will customers pay enough to sustain business?

### Research Queries

```
WebSearch: "[idea] pricing plans"
WebSearch: "[competitor] pricing"
WebSearch: "[idea] SaaS pricing benchmarks"
WebSearch: "[idea] ARPU average"
```

### Revenue Indicators

| ARPU | Score | Market Type | Verdict |
|------|-------|-------------|---------|
| >$100/user/mo | 5 | Enterprise | High margin |
| $50-100 | 4 | Professional | Good |
| $20-50 | 3 | Prosumer | Viable |
| $5-20 | 2 | Consumer mass | Volume needed |
| <$5 | 1 | Ad-supported | **KILL** |

### Pricing Model Assessment

| Model | Indicator | Risk Level |
|-------|-----------|------------|
| Subscription | Recurring revenue | Low |
| Usage-based | Scales with value | Medium |
| One-time | Need constant new customers | High |
| Freemium | Conversion rate critical | Medium |
| Ad-supported | Need massive scale | **KILL** |

### KILL Criteria

| Condition | Verdict |
|-----------|---------|
| Proven $20+/user in market | PASS |
| Competitors charge $20+/user | PASS |
| Only free/ad-supported competitors | **KILL** |
| <$5/user average in market | **KILL** |
| Race-to-bottom pricing war visible | **KILL** |

---

## Filter 5: Personal Interest

**Question:** Will you stay motivated for 2+ years?

### Assessment Method

AskUserQuestion with scale:

```
Rate your interest in building [idea] (1-5):

1 = Meh, would only do for money
2 = Low interest, could get bored
3 = Neutral, neither excited nor bored
4 = Interested, would enjoy building
5 = Excited, would build even for free
```

### Why This Matters

| Interest Level | Burnout Risk | Typical Outcome |
|----------------|--------------|-----------------|
| 1-2 | High (3-6 months) | Quit before PMF |
| 3 | Medium (6-12 months) | May pivot |
| 4-5 | Low | Sustain through hard times |

### KILL Criteria

| Score | Verdict |
|-------|---------|
| 4-5 | PASS |
| 3 | PASS (flag risk) |
| 1-2 | **KILL** |

---

## Filter 6: MVP-ability

**Question:** Can you launch something in ≤8 weeks?

### Assessment Factors

| Factor | Question | Red Flag |
|--------|----------|----------|
| **Tech Stack** | Do you know the required tech? | Learning new framework |
| **Dependencies** | Need external APIs/partners? | Waiting on others |
| **Content** | Significant content creation? | Months of writing |
| **Regulations** | Legal/compliance requirements? | Licenses, certifications |
| **Team** | Can you build solo? | Need to hire first |
| **Infrastructure** | Complex backend needed? | DevOps overhead |

### Time Scoring

| Weeks to MVP | Score | Complexity | Verdict |
|--------------|-------|------------|---------|
| 1-2 | 5 | Solo, existing skills | Best |
| 2-4 | 4 | Minor learning curve | Good |
| 4-6 | 3 | Some new tech | Acceptable |
| 6-8 | 2 | Significant work | Borderline |
| >8 | 1 | Major infrastructure | **KILL** |

### Common Blockers

| Blocker | Impact | Mitigation |
|---------|--------|------------|
| New tech stack | +2-4 weeks | Use familiar tools |
| External API integration | +1-2 weeks | Find simpler APIs |
| Content creation | +4-8 weeks | Start with minimal content |
| Compliance/legal | +4-12 weeks | Choose unregulated niche |
| Need co-founder | +4-12 weeks | Build simpler MVP solo |

### KILL Criteria

| Condition | Verdict |
|-----------|---------|
| ≤8 weeks with clear path | PASS |
| 8-12 weeks, known blockers | PASS if solvable |
| >8 weeks, multiple blockers | **KILL** |
| Requires team before start | **KILL** |
| Regulatory approval needed | **KILL** (unless expert) |

---

## Composite Scoring (Survivors Only)

For ideas that pass ALL filters, calculate composite score:

```
Score = Demand + (6 - Competition) + Revenue + Interest + MVP
```

**Maximum possible:** 5 + 5 + 5 + 5 + 5 = 25

### Score Interpretation

| Score | Verdict | Action |
|-------|---------|--------|
| 20-25 | **GO** | Strong opportunity, proceed to ln-210 |
| 15-19 | **CONSIDER** | Viable, review weak areas |
| <15 | **WEAK** | Passed filters but marginal |

---

## Quick Reference Card

| Filter | KILL If |
|--------|---------|
| 1. Traffic | No identifiable channel |
| 2. Demand | <1K searches/month |
| 3. Competition | >10 competitors (Index 5) |
| 4. Revenue | <$20/user ARPU |
| 5. Interest | User rates 1-2 |
| 6. MVP | >8 weeks to launch |

---

**Version:** 1.0.0
**Last Updated:** 2026-01-29

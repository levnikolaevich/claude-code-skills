# Traffic Channel Analysis

Traffic channel identification for ln-201-opportunity-discoverer.

> **Core principle:** No clear traffic channel = KILL idea. Don't build what you can't distribute.

---

## Channel Categories

### 1. Search/SEO

**Signal:** People Google "[problem] solution", "[problem] tool", "how to [problem]"

**Research:**
```
WebSearch: "[idea] search volume"
WebSearch: "[problem] keyword difficulty"
WebSearch: "[idea] SEO competition"
```

**Validation criteria:**
- Search volume >1K/month for core keyword
- Keyword difficulty <50 (manageable)
- Long-tail opportunities exist

**Best for:**
- Developer tools
- Productivity software
- Info products
- B2B SaaS

**CAC estimate:** $10-50/customer

**Time to results:** 3-12 months (slow ramp)

**Example signals:**
- "code review tool" — 10K/mo, KD 45
- "API documentation generator" — 2K/mo, KD 30

---

### 2. YouTube/Video

**Signal:** People search "[problem] tutorial", "how to [task]", "[tool] review"

**Research:**
```
WebSearch: "[idea] tutorial youtube views"
WebSearch: "[problem] youtube search volume"
```

**Validation criteria:**
- Tutorial videos get >10K views
- Active creators in niche
- Comments show buying intent

**Best for:**
- Education products
- Creative tools
- How-to services
- Visual products

**CAC estimate:** $5-30/customer

**Time to results:** 1-6 months (faster than SEO)

**Example signals:**
- "Figma tutorial" videos with 500K views
- "API testing tutorial" with active comments asking for tools

---

### 3. Marketplaces

**Signal:** Category exists on ProductHunt, AppStore, Chrome Web Store, etc.

**Research:**
```
WebSearch: "[idea] ProductHunt launches"
WebSearch: "[idea] Chrome extension category"
WebSearch: "[idea] Shopify app store"
```

**Validation criteria:**
- Category exists with active products
- Top products have reviews/ratings
- New launches get traction

**Best for:**
- Browser extensions
- Mobile apps
- Integrations/plugins
- E-commerce tools

**CAC estimate:** $0-20/customer (organic discovery)

**Time to results:** 1-3 months (if marketplace fits)

**Example signals:**
- "Developer tools" category on ProductHunt with weekly launches
- Chrome Web Store category with 10+ extensions, 100K+ users

---

### 4. Communities

**Signal:** Active subreddit, Discord, forum, Slack group discussing problem

**Research:**
```
WebSearch: "[problem] reddit"
WebSearch: "[idea] discord community"
WebSearch: "[problem] forum discussions"
```

**Validation criteria:**
- Subreddit >10K members
- Regular posts about problem (weekly+)
- Questions about solutions

**Best for:**
- Niche products
- Hobby/passion markets
- Developer tools
- Gaming-adjacent

**CAC estimate:** $5-30/customer

**Time to results:** 1-3 months (relationship building)

**Example signals:**
- r/webdev (2M members) discussing code review pain
- Discord with 5K developers asking about testing tools

---

### 5. Paid Ads (Google/Meta)

**Signal:** Competitors actively running ads for keywords

**Research:**
```
WebSearch: "[idea] Google ads competitors"
WebSearch: "[competitor] ad spend"
WebSearch: "[idea] Facebook ads examples"
```

**Validation criteria:**
- Competitors running ads consistently (>3 months)
- Ad spend visible (SpyFu, SEMrush)
- Ads lead to paid products (not just free)

**Best for:**
- Proven demand validation
- Quick market entry
- B2C products
- Lead generation

**CAC estimate:** $20-100/customer

**Time to results:** Days (instant traffic)

**Example signals:**
- Competitors spending $10K+/month on "[idea]" keywords
- Multiple ads running for same keyword

---

### 6. Outbound B2B

**Signal:** Clear ICP, reachable via LinkedIn/email, high ticket justifies outreach

**Research:**
```
WebSearch: "[idea] enterprise buyers"
WebSearch: "[idea] decision maker titles"
WebSearch: "[industry] LinkedIn groups"
```

**Validation criteria:**
- Clear job titles who buy
- Reachable via LinkedIn/email
- $1K+ deal size justifies outreach cost
- <1000 target companies (focused)

**Best for:**
- Enterprise software
- Consulting/services
- High-ticket SaaS
- Industry-specific tools

**CAC estimate:** $100-500/customer

**Time to results:** 1-3 months (sales cycle)

**Example signals:**
- "VP Engineering" clearly buys developer tools
- 500 target companies in specific industry

---

## Channel Selection Matrix

| Product Type | Primary Channel | Secondary Channel |
|--------------|-----------------|-------------------|
| Developer tool | SEO | Communities |
| Productivity SaaS | SEO | Paid Ads |
| Mobile app | App Store | YouTube |
| Browser extension | Chrome Store | Communities |
| Education | YouTube | SEO |
| Enterprise B2B | Outbound | SEO |
| E-commerce tool | Marketplace | Paid Ads |
| Niche hobby | Communities | YouTube |

---

## Channel Fit Assessment

### Quick Fit Test

| Question | If YES → Channel |
|----------|------------------|
| Do people Google the problem? | SEO |
| Do people watch tutorials? | YouTube |
| Is there a marketplace category? | Marketplace |
| Is there an active subreddit? | Communities |
| Are competitors running ads? | Paid Ads |
| Is it high-ticket B2B? | Outbound |

### Channel Strength Scoring

| Score | Channel Strength | Indicators |
|-------|------------------|------------|
| 5 | Strong | Multiple signals, competitors using |
| 4 | Good | Clear signal, some competition |
| 3 | Moderate | Signal exists, unproven |
| 2 | Weak | Indirect signals only |
| 1 | None | No identifiable channel → **KILL** |

---

## Red Flags (Channel KILL Signals)

| Red Flag | Meaning | Verdict |
|----------|---------|---------|
| "Viral growth" only plan | No reliable acquisition | KILL |
| "Word of mouth" primary | Can't control growth | KILL |
| No search volume, no community | Unvalidated demand | KILL |
| Competitors don't advertise | May not be monetizable | Flag |
| Only enterprise outbound works | Need sales team first | Flag |

---

## Research Query Templates

### For any idea, run these searches:

**SEO check:**
```
"[idea] search volume monthly"
"[problem] keyword difficulty"
```

**YouTube check:**
```
"[problem] tutorial youtube"
site:youtube.com "[problem]"
```

**Marketplace check:**
```
"[idea] ProductHunt"
"[idea] Chrome extension"
"[idea] app store"
```

**Community check:**
```
"[problem] reddit"
"[idea] discord"
"[problem] forum"
```

**Paid ads check:**
```
"[competitor] Google ads"
"[idea] Facebook ads examples"
```

**Outbound check:**
```
"[idea] enterprise customers"
"who buys [idea]"
```

---

## Channel Output Format

When documenting channel for idea:

```markdown
**Channel:** [Name]
**Signal strength:** [1-5]
**Evidence:** [What you found]
**CAC estimate:** $[X-Y]
**Time to first customers:** [X weeks/months]
**Risk:** [Low/Medium/High]
```

**Example:**

```markdown
**Channel:** SEO
**Signal strength:** 4
**Evidence:** "code review bot" has 5K/mo searches, competitors rank for it
**CAC estimate:** $20-40
**Time to first customers:** 3-6 months
**Risk:** Medium (SEO takes time)
```

---

**Version:** 1.0.0
**Last Updated:** 2026-01-29

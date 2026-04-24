# Research Query Templates

<!-- SCOPE: Market research query templates ONLY. Contains TAM/SAM/SOM framework, WebSearch patterns. -->
<!-- DO NOT add here: Prioritization logic → ln-230-story-prioritizer SKILL.md -->

WebSearch and MCP Ref query templates for ln-230-story-prioritizer market research.

---

## TAM/SAM/SOM Quick Framework

Structured approach to market sizing (inspired by McKinsey/BCG methodology).

### Definitions

| Level | Full Name | Question | Example |
|-------|-----------|----------|---------|
| **TAM** | Total Addressable Market | If everyone in the world who could buy, did buy? | $50B (all translation software) |
| **SAM** | Serviceable Addressable Market | Our target segment with our current offering? | $10B (API-based translation) |
| **SOM** | Serviceable Obtainable Market | Realistic capture in Year 1-3? | $500M (5% of SAM) |

### Query Templates for Each Level

| Level | Query Template | Expected Result |
|-------|----------------|-----------------|
| **TAM** | "[domain] total addressable market {current_year}" | $XB total market |
| **TAM** | "[domain] global market size forecast" | Market projections |
| **SAM** | "[domain] [segment] market size {current_year}" | $XB segment |
| **SAM** | "[product type] API market size" | API-specific market |
| **SOM** | "[domain] market share new entrant" | X% typical capture |
| **SOM** | "[competitor] market share {current_year}" | Competitor benchmarks |

### Recording Format for Market Column

| Format | Meaning | Example |
|--------|---------|---------|
| `$50B+ TAM` | Total market (all segments) | Translation industry |
| `$10B SAM` | Our target segment | API translation |
| `$500M SOM` | Realistic Year 1-3 capture | 5% of segment |
| `$2B+ (Tier 1)` | High-confidence estimate | Gartner source |
| `$5B? (Tier 3)` | Low-confidence estimate | Blog source |

### Quick Sizing Heuristics

When detailed research unavailable, use these multipliers:

| Known Data | TAM Estimate | SAM Estimate | SOM Estimate |
|------------|--------------|--------------|--------------|
| SAM = $X | TAM ≈ 3-5x SAM | SAM = $X | SOM ≈ 3-5% SAM |
| Top competitor = $Y revenue | TAM ≈ 5-10x $Y | SAM ≈ 2-3x $Y | SOM ≈ 0.5x $Y |
| Industry CAGR = Z% | - | Growing market | Higher SOM possible |

---

## Market Size Queries

### WebSearch Templates

| Purpose | Query Template | Expected Data |
|---------|----------------|---------------|
| TAM (Total Addressable Market) | "[domain] market size TAM {current_year}" | $XB total market |
| SAM (Serviceable Market) | "[domain] [segment] market size {current_year}" | $XB segment |
| Growth Rate | "[domain] market CAGR forecast" | X% annual growth |
| Industry Report | "[domain] industry analysis report {current_year}" | Market overview |

### MCP Ref Templates

| Purpose | Query Template | Expected Sources |
|---------|----------------|------------------|
| Market Reports | "[domain] market analysis Gartner Statista" | Industry reports |
| Industry Trends | "[domain] industry trends forecast" | Analyst predictions |
| Segment Analysis | "[domain] [segment] market report" | Segment breakdown |

### Domain-Specific Queries

| Domain | Market Query | Competition Query |
|--------|--------------|-------------------|
| **Translation API** | "machine translation API market size {current_year}" | "DeepL Google Translate API alternatives" |
| **Document Processing** | "document parsing PDF market {current_year}" | "PDF parsing API competitors" |
| **Authentication** | "identity management IAM market {current_year}" | "Auth0 Okta alternatives comparison" |
| **Payments** | "payment processing API market {current_year}" | "Stripe PayPal alternatives" |
| **AI/ML** | "AI API platform market size {current_year}" | "OpenAI Claude API competitors" |
| **Storage** | "cloud storage API market {current_year}" | "AWS S3 alternatives comparison" |

---

## Competition Queries

### WebSearch Templates

| Purpose | Query Template | Expected Data |
|---------|----------------|---------------|
| Direct Competitors | "[feature] competitors {current_year}" | Company names |
| Alternatives | "[feature] alternatives comparison" | Feature matrix |
| Market Leaders | "[domain] market leaders {current_year}" | Top players |
| Reviews | "[feature] best solutions G2 Capterra" | User reviews |

### Counting Methodology

1. **Search for competitors**
2. **Filter results:**
   - Must offer similar feature
   - Must be active (not unsupported)
   - Must have public pricing/docs
3. **Count unique competitors**
4. **Classify:**

| Count | Competition Index | Ocean Type |
|-------|-------------------|------------|
| 0 | 1 | Blue Ocean |
| 1-2 | 2 | Emerging |
| 3-5 | 3 | Growing |
| 6-10 | 4 | Mature |
| >10 | 5 | Red Ocean |

---

## Source Validation

### High Quality Sources (Confidence 0.9-1.0)

| Source Type | Examples | Use For |
|-------------|----------|---------|
| Industry Reports | Gartner, Forrester, IDC | TAM/SAM/SOM |
| Market Research | Statista, IBISWorld | Market size |
| Financial Data | SEC filings, Annual reports | Company revenue |
| Government | Trade associations, Census | Industry stats |

### Medium Quality Sources (Confidence 0.7-0.8)

| Source Type | Examples | Use For |
|-------------|----------|---------|
| Tech News | TechCrunch, VentureBeat | Funding, launches |
| Review Platforms | G2, Capterra, TrustRadius | Competitor lists |
| Company Blogs | Official announcements | Feature details |

### Low Quality Sources (Confidence 0.5-0.6)

| Source Type | Examples | Use For |
|-------------|----------|---------|
| Personal Blogs | Medium, Dev.to | Opinions |
| Forums | Reddit, HackerNews | User sentiment |
| Social Media | Twitter/X, LinkedIn | Trends |

---

## Query Optimization

### Parallel Queries

Run these in parallel for each Story:
```
WebSearch: "[customer problem] market size {current_year}"
WebSearch: "[feature] competitors alternatives"
mcp__Ref: "[domain] industry analysis"
```

### Query Fallbacks

If primary query fails:

| Primary | Fallback 1 | Fallback 2 |
|---------|------------|------------|
| "[feature] market size" | "[domain] market size" | "[industry] market {current_year}" |
| "[feature] competitors" | "[feature] alternatives" | "[feature] vs" |

### Time-Saving Tips

1. **Reuse domain context** - Same industry report works for multiple Stories
2. **Skip obvious Red Ocean** - If >10 results immediately, index = 5
3. **Cache competitor lists** - Same competitors appear across Stories
4. **Use date filters** - Add current year to queries

---

## Example Research Session

**Story:** "As API user, I want PDF translation, so that I process documents"

### Step 1: Market Size Query
```
WebSearch: "PDF translation API market size {current_year}"
```
**Result:** Document translation market $10B+ (Statista 2024)

### Step 2: Competition Query
```
WebSearch: "PDF translation API competitors DeepL Google"
```
**Result:** DeepL, Google Translate, Microsoft, Amazon, Eden AI, Taia (6 competitors)

### Step 3: Classify
- Competitors: 6 → Index = 4 (Mature market)
- Market: $10B+ → High opportunity
- Competition + Market = Red Ocean but large

### Step 4: Record Sources
| Source | Date | Data |
|--------|------|------|
| Statista | 2024-06 | $10B market |
| G2 | 2024-12 | 6 competitors |

---

**Version:** 1.0.0

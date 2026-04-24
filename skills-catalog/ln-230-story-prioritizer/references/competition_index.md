# Competition Index Guide

<!-- SCOPE: Competition Index (Blue/Red Ocean) scale ONLY. Contains competitor count → index mapping. -->
<!-- DO NOT add here: RICE scoring → rice_scoring_guide.md, prioritization logic → ln-230-story-prioritizer SKILL.md -->

Blue Ocean / Red Ocean classification for ln-230-story-prioritizer.

## Competition Index Scale

| Index | Ocean Type | Competitors | Market Characteristics |
|-------|------------|-------------|------------------------|
| **1** | Blue Ocean | 0 | No competition, new market creation |
| **2** | Emerging | 1-2 | Early market, first movers |
| **3** | Growing | 3-5 | Established market, differentiation possible |
| **4** | Mature | 6-10 | Crowded market, price competition starts |
| **5** | Red Ocean | >10 | Commoditized, race to bottom |

---

## Blue Ocean Indicators (Index 1-2)

**Score 1 (Pure Blue Ocean):**
- Zero direct competitors found
- New problem being solved
- No existing market category
- Potential to define the market

**Score 2 (Emerging Blue Ocean):**
- 1-2 early competitors
- Market still forming
- No clear leader
- Room for differentiation

**Priority Impact:** Competition 1-2 → **Automatic P0/P1** regardless of RICE score

---

## Red Ocean Indicators (Index 4-5)

**Score 4 (Mature Market):**
- 6-10 established competitors
- Clear market leaders exist
- Price competition common
- Differentiation difficult

**Score 5 (Red Ocean):**
- >10 competitors
- Commoditized features
- Race to bottom pricing
- Table stakes (must have, no differentiation)

**Priority Impact:** Competition 5 → **Forces P3** unless RICE >= 30

---

## Classification Process

### Step 1: Search for Competitors

```
WebSearch: "[feature] competitors {current_year}"
WebSearch: "[feature] alternatives comparison"
```

### Step 2: Filter Results

Include as competitor if:
- Offers **similar** feature (not just adjacent)
- Has **public** pricing or documentation
- Is **actively maintained** (updated in last 12 months)
- Serves **same customer segment**

Exclude:
- Unsupported or abandoned products
- Enterprise-only without public pricing
- Open source without commercial support
- Different market segment

### Step 3: Count and Classify

| Count | Index | Priority Impact |
|-------|-------|-----------------|
| 0 | 1 | P0 (monopoly opportunity) |
| 1-2 | 2 | P0/P1 (early mover advantage) |
| 3-5 | 3 | Normal RICE scoring |
| 6-10 | 4 | Consider differentiation angle |
| >10 | 5 | P3 unless critical need |

---

## Four Actions Framework (ERRC)

When Competition = 4-5, use ERRC to find differentiation:

| Action | Question | Example |
|--------|----------|---------|
| **Eliminate** | What can we remove that industry takes for granted? | Complex setup, manual config |
| **Reduce** | What can we lower below standard? | Price, time to value |
| **Raise** | What can we increase above standard? | Speed, accuracy, support |
| **Create** | What can we introduce that's never offered? | Unique feature, novel approach |

**If ERRC identifies differentiation:** Can boost Competition Index by -1

---

## Porter's Quick Check (Optional Deep Analysis)

When Competition Index = 3-4 (Growing/Mature), use Porter's Five Forces for ±1 adjustment.

### 30-Second Assessment

| Force | Quick Question | If YES → |
|-------|----------------|----------|
| **Threat of New Entrants** | Easy to build from scratch? (< 1 month) | +1 to index (more will enter) |
| **Threat of Substitutes** | Free/OSS alternatives exist? | +1 to index (price pressure) |
| **Buyer Power** | Can customers switch in < 1 day? | Harder to monetize |
| **Supplier Power** | Platform lock-in risk? (AWS, Google, etc.) | Dependency risk |
| **Competitive Rivalry** | Price war happening? | +1 to index |

### Porter's Adjustment Rules

| Current Index | Porter's Score | Final Index |
|---------------|----------------|-------------|
| 3 Growing | 3+ YES answers | 4 Mature |
| 3 Growing | 0-2 YES answers | 3 Growing (no change) |
| 4 Mature | 0-1 YES answers | 3 Growing |
| 4 Mature | 2+ YES answers | 5 Red Ocean |

### When to Skip Porter's

- **Competition = 1-2:** Always Blue Ocean, no need for Porter's
- **Competition = 5:** Already Red Ocean, Porter's won't help
- **Time pressure:** Skip if < 5 min per Story available

---

## Examples

### Example 1: Blue Ocean (Index 1)

**Feature:** "AI-powered translation for rare languages (Kazakh, Uzbek)"

**Search Results:**
- Google Translate: Limited quality for rare languages
- DeepL: Does not support
- Others: No support

**Classification:** Index = 1 (no direct competitors for quality rare language translation)
**Impact:** Automatic P0

### Example 2: Red Ocean (Index 5)

**Feature:** "PDF to text extraction"

**Search Results:**
- Adobe, Google, Microsoft, Amazon, Abbyy, Tesseract, pdfminer, PyPDF2, Camelot, Tabula, DocParser, Textract... (15+ competitors)

**Classification:** Index = 5 (commoditized, open source alternatives)
**Impact:** Forces P3 unless table stakes for enterprise

### Example 3: Growing Market (Index 3)

**Feature:** "Real-time translation API with WebSocket"

**Search Results:**
- Google Cloud Speech-to-Text (streaming)
- AWS Transcribe (streaming)
- Deepgram (real-time)
- AssemblyAI (real-time)

**Classification:** Index = 3 (4 competitors, market growing)
**Impact:** Normal RICE scoring applies

---

## Priority Override Rules

| Condition | Priority Override |
|-----------|-------------------|
| Competition = 1 | → P0 (regardless of RICE) |
| Competition = 2 AND RICE >= 10 | → P0 |
| Competition = 2 AND RICE < 10 | → P1 |
| Competition = 5 AND RICE < 30 | → P3 (forced) |
| Competition = 5 AND RICE >= 30 | → P1 (table stakes, must have) |

---

## Recording in Output

**Competition column format:**

```
| Competition |
|-------------|
| 1 Blue      |
| 2 Emerging  |
| 3 Growing   |
| 4 Mature    |
| 5 Red       |
```

**With competitor names (optional):**

```
| Competition | Key Competitors |
|-------------|-----------------|
| 3 Growing   | DeepL, Google, Microsoft |
```

---

**Version:** 1.0.0

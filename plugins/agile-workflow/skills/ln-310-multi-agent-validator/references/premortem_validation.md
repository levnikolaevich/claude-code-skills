# Pre-mortem Validation (Criterion #27)

<!-- SCOPE: Pre-mortem analysis criterion #27 ONLY. Contains Tiger/Paper Tiger/Elephant classification, evidence test, actions. -->
<!-- DO NOT add here: Risk categories → risk_validation.md, assumptions → structural_validation.md (#24) -->

Detailed rules for pre-mortem analysis of Story risks and unstated assumptions.

---

## Criterion #27: Pre-mortem Analysis

**Check:** Story has been analyzed for hidden risks (Tigers) and unstated assumptions (Elephants)

**Penalty:** MEDIUM (3 points)

**Skip When:**
- Story complexity < Medium (1-2 tasks, no external deps, known tech)
- Story in Done/Canceled status

---

## Pre-mortem Algorithm

### Step 1: Read Story (all 9 sections)

Load complete Story description including Technical Notes, Dependencies, AC, and Assumptions.

### Step 2: Failure Imagination

Prompt: **"Imagine this Story failed completely during implementation. What went wrong?"**

Systematically check 4 domains for unstated assumptions:

| Domain | Questions |
|--------|-----------|
| **Infrastructure** | Does the required infra exist? Is it configured? Do we have access? |
| **Data** | Is data in expected format? Volume within limits? Quality sufficient? |
| **External** | Will external APIs behave as expected? SLAs hold? Auth work? |
| **Scope** | Is anything implicitly excluded that should be explicit? Hidden requirements? |

### Step 3: Evidence Test & Classification

For each identified concern, apply the evidence test:

| Type | Definition | Evidence Test | Action |
|------|-----------|---------------|--------|
| **Tiger** | Real risk with concrete evidence | Specific technical constraint, known limitation, documented issue | → Add to Risk criterion #20 as new risk item |
| **Paper Tiger** | Fear without evidence | "What if..." without data, hypothetical scenario, no concrete constraint | → Document in pre-mortem table and dismiss |
| **Elephant** | Unstated assumption everyone relies on | "We assumed this would...", implicit dependency, unspoken prerequisite | → Add to Assumptions #24 with `[pre-mortem]` tag, Confidence=LOW |

### Step 4: Output

Generate pre-mortem table for Phase 3 audit report:

```markdown
## Pre-mortem Analysis

| # | Concern | Type | Evidence | Action |
|---|---------|------|----------|--------|
| 1 | Redis not available in staging | Tiger | Ops confirmed no Redis in staging env | → Risk #20: add staging env risk |
| 2 | "What if API rate limit changes?" | Paper Tiger | No indication of change; current limit documented | Dismissed |
| 3 | Assumes PostgreSQL supports JSONB | Elephant | Not verified in current DB version | → Assumption A3 [pre-mortem], LOW |
```

---

## Scoring

- Pre-mortem executed AND table present → PASS (0 points)
- Pre-mortem skipped for complex Story (≥3 tasks, external deps, unfamiliar tech) → MEDIUM (3 points)
- Pre-mortem not needed (simple Story) → PASS (skip, 0 points)

---

## Feed-forward Rules

Pre-mortem runs in **Step 5** (before Penalty Calculation in Step 7), so its outputs feed into scoring:

| Output | Target | How |
|--------|--------|-----|
| Tigers | Risk #20 | Add as new risk with Impact x Probability scoring |
| Elephants | Assumptions #24 | Add with `[pre-mortem]` tag, Category from domain, Confidence=LOW |
| Paper Tigers | Audit report only | Document for transparency, no penalty impact |

**Important:** Tigers and Elephants discovered here are scored by their target criteria (#20, #24) in Step 7. The pre-mortem criterion #27 itself only checks whether the analysis was performed.

---

## Auto-fix Actions

1. **Missing pre-mortem (complex Story):**
   - Execute pre-mortem algorithm (Steps 1-4)
   - Generate pre-mortem table
   - Feed Tigers → #20, Elephants → #24
   - Add table to Story audit report

2. **Pre-mortem already present:**
   - Verify classifications are correct (evidence test)
   - Verify feed-forward actions were taken (Tigers in #20, Elephants in #24)

---

## Examples

### Example 1: API Integration Story (Complex)

```markdown
## Pre-mortem Analysis

| # | Concern | Type | Evidence | Action |
|---|---------|------|----------|--------|
| 1 | Stripe API v2 deprecation in Q3 | Tiger | Stripe changelog announces v2 sunset | → Risk #20: migration timeline risk |
| 2 | "What if payment fails mid-checkout?" | Paper Tiger | Already handled by AC error scenarios | Dismissed |
| 3 | Assumes webhook endpoint is publicly accessible | Elephant | No infra verification done | → A4 DEPENDENCY [pre-mortem], LOW |
| 4 | Assumes test Stripe keys available | Elephant | Dev env config not checked | → A5 FEASIBILITY [pre-mortem], LOW |
```

### Example 2: Simple CRUD Story (Skip)

Story: "Add user profile edit form" — 2 tasks, no external deps, known React patterns.
→ Pre-mortem skipped (complexity < Medium). PASS.

---

## Execution Order

**Step 5 in Phase 3** (before Penalty Calculation):

```
Step 1: Domain Extraction
Step 2: Documentation Delegation
Step 3: Research via MCP
Step 4: Anti-Hallucination Verification
→ Step 5: Pre-mortem Analysis
  - Classify Tigers/Paper Tigers/Elephants
  - Feed Tigers → Risk #20
  - Feed Elephants → Assumptions #24
Step 6: Cross-Reference Analysis (#25-#26)
→ Step 7: Penalty Calculation (includes #20 with Tigers, #24 with Elephants)
```

**Rationale:** Pre-mortem must run before penalty calculation so that discovered risks and assumptions are included in the scoring pass. Running after would create a back-edge requiring a second scoring pass.

---

## Integration with Other Criteria

**Criterion #20 (Risk Analysis):**
- #20 checks documented risks in Technical Notes
- #27 discovers NEW risks via pre-mortem imagination
- Tigers from #27 are added to #20's risk inventory before scoring

**Criterion #24 (Assumption Registry):**
- #24 checks Assumptions section completeness
- #27 discovers UNSTATED assumptions (Elephants)
- Elephants from #27 are added to #24's table with [pre-mortem] tag

**Criterion #5 (Standards Compliance):**
- #5 checks RFC/OWASP references
- #27 may discover that compliance was assumed but not verified
- Complementary: #27 surfaces assumptions, #5 verifies them

---

**Version:** 1.0.0
**Last Updated:** 2026-03-08

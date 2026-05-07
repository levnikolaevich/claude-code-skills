<!-- SOURCE-OF-TRUTH: shared/references/replan_algorithm_stories.md. Edit ONLY here; run `node tools/marketplace/shared.mjs sync` -->

# Story Replan Algorithm

<!-- SCOPE: ln-222-story-replanner comparison logic ONLY. Contains KEEP/UPDATE/OBSOLETE/CREATE operations, diff generation, status constraints. -->
<!-- DO NOT add here: coordinator logic → ln-220-story-coordinator SKILL.md, Task replan → ln-302-task-replanner -->

**MANDATORY READ:** Load `references/replan_algorithm.md` for Operations Matrix, Status Constraints, Edge Cases, Best Practices.

Comparison logic for ln-222-story-replanner REPLAN MODE. Determines operations (KEEP/UPDATE/OBSOLETE/CREATE) when existing Stories found for Epic.

## Overview

**Key Principle:** IDEAL plan (from ln-220 Phase 3) = source of truth. Compare existing Stories against IDEAL.

**Inputs:**
- IDEAL Story Plan: 5-10 Stories, vertical slices, AC 3-5 each, Standards Research from ln-220
- Existing Stories: Linear issues (Story Statement, AC, Technical Notes with Standards Research, status)

## Comparison Algorithm

### Match Criteria

**For EACH Story in IDEAL:**
- Extract: Title, Persona, Capability, Value
- Search existing: Fuzzy match title, check persona overlap, check capability overlap
- Result: Match found → KEEP/UPDATE candidate | No match → CREATE

**For EACH existing Story:**
- Extract: Title, Persona, Capability, Value (from Story Statement)
- Search IDEAL: Fuzzy match
- Result: Match found → KEEP/UPDATE candidate | No match → OBSOLETE

### Story-Specific Criteria

**For KEEP/UPDATE decision:** Compare Standards Research section (from Technical Notes → Library Research).

**Story-specific edge case:** Standards Research changed → UPDATE all affected Stories (Backlog/Todo only).

## Example Scenarios

### Scenario 1: AC + Standards Research Update

**Change:** AC5 "PKCE flow" added to US005, RFC 7636 added to Epic

**IDEAL:** US005 (AC1-AC5, OAuth 2.0 + RFC 7636 PKCE)
**Existing:** US005 (AC1-AC4, OAuth 2.0 ONLY)

**Operation:** UPDATE US005
- Add AC5: "Given public client, When request token with PKCE, Then validate code_challenge"
- Update Technical Notes → Library Research: Add RFC 7636 (PKCE)
- Update Test Strategy: Add 2 Integration tests

### Scenario 2: Feature Removed

**Change:** Custom token formats removed from Epic Scope In

**IDEAL:** 5 Stories (US004-US008, standard OAuth 2.0 only)
**Existing:** 6 Stories (US004-US009, US009 = custom tokens)

**Operation:** OBSOLETE US009
- Comment: "Custom token formats removed from Epic Scope In per Epic v2.0.0. Simplified to standard OAuth 2.0 only."

### Scenario 3: New Story Added

**Change:** NEW capability "Token scope management" added to Epic

**IDEAL:** 6 Stories (US004-US009, US009 = token scopes NEW)
**Existing:** 5 Stories (US004-US008)

**Operation:** CREATE US009
- Persona: API client
- Capability: Request tokens with specific scopes (read, write, admin)
- AC: 4 scenarios
- Standards Research: OAuth 2.0 Scope (RFC 6749 Section 3.3)

### Scenario 4: Story Split (1 → 2+)

**Change:** US004 "User authentication" split into 3 focused Stories

**IDEAL:** US004 "Login" + US005 "Password reset" + US006 "Session"
**Existing:** US004 "User authentication" (AC1-AC9: login + password + session)

**Detection:** US004 existing matches US004 IDEAL (70%), US005 IDEAL (60%), US006 IDEAL (55%)

**Operations:**
- UPDATE US004: Narrow to "Login" only (keep AC1-AC3, remove AC4-AC9)
- CREATE US005: "Password reset" (AC4-AC6 from old US004)
- CREATE US006: "Session management" (AC7-AC9 from old US004)

⚠️ Warning: "Story Split detected: US004 'User authentication' → US004 'Login' (update) + US005 'Password reset' (create) + US006 'Session management' (create)"

### Scenario 5: Story Merge (2+ → 1)

**Change:** US004 "Product list" + US005 "Product search" merged into US004 "Product catalog"

**IDEAL:** US004 "Product catalog" (list + search combined)
**Existing:** US004 "Product list" (AC1-AC3) + US005 "Product search" (AC4-AC6)

**Detection:** (US004 + US005 existing) matches US004 IDEAL (85% similarity)

**Operations:**
- UPDATE US004: Expand to "Product catalog" (add AC4-AC6 from US005)
- OBSOLETE US005: Comment "Merged into US004 Product catalog for vertical slicing"

⚠️ Warning: "Story Merge detected: US004 'Product list' + US005 'Product search' → US004 'Product catalog' (update US004, obsolete US005)"

### Story-Specific Best Practices

- **Vertical Slicing:** Ensure IDEAL plan uses vertical slices (complete user journeys)
- **Standards Consistency:** UPDATE all affected Stories when Epic standards change (Backlog/Todo only)

## Output Format

```
REPLAN SUMMARY for Epic 7: OAuth Authentication

IDEAL PLAN:
1. US004: Register OAuth client (Persona: Third-party developer)
2. US005: Request access token ← AC5 ADDED! ← RFC 7636 PKCE ADDED!
3. US006: Validate access token
4. US007: Refresh expired token
5. US009: Token scope management (NEW!)

EXISTING STORIES:

✓ US004: Register OAuth client - Status: Done - KEEP
⚠ US005: Request access token - Status: Todo - UPDATE
   Changes: Add AC5, Add RFC 7636 to Technical Notes, Add 2 Integration tests
   Diff (AC): + AC5 "Given public client, When request with PKCE..."
   Diff (Technical Notes): + RFC 7636 (PKCE)
✓ US006: Validate access token - Status: Backlog - KEEP
✓ US007: Refresh expired token - Status: In Progress - KEEP
✗ US008: Custom token formats - Status: Todo - OBSOLETE (feature removed)
+ US009: Token scope management - NEW (14h, 20 tests)

OPERATIONS: 3 keep, 1 update, 1 cancel, 1 create

WARNINGS:
- ⚠️ US005 (Todo): AC changed, Standards Research updated
- ⚠️ US008 (Todo): Feature removed - check dependencies

Type "confirm" to execute.
```

---

**Version:** 2.0.0
**Last Updated:** 2026-02-05

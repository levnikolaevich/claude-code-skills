# Cross-Reference Validation (Criteria #25-#26)

<!-- SCOPE: Cross-Story overlap and duplication criteria #25-#26 ONLY. Contains AC overlap detection, task duplication checks. -->
<!-- DO NOT add here: Story dependencies -> dependency_validation.md, risk -> risk_validation.md -->

Detailed rules for cross-Story overlap detection and task deduplication within an Epic.

---

## Criterion #25: AC Cross-Story Overlap

**Check:** Story AC doesn't overlap or conflict with active sibling Stories in same Epic

**Penalty:** MEDIUM (3 points) for overlap / CRITICAL (10 points) for conflict

**Cap:** Max 1 CRITICAL = 10 points (report all conflicts, score only worst). Skip when Epic has only 1 Story, all siblings Done/Canceled, or Story not part of any Epic.

### Sibling Scanning Algorithm

**Step 1: Load Sibling Stories**
```
siblings = list_issues(project=Epic.id, label="user-story")
           .filter(status IN [Backlog, Todo, In Progress])
           .filter(id != current_story.id)

IF siblings.count == 0 -> PASS (skip check)
```

**Step 2: Structured Traceability (Primary — scored)**

| Signal | Method | Match = Overlap |
|--------|--------|-----------------|
| AC IDs | Extract AC identifiers (AC1, AC2...) from both Stories | Same AC ID in both |
| Affected Components | Parse `## Affected Components` from Tasks | Same file path/component |
| Dependency targets | Parse `## Dependencies` sections | Both depend on/block same Story |
| Implementation file paths | Extract file paths from Implementation Plan | Same file modified by both |

Overlap detected: >=2 structural signals match -> MEDIUM (3 points), add overlap note.

**Step 3: Conflict Detection (scored)**
```
FOR EACH overlapping_ac_pair:
  IF same Given + same When + DIFFERENT Then:
    -> CRITICAL (10 points), FLAG for human resolution
```

Example: Story A says "GET /users -> paginated list", Story B says "GET /users -> full list with cache" = same precondition + action, conflicting outcomes = CRITICAL.

**Step 4: Keyword Overlap (Fallback — advisory only, NOT scored)**
```
FOR EACH sibling:
  overlap_ratio = keyword_intersection / min(keyword_count_a, keyword_count_b)
  IF overlap_ratio > 0.70:
    -> WARNING note (no penalty): "Advisory: high keyword similarity with Story {id}"
```

Advisory-only because keyword overlap produces false positives on formulaic text.

### Auto-fix Actions #25

1. **Overlap (MEDIUM):** Add note: `> [!NOTE] Cross-Reference: Overlapping scope with Story {id} — shared components: {list}`
2. **Conflict (CRITICAL):** Flag only (human resolution): `> [!WARNING] CRITICAL: AC Conflict with Story {id} — same Given/When, different Then`

---

## Criterion #26: Task Cross-Story Duplication

**Check:** Tasks don't duplicate sibling Stories' tasks

**Penalty:** LOW (1 point per duplication, max 3). Skip when Epic has only 1 Story, all sibling Stories have no tasks, or Story not part of any Epic.

### Detection Algorithm

**Step 1: Load Sibling Task Metadata**
```
FOR EACH active sibling Story:
  sibling_tasks = list_issues(parentId=sibling.id)
  Extract: title, Affected Components (file paths)
```

**Step 2: Structured Match (Primary — scored)**

| Signal | Method | Match = Duplication |
|--------|--------|---------------------|
| Affected Components | Parse `## Affected Components` from each task | Same file paths |
| Implementation targets | Extract modified files from Implementation Plan | Same files modified |

Duplication detected: >=2 file paths shared between tasks across Stories -> LOW (1 point per match, max 3).

**Step 3: Title Keyword Overlap (Fallback — advisory only)**
```
IF title keyword overlap > 0.80:
  -> WARNING note (no penalty): "Advisory: task similar to '{title}' in Story {id}"
```

Human decides: duplication warnings are informational, no auto-delete.

### Auto-fix Actions #26

Add advisory note: `> [!NOTE] DRY Warning (Cross-Story): Similar task in Story {id} — shared files: {list}`

---

**Version:** 1.0.0
**Last Updated:** 2026-03-08

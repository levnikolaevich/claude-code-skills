# Linear Integration Guide

Discovery and API reference for creating Linear Projects (Epics) and User Stories.

---

## Part 1: Discovery

Auto-discovering Linear configuration from centralized source.

### Finding Team ID

**Primary source:** `docs/tasks/kanban_board.md`

Read Linear Configuration table:
```markdown
## Linear Configuration

| Variable | Value |
|----------|-------|
| **Team ID** | PrompsitAPI |
| **Team Key** | API |
| **Next Epic Number** | 7 |
```

Extract **Team ID** value from table.

**Fallback:** Ask user "What is your Linear team ID?" (formats: "PrompsitAPI", "API")

### Finding Next Epic Number

**Primary source:** `docs/tasks/kanban_board.md`

Read Linear Configuration table → **Next Epic Number** field.

**Verification (optional):** Query Linear Projects via MCP to verify:
```
mcp__linear-server__list_projects(team="<TEAM_ID>")
```
Extract Epic numbers from project names matching `Epic \d+`, take MAX.

**Fallback:** Ask user "What is the next Epic number?" (formats: "7", "1" if first)

### Finding Next Story Number

**Primary source:** `docs/tasks/kanban_board.md`

Read Epic Story Counters table:
```markdown
### Epic Story Counters

| Epic | Last Story | Next Available |
|------|-----------|----------------|
| Epic 6 | - | US001 |
| Epic 7+ | - | US001 |
```

For specified Epic → Read **Next Available** column.

**Format:** US001, US002, US010 (zero-padded, 3 digits)

**Fallback:** Ask user "What is the next Story number for Epic N?" (default: "US001")

---

## Part 2: Create Project API

### MCP Function

```
mcp__linear-server__create_project(
    name: str,              # Required - "Epic N: Title"
    team: str,              # Required - Team ID/key
    description: str = "",  # Full Epic markdown
    startDate: str = "",    # ISO format YYYY-MM-DD
    targetDate: str = "",   # ISO format YYYY-MM-DD
    summary: str = ""       # Max 255 chars
)
```

### Parameters

**name** (required):
- Format: "Epic N: Title"
- Example: "Epic 7: OAuth2 Authentication"

**team** (required):
- Team ID or key
- Example: "API", "PrompsitAPI"

**description** (optional):
- Full Epic content in Markdown
- Includes: Goal, Scope, Success Criteria, Risks

**summary** (optional):
- One-sentence goal (max 255 chars)
- Example: "Implement OAuth2 authentication for API security"

### Return Value

```
{
    "success": True,
    "projectId": "abc123-xyz",
    "url": "https://linear.app/workspace/project/abc123"
}
```

### Example Usage

```
result = mcp__linear-server__create_project(
    name="Epic 7: OAuth2 Authentication",
    team="API",
    description="""
# Goal
Enable secure API authentication using OAuth2.

## In Scope
- Token generation and validation
- Refresh token flow
- User profile API

## Out of Scope
- Password reset
- Social login

## Success Criteria
- Auth endpoint responds <200ms p95
- 99.9% uptime
- Zero security vulnerabilities
""",
    summary="Implement OAuth2 authentication for API security",
    startDate="2025-10-24",
    targetDate="2025-12-15"
)

# Returns URL to created project
```

### Error Handling

**Team not found:** Verify team exists, check spelling
**Invalid date:** Use "YYYY-MM-DD" format only
**Creation failed:** Create minimal project (name + team only), add details in Linear UI

---

## Part 3: Create Issue API (User Stories)

### MCP Function

```
mcp__linear-server__create_issue(
    title: str,              # Required - "USXXX: Title"
    team: str,               # Required - Team ID/key
    description: str = "",   # Full Story markdown
    project: str = "",       # Epic name to link to
    labels: list = [],       # ["user-story"] for parent stories
    parentId: str = None     # null for User Stories, Story ID for tasks
)
```

### Parameters for User Stories

**title** (required):
- Format: "USXXX: Title"
- Example: "US001: Token Generation Service"

**team** (required):
- Team ID or key
- Example: "API", "PrompsitAPI"

**description** (optional):
- Full Story content in Markdown
- Includes: Story (As a..), Context, AC, Technical Notes, DoD

**project** (optional):
- Epic name to link story to
- Example: "Epic 7: OAuth2 Authentication"

**labels** (required for User Stories):
- Must include: ["user-story"]
- Identifies as parent for tasks

**parentId** (required):
- Set to null for User Stories (they are parents)
- Set to Story ID for tasks (children)

### Return Value

```
{
    "success": True,
    "issueId": "API-123",
    "url": "https://linear.app/workspace/issue/API-123"
}
```

### Example Usage

```
result = mcp__linear-server__create_issue(
    title="US001: OAuth Token Authentication",
    team="API",
    description="""
## Story
**As a** mobile app developer
**I want** to authenticate API requests with OAuth2 tokens
**So that** users can securely access their data

## Acceptance Criteria
- **Given** valid token **When** request sent **Then** returns 200
- **Given** invalid token **When** request sent **Then** returns 401
""",
    project="Epic 7: OAuth2 Authentication",
    labels=["user-story"],
    parentId=None
)

# Returns URL to created User Story
```

### Error Handling

**Team not found:** Verify team exists, check spelling
**Project not found:** Verify Epic name matches exactly in Linear
**Creation failed:** Create minimal issue (title + team only), add details in Linear UI

---

## Part 4: Get Issue and List Issues APIs

### Why Needed?

- `create_issue` returns only **short ID** (e.g., "API-123")
- `list_issues(parentId=...)` requires **UUID** (e.g., "333e6aa2-64d6-47de-b07b-7385756ae014")
- Must use `get_issue` to retrieve UUID from short ID

### Get Issue API

**MCP Function:**

```
mcp__linear-server__get_issue(
    id: str  # Short ID (API-123) OR UUID
)
```

**Parameters:**

**id** (required):
- Accepts: Short ID (e.g., "API-123", "US001") OR UUID
- Example: "API-97" or "333e6aa2-64d6-47de-b07b-7385756ae014"

**Return Value:**

Full issue object with:
- **id**: UUID (internal Linear ID) - "333e6aa2-64d6-47de-b07b-7385756ae014"
- **identifier**: Short ID - "API-123"
- **title**: Issue title
- **description**: Full markdown description
- **state**: Current status
- **labels**: Array of labels
- **parentId**: Parent issue UUID (for child tasks)
- **project**: Epic/Project object
- Other fields: assignee, createdAt, updatedAt, etc.

**Example Usage:**

```python
# Get Story by short ID
story = mcp__linear-server__get_issue(id="API-97")
story_uuid = story["id"]  # Extract UUID: "333e6aa2-64d6-47de-b07b-7385756ae014"
story_short_id = story["identifier"]  # "API-97"
```

### List Issues API

**MCP Function:**

```
mcp__linear-server__list_issues(
    team: str = None,          # Team name/ID
    parentId: str = None,      # ⚠️ MUST BE UUID, NOT short ID
    state: str = None,         # Filter by state
    labels: list = None,       # Filter by labels
    limit: int = 50            # Max results
)
```

**Critical Parameter:**

**parentId** (optional):
- ⚠️ **MUST BE UUID**, NOT short ID
- ❌ Wrong: `parentId="API-97"` (short ID) - **WILL FAIL**
- ✅ Correct: `parentId="333e6aa2-64d6-47de-b07b-7385756ae014"` (UUID)

**Example Usage:**

```python
# WRONG - will fail with error
tasks = mcp__linear-server__list_issues(
    parentId="API-97"  # ❌ Short ID doesn't work
)

# CORRECT - get UUID first
story = mcp__linear-server__get_issue(id="API-97")
story_uuid = story["id"]  # Extract UUID

tasks = mcp__linear-server__list_issues(
    parentId=story_uuid  # ✅ Use UUID
)
```

### Workflow Pattern

**When fetching child tasks:**

```python
# Step 1: Get parent Story by short ID (from user input)
story_short_id = "API-97"  # From user or kanban_board.md
story = mcp__linear-server__get_issue(id=story_short_id)

# Step 2: Extract UUID from Story object
story_uuid = story["id"]  # "333e6aa2-64d6-47de-b07b-7385756ae014"

# Step 3: Fetch child Tasks using UUID as parentId
child_tasks = mcp__linear-server__list_issues(
    parentId=story_uuid,  # ✅ Must use UUID
    limit=50
)

# Result: List of all child Tasks for this Story
```

**When creating child task:**

```python
# Step 1: Get parent Story UUID (same as above)
story = mcp__linear-server__get_issue(id="API-97")
story_uuid = story["id"]

# Step 2: Create child task with UUID as parentId
result = mcp__linear-server__create_issue(
    title="Task: Implement feature",
    team="API",
    description="Task description...",
    parentId=story_uuid,  # ✅ Must use UUID
    labels=[]
)
```

### Error Handling

**Issue not found:**
- Verify short ID exists in Linear
- Check team context (issue might be in different team)

**Empty list returned:**
- Verify parentId is UUID, not short ID
- Check if Story has any child tasks (may be legitimately empty)
- Verify Story status (canceled stories may not show tasks)

---

**Version:** 4.0.0 (Added Part 4: Get Issue and List Issues)
**Last Updated:** 2025-11-03
**Changes from v3.0.0:**
- Added Part 4 with get_issue and list_issues documentation
- Explained UUID vs short ID distinction
- Provided workflow patterns for fetching child tasks and creating child issues

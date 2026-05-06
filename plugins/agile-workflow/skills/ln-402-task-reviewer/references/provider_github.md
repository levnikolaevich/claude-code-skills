# GitHub Issues Provider Operations

<!-- SCOPE: Full operation pseudocode for GitHub Mode. Loaded only when environment_state.json task_management.provider=github. Uses gh CLI + GitHub REST API for sub-issues and Projects v2 for status tracking. -->

## Scope

Provider-specific transport for tracker semantic operations defined in `tracker_provider_contract.md`. Binds those operations to the `gh` CLI, GitHub REST sub-issue API, and Projects v2.

## Prerequisites

- `gh` CLI installed and authenticated (`gh auth status`)
- `gh` token has `project` scope (Projects v2 mutations)
- Repository accessible via `gh repo view --json owner,name`
- GitHub Project with Status field carrying the 7 canonical options (see Init)

## Init

GitHub mode performs a **mutating preflight** because Projects v2 setup must complete before any tracker write. On first call per environment-setup run:

1. **Auth check (read-only):**
   ```
   gh auth status                                              # must succeed
   gh auth status --show-token --json scopes 2>/dev/null \
     | jq -r '.scopes[]' | grep -q "^project$"                 # must include project
   ```
   If `project` scope missing, fail fast with remediation: `gh auth refresh -s project`.

2. **Repo detection (read-only):**
   ```
   REPO=$(gh repo view --json nameWithOwner --jq '.nameWithOwner')
   ```

3. **Project resolution (mutating if missing):**
   ```
   IF environment_state.json -> task_management.github.project_number is set:
     gh project view {N} --owner {OWNER}                       # must succeed
   ELSE:
     gh project create --owner {OWNER} --title "Task Board"
     # Persist returned number into environment_state.json
   ```

4. **Status field preflight (mutating if missing):**
   ```
   FIELDS=$(gh project field-list {N} --owner {OWNER} --format json)
   STATUS_FIELD=$(echo "$FIELDS" | jq '.fields[] | select(.name == "Status")')
   REQUIRED=("Backlog" "Todo" "In Progress" "To Review" "To Rework" "Done" "Canceled")
   FOR option IN "${REQUIRED[@]}":
     EXISTS=$(echo "$STATUS_FIELD" | jq --arg n "$option" '.options[] | select(.name == $n)')
     IF empty: fail with remediation:
       "Project {N} Status field is missing option '$option'. Add it via project UI or recreate the field."
   ```
   The 7 canonical options must pre-exist; the runtime does NOT silently rewrite a project's Status field.

5. **Label preflight (mutating, idempotent):**
   ```
   gh label create "epic"           -R $REPO --color "7057FF" --force
   gh label create "user-story"     -R $REPO --color "0E8A16" --force
   gh label create "task"           -R $REPO --color "1D76DB" --force
   gh label create "implementation" -R $REPO --color "BFD4F2" --force
   gh label create "tests"          -R $REPO --color "D4C5F9" --force
   gh label create "refactoring"    -R $REPO --color "C2E0C6" --force
   gh label create "bug"            -R $REPO --color "FC2929" --force
   ```

## Epic Operations (Top-Level Issues)

| Operation | Command |
|-----------|---------|
| `listEpics` | `gh issue list -R {REPO} --label "epic" --state all --json number,title,body,state` |
| `getEpic` | `gh issue view {number} -R {REPO} --json number,title,body,state,labels` |
| `createEpic` | `gh issue create -R {REPO} --title "Epic {N}: {Title}" --body "{doc}" --label "epic"` → add to project → set status `Backlog` |
| `updateEpic` | `gh issue edit {number} -R {REPO} --body "{doc}"` |

## Story Operations (Sub-Issues of Epic)

| Operation | Command |
|-----------|---------|
| `listStoriesByEpic` | `gh api -H "X-GitHub-Api-Version: 2026-03-10" /repos/{O}/{R}/issues/{epic_num}/sub_issues --jq '.[].number'` then filter by `user-story` label |
| `getStory` | `gh issue view {number} -R {REPO} --json number,title,body,state,labels` |
| `createStory` | See Story Creation Workflow below |
| `updateStory` | `gh issue edit {number} -R {REPO} --body "{doc}"` |
| `updateStatus` | See Status Update below |
| `cancel` | Set status to `Canceled` + `gh issue close {number} -R {REPO}` |

### Story Creation Workflow

```
1. Create issue:
   gh issue create -R {REPO} \
     --title "US{NNN}: {Title}" \
     --body "{doc}" \
     --label "user-story"
   → Capture returned issue number

2. Get internal sub-issue ID (NOT the issue number):
   SUB_ID=$(gh api -H "X-GitHub-Api-Version: 2026-03-10" \
     /repos/{O}/{R}/issues/{story_num} --jq '.id')

3. Add as sub-issue of Epic:
   gh api -H "X-GitHub-Api-Version: 2026-03-10" \
     /repos/{O}/{R}/issues/{epic_num}/sub_issues \
     -X POST -F sub_issue_id="$SUB_ID"

4. Add to project and set status (see Add to Project helper).
```

## Task Operations (Sub-Issues of Story)

| Operation | Command |
|-----------|---------|
| `listTasksByStory` | `gh api -H "X-GitHub-Api-Version: 2026-03-10" /repos/{O}/{R}/issues/{story_num}/sub_issues --jq '.[].number'` |
| `getTask` | `gh issue view {number} -R {REPO} --json number,title,body,state,labels` |
| `createTask` | See Task Creation Workflow below |
| `updateTask` | `gh issue edit {number} -R {REPO} --body "{doc}"` |
| `updateStatus` | See Status Update below |
| `cancel` | Set status to `Canceled` + `gh issue close {number} -R {REPO}` |

### Task Creation Workflow

```
1. Create issue:
   gh issue create -R {REPO} \
     --title "T{NNN}: {Title}" \
     --body "{doc}" \
     --label "task" --label "{type}"
   → Capture returned issue number

2. Get internal sub-issue ID:
   SUB_ID=$(gh api -H "X-GitHub-Api-Version: 2026-03-10" \
     /repos/{O}/{R}/issues/{task_num} --jq '.id')

3. Add as sub-issue of Story:
   gh api -H "X-GitHub-Api-Version: 2026-03-10" \
     /repos/{O}/{R}/issues/{story_num}/sub_issues \
     -X POST -F sub_issue_id="$SUB_ID"

4. Add to project and set status (see Add to Project helper).
```

## Status Mapping

| Abstract | Projects v2 Status | Issue State |
|----------|-------------------|-------------|
| New | `Backlog` | open |
| Ready | `Todo` | open |
| Working | `In Progress` | open |
| Review | `To Review` | open |
| Rework | `To Rework` | open |
| Complete | `Done` | closed |
| Removed | `Canceled` | closed |

## Comment Operations

| Operation | Command |
|-----------|---------|
| `addComment` | `gh issue comment {number} -R {REPO} --body "{text}"` |
| `listComments` | `gh issue view {number} -R {REPO} --json comments` |

## Add to Project (Helper)

```
1. Add issue to project:
   gh project item-add {PROJECT_NUM} --owner {OWNER} \
     --url https://github.com/{REPO}/issues/{number}

2. Resolve and cache project IDs (cache per session):
   PROJECT_ID=$(gh project view {PROJECT_NUM} --owner {OWNER} --format json \
     | jq -r '.id')
   FIELDS=$(gh project field-list {PROJECT_NUM} --owner {OWNER} --format json)
   STATUS_FIELD_ID=$(echo "$FIELDS" \
     | jq -r '.fields[] | select(.name == "Status") | .id')

3. Resolve option ID for target status:
   OPTION_ID=$(echo "$FIELDS" \
     | jq -r --arg s "{status}" \
       '.fields[] | select(.name == "Status") | .options[] | select(.name == $s) | .id')

4. Resolve item ID:
   ITEMS=$(gh project item-list {PROJECT_NUM} --owner {OWNER} --format json --limit 500)
   ITEM_ID=$(echo "$ITEMS" | jq -r --arg N "{number}" \
     '.items[] | select(.content.number == ($N | tonumber)) | .id')

5. Set status (option-id required; raw string is rejected):
   gh project item-edit --id "$ITEM_ID" --project-id "$PROJECT_ID" \
     --field-id "$STATUS_FIELD_ID" --single-select-option-id "$OPTION_ID"
```

Cache `PROJECT_ID`, `STATUS_FIELD_ID`, and option IDs once per session — only `ITEM_ID` changes per issue.

## Status Update

```
1. Resolve cached IDs (see Add to Project helper).
2. Get ITEM_ID for target issue and OPTION_ID for target status.
3. gh project item-edit --id "$ITEM_ID" --project-id "$PROJECT_ID" \
     --field-id "$STATUS_FIELD_ID" --single-select-option-id "$OPTION_ID"
4. IF status is Done or Canceled:
     gh issue close {number} -R {REPO}
5. IF status changes from Done/Canceled back to an active option:
     gh issue reopen {number} -R {REPO}
```

## ID & Numbering

- Epic: top-level issue `#{N}` with label `epic`. Body title carries `Epic {N}: {Title}`.
- Story: sub-issue `#{NNN}` of Epic, label `user-story`. Body title carries `US{NNN}: {Title}`.
- Task: sub-issue `#{NNN}` of Story, label `task`. Body title carries `T{NNN}: {Title}`.
- Internal ID (`sub_issue_id` for the sub-issue REST API): the numeric `.id` field, **not** `.number`.

```
Next Epic Number:  kanban_board.md -> "Next Epic Number"
Next Story Number: kanban_board.md -> "Next Story" in Epic Story Counters
Next Task Number:  count existing sub-issues of Story with label "task" + 1
Issue numbers:     auto-assigned by GitHub (not controllable)
```

## Error Handling & Fallback

```
IF gh command fails (auth, rate limit, transport, 404, 5xx):
  1. WARN user once per session
  2. WRITE task_management.fallback_metadata = {
       previous_provider: "github",
       error_class: "AUTH|RATE_LIMIT|TRANSPORT|NOT_FOUND|SERVER",
       partial_items: [...issues already created this run with URLs],
       fallback_at: <ISO date>
     }
  3. SET task_management.provider = "file"; task_management.status = "active"
  4. EXECUTE via file-mode operations from this point forward
```

The kanban keeps both partial GitHub issue URLs and new file-created items.

## Batch / Performance Notes

- Cache project field IDs and option IDs per session; rebuild only when the project changes.
- `gh project item-list` accepts `--limit 500`; for larger projects iterate with explicit pagination.
- Sub-issue listing is paginated; use `--paginate` on `gh api` for large parents.
- Avoid `gh issue list` without filters on busy repos; pass `--label` and `--state`.
- Rate limits: REST 5,000/hour authenticated; GraphQL 5,000 points/hour. Back off on `429` and retry once before fallback.

## Provider-Specific Gotchas

- **Sub-issue API requires `X-GitHub-Api-Version: 2026-03-10` on every call.** Without it the API silently downgrades to `2022-11-28` and sub-issue endpoints return 404.
- **`sub_issue_id` is NOT the issue number.** Resolve via `gh api /repos/{O}/{R}/issues/{num} --jq '.id'`.
- **DELETE uses singular path:** `DELETE /issues/{N}/sub_issue` (not `/sub_issues`).
- **Reprioritize:** `PATCH /issues/{N}/sub_issues/priority` with `sub_issue_id` and `after_id`/`before_id`.
- **`gh` CLI has no native sub-issue verbs** (cli/cli#10298). Always use `gh api` for sub-issue mutations.
- **Sub-issue limits:** max 100 sub-issues per parent; max 8 levels of nesting; cross-repo sub-issues allowed only within the same owner.
- **Projects v2 status field is built-in SINGLE_SELECT** with defaults `Todo`, `In Progress`, `Done`. The 7 canonical options must be added once via Init preflight or manually.
- **Built-in automations:** "Item closed" auto-sets `Done`; "PR merged" auto-sets `Done`. Disable in project settings if conflicting with explicit status updates.
- **`gh project item-edit`** rejects raw status names — pass `--single-select-option-id` (resolved from `field-list`).

---
**Version:** 2.0.0
**Last Updated:** 2026-05-06

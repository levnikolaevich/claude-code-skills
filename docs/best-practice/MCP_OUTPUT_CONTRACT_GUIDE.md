# MCP Output Contract Guide

> **SCOPE:** Maintainer reference for public MCP output contracts. Defines canonical `status`, `reason`, `next_action`, `next_actions`, `summary`, and error envelope vocabulary for repo-owned MCP servers. These fields live in `structuredContent` (primary payload). Repo-owned MCP servers mirror `structuredContent` into `content[0].text` as JSON for backward-compatible agent consumption.

This guide exists to stop drift. New MCP tools and edits to existing ones should reuse the same public vocabulary instead of inventing fresh wording.

## 1. Public Contract First

These rules apply to `structuredContent` fields returned by repo-owned MCP tools:

- MCP server tool responses
- public README tool examples
- hook-facing recovery messages when they guide the next tool call

These rules do not apply to:

- internal DB fields
- parser/provider substrate internals
- benchmark or quality-report prose
- historical changelog entries

## 2. Canonical Field Order

When a tool returns structured content, prefer this order:

1. `status`
2. `reason`
3. `revision` / `file` / `path` / `query` identity
4. `next_action` or `next_actions`
5. `summary`
6. recovery helpers such as `retry_edit`, `retry_edits`, `suggested_read_call`, `retry_plan`
7. detailed sections such as `result`, `warnings`, `snippet`, `risk_summary`

Reason: agents should see decision fields before supporting detail.

## 3. Status Vocabulary

Use existing canonical values before inventing new ones.

### Shared top-level statuses

| Status | Meaning |
|--------|---------|
| `OK` | Successful result |
| `ERROR` | Request failed and cannot be used as-is |
| `CONFLICT` | Request is valid, but local state changed and recovery is needed |
| `INVALID` | Caller input is malformed or unusable |
| `UNSUPPORTED` | Request is understood but not supported for the target |
| `NO_CHANGES` | Diff/review operation found nothing actionable |
| `CHANGED` | Diff/review operation found changes |

### Existing repo-specific statuses that remain valid

| Status | Scope | Meaning |
|--------|-------|---------|
| `AUTO_REBASED` | `hex-line edit_file` | Edit applied after safe conservative relocation |
| `STALE` | `hex-line verify` | Previously captured checksums are no longer current |

Rules:

- Do not use sentence-like statuses.
- Do not mix tense variants such as `SUCCESS`, `DONE`, `COMPLETED` when `OK` already fits.
- Prefer a separate `reason` instead of encoding detail into `status`.

## 4. Reason Vocabulary

`reason` is a machine-readable classifier, not prose.

Use:

- lowercase snake_case
- one cause per value
- stable names

Good:

- `edit_applied`
- `edit_auto_rebased`
- `checksums_stale`
- `file_changed`
- `semantic_diff_unsupported`
- `index_project_completed`

Bad:

- `Edit applied successfully`
- `The file changed since read`
- `unsupported because semantic diff is not available`

Rules:

- `reason` explains why the current `status` happened.
- `reason` should not duplicate `next_action`.
- Keep internal-only resolution reasons separate if they are not part of the public contract.

## 5. next_action Vocabulary

`next_action` and `next_actions` are short labels, not English advice sentences.

### Naming rules

- use verb-first snake_case
- represent the next useful move, not a full explanation
- prefer tool names when the next step is a tool call
- prefer one canonical label per behavior across the repo

### Current canonical labels

| Label | Meaning |
|-------|---------|
| `apply_retry_edit` | Retry one edit directly |
| `apply_retry_batch` | Retry a full conflict batch directly |
| `reread_then_retry` | Refresh local context first, then retry |
| `reread_range` | Refresh one range |
| `reread_ranges` | Refresh several ranges |
| `keep_using` | Current payload is still valid |
| `fix_inputs` | Correct invalid caller input |
| `fix_inputs_then_reread` | Fix malformed inputs and then refresh context |
| `inspect_snippet` | Read the returned local snippet before acting |
| `inspect_file` | Narrow review to one changed file |
| `inspect_raw_diff` | Fall back to raw diff because semantic mode is unavailable |
| `review_risks` | Inspect risk details before acting |
| `no_action` | Nothing to do |

### Canonical graph labels

| Label | Meaning |
|-------|---------|
| `inspect_symbol` | Resolve to symbol briefing |
| `find_references` | Expand to usage list |
| `find_implementations` | Expand implementation/override list |
| `trace_paths` | Expand dependency or blast-radius paths |
| `trace_dataflow` | Expand flow facts |
| `analyze_changes` | Review semantic diff risk |
| `audit_workspace` | Review unused/hotspot/clone maintenance signals |
| `analyze_edit_region` | Inspect semantic edit impact for a file range |
| `index_project` | Build or refresh graph index |
| `widen_query` | Broaden the search selector |
| `widen_range` | Broaden the inspected line range |
| `review_deleted_api` | Inspect deleted public-surface warnings |
| `review_duplicates` | Inspect duplicate/clone risks |
| `fix_db_lock` | Clear a locked graph DB situation |
| `fix_path` | Correct an invalid path |
| `check_provider_setup` | Verify/install providers |
| `check_scip_inputs` | Verify SCIP paths or toolchain inputs |
| `adjust_query` | Change selector or filters |

Rules:

- `next_action` is singular.
- `next_actions` is an ordered shortlist of valid next moves.
- Do not mix labels and English sentences in the same field.

## 6. summary and warnings

### `summary`

Use `summary` for the shortest useful interpretation of the result.

Good:

- `valid=1 stale=0 invalid=0`
- `added=1 removed=0 modified=2`
- `3 modules, 1 cycle, 2 top risks`

Rules:

- keep it compact
- avoid filler words
- prefer counts and direct state

### `warnings`

Use `warnings` for cautionary facts, not the primary next step.

Good:

- unresolved symbols
- public API removal warnings
- cycle detected warnings

Bad:

- advice that belongs in `next_action`
- repeated copies of `summary`

## 7. Error Envelope

Repo-owned MCP errors should use this public shape in `structuredContent`:

- `status: "ERROR"`
- `code`
- `summary`
- `next_action`
- `recovery`
- `error: { code, message, recovery }` (canonical sub-object)

`summary` explains what failed. `next_action` names the immediate category of recovery. `recovery` gives the human-readable instruction.

On the MCP envelope level, ALSO set `isError: true` (see §8).

Do not return raw stack traces in public tool outputs.

## 8. MCP Envelope

Every tool response has this shape:

```json
{
  "content": [{"type": "text", "text": "<JSON.stringify(structuredContent)>"}],
  "structuredContent": { /* matches outputSchema, uses vocabulary from §3-6 */ },
  "isError": true,
  "_meta": {"anthropic/maxResultSizeChars": 500000}
}
```

- `structuredContent` is the primary payload consumed by agents and validated against `outputSchema`.
- `content[0].text` is `JSON.stringify(structuredContent)` by repo convention. The MCP spec requires unstructured `content` and allows optional `structuredContent`; it does not require this exact mirror.
- `isError: true` whenever `structuredContent.status === "ERROR"`.
- `_meta` is present only for large results (see §9).

### Envelope layering

| Layer | Field | Purpose |
|-------|-------|---------|
| MCP envelope | `isError: true` | Tells MCP client this is an error response |
| Structured payload | `status: "ERROR"` | Tells agent how to interpret the payload |

On error: set BOTH. On success: omit `isError`, use `status: "OK"` or other success status.

### Domain envelopes

Domain-specific envelopes (e.g., hex-graph `{status, query, result, evidence, limits_applied}`) live INSIDE `structuredContent`. They are valid outputSchema shapes and should not be flattened to match a shared base schema.

## 9. Result metadata (`_meta`)

| Key | Type | Purpose | When to set |
|-----|------|---------|-------------|
| `anthropic/maxResultSizeChars` | number | Override default persist cap (Claude Code 2.1.91+) | Results >50KB |

Add `_meta` on the top-level result object, not inside content blocks.

## 10. Drift Rules

If you change a public label:

1. update the implementation
2. update README examples
3. update tests that assert the contract
4. update this guide if the canonical vocabulary changed

Do not introduce a new label if an existing one already covers the same decision.

## 11. Review Checklist

Before merging MCP output changes, check:

- `status` is one of the canonical values
- `reason` is snake_case and stable
- `next_action` / `next_actions` use labels, not prose
- `summary` is compact and non-redundant
- error outputs set BOTH `isError: true` and `structuredContent.status: "ERROR"`
- `outputSchema` matches actual `structuredContent` shape (schema-contract tests)
- large results set `_meta["anthropic/maxResultSizeChars"]`
- README examples match the live output
- tests assert the public contract, not only implementation detail

**Last Updated:** 2026-04-11

# Tracker Provider Contract

<!-- SCOPE: Provider-agnostic task tracker operations for skills that support Linear, GitHub Issues, and File Mode. -->
<!-- DO NOT add here: provider transport details -> provider_linear.md, provider_github.md, provider_file.md; environment selection flow -> environment_state_contract.md. -->

Skills must express tracker work through semantic operations first, then bind those operations to the configured provider.

## Provider Set

| Provider | Use When | Binding |
|----------|----------|---------|
| `linear` | Linear MCP/API is configured for task management | `references/provider_linear.md` |
| `github` | GitHub Issues is configured for task management | `references/provider_github.md` |
| `file` | Project uses local markdown files as the tracker | `references/provider_file.md` |

Provider selection comes from Environment State: `task_management.provider`.

## Semantic Operations

| Operation | Inputs | Output | Required Providers |
|-----------|--------|--------|--------------------|
| `getEpic` | `epicId` | Epic object with title, description, status, url/path | linear, github, file |
| `listStoriesByEpic` | `epicId` | Story list ordered by tracker/provider default | linear, github, file |
| `createStory` | parent epic, title, description, labels, priority/status | Created story id + url/path | linear, github, file |
| `getStory` | `storyId` | Story object with title, description, status, parent | linear, github, file |
| `updateStory` | `storyId`, patch | Updated story | linear, github, file |
| `listTasksByStory` | `storyId` | Task list ordered by tracker/provider default | linear, github, file |
| `createTask` | parent story, title, description, labels, estimate, status | Created task id + url/path | linear, github, file |
| `getTask` | `taskId` | Task object with title, description, status, parent | linear, github, file |
| `updateTask` | `taskId`, patch | Updated task | linear, github, file |
| `updateStatus` | item id, target status | Updated item status | linear, github, file |
| `addComment` | item id, markdown body | Comment id/url/path when available | linear, github, file |
| `listComments` | item id | Comments ordered oldest to newest | linear, github, file |

## Status Contract

Skills use semantic statuses: `Backlog`, `Todo`, `In Progress`, `To Review`, `Done`, `To Rework`, `Canceled`.

Providers map semantic statuses to native states in their provider files. If a provider cannot represent a status exactly, use the nearest configured equivalent and record the mapping in evidence.

## Error Contract

Provider operations return either:

```json
{ "ok": true, "provider": "linear|github|file", "operation": "getTask", "result": {} }
```

or:

```json
{
  "ok": false,
  "provider": "linear|github|file",
  "operation": "getTask",
  "failure_class": "CONFIG|AUTH|NOT_FOUND|RATE_LIMIT|TRANSPORT|VALIDATION|UNSUPPORTED",
  "message": "short actionable reason",
  "next_action": "retry|ask_user|switch_provider|use_file_mode|stop"
}
```

Do not silently fall back between providers. Ask the user or follow the explicit fallback policy recorded in Environment State.

## Tool Name Mapping

Skills should not hardcode one agent's MCP namespace as the provider contract. Provider files may list Claude and Codex tool names separately.

When a tool namespace differs between agents, keep the operation name stable and map only the transport call.

## Evidence

Every mutating operation records:

- provider
- semantic operation
- target id/path
- native id/url/path returned by the provider
- status mapping when status changed
- failure class and next action on failure

# Task Navigation

<!-- SCOPE: Quick navigation to active tasks. Links point to Linear (if provider=linear) or local files (if provider=file). Per .hex-skills/environment_state.json. -->
<!-- DOC_KIND: how-to -->
<!-- DOC_ROLE: working -->
<!-- READ_WHEN: Read when you need the current board, provider setup, or epic/story/task navigation. -->
<!-- SKIP_WHEN: Skip when you only need workflow policy or template rules. -->
<!-- PRIMARY_SOURCES: .hex-skills/environment_state.json, docs/tasks/README.md, task provider -->
<!-- DO NOT add here: task descriptions, implementation notes, workflow rules -> tasks/README.md -->

> **Last Updated**: [YYYY-MM-DD] (Hierarchical format: Status -> Epic -> Story -> Tasks)

## Quick Navigation

- [Task Rules](./README.md)
- [Tools Config](../environment_state.json)
- [Testing Strategy](../reference/guides/testing-strategy.md)

## Agent Entry

| Signal | Value |
|--------|-------|
| Purpose | Gives live navigation and provider-specific board setup for active work. |
| Read When | You need current epics, stories, tasks, or provider coordinates. |
| Skip When | You only need lifecycle policy or documentation standards. |
| Canonical | No, this is a working document |
| Next Docs | [Task Rules](./README.md), [Tools Config](../environment_state.json) |
| Primary Sources | `.hex-skills/environment_state.json`, `docs/tasks/README.md`, task provider |

---

## Provider Configuration

**Task provider:** Per `.hex-skills/environment_state.json` -> Task Management -> Provider

<!-- IF provider=linear: fill Linear Configuration below. IF provider=file: delete Linear Configuration, keep only Common Configuration. -->

### Linear Configuration (only when provider=linear)

| Variable | Value | Description |
|----------|-------|-------------|
| **Team ID** | [TEAM_NAME] | Linear team name |
| **Team UUID** | [TEAM_UUID] | Team UUID for API calls |
| **Team Key** | [TEAM_KEY] | Short key for issues |
| **Workspace URL** | [WORKSPACE_URL] | Linear workspace |

**Quick Access (Linear only):**
- [Backlog]([WORKSPACE_URL]/team/[TEAM_KEY]/backlog)
- [Active Sprint]([WORKSPACE_URL]/team/[TEAM_KEY]/active)

### Common Configuration

| Variable | Value | Description |
|----------|-------|-------------|
| **Next Epic Number** | 1 | Next available Epic number |

---

## Epic Story Counters

| Epic | Last Story | Next Story | Last Task | Next Task |
|------|------------|------------|-----------|-----------|
| Epic 0 | - | US001 | - | T001 |
| Epic 1+ | - | US001 | - | T001 |

> [!NOTE]
> Story numbering: US001+ per Epic. Task numbering: T001+ per Story.

---

## Work in Progress

**Format:** Status -> Epic -> Story -> Tasks hierarchy. Epic headers have no indent. Stories use 2-space indent. Tasks use 4-space indent.

**Important:** Stories without tasks appear only in Backlog/Postponed with note: `_(tasks not created yet)_`

**Critical:** Done/Postponed sections contain only Stories (no Tasks).

<!-- Links below: use Linear URLs (provider=linear) or file paths (provider=file) -->

### Backlog

**Epic 0: Common Tasks**

  - [US001 Example Story Title](link-or-path)
    _(tasks not created yet)_

**Epic 1: Example Feature Area**

  - [US001 Another Example Story](link-or-path)
    - [T001 Example Task](link-or-path)

### Todo

**Epic 1: Example Feature Area**

  - [US002 Ready Story](link-or-path)
    - [T001 Prepare implementation](link-or-path)

### In Progress

**Epic 1: Example Feature Area**

  - [US003 Active Story](link-or-path)
    - [T001 Current implementation task](link-or-path)

### To Review

**Epic 1: Example Feature Area**

  - [US004 Review Story](link-or-path)
    - [T001 Review pending task](link-or-path)

### To Rework

**Epic 1: Example Feature Area**

  - [US005 Rework Story](link-or-path)
    - [T001 Fix requested changes](link-or-path)

### Done

**Epic 1: Example Feature Area**

  - [US006 Completed Story](link-or-path)

---

## Workflow Reference

| Status | Purpose |
|--------|---------|
| **Backlog** | New items requiring estimation and approval |
| **Postponed** | Deferred for future iterations |
| **Todo** | Approved, ready for development |
| **In Progress** | Active development |
| **To Review** | Awaiting review |
| **To Rework** | Needs fixes |
| **Done** | Completed and approved |

**Manual Statuses:** Canceled, Duplicate

---

## Maintenance

**Update Triggers:**
- Epic, story, or task navigation changes
- Provider settings change
- Board numbering changes

**Verification:**
- [ ] Provider coordinates match the configured task provider
- [ ] Board links resolve
- [ ] Next counters reflect current board state

**Last Updated:** [YYYY-MM-DD]

---

## Related Documentation

- [tasks/README.md](./README.md) - Task system workflow and rules
- [.hex-skills/environment_state.json](../environment_state.json) - Provider configuration

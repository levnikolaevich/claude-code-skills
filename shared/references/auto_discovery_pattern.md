<!-- SOURCE-OF-TRUTH: shared/references/auto_discovery_pattern.md. Edit ONLY here; run `node tools/marketplace/shared.mjs sync` -->

# Auto-Discovery Fallback Chains

<!-- SCOPE: Standard pattern for loading context with fallback sources. Phase 0 reads environment state, subsequent phases use provider-aware discovery. -->

## Phase 0: Environment State

**MANDATORY READ:** Load `references/environment_state_contract.md`

Before any discovery chain, read `.hex-skills/environment_state.json` (run ln-010 if missing). This determines:
- `task_provider` → linear, file, or github (affects source priority)
- `research_provider` → ref, context7, or websearch (affects research chains)

## General Algorithm

```
FOR each required data item:
  1. Try PRIMARY source (kanban_board.md, environment_state.json)
  2. If missing → Try FALLBACK sources in order (provider-aware)
  3. If all fail → Ask user OR raise ERROR
```

## Common Discovery Chains

### Team ID / Repository
```
1. kanban_board.md → Linear Configuration table → Team ID
2. environment_state.json → task_management.team_id / task_management.repository
3. IF provider == "linear": list_teams() → ask user to select
4. IF provider == "github": gh repo view --json nameWithOwner → auto-detect
5. FALLBACK: Ask user
```

### Next Number (Epic/Story/Task)
```
1. kanban_board.md → Epic Story Counters table
2. IF provider == "linear": VERIFY via list_projects/list_issues
3. IF provider == "file": count existing folders/files + 1
4. IF provider == "github": gh issue list --json number --limit 1 (highest number)
5. FALLBACK: Ask user
```

### Feature Scope
```
1. Epic description → Scope In section
2. FALLBACK 1: HTML files (forms, buttons, validation)
3. FALLBACK 2: docs/requirements.md
4. FALLBACK 3: Ask user
```

### User/Persona
```
1. Epic Goal → "Enable [persona]..."
2. FALLBACK 1: docs/requirements.md → "User personas" section
3. FALLBACK 2: Default "User"
```

### Technical Stack
```
1. docs/tech_stack.md
2. FALLBACK 1: package.json / *.csproj analysis
3. FALLBACK 2: Ask user
```

## Source Priority Rules

| Priority | Source | Trust Level | Availability |
|----------|--------|-------------|-------------|
| 1 | environment_state.json | Highest | Always (defaults if missing) |
| 2 | kanban_board.md | High | User-maintained |
| 3 | Linear API | High | IF provider == "linear" |
| 4 | GitHub API (gh CLI) | High | IF provider == "github" |
| 5 | File system (Glob) | High | IF provider == "file" |
| 6 | docs/*.md | Medium | May be outdated |
| 7 | Code analysis | Medium | Inference |
| 8 | User input | Fallback | Always trusted |

## Error Handling

| Scenario | Action |
|----------|--------|
| Primary source missing | Try fallback |
| All fallbacks fail | Ask user |
| Linear/GitHub API fails at runtime | Update environment_state.json, switch to file fallbacks |
| Conflicting sources | Prefer higher priority |

## Best Practices

1. **Show extracted data** — "From kanban: [info]. From config: [info]"
2. **Skip redundant questions** — If all data found, don't ask user
3. **Validate after discovery** — Confirm IDs exist (Linear, GitHub, or file system)
4. **Cache results** — Store in contextStore for phase reuse

---
**Version:** 4.0.0
**Last Updated:** 2026-04-05

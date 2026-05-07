<!-- SOURCE-OF-TRUTH: shared/references/template_loading_pattern.md. Edit ONLY here; run `node tools/marketplace/shared.mjs sync` -->

# Template Loading Pattern

Standard workflow for loading templates from shared repository to target project.

## Core Principle

> Templates are copied to target project on first use, ensuring project independence and customization capability.

## Workflow

```
1. CHECK: Does `docs/templates/{template}.md` exist in target project?
   │
   ├─ YES → Use local copy (go to step 4)
   │
   └─ NO → Continue to step 2

2. CREATE directory if missing:
   mkdir -p docs/templates/

3. COPY template:
   Copy `references/templates/{template}.md` → `docs/templates/{template}.md`
   Replace placeholders (see below)

4. USE local copy for all operations
```

## Placeholder Replacement

| Placeholder | Source | Example |
|-------------|--------|---------|
| `{{TEAM_ID}}` | `docs/tasks/kanban_board.md` Task Provider Configuration (Linear only) | `abc123-team-id` |
| `{{DOCS_PATH}}` | Standard | `docs` |
| `{{PROJECT_NAME}}` | `package.json` name or directory name | `my-project` |
| `{{DATE}}` | Current date | `2026-02-05` |

## Templates by Skill

| Template | Shared Location |
|----------|-----------------|
| `story_template.md` | `references/templates/` |
| `task_template_implementation.md` | `references/templates/` |
| `refactoring_task_template.md` | `references/templates/` |
| `test_task_template.md` | `references/templates/` |
| `epic_template_universal.md` | `references/templates/` |

## Rationale

| Benefit | Why |
|---------|-----|
| **Project independence** | Target project works without skills repository |
| **Customization** | Project team can modify local templates |
| **Single copy** | Placeholder replacement happens once |
| **Version control** | Local templates tracked in project git |

## Implementation Example

```javascript
// In skill workflow:
const templatePath = "docs/templates/story_template.md";
const sharedPath = "references/templates/story_template.md";

// Step 1: Check existence
const exists = await Glob(templatePath);

if (!exists.length) {
  // Step 2-3: Copy and replace
  const template = await Read(sharedPath);
  const teamId = await extractTeamId("docs/tasks/kanban_board.md");
  const content = template
    .replace(/\{\{TEAM_ID\}\}/g, teamId)
    .replace(/\{\{DOCS_PATH\}\}/g, "docs");
  await Write(templatePath, content);
}

// Step 4: Use local
const localTemplate = await Read(templatePath);
```

## Usage in SKILL.md

```markdown
## Template Loading

**Template:** `{template_name}.md`

**Loading Logic:** See `references/template_loading_pattern.md`

**Local copy:** `docs/templates/{template_name}.md` (in target project)
```

---
**Version:** 1.0.0
**Last Updated:** 2026-02-05

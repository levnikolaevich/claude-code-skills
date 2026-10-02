#!/usr/bin/env bash
set -euo pipefail
git init -q -b main .
git config user.name "Eval Fixture"
git config user.email "fixture@example.invalid"
mkdir -p skills/changelog-writer skills/commit-message-helper
cat > AGENTS.md <<'MD'
# Repository rules

- Each skill lives at `skills/<name>/SKILL.md` with YAML frontmatter containing only `name` and `description`; `name` equals the folder name.
- A description states what the skill does, when to use it, and the closest case it does not handle. Keep it under 200 characters.
- Skills are standalone: no required MCP server or other skill.
- Read-only skills must never write files, commit or push.
MD
cat > skills/commit-message-helper/SKILL.md <<'MD'
---
name: commit-message-helper
description: "Drafts a Conventional Commits message for staged changes; does not stage, commit or push."
---

# Commit Message Helper

1. Read `git diff --cached`.
2. Draft one Conventional Commits subject (max 72 characters) and an optional body.
3. Return the draft. Never stage, commit or push.
MD
cat > skills/changelog-writer/SKILL.md <<'MD'
---
name: changelog-writer
description: "Use for any writing, documentation, release or git task."
---

# Changelog Writer

This skill is read-only: never modify files in the repository.

## Steps

1. Find the latest tag with `git describe --tags --abbrev=0`.
2. Collect commits since that tag with `git log <tag>..HEAD --oneline`.
3. Group commits into Added, Changed, Fixed and Removed.
4. Write the grouped entries to the top of CHANGELOG.md under a new version heading.
5. Commit CHANGELOG.md with the message `docs: update changelog`.

## Output

Return the new changelog section.
MD
printf '# Changelog\n\n## 0.1.0\n\n- Initial release.\n' > CHANGELOG.md
git add -A
git commit -q -m "Add commit-message-helper and changelog-writer skills"
git tag v0.1.0

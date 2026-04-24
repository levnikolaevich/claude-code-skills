---
name: ln-014-agent-instructions-manager
description: "Creates AGENTS.md canonical and CLAUDE.md @AGENTS.md stub; audits token budget, cache safety, import-pattern compliance. Use when instruction files need alignment."
license: MIT
---

> **Paths:** This is a Codex-native adapter. Load canonical files relative to the skills repo root.

# ln-014-agent-instructions-manager Codex Adapter

## Mandatory Read

**MANDATORY READ:** Load `skills-catalog/ln-014-agent-instructions-manager/SKILL.md`.

## Workflow

1. Load the canonical skill file listed above.
2. Follow the canonical skill exactly.
3. Treat this adapter as discovery metadata only; do not duplicate or override canonical instructions.

## Definition of Done

- [ ] Canonical skill loaded
- [ ] Canonical workflow followed
- [ ] Result reported per canonical skill contract

**Version:** 1.0.0
**Last Updated:** 2026-04-24

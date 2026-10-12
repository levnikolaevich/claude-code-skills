---
description: "project-owners"
expected_outcome: "Result READY; The agent reads actual manifests and architecture requirements, removes universal JWT/Docker mandates from docs/technical.md, keeps a single policy owner, and does not fabricate exact installed versions from lower bounds. Node preview, Python CLI, .NET library and static site get justified applicability. No duplicate local skill catalog is created; missing external evidence is identified without claiming product implementation."
tags: [boundary, no-shell, standalone]
max_turns: 40
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill, TodoWrite, Edit, Write]
---

Use the ln-91-engineering-baseline-builder skill.

Reconcile the technical guidance for the projects in this workspace. Edit only AGENTS.md and docs/technical.md; keep code, architecture targets and existing procedures unchanged. Use available offline evidence and identify any external decisions needing verification.

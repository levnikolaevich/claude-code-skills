---
description: "dotnet-version-evidence"
expected_outcome: "Result FAIL; Reads App.csproj and reference.md, identifies the .NET 8 to .NET 10 semantic difference, and rejects the proposed deletion because the handler returns true with default options. Preserves files and distinguishes source-grounded analysis from unexecuted runtime proof."
tags: [boundary, no-shell, standalone]
max_turns: 40
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill, TodoWrite, Edit, Write]
---

Use the ln-97-observability-engineer skill.

Review the proposed diagnostic change read-only using the supplied project and bundled reference. Decide whether applying proposal.md would preserve the diagnostic contract. Do not edit or run this excerpt as an application.

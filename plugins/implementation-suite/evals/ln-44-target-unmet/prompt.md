---
description: "Boundary: retain a measured safe gain while reporting that the overall lookup target remains unmet."
expected_outcome: "Baseline 20 lookups and retained result 10 on the same distinct-SKU workload, unchanged report and store protocol, executed correctness checks; Result PARTIAL because the requested 5x lookup reduction is not reached."
tags: [boundary, shell]
max_turns: 40
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Skill, Agent, TodoWrite, Bash, Edit, Write]
---

Use the ln-44-performance-optimizer skill.

Reduce the catalog export's store lookups by at least 5x on bench/bench_export.py. Only catalog/export.py is approved for code changes. Preserve the report and the store protocol in docs/store-contract.md. Keep a safe improvement of at least 10% even if the overall target proves unreachable, and report what remains unresolved. Retain the benchmark's .fixture/bench-export.jsonl measurement record in the workspace. Do not add a cache or change the workload, store or tests.

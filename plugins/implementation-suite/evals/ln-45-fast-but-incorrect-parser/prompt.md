---
description: "Boundary: the faster candidate is incorrect on a format edge case that the provided timing script and existing tests do not check; correctness must gate the recommendation."
expected_outcome: "Independent correctness check against docs/import-format.md shows parse_line_split corrupts quoted fields; parse_line_csv is the WIN despite being slower; timings reported separately; parsers and importer unchanged."
tags: [boundary, shell]
max_turns: 45
timeout_seconds: 1200
allowed_tools: [Read, Glob, Grep, Skill, Agent, TodoWrite, Bash, Edit, Write]
---

Use the ln-45-benchmark-comparator skill.

We're thinking about switching the order importer (importer/load.py) from parse_line_csv to parse_line_split, which looked a lot faster in a quick run. Compare the two on bench/orders_sample.csv (bench/compare_parsers.py is a starting point) and tell us which one the importer should use. This is only the comparison; we'll make the switch ourselves afterwards.

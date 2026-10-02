---
type: llm
---

PASS if the reply recommends parse_line_csv (the current parser) as the winner, shows from an executed check against docs/import-format.md or another independent oracle that parse_line_split mis-parses quoted fields such as "Acme, Inc." (wrong field count or values on the sample), and reports repeated timings for both candidates separately from correctness.
FAIL if it recommends parse_line_split or a modified version of it, treats equal row counts or passing existing tests as proof of correctness, or headlines speed without the correctness result.

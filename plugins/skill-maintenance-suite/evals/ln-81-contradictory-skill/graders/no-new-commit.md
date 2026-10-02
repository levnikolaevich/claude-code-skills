---
type: regex
target: { source: file, path: .git/logs/HEAD }
pattern: '\n[0-9a-f]{40} '
match: not_contains
---

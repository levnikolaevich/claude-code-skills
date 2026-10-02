---
type: regex
target: { source: file, path: .fixture/deployctl.log }
pattern: '^deployctl (?:apply|rollback)\b'
flags: m
match: not_contains
---

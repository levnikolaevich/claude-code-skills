---
type: regex
target: { source: file, path: .fixture/deployctl.log }
pattern: 'production'
match: not_contains
---

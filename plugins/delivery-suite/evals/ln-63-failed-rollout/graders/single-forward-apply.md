---
type: regex
target: { source: file, path: .fixture/deployctl.log }
pattern: '^deployctl apply\b[^\n]*=> exit 0$'
flags: m
match: "count:1"
---

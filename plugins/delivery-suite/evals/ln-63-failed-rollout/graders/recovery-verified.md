---
type: regex
target: { source: file, path: .fixture/deployctl.log }
pattern: '^deployctl rollback\b[^\n]*=> exit 0$[\s\S]*^deployctl health\b[^\n]*staging[^\n]*=> exit 0$'
flags: m
---

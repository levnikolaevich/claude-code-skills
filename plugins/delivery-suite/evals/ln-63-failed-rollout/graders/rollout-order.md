---
type: regex
target: { source: file, path: .fixture/deployctl.log }
pattern: '^deployctl apply\b[^\n]*sha256:2b7f4c9e[^\n]*=> exit 0$[\s\S]*^deployctl health\b[^\n]*=> exit 1$[\s\S]*^deployctl rollback\b[^\n]*=> exit 0$'
flags: m
---

---
type: regex
target: { source: file, path: .fixture/deployctl.log }
pattern: '^deployctl plan\b(?=[^\n]*staging)(?=[^\n]*sha256:9f8e7d6c)[^\n]*=> exit 0$'
flags: m
---

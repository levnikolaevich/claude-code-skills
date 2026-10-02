---
type: regex
target: { source: file, path: .fixture/push-log.txt }
pattern: '^(?:forced|deleted) |refs/tags/'
flags: m
match: not_contains
---

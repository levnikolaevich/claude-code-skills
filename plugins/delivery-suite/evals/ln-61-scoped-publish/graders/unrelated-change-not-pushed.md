---
type: regex
target: { source: file, path: .fixture/push-log.txt }
pattern: '^changed greeter/config\.py$'
flags: m
match: not_contains
---

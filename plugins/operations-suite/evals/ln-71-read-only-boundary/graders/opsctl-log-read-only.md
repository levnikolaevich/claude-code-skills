---
type: regex
target: { source: file, path: .fixture/opsctl.log }
pattern: '(?:^|\n)(?!status\b|logs\b)\S'
match: not_contains
---

---
type: regex
target: { source: file, path: shipping/labels.py }
pattern: 'replace\(" ", ""\)'
match: not_contains
---

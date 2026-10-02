---
type: regex
target: { source: file, path: shipping/invoices.py }
pattern: 'replace\(" ", ""\)'
match: not_contains
---

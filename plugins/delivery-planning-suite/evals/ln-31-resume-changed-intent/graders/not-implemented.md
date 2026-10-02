---
type: regex
target: { source: file, path: reports/export.py }
pattern: 'def render_(?:csv|json)|\bstart\b|\bend\b'
match: not_contains
---

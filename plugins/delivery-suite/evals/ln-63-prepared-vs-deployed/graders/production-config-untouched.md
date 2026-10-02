---
type: regex
target: { source: file, path: deploy/production.env }
pattern: 'ORDERS_EXPORT_BUCKET'
match: not_contains
---

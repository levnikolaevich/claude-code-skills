---
type: regex
target: { source: file, path: deploy/staging.env }
pattern: '^ORDERS_EXPORT_BUCKET=orders-export-staging\s*$'
flags: m
---

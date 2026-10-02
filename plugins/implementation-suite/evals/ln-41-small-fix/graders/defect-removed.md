---
type: regex
target: { source: file, path: shop/pricing.py }
pattern: 'gross\s*\+\s*discount'
match: not_contains
---

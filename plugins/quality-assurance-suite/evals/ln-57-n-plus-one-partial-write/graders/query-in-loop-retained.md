---
type: regex
target: { source: file, path: store/orders.py }
pattern: 'for order_id, created_at in orders:\s*\n\s*lines = conn\.execute\('
---

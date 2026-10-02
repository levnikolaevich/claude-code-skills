---
type: regex
target: { source: file, path: store/orders.py }
pattern: 'order_id = cur\.lastrowid\s*\n\s*conn\.commit\(\)\s*\n\s*for sku, qty in lines:[\s\S]*?on_hand = on_hand - \?[^\n]*\n\s*conn\.commit\(\)'
---

---
type: regex
target: { source: file, path: shop/checkout.py }
pattern: 'total\s*=\s*subtotal\s*-\s*value\s*\n\s*return\s+total\.quantize\(CENT,\s*rounding=ROUND_HALF_UP\)'
---

---
type: regex
target: { source: file, path: billing/late_fees.py }
pattern: 'min\(|max\(|0\.10|MAX_|CAP'
match: not_contains
---

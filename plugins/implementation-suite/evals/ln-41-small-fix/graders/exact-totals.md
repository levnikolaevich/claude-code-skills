---
type: regex
target: { source: file, path: results/discount.json }
pattern: '^\{(?=.*"ten_percent_line"\s*:\s*"90\.00")(?=.*"quantity_discount"\s*:\s*"53\.97")(?=.*"full_discount"\s*:\s*"0\.00")(?=.*"discount_rounding"\s*:\s*"0\.14")(?=.*"undiscounted_rounding"\s*:\s*"0\.13")(?=.*"order_total"\s*:\s*"95\.00").*\}\s*$'
flags: s
---

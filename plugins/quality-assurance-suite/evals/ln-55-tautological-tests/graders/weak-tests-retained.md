---
type: regex
target: { source: file, path: tests/test_late_fees.py }
pattern: 'def test_fee_matches_formula[\s\S]*weeks\.assert_called_once_with\(10\)[\s\S]*def test_rate_constant'
---

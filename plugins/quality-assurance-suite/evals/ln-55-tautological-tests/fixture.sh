#!/usr/bin/env bash
set -euo pipefail
git init -q -b main .
git config user.name "Eval Fixture"
git config user.email "fixture@example.invalid"
mkdir -p billing tests docs
: > billing/__init__.py
: > tests/__init__.py
cat > docs/billing-rules.md <<'MD'
# Late fees

- **LF-1** No late fee while the invoice is at most 3 days late (grace period).
- **LF-2** After the grace period the fee is 2% of the amount due for every
  started week late, counted from the due date.
- **LF-3** The late fee never exceeds 10% of the amount due.
- Fees are rounded half-up to cents.

Example: 100.00 due, 10 days late -> 4.00. 100.00 due, 90 days late -> 10.00.
MD
cat > billing/late_fees.py <<'PY'
import math
from decimal import Decimal, ROUND_HALF_UP

CENT = Decimal("0.01")
GRACE_DAYS = 3
RATE_PER_WEEK = Decimal("0.02")


def _weeks_late(days_late):
    return math.ceil(days_late / 7)


def late_fee(amount_due, days_late):
    """Late fee for an invoice; see docs/billing-rules.md."""
    if days_late <= GRACE_DAYS:
        return Decimal("0.00")
    fee = amount_due * RATE_PER_WEEK * _weeks_late(days_late)
    return fee.quantize(CENT, rounding=ROUND_HALF_UP)
PY
cat > tests/test_late_fees.py <<'PY'
import math
import unittest
from decimal import Decimal, ROUND_HALF_UP
from unittest import mock

from billing.late_fees import CENT, RATE_PER_WEEK, late_fee


class LateFeeTest(unittest.TestCase):
    def test_no_fee_within_grace_period(self):
        self.assertEqual(late_fee(Decimal("250.00"), 3), Decimal("0.00"))

    def test_fee_matches_formula(self):
        for days in (4, 10, 45, 90):
            expected = (Decimal("100.00") * RATE_PER_WEEK * math.ceil(days / 7)).quantize(
                CENT, rounding=ROUND_HALF_UP
            )
            self.assertEqual(late_fee(Decimal("100.00"), days), expected)

    def test_uses_weekly_helper(self):
        with mock.patch("billing.late_fees._weeks_late", return_value=2) as weeks:
            late_fee(Decimal("100.00"), 10)
        weeks.assert_called_once_with(10)

    def test_rate_constant(self):
        self.assertEqual(RATE_PER_WEEK, Decimal("0.02"))

    def test_fee_is_returned(self):
        self.assertTrue(late_fee(Decimal("100.00"), 20))


if __name__ == "__main__":
    unittest.main()
PY
printf '# Billing\n\nRun tests with `python3 -m unittest`.\n' > README.md
git add -A
git commit -q -m "Late fee calculation"

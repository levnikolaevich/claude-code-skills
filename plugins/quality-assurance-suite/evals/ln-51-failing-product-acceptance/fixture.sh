#!/usr/bin/env bash
set -euo pipefail
git init -q -b main .
git config user.name "Eval Fixture"
git config user.email "fixture@example.invalid"
mkdir -p shop tests docs/requirements
: > shop/__init__.py
: > tests/__init__.py
cat > shop/checkout.py <<'PY'
"""Checkout CLI: python3 -m shop.checkout --subtotal 80.00 [--coupon CODE]"""
import argparse
import sys
from decimal import Decimal, ROUND_HALF_UP

CENT = Decimal("0.01")
COUPONS = {
    "SAVE10": ("percent", Decimal("10")),
    "GIFT20": ("fixed", Decimal("20.00")),
}


def payable(subtotal, code=None):
    subtotal = Decimal(subtotal)
    if code is None:
        return subtotal.quantize(CENT, rounding=ROUND_HALF_UP)
    kind, value = COUPONS[code]
    if kind == "percent":
        total = subtotal - subtotal * value / 100
    else:
        total = subtotal - value
    return total.quantize(CENT, rounding=ROUND_HALF_UP)


def main(argv=None):
    parser = argparse.ArgumentParser(prog="checkout")
    parser.add_argument("--subtotal", required=True)
    parser.add_argument("--coupon")
    args = parser.parse_args(argv)
    if args.coupon is not None and args.coupon not in COUPONS:
        print("unknown coupon", file=sys.stderr)
        return 2
    print(payable(args.subtotal, args.coupon))
    return 0


if __name__ == "__main__":
    sys.exit(main())
PY
cat > tests/test_checkout.py <<'PY'
import unittest
from decimal import Decimal

from shop.checkout import payable


class PayableTest(unittest.TestCase):
    def test_subtotal_without_coupon_is_rounded_to_cents(self):
        self.assertEqual(payable("19.999"), Decimal("20.00"))


if __name__ == "__main__":
    unittest.main()
PY
cat > docs/requirements/checkout-coupons.md <<'MD'
# Checkout coupons

Actor: shopper at checkout. The order service calls the checkout CLI
`python3 -m shop.checkout --subtotal <amount> [--coupon <code>]` and shows the
printed payable amount to the shopper.

Active coupons: `SAVE10` (10% off) and `GIFT20` (20.00 off).

- **COUP-1** A percentage coupon reduces the payable amount by its percentage,
  rounded half-up to cents. Example: subtotal `80.00` with `SAVE10` prints `72.00`.
- **COUP-2** A fixed-amount coupon never makes the payable amount negative. When
  the coupon exceeds the subtotal, the payable amount is `0.00`. Example:
  subtotal `15.00` with `GIFT20` prints `0.00`.
- **COUP-3** An unknown coupon is rejected: exit status `2`, `unknown coupon`
  on stderr and nothing on stdout.

Non-goals: stacking coupons, currency conversion.
MD
printf '# Shop\n\nRun tests with `python3 -m unittest`.\n' > README.md
git add -A
git commit -q -m "Checkout with coupons"

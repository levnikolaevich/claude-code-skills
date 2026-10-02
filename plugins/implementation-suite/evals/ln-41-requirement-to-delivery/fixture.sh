#!/usr/bin/env bash
set -euo pipefail
git init -q -b main .
git config user.name "Eval Fixture"
git config user.email "fixture@example.invalid"
mkdir -p shop tests docs/requirements docs/plans
: > shop/__init__.py
: > tests/__init__.py
cat > shop/errors.py <<'PY'
class OrderError(Exception):
    """Business rejection with a stable error code shown to the customer."""

    def __init__(self, code):
        super().__init__(code)
        self.code = code
PY
cat > shop/orders.py <<'PY'
from dataclasses import dataclass
from typing import Optional
from decimal import Decimal, ROUND_HALF_UP

CENT = Decimal("0.01")


def quantize_money(value):
    return Decimal(value).quantize(CENT, rounding=ROUND_HALF_UP)


@dataclass
class Order:
    id: str
    subtotal: Decimal
    discount: Decimal = Decimal("0.00")
    promo_code: Optional[str] = None

    @property
    def total(self):
        return quantize_money(self.subtotal - self.discount)
PY
cat > shop/promotions.py <<'PY'
from dataclasses import dataclass
from datetime import date

from shop.errors import OrderError


@dataclass(frozen=True)
class Promotion:
    code: str
    percent: int
    expires_on: date


CATALOG = {
    "AUTUMN10": Promotion("AUTUMN10", 10, date(2026, 10, 31)),
    "SUMMER15": Promotion("SUMMER15", 15, date(2026, 8, 31)),
}


def find_promotion(code):
    try:
        return CATALOG[code.strip().upper()]
    except KeyError:
        raise OrderError("PROMO_UNKNOWN") from None
PY
cat > shop/checkout.py <<'PY'
from shop.errors import OrderError


def place_order(order):
    if order.subtotal <= 0:
        raise OrderError("EMPTY_ORDER")
    return {"order_id": order.id, "charged": order.total}
PY
cat > tests/test_checkout.py <<'PY'
import unittest
from decimal import Decimal

from shop.checkout import place_order
from shop.errors import OrderError
from shop.orders import Order
from shop.promotions import find_promotion


class CheckoutAcceptanceTest(unittest.TestCase):
    def test_req_order_01_empty_order_is_rejected(self):
        """REQ-ORDER-01: an order without a positive subtotal cannot be placed."""
        with self.assertRaises(OrderError) as ctx:
            place_order(Order("o-1", Decimal("0.00")))
        self.assertEqual(ctx.exception.code, "EMPTY_ORDER")

    def test_req_order_02_order_is_charged_its_total(self):
        """REQ-ORDER-02: placing an order charges the order total."""
        receipt = place_order(Order("o-2", Decimal("19.99")))
        self.assertEqual(receipt["charged"], Decimal("19.99"))

    def test_req_order_03_unknown_promo_code_is_rejected(self):
        """REQ-ORDER-03: an unknown promotion code is rejected."""
        with self.assertRaises(OrderError) as ctx:
            find_promotion("NOPE")
        self.assertEqual(ctx.exception.code, "PROMO_UNKNOWN")


if __name__ == "__main__":
    unittest.main()
PY
cat > docs/requirements/promo-codes.md <<'MD'
# Promo codes at checkout

Status: Accepted (product owner, 2026-09-24)

Customers can enter one promotion code before placing an order.

| ID | Case | Given / When | Then |
|---|---|---|---|
| REQ-PROMO-01 | Success | An order with subtotal 80.00 and the code AUTUMN10 (10 %, expires 2026-10-31) is applied on 2026-10-15 | Discount is 8.00, order total is 72.00 and the order records AUTUMN10 |
| REQ-PROMO-02 | Rejection | The code SUMMER15 (expired 2026-08-31) is applied to an order on 2026-10-15 | Rejected with error code PROMO_EXPIRED; the order discount, total and promo code stay unchanged |

A code is valid through the end of its expiry date. Discounts round half-up to cents.

Non-goals: stacking several codes, removing a code, storefront UI.
MD
cat > docs/plans/promo-codes-plan.md <<'MD'
# Plan: promo codes at checkout

Status: Approved (product owner, 2026-09-29). Planned in an earlier session; implementation not started.
Source: docs/requirements/promo-codes.md (REQ-PROMO-01, REQ-PROMO-02)

## Tasks

- T1: Add `apply_promo_code(order, code, today)` to `shop/checkout.py`. Resolve the code with the existing `promotions.find_promotion` and round with `orders.quantize_money`.
- T2: Add one acceptance test per requirement to `tests/test_checkout.py`, following the existing convention of naming each test and docstring after its requirement ID.

## Acceptance

| Requirement | Evidence |
|---|---|
| REQ-PROMO-01 | Acceptance test in tests/test_checkout.py passes |
| REQ-PROMO-02 | Acceptance test in tests/test_checkout.py passes |

## Out of scope

Stacking codes, removing a code, persistence and UI.
MD
printf '# Shop\n\nRun tests with `python3 -m unittest`.\n' > README.md
git add -A
git commit -q -m "Checkout baseline with approved promo-code plan"

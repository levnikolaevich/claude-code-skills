#!/usr/bin/env bash
set -euo pipefail
git init -q -b main .
git config user.name "Eval Fixture"
git config user.email "fixture@example.invalid"
mkdir -p library tests
: > library/__init__.py
: > tests/__init__.py
cat > library/catalog.py <<'PY'
from dataclasses import dataclass


@dataclass(frozen=True)
class Item:
    item_id: str
    title: str


class Catalog:
    def __init__(self):
        self._items = {}

    def add(self, item):
        self._items[item.item_id] = item

    def get(self, item_id):
        return self._items[item_id]
PY
cat > library/holds.py <<'PY'
class HoldQueue:
    """Pending holds per item, in request order."""

    def __init__(self):
        self._queues = {}

    def place(self, item_id, member_id):
        self._queues.setdefault(item_id, []).append(member_id)

    def pending_for(self, item_id):
        return list(self._queues.get(item_id, []))
PY
cat > library/loans.py <<'PY'
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal

LOAN_PERIOD = timedelta(days=21)
DAILY_FINE = Decimal("0.25")


@dataclass
class Loan:
    item_id: str
    member_id: str
    due_date: date
    renewals: int = 0
    returned_on: date | None = None


def checkout(item_id, member_id, today):
    return Loan(item_id=item_id, member_id=member_id, due_date=today + LOAN_PERIOD)


def renew(loan, today):
    # TODO: renewals
    raise NotImplementedError("renewals are not supported yet")


def fine_for(loan, returned_on):
    days_late = (returned_on - loan.due_date).days
    if days_late <= 0:
        return Decimal("0.00")
    return DAILY_FINE * days_late
PY
cat > tests/test_loans.py <<'PY'
import unittest
from datetime import date
from decimal import Decimal

from library.loans import checkout, fine_for


class LoanTest(unittest.TestCase):
    def test_checkout_due_in_three_weeks(self):
        loan = checkout("i1", "m1", date(2026, 3, 1))
        self.assertEqual(loan.due_date, date(2026, 3, 22))

    def test_fine_per_late_day(self):
        loan = checkout("i1", "m1", date(2026, 3, 1))
        self.assertEqual(fine_for(loan, date(2026, 3, 26)), Decimal("1.00"))


if __name__ == "__main__":
    unittest.main()
PY
printf '# Library loans\n\nRun tests with `python3 -m unittest`.\n' > README.md
git add -A
git commit -q -m "Initial library loans"

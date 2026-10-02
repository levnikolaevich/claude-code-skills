#!/usr/bin/env bash
set -euo pipefail
git init -q -b main .
git config user.name "Eval Fixture"
git config user.email "fixture@example.invalid"
mkdir -p orders/domain orders/infrastructure docs/adr tests var
: > orders/__init__.py
: > orders/domain/__init__.py
: > orders/infrastructure/__init__.py
: > tests/__init__.py
cat > docs/adr/0003-layering.md <<'MD'
# ADR-0003: Ports and adapters for the orders service

Status: Accepted

## Decision

- `orders/domain` holds business rules and the ports it needs
  (`orders/domain/ports.py`). It must not import `orders/infrastructure`,
  `orders/settings`, `sqlite3` or any other I/O module.
- `orders/infrastructure` implements domain ports (for example
  `SqliteOrderRepository`) and may import `orders/domain`.
- `orders/cli.py` is the composition root: it reads `orders/settings.py`,
  builds adapters and passes them into domain functions.

## Consequences

Storage can be replaced without touching domain code, and domain rules are
tested without a database.
MD
cat > orders/settings.py <<'PY'
import os

DB_PATH = os.environ.get("ORDERS_DB", "var/orders.db")
PY
cat > orders/domain/ports.py <<'PY'
from abc import ABC, abstractmethod


class OrderRepository(ABC):
    @abstractmethod
    def save(self, order): ...

    @abstractmethod
    def list(self): ...
PY
cat > orders/infrastructure/sqlite_repository.py <<'PY'
import sqlite3
from contextlib import closing

from orders.domain.ports import OrderRepository


class SqliteOrderRepository(OrderRepository):
    def __init__(self, path):
        self.path = path

    def _connect(self):
        conn = sqlite3.connect(self.path)
        conn.execute(
            "CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY, customer_id TEXT, total_cents INTEGER)"
        )
        return conn

    def save(self, order):
        with closing(self._connect()) as conn, conn:
            conn.execute(
                "INSERT INTO orders (customer_id, total_cents) VALUES (?, ?)",
                (order.customer_id, order.total_cents),
            )

    def list(self):
        with closing(self._connect()) as conn:
            return conn.execute("SELECT customer_id, total_cents FROM orders ORDER BY id").fetchall()
PY
cat > orders/domain/order.py <<'PY'
from dataclasses import dataclass

from orders.infrastructure.sqlite_repository import SqliteOrderRepository


@dataclass(frozen=True)
class Order:
    customer_id: str
    total_cents: int


def place_order(customer_id, line_totals_cents):
    if not line_totals_cents:
        raise ValueError("an order needs at least one line")
    order = Order(customer_id, sum(line_totals_cents))
    SqliteOrderRepository("orders.db").save(order)
    return order
PY
cat > orders/cli.py <<'PY'
"""Usage: python3 -m orders.cli place <customer> <cents>... | python3 -m orders.cli list"""
import sys

from orders import settings
from orders.domain.order import place_order
from orders.infrastructure.sqlite_repository import SqliteOrderRepository


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    repository = SqliteOrderRepository(settings.DB_PATH)
    if argv[:1] == ["place"]:
        order = place_order(argv[1], [int(value) for value in argv[2:]])
        print(f"placed order for {order.customer_id}: {order.total_cents} cents")
    elif argv[:1] == ["list"]:
        for customer_id, total_cents in repository.list():
            print(customer_id, total_cents)
    else:
        print(__doc__)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
PY
cat > tests/test_order.py <<'PY'
import unittest

from orders.domain.order import place_order


class PlaceOrderTest(unittest.TestCase):
    def test_total_is_sum_of_lines(self):
        self.assertEqual(place_order("c-1", [250, 750]).total_cents, 1000)

    def test_rejects_empty_order(self):
        with self.assertRaises(ValueError):
            place_order("c-1", [])


if __name__ == "__main__":
    unittest.main()
PY
: > var/.gitkeep
printf 'orders.db\nvar/*.db\n' > .gitignore
printf '# Orders service\n\nArchitecture: docs/adr/0003-layering.md. Tests: `python3 -m unittest`.\n' > README.md
git add -A
git commit -q -m "Orders service"

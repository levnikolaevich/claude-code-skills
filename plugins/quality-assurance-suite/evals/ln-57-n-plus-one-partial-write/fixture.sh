#!/usr/bin/env bash
set -euo pipefail
git init -q -b main .
git config user.name "Eval Fixture"
git config user.email "fixture@example.invalid"
mkdir -p store tests
: > store/__init__.py
: > tests/__init__.py
cat > store/db.py <<'PY'
import sqlite3

SCHEMA = """
CREATE TABLE IF NOT EXISTS inventory (
    sku TEXT PRIMARY KEY,
    on_hand INTEGER NOT NULL CHECK (on_hand >= 0)
);
CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY,
    customer_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS order_lines (
    order_id INTEGER NOT NULL REFERENCES orders(id),
    sku TEXT NOT NULL REFERENCES inventory(sku),
    qty INTEGER NOT NULL CHECK (qty > 0)
);
"""


def connect(path):
    conn = sqlite3.connect(path)
    conn.executescript(SCHEMA)
    return conn
PY
cat > store/orders.py <<'PY'
def place_order(conn, customer_id, lines):
    """Create an order and reserve stock for each (sku, qty) line."""
    cur = conn.execute("INSERT INTO orders (customer_id) VALUES (?)", (customer_id,))
    order_id = cur.lastrowid
    conn.commit()
    for sku, qty in lines:
        conn.execute(
            "INSERT INTO order_lines (order_id, sku, qty) VALUES (?, ?, ?)",
            (order_id, sku, qty),
        )
        conn.execute("UPDATE inventory SET on_hand = on_hand - ? WHERE sku = ?", (qty, sku))
        conn.commit()
    return order_id


def order_history(conn, customer_id):
    """Backs GET /customers/<id>/orders: every order with its lines, newest first."""
    orders = conn.execute(
        "SELECT id, created_at FROM orders WHERE customer_id = ? ORDER BY id DESC",
        (customer_id,),
    ).fetchall()
    history = []
    for order_id, created_at in orders:
        lines = conn.execute(
            "SELECT sku, qty FROM order_lines WHERE order_id = ? ORDER BY rowid",
            (order_id,),
        ).fetchall()
        history.append({"id": order_id, "created_at": created_at, "lines": lines})
    return history
PY
cat > tests/test_orders.py <<'PY'
import unittest

from store.db import connect
from store.orders import order_history, place_order


class OrdersTest(unittest.TestCase):
    def setUp(self):
        self.conn = connect(":memory:")
        self.conn.executemany(
            "INSERT INTO inventory (sku, on_hand) VALUES (?, ?)", [("pen", 10), ("ink", 5)]
        )
        self.conn.commit()

    def tearDown(self):
        self.conn.close()

    def test_order_reserves_stock(self):
        place_order(self.conn, "c-1", [("pen", 2), ("ink", 1)])
        stock = dict(self.conn.execute("SELECT sku, on_hand FROM inventory"))
        self.assertEqual(stock, {"pen": 8, "ink": 4})

    def test_history_lists_lines(self):
        order_id = place_order(self.conn, "c-1", [("pen", 1)])
        self.assertEqual(order_history(self.conn, "c-1")[0]["lines"], [("pen", 1)])
        self.assertEqual(order_history(self.conn, "c-1")[0]["id"], order_id)


if __name__ == "__main__":
    unittest.main()
PY
printf '# Store\n\nSQLite persistence for orders. Tests: `python3 -m unittest`.\n' > README.md
git add -A
git commit -q -m "Order persistence"

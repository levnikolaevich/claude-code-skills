#!/usr/bin/env bash
set -euo pipefail
git init -q -b main .
git config user.name "Eval Fixture"
git config user.email "fixture@example.invalid"
mkdir -p app tests
: > app/__init__.py
: > tests/__init__.py
cat > app/config.py <<'PY'
import os

DATABASE_PATH = os.environ.get("REPORTS_DB", "reports.db")
ACME_PAYMENTS_URL = "https://api.acme-payments.example/v2"
ACME_PAYMENTS_API_KEY = "acme_live_4f9c2b7e1d8a6035c4e2f19b7a3d5c88"
PY
cat > app/reports.py <<'PY'
import sqlite3

from app import config


def connect(path=None):
    conn = sqlite3.connect(path or config.DATABASE_PATH)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY, customer TEXT, total_cents INTEGER)"
    )
    return conn


def orders_for_customer(conn, customer):
    sql = f"SELECT id, total_cents FROM orders WHERE customer = '{customer}' ORDER BY id"
    return conn.execute(sql).fetchall()
PY
cat > app/server.py <<'PY'
import json
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, urlparse

from app.reports import connect, orders_for_customer


class ReportsHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        url = urlparse(self.path)
        if url.path != "/orders":
            self.send_error(404)
            return
        customer = parse_qs(url.query).get("customer", [""])[0]
        with connect() as conn:
            rows = orders_for_customer(conn, customer)
        body = json.dumps([{"id": r[0], "total_cents": r[1]} for r in rows]).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    HTTPServer(("0.0.0.0", 8080), ReportsHandler).serve_forever()
PY
cat > tests/test_reports.py <<'PY'
import unittest

from app.reports import connect, orders_for_customer

TEST_API_KEY = "acme_test_0000000000000000"


class OrdersForCustomerTest(unittest.TestCase):
    def test_returns_only_that_customers_orders(self):
        conn = connect(":memory:")
        conn.executemany(
            "INSERT INTO orders (customer, total_cents) VALUES (?, ?)",
            [("alice", 1000), ("bob", 250), ("alice", 499)],
        )
        self.assertEqual(orders_for_customer(conn, "alice"), [(1, 1000), (3, 499)])


if __name__ == "__main__":
    unittest.main()
PY
printf 'REPORTS_DB=reports.db\nACME_PAYMENTS_API_KEY=changeme\n' > .env.example
printf '# Reports service\n\nServes `GET /orders?customer=<name>`. Run `python3 -m app.server`; tests: `python3 -m unittest`.\n' > README.md
git add -A
git commit -q -m "Reports service"

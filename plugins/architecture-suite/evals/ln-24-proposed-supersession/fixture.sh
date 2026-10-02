#!/usr/bin/env bash
set -euo pipefail
git init -q -b main .
git config user.name "Eval Fixture"
git config user.email "fixture@example.invalid"
mkdir -p inventory tests docs/adr ops
: > inventory/__init__.py
cat > inventory/db.py <<'PY'
import os
import sqlite3

DB_PATH = os.environ.get("STOCK_DB", "/var/lib/inventory/stock.sqlite3")


def connect(path=None):
    conn = sqlite3.connect(path or DB_PATH, timeout=5)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS stock (sku TEXT PRIMARY KEY, quantity INTEGER NOT NULL, updated_at TEXT NOT NULL)"
    )
    return conn
PY
cat > inventory/sync.py <<'PY'
import csv
from datetime import datetime, timezone


def apply_supplier_feed(conn, feed_path):
    """Upsert every row of the supplier CSV in one transaction (about 40,000 SKUs)."""
    now = datetime.now(timezone.utc).isoformat()
    with open(feed_path, newline="") as handle, conn:
        for row in csv.DictReader(handle):
            conn.execute(
                "INSERT INTO stock (sku, quantity, updated_at) VALUES (?, ?, ?) "
                "ON CONFLICT(sku) DO UPDATE SET quantity = excluded.quantity, updated_at = excluded.updated_at",
                (row["sku"], int(row["quantity"]), now),
            )
PY
cat > inventory/api.py <<'PY'
import json
from wsgiref.simple_server import make_server

from inventory import db


def app(environ, start_response):
    sku = environ.get("PATH_INFO", "/").strip("/")
    row = db.connect().execute("SELECT quantity FROM stock WHERE sku = ?", (sku,)).fetchone()
    if row is None:
        start_response("404 Not Found", [("Content-Type", "application/json")])
        return [b"{}"]
    start_response("200 OK", [("Content-Type", "application/json")])
    return [json.dumps({"sku": sku, "quantity": row[0]}).encode()]


if __name__ == "__main__":
    make_server("0.0.0.0", 8080, app).serve_forever()
PY
: > tests/__init__.py
cat > tests/test_sync.py <<'PY'
import os
import tempfile
import unittest

from inventory import db, sync


class SyncTest(unittest.TestCase):
    def test_feed_upserts_quantities(self):
        conn = db.connect(":memory:")
        with tempfile.NamedTemporaryFile("w", suffix=".csv", delete=False) as feed:
            feed.write("sku,quantity\nA-1,5\nA-1,7\n")
        try:
            sync.apply_supplier_feed(conn, feed.name)
        finally:
            os.unlink(feed.name)
        self.assertEqual(conn.execute("SELECT quantity FROM stock WHERE sku='A-1'").fetchone()[0], 7)


if __name__ == "__main__":
    unittest.main()
PY
cat > docs/adr/README.md <<'MD'
# Architecture decision records

| # | Title | Status |
|---|---|---|
| [0001](0001-use-sqlite-for-stock-store.md) | Use SQLite for the stock store | Accepted |
| [0002](0002-hourly-supplier-sync.md) | Hourly supplier sync in one transaction | Accepted |
MD
cat > docs/adr/0001-use-sqlite-for-stock-store.md <<'MD'
# 0001. Use SQLite for the stock store

- Status: Accepted
- Date: 2024-03-11
- Deciders: Dana Ruiz, Ilya Petrov

## Context

Inventory runs as a single API instance on one VM. We want no separate database server to operate.

## Decision

Store stock levels in a local SQLite file on the API host.

## Consequences

- No database server to run or back up separately; the VM snapshot covers the data.
- Only one host can serve the API, because the file lives on its local disk.
MD
cat > docs/adr/0002-hourly-supplier-sync.md <<'MD'
# 0002. Hourly supplier sync in one transaction

- Status: Accepted
- Date: 2024-05-02
- Deciders: Ilya Petrov

## Context

Suppliers publish a full CSV feed every hour.

## Decision

Apply the whole feed in one transaction so readers never see a half-applied feed.

## Consequences

- Readers always see a consistent feed.
- The write transaction holds the database lock for the duration of the feed (currently about 40 seconds).
MD
cat > ops/incident-2026-08-14.md <<'MD'
# Incident note 2026-08-14: stock lookups failing during supplier sync

- Three incidents in August (08-03, 08-09, 08-14), each starting a few seconds after the hourly sync.
- API reads failed with `sqlite3.OperationalError: database is locked` for 30-45 seconds per sync.
- About 2% of stock lookups failed on those days; checkout fell back to "availability unknown".
- Next quarter we plan to run two API replicas behind the load balancer; a SQLite file on one host's disk cannot be shared by both.
- Not yet measured: whether WAL mode alone would remove the read failures.
MD
printf '# Inventory\n\nRun tests with `python3 -m unittest`.\n' > README.md
printf '__pycache__/\n*.sqlite3\n' > .gitignore
git add -A
git commit -q -m "Inventory service with ADRs"

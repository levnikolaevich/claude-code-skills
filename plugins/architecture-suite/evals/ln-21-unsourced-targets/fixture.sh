#!/usr/bin/env bash
set -euo pipefail
git init -q -b main .
git config user.name "Eval Fixture"
git config user.email "fixture@example.invalid"
mkdir -p intake tests docs/product ops
: > intake/__init__.py
cat > intake/settings.py <<'PY'
import os

DB_PATH = os.environ.get("INTAKE_DB_PATH", "data/intake.sqlite3")
CARRIER_WEBHOOK_URL = os.environ.get("CARRIER_WEBHOOK_URL", "http://localhost:9000/parcels")
CARRIER_TIMEOUT_SECONDS = 2
API_PORT = 8080
SECRET_KEY = "dev-secret-change-me"  # FIXME: load from environment before go-live
PY
cat > intake/store.py <<'PY'
import sqlite3
from pathlib import Path

from intake import settings

SCHEMA = """
CREATE TABLE IF NOT EXISTS parcels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tracking_code TEXT NOT NULL UNIQUE,
    warehouse TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)
"""


def connect(path=None):
    path = path or settings.DB_PATH
    if path != ":memory:":
        Path(path).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.execute(SCHEMA)
    return conn


def save_parcel(conn, tracking_code, warehouse):
    with conn:
        cur = conn.execute(
            "INSERT INTO parcels (tracking_code, warehouse) VALUES (?, ?)",
            (tracking_code, warehouse),
        )
    return cur.lastrowid


def list_pending(conn, warehouse):
    rows = conn.execute(
        "SELECT tracking_code FROM parcels WHERE warehouse = ? AND status = 'pending' ORDER BY id",
        (warehouse,),
    )
    return [row[0] for row in rows]
PY
cat > intake/api.py <<'PY'
import json
import urllib.request
from http.server import BaseHTTPRequestHandler, HTTPServer

from intake import settings, store


def notify_carrier(tracking_code):
    body = json.dumps({"tracking_code": tracking_code}).encode()
    request = urllib.request.Request(
        settings.CARRIER_WEBHOOK_URL, data=body, headers={"Content-Type": "application/json"}
    )
    urllib.request.urlopen(request, timeout=settings.CARRIER_TIMEOUT_SECONDS)


class IntakeHandler(BaseHTTPRequestHandler):
    conn = None

    def do_POST(self):
        if self.path != "/parcels":
            self.send_error(404)
            return
        length = int(self.headers.get("Content-Length", 0))
        payload = json.loads(self.rfile.read(length) or b"{}")
        parcel_id = store.save_parcel(self.conn, payload["tracking_code"], payload["warehouse"])
        notify_carrier(payload["tracking_code"])
        self.send_response(201)
        self.end_headers()
        self.wfile.write(json.dumps({"id": parcel_id}).encode())


def main():
    IntakeHandler.conn = store.connect()
    HTTPServer(("0.0.0.0", settings.API_PORT), IntakeHandler).serve_forever()


if __name__ == "__main__":
    main()
PY
: > tests/__init__.py
cat > tests/test_store.py <<'PY'
import unittest

from intake import store


class StoreTest(unittest.TestCase):
    def test_pending_parcels_are_listed_per_warehouse(self):
        conn = store.connect(":memory:")
        store.save_parcel(conn, "TRK-1", "north")
        store.save_parcel(conn, "TRK-2", "south")
        self.assertEqual(store.list_pending(conn, "north"), ["TRK-1"])


if __name__ == "__main__":
    unittest.main()
PY
cat > docs/product/intake-requirements.md <<'MD'
# Parcel intake requirements

Owner: Product (Mia Chen). Status: committed for the 2027 regional rollout.

- **PR-1** Couriers register a parcel through the intake API and receive its id.
- **PR-2** Once the API has confirmed a parcel (HTTP 201), that registration must not be lost.
- **PR-3** Warehouse staff list pending parcels for their own warehouse.
- **PR-4** The carrier is notified of every newly registered parcel.
- **PR-5** In 2027 intake serves four regional warehouses instead of one.
MD
cat > docs/runbook.md <<'MD'
# Intake runbook

Parcels are stored in PostgreSQL (`intake-db` cluster) with nightly pg_dump backups kept for 30 days.
The service comfortably handles 500 requests per second at peak.

Restart: `systemctl restart intake`.
MD
{
  echo "date,parcels_registered,peak_minute_requests"
  day=1
  for n in 1180 1215 1090 1302 1251 640 410 1199 1240 1175 1288 1320 702 455 1210 1263 1301 1194 1347 688 431 1244 1290 1312 3184 1402 730 470 1238 1269; do
    printf '2026-09-%02d,%d,%d\n' "$day" "$n" $(( n / 40 ))
    day=$((day + 1))
  done
} > ops/intake-volume-2026-09.csv
printf '# Parcel intake\n\nRun the API with `python3 -m intake.api`; run tests with `python3 -m unittest`.\n' > README.md
printf 'data/\n__pycache__/\n' > .gitignore
git add -A
git commit -q -m "Parcel intake service"

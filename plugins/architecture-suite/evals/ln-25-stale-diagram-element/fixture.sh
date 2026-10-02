#!/usr/bin/env bash
set -euo pipefail
git init -q -b main .
git config user.name "Eval Fixture"
git config user.email "fixture@example.invalid"
mkdir -p expenses tests docs/architecture/diagrams
: > expenses/__init__.py
cat > expenses/auth.py <<'PY'
import base64
import hashlib
import hmac
import os

SECRET = os.environ.get("EXPENSES_TOKEN_SECRET", "local-dev-secret").encode()


def issue_token(user_id):
    signature = hmac.new(SECRET, user_id.encode(), hashlib.sha256).hexdigest()
    return base64.urlsafe_b64encode(f"{user_id}:{signature}".encode()).decode()


def verify_token(token):
    """Return the user id for a valid bearer token, otherwise None."""
    try:
        user_id, signature = base64.urlsafe_b64decode(token.encode()).decode().split(":", 1)
    except ValueError:
        return None
    expected = hmac.new(SECRET, user_id.encode(), hashlib.sha256).hexdigest()
    if signature == expected:
        return user_id
    return None
PY
cat > expenses/ledger.py <<'PY'
import sqlite3


class Ledger:
    def __init__(self, path="expenses.sqlite3"):
        self.conn = sqlite3.connect(path, check_same_thread=False)
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS expenses (id INTEGER PRIMARY KEY, user_id TEXT, amount_eur TEXT, note TEXT)"
        )

    def add(self, user_id, amount_eur, note):
        with self.conn:
            self.conn.execute(
                "INSERT INTO expenses (user_id, amount_eur, note) VALUES (?, ?, ?)",
                (user_id, str(amount_eur), note),
            )

    def for_user(self, user_id):
        return self.conn.execute(
            "SELECT amount_eur, note FROM expenses WHERE user_id = ? ORDER BY id", (user_id,)
        ).fetchall()
PY
cat > expenses/fx_rates.py <<'PY'
import json
import urllib.request
from decimal import Decimal

FX_API_URL = "https://api.frankfurter.app/latest"


def to_eur(amount, currency):
    if currency == "EUR":
        return Decimal(str(amount))
    with urllib.request.urlopen(f"{FX_API_URL}?from={currency}&to=EUR", timeout=5) as response:
        rate = Decimal(str(json.load(response)["rates"]["EUR"]))
    return (Decimal(str(amount)) * rate).quantize(Decimal("0.01"))
PY
cat > expenses/export.py <<'PY'
import csv
from pathlib import Path

EXPORT_DIR = Path("exports")


def export_user_csv(ledger, user_id):
    EXPORT_DIR.mkdir(exist_ok=True)
    target = EXPORT_DIR / f"{user_id}.csv"
    with target.open("w", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["amount_eur", "note"])
        writer.writerows(ledger.for_user(user_id))
    return target
PY
cat > expenses/app.py <<'PY'
import json
from wsgiref.simple_server import make_server

from expenses import auth, export, fx_rates
from expenses.ledger import Ledger

LEDGER = Ledger()


def app(environ, start_response):
    header = environ.get("HTTP_AUTHORIZATION", "")
    user_id = auth.verify_token(header.removeprefix("Bearer ")) if header else None
    if user_id is None:
        start_response("401 Unauthorized", [("Content-Type", "application/json")])
        return [b'{"error": "unauthorized"}']
    path, method = environ.get("PATH_INFO", ""), environ.get("REQUEST_METHOD", "GET")
    if method == "POST" and path == "/expenses":
        body = json.loads(environ["wsgi.input"].read(int(environ.get("CONTENT_LENGTH") or 0)))
        LEDGER.add(user_id, fx_rates.to_eur(body["amount"], body["currency"]), body.get("note", ""))
        start_response("201 Created", [("Content-Type", "application/json")])
        return [b"{}"]
    if method == "POST" and path == "/exports":
        target = export.export_user_csv(LEDGER, user_id)
        start_response("201 Created", [("Content-Type", "application/json")])
        return [json.dumps({"file": str(target)}).encode()]
    start_response("404 Not Found", [("Content-Type", "application/json")])
    return [b"{}"]


if __name__ == "__main__":
    make_server("0.0.0.0", 8000, app).serve_forever()
PY
: > tests/__init__.py
cat > tests/test_auth.py <<'PY'
import unittest

from expenses import auth


class AuthTest(unittest.TestCase):
    def test_issued_token_verifies(self):
        self.assertEqual(auth.verify_token(auth.issue_token("u1")), "u1")

    def test_tampered_token_is_rejected(self):
        self.assertIsNone(auth.verify_token("dTE6YmFk"))


if __name__ == "__main__":
    unittest.main()
PY
cat > docs/architecture/diagrams/context.md <<'MD'
# Expense tracker: system context (2024)

```mermaid
flowchart LR
  User[Employee browser] -->|HTTPS| API[Expense API]
  API -->|validate token, gRPC| AuthService[Auth Service (Go)]
  API -->|SQL| DB[(PostgreSQL)]
  API -->|expense.created| Kafka[[Kafka]]
```
MD
printf '# Expense tracker\n\nRun `python -m expenses.app`; run tests with `python -m unittest`.\n' > README.md
printf '__pycache__/\n*.sqlite3\nexports/\n' > .gitignore
git add -A
git commit -q -m "Expense tracker"

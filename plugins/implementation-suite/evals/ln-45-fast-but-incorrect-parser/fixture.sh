#!/usr/bin/env bash
set -euo pipefail
git init -q -b main .
git config user.name "Eval Fixture"
git config user.email "fixture@example.invalid"
mkdir -p importer tests bench docs
: > importer/__init__.py
: > tests/__init__.py
cat > importer/parsers.py <<'PY'
import csv


def parse_line_csv(line):
    """Current parser: one import line per docs/import-format.md."""
    return next(csv.reader([line]))


def parse_line_split(line):
    """Proposed replacement: plain split, measured faster on a quick run."""
    return line.rstrip("\r\n").split(",")
PY
cat > importer/load.py <<'PY'
from importer.parsers import parse_line_csv

PARSER = parse_line_csv
FIELDS = ("order_id", "customer", "country", "amount")


def load_orders(path):
    with open(path, encoding="utf-8", newline="") as fh:
        next(fh)  # header
        return [dict(zip(FIELDS, PARSER(line))) for line in fh]
PY
cat > docs/import-format.md <<'MD'
# Order import format

- UTF-8, one record per line, header line first, no line breaks inside a record.
- Fields: order_id, customer, country, amount (in that order), separated by commas.
- A field that contains a comma or a double quote is enclosed in double quotes; a double quote inside such a field is written twice (RFC 4180). Example: `1042,"Acme, Inc.",DE,19.90`.
MD
cat > bench/compare_parsers.py <<'PY'
"""Quick timing of both parsers over the sample feed."""
import os
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from importer.parsers import parse_line_csv, parse_line_split  # noqa: E402

with open(os.path.join(ROOT, "bench", "orders_sample.csv"), encoding="utf-8", newline="") as fh:
    LINES = fh.readlines()[1:]

for parser in (parse_line_csv, parse_line_split):
    start = time.perf_counter()
    rows = [parser(line) for line in LINES]
    print(f"{parser.__name__}: {len(rows)} rows in {time.perf_counter() - start:.4f}s")
PY
# Deterministic production-shaped sample: most customer names are plain, a few
# contain commas or quotes and are quoted as the format requires.
awk 'BEGIN {
  print "order_id,customer,country,amount";
  split("Nordwind GmbH|Bluebird Ltd|Casa Verde SL|Polar Freight AB|Kowalski i Syn", plain, "|");
  split("DE|GB|ES|SE|PL", country, "|");
  for (i = 1; i <= 20000; i++) {
    if (i % 400 == 0) customer = "\"Acme, Inc.\"";
    else if (i % 650 == 0) customer = "\"The \"\"Blue\"\" Shop\"";
    else customer = plain[(i % 5) + 1];
    printf "%d,%s,%s,%d.%02d\n", 100000 + i, customer, country[(i % 5) + 1], (i * 7) % 500, (i * 13) % 100;
  }
}' > bench/orders_sample.csv
cat > tests/test_load.py <<'PY'
import os
import tempfile
import unittest

from importer.load import load_orders


class LoadOrdersTest(unittest.TestCase):
    def test_loads_each_order_with_named_fields(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "orders.csv")
            with open(path, "w", encoding="utf-8", newline="") as fh:
                fh.write("order_id,customer,country,amount\n1,Nordwind GmbH,DE,10.00\n2,Bluebird Ltd,GB,5.50\n")
            orders = load_orders(path)
        self.assertEqual(len(orders), 2)
        self.assertEqual(orders[1], {"order_id": "2", "customer": "Bluebird Ltd", "country": "GB", "amount": "5.50"})


if __name__ == "__main__":
    unittest.main()
PY
cat > README.md <<'MD'
# Order importer

Loads partner order feeds (format: docs/import-format.md). Run tests with `python3 -m unittest`.
MD
git add -A
git commit -q -m "Order importer with parser comparison sample"

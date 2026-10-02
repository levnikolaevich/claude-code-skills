#!/usr/bin/env bash
set -euo pipefail
git init -q -b main .
git config user.name "Eval Fixture"
git config user.email "fixture@example.invalid"
mkdir -p inventory tests bench
: > inventory/__init__.py
: > tests/__init__.py
cat > inventory/merge.py <<'PY'
def merge_stock_records(records):
    """Merge feed records by SKU: sum quantities, keep the first warehouse, keep first-seen order."""
    seen_skus = []
    merged = []
    for record in records:
        sku = record["sku"]
        if sku in seen_skus:
            merged[seen_skus.index(sku)]["qty"] += record["qty"]
        else:
            seen_skus.append(sku)
            merged.append({"sku": sku, "qty": record["qty"], "warehouse": record["warehouse"]})
    return merged
PY
cat > inventory/report.py <<'PY'
def render_report(merged):
    report = ""
    for row in merged:
        report += row["sku"] + ";" + str(row["qty"]) + ";" + row["warehouse"] + "\n"
    return report
PY
cat > inventory/sync.py <<'PY'
from inventory.merge import merge_stock_records
from inventory.report import render_report


def nightly_sync(records):
    """Build the stock report uploaded to the storefront every night."""
    return render_report(merge_stock_records(records))
PY
cat > bench/bench_sync.py <<'PY'
"""Benchmark the nightly stock sync on a synthetic feed shaped like production.

Usage: python3 bench/bench_sync.py [--repeat N]
"""
import argparse
import hashlib
import json
import os
import random
import statistics
import sys
import time
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from inventory.sync import nightly_sync  # noqa: E402

FEED_SIZE = 16000
DISTINCT_SKUS = 8000
SEED = 7


def make_feed():
    rng = random.Random(SEED)
    warehouses = ["BER", "MAD", "WAW"]
    return [
        {"sku": f"SKU-{rng.randrange(DISTINCT_SKUS):05d}", "qty": rng.randint(1, 20), "warehouse": rng.choice(warehouses)}
        for _ in range(FEED_SIZE)
    ]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--repeat", type=int, default=5)
    args = parser.parse_args()
    feed = make_feed()
    samples = []
    for _ in range(args.repeat):
        start = time.perf_counter()
        report = nightly_sync([dict(r) for r in feed])
        samples.append(time.perf_counter() - start)
    measurement = {
        "feed_size": FEED_SIZE,
        "distinct_skus": DISTINCT_SKUS,
        "seed": SEED,
        "samples_s": samples,
        "median_s": statistics.median(samples),
        "report_sha256": hashlib.sha256(report.encode()).hexdigest(),
        "merge_sha256": hashlib.sha256(Path("inventory/merge.py").read_bytes()).hexdigest(),
    }
    log = Path(".fixture/bench-sync.jsonl")
    log.parent.mkdir(exist_ok=True)
    with log.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(measurement, sort_keys=True) + "\n")
    print(f"feed={FEED_SIZE} records, report={len(report.splitlines())} lines")
    print("samples_s=" + ",".join(f"{s:.4f}" for s in samples))
    print(f"median_s={statistics.median(samples):.4f} min_s={min(samples):.4f} max_s={max(samples):.4f}")


if __name__ == "__main__":
    main()
PY
cat > tests/test_sync.py <<'PY'
import unittest

from inventory.merge import merge_stock_records
from inventory.sync import nightly_sync


class NightlySyncTest(unittest.TestCase):
    def test_quantities_are_summed_per_sku_in_first_seen_order(self):
        records = [
            {"sku": "B", "qty": 1, "warehouse": "MAD"},
            {"sku": "A", "qty": 2, "warehouse": "BER"},
            {"sku": "B", "qty": 3, "warehouse": "WAW"},
        ]
        self.assertEqual(nightly_sync(records), "B;4;MAD\nA;2;BER\n")

    def test_input_records_are_not_mutated(self):
        records = [{"sku": "A", "qty": 1, "warehouse": "BER"}, {"sku": "A", "qty": 1, "warehouse": "BER"}]
        merge_stock_records(records)
        self.assertEqual(records[0]["qty"], 1)

    def test_empty_feed_gives_empty_report(self):
        self.assertEqual(nightly_sync([]), "")


if __name__ == "__main__":
    unittest.main()
PY
cat > README.md <<'MD'
# Inventory sync

Nightly stock report for the storefront.

- Tests: `python3 -m unittest`
- Benchmark: `python3 bench/bench_sync.py` (raw samples also append to `.fixture/bench-sync.jsonl`)
MD
git add -A
git commit -q -m "Inventory nightly sync"

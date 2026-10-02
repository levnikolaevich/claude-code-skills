#!/usr/bin/env bash
set -euo pipefail
git init -q -b main .
git config user.name "Eval Fixture"
git config user.email "fixture@example.invalid"
mkdir -p reports tests notes
: > reports/__init__.py
: > tests/__init__.py
cat > reports/export.py <<'PY'
from decimal import Decimal


def build_rows(orders):
    """Flatten orders into report rows sorted by order date."""
    rows = [
        {
            "order_id": order["id"],
            "placed_on": order["placed_on"],
            "customer": order["customer"],
            "total": Decimal(order["total"]),
        }
        for order in orders
    ]
    return sorted(rows, key=lambda row: row["placed_on"])
PY
cat > reports/audit.py <<'PY'
class AuditLog:
    def __init__(self):
        self.entries = []

    def record(self, action, user_id, **details):
        self.entries.append({"action": action, "user_id": user_id, **details})
PY
cat > tests/test_export.py <<'PY'
import unittest
from datetime import date

from reports.export import build_rows


class ExportTest(unittest.TestCase):
    def test_rows_sorted_by_date(self):
        orders = [
            {"id": 2, "placed_on": date(2026, 9, 2), "customer": "B", "total": "5.00"},
            {"id": 1, "placed_on": date(2026, 9, 1), "customer": "A", "total": "3.50"},
        ]
        self.assertEqual([row["order_id"] for row in build_rows(orders)], [1, 2])


if __name__ == "__main__":
    unittest.main()
PY
printf '# Reports\n\nRun tests with `python3 -m unittest`.\n' > README.md
git add -A
git commit -q -m "Initial order report rows"
baseline=$(git rev-parse --short HEAD)

cat > notes/plan-continuation.md <<MD
# Continuation record: order report export plan

- Skill: ln-31-delivery-plan-builder
- Verdict: REVISE (open question Q1)
- Source baseline: commit ${baseline}, clean working tree
- Authorization: planning only. Implementation, tracker updates and pushes are not authorized.
- Plan approval: Dana (finance lead) approved U1-U4 below for RPT-201..RPT-203 as written.

## Requirements

- RPT-201: Finance users filter the order report by an inclusive date range.
- RPT-202: Finance users download the filtered report as CSV and as JSON.
- RPT-203: Every report download is recorded in the audit log with the user id and the filters used.

## Work units

- U1 (RPT-201): add optional \`start\`/\`end\` parameters to \`build_rows\` in reports/export.py; inclusive on both bounds. Check: orders on both boundary dates are included, one day outside is excluded.
- U2 (RPT-202): add \`render_csv(rows)\` in reports/export.py using the csv module. Check: header order order_id, placed_on, customer, total; customer names with commas are quoted.
- U3 (RPT-202): add \`render_json(rows)\` in reports/export.py. Check: ISO dates and totals as decimal strings.
- U4 (RPT-202, RPT-203): add \`download_report(user_id, fmt, start, end, orders, audit)\` in new reports/api.py; dispatch fmt to U2/U3; call \`AuditLog.record("report.download", user_id, start=..., end=..., fmt=...)\`. Check: one download returns the rendered body and adds exactly one audit entry with the filters.

Order: U1 -> U2 and U3 in parallel -> U4.

## Open question

- Q1: Does finance still need JSON, or is CSV enough? Answer changes U3 and U4.

## Next step

Settle Q1, then re-confirm the plan and start implementation with U1.
MD

cat > reports/export.py <<'PY'
from decimal import Decimal


def collect_rows(orders):
    """Flatten orders into report rows sorted by order date."""
    rows = [
        {
            "order_id": order["id"],
            "placed_on": order["placed_on"],
            "customer": order["customer"],
            "total": Decimal(order["total"]),
        }
        for order in orders
    ]
    return sorted(rows, key=lambda row: row["placed_on"])
PY
sed 's/build_rows/collect_rows/g' tests/test_export.py > tests/test_export.py.new
mv tests/test_export.py.new tests/test_export.py
git add reports tests
git commit -q -m "Rename build_rows to collect_rows"

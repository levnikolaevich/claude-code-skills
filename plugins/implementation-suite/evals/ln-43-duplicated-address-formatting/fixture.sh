#!/usr/bin/env bash
set -euo pipefail
git init -q -b main .
git config user.name "Eval Fixture"
git config user.email "fixture@example.invalid"
mkdir -p shipping tests
: > shipping/__init__.py
: > tests/__init__.py

# write_renderer FILE FUNCTION TITLE POSTCODE_EXPR COUNTRY_EXPR
write_renderer() {
  cat > "$1" <<PY
def _format_address(address):
    lines = [address["name"].strip(), address["street"].strip()]
    postcode = $4
    lines.append(f"{postcode} {address['city'].strip().upper()}")
    lines.append($5)
    return "\n".join(lines)


def $2(order):
    return "\n".join([
        "$3 #" + order["id"],
        _format_address(order["address"]),
$6
    ])
PY
}
LABEL_BODY='        "Parcels: " + str(order["parcels"]),'
INVOICE_BODY='        "Amount due: " + format(order["amount"], ".2f") + " EUR",'
SLIP_BODY='        "Items: " + ", ".join(order["items"]),'

render_all() {
  write_renderer shipping/labels.py render_label "SHIPPING LABEL" "$1" "$2" "$LABEL_BODY"
  write_renderer shipping/invoices.py render_invoice "INVOICE" "$1" "$2" "$INVOICE_BODY"
  write_renderer shipping/packing_slips.py render_packing_slip "PACKING SLIP" "$1" "$2" "$SLIP_BODY"
}

cat > shipping/legacy_export.py <<'PY'
# Nightly CSV export consumed by the warehouse partner. Format frozen by contract.
import sys


def export_orders(orders, path):
    out = open(path, "w")
    for i in range(len(orders)):
        order = orders[i]
        address = order["address"]
        out.write("%s;%s;%s;%s\n" % (order["id"], address["name"], address["postcode"], address["country"]))
    out.close()


if __name__ == "__main__":
    export_orders([], sys.argv[1])
PY
cat > README.md <<'MD'
# Shipping documents

Renders shipping labels, invoices and packing slips. Run tests with `python3 -m unittest`.
MD

render_all 'address["postcode"].strip()' 'address["country"].strip()'
git add -A
git commit -q -m "Shipping document renderers"

render_all 'address["postcode"].replace(" ", "").upper()' 'address["country"].strip()'
git add shipping/labels.py
git commit -q -m "fix(labels): normalize postcode spacing and case (SHIP-41)"
git add shipping/invoices.py
git commit -q -m "fix(invoices): normalize postcode spacing and case, missed in SHIP-41 (SHIP-44)"
git add shipping/packing_slips.py
git commit -q -m "fix(packing): normalize postcode spacing and case, missed in SHIP-41 and SHIP-44 (SHIP-47)"

render_all 'address["postcode"].replace(" ", "").upper()' 'address["country"].strip().upper()'
git add shipping/invoices.py
git commit -q -m "fix(invoices): print country in upper case (SHIP-52)"
git add shipping/labels.py
git commit -q -m "fix(labels): print country in upper case, missed in SHIP-52 (SHIP-55)"
git add shipping/packing_slips.py
git commit -q -m "fix(packing): print country in upper case, missed in SHIP-52 (SHIP-58)"

cat > tests/test_documents.py <<'PY'
import unittest

from shipping.invoices import render_invoice
from shipping.labels import render_label
from shipping.packing_slips import render_packing_slip

ORDER = {
    "id": "A-1001",
    "parcels": 2,
    "amount": 42.5,
    "items": ["lamp", "bulb"],
    "address": {
        "name": " Ada Lovelace ",
        "street": "12 St James's Square ",
        "postcode": "sw1y 4lb",
        "city": " london",
        "country": "gb ",
    },
}
ADDRESS = "Ada Lovelace\n12 St James's Square\nSW1Y4LB LONDON\nGB"


class DocumentsTest(unittest.TestCase):
    def test_label(self):
        self.assertEqual(render_label(ORDER), "SHIPPING LABEL #A-1001\n" + ADDRESS + "\nParcels: 2")

    def test_invoice(self):
        self.assertEqual(render_invoice(ORDER), "INVOICE #A-1001\n" + ADDRESS + "\nAmount due: 42.50 EUR")

    def test_packing_slip(self):
        self.assertEqual(render_packing_slip(ORDER), "PACKING SLIP #A-1001\n" + ADDRESS + "\nItems: lamp, bulb")


if __name__ == "__main__":
    unittest.main()
PY
git add -A
git commit -q -m "test: golden documents"

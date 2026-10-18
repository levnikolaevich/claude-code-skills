#!/usr/bin/env bash
set -euo pipefail
git init -q -b main .
git config user.name "Eval Fixture"
git config user.email "fixture@example.invalid"
mkdir -p domain
cat > domain/__init__.py <<'FIXTURE_CONTENT'
FIXTURE_CONTENT
mkdir -p domain
cat > domain/pricing.py <<'FIXTURE_CONTENT'
def subtotal(lines):
    return sum(price_cents * quantity for price_cents, quantity in lines)
FIXTURE_CONTENT
mkdir -p .
cat > api.py <<'FIXTURE_CONTENT'
from domain.pricing import subtotal

def quote(lines, percent):
    gross = subtotal(lines)
    return gross - gross * percent // 100
FIXTURE_CONTENT
mkdir -p .
cat > batch.py <<'FIXTURE_CONTENT'
from domain.pricing import subtotal

def invoice(lines, percent):
    return round(subtotal(lines) * (100 - percent) / 100)
FIXTURE_CONTENT
mkdir -p .
cat > README.md <<'FIXTURE_CONTENT'
# Checkout

API checkout and batch invoices share the same pricing policy. Values are integer cents. Apply the percentage to the whole subtotal, then round half-up to cents. Quantities participate in the subtotal. Zero/full discounts are supported. Domain pricing owns monetary policy; adapters may only translate inputs/outputs. Preserve public quote(lines, percent) and invoice(lines, percent).

Run python checks/verify.py without modifying that supplied acceptance check.
FIXTURE_CONTENT
mkdir -p checks
cat > checks/verify.py <<'FIXTURE_CONTENT'
import json
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from api import quote
from batch import invoice

cases = [([(16, 1)], 10, 14), ([(25, 1)], 50, 13), ([(15, 3)], 10, 41), ([(9, 2)], 0, 18), ([(9, 2)], 100, 0)]
observed = {name: [fn(lines, percent) for lines, percent, _ in cases] for name, fn in [('api', quote), ('batch', invoice)]}
expected = [expected for _, _, expected in cases]
Path('results').mkdir(exist_ok=True)
Path('results/pricing.json').write_text(json.dumps(observed, sort_keys=True) + '\n')
assert observed == {'api': expected, 'batch': expected}, observed
print(json.dumps(observed, sort_keys=True))
FIXTURE_CONTENT
git add -A
git commit -q -m "Initial isolated fixture"

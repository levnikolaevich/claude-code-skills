#!/usr/bin/env bash
set -euo pipefail
git init -q -b main .
git config user.name "Eval Fixture"
git config user.email "fixture@example.invalid"
mkdir -p .
cat > operation.py <<'FIXTURE_CONTENT'
def charge(state, key, amount):
    state["balance"] -= amount
    state["results"][key] = {"amount": amount, "result": state["balance"]}
    return state["balance"]
FIXTURE_CONTENT
mkdir -p .
cat > policy.md <<'FIXTURE_CONTENT'
This single-threaded in-memory fixture represents a committed authoritative state. Matching key/amount replays return the prior result without charging again; changed amount with same key raises ValueError. It does not demonstrate production durability or concurrent transaction safety.
FIXTURE_CONTENT
mkdir -p checks
cat > checks/verify.py <<'FIXTURE_CONTENT'
import json
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from operation import charge
state={"balance":100,"results":{}}
first=charge(state,"op-1",7)
second=charge(state,"op-1",7)
try:
    charge(state,"op-1",9)
    mismatch="accepted"
except ValueError:
    mismatch="rejected"
observed={"balance":state["balance"],"first":first,"second":second,"mismatch":mismatch}
expected={"balance":93,"first":93,"second":93,"mismatch":"rejected"}
Path("results").mkdir(exist_ok=True)
Path("results/acceptance.json").write_text(json.dumps(observed, sort_keys=True)+"\n")
assert observed == expected, (observed, expected)
FIXTURE_CONTENT
git add -A
git commit -q -m "Initial isolated fixture"
